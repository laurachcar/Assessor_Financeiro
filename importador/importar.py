"""Importador de extratos e faturas → linhas da aba Import_Staging.

Uso:
  python3 -m importador.importar EXTRATO.csv [mais arquivos] --conta "Nubank" \
      [--regras regras.csv] [--categorias categorias.csv] [--existentes hashes.txt] \
      [--formato auto|cartao|conta] [--titular Laura] [--json] [--saida saida/staging.csv]

- Não gasta tokens: tudo é regra fixa.
- Nada vai direto para Lançamentos: as linhas entram na Import_Staging com "Aprovar" desmarcado.
- Números de cartão, conta ou documento são removidos da descrição antes de qualquer coisa.
- Duplicados (mesma data, valor e descrição) são descartados, comparando com --existentes e dentro do próprio lote.
"""
import argparse
import csv
import json
import os
import sys
import uuid
from datetime import datetime

from .categorizar import carregar_regras, sugerir
from .leitores import ler_arquivo
from .normalizar import dinheiro, hash_lancamento, limpar_sensivel, parece_sensivel

COLUNAS_STAGING = ["ID", "Data", "Competência", "Descrição", "Valor", "Tipo", "Categoria", "Centro de custo",
                   "Conta/Cartão", "Parcela", "Origem", "Titular", "Hash", "Confiança", "Aprovar"]


def carregar_categorias(caminho):
    """CSV exportado da aba Categorias. Devolve (conjunto de nomes, {nome: tipo})."""
    if not caminho:
        return None, None
    nomes, tipos = set(), {}
    with open(caminho, encoding="utf-8-sig") as f:
        for l in csv.DictReader(f):
            n = (l.get("Categoria") or "").strip()
            if n:
                nomes.add(n)
                tipos[n] = (l.get("Tipo") or "").strip()
    return nomes, tipos


def carregar_hashes(caminho):
    if not caminho or not os.path.exists(caminho):
        return set()
    with open(caminho, encoding="utf-8") as f:
        return {l.strip() for l in f if l.strip()}


def processar(arquivos, conta, titular="", formato="auto", regras=None, categorias=None, tipos=None, existentes=None):
    """Devolve (linhas como dicts, resumo)."""
    regras = regras or []
    existentes = set(existentes or ())
    vistos = set()
    linhas = []
    resumo = {"lidos": 0, "novos": 0, "duplicados_planilha": 0, "duplicados_lote": 0,
              "sem_categoria": 0, "numeros_removidos": 0, "arquivos": []}
    for arq in arquivos:
        trans = ler_arquivo(arq, formato)
        resumo["arquivos"].append({"arquivo": os.path.basename(arq), "transacoes": len(trans)})
        for t in trans:
            resumo["lidos"] += 1
            desc = t.descricao
            if parece_sensivel(desc):
                desc = limpar_sensivel(desc)
                resumo["numeros_removidos"] += 1
            h = hash_lancamento(t.data, t.valor, desc)
            if h in existentes:
                resumo["duplicados_planilha"] += 1
                continue
            if h in vistos:
                resumo["duplicados_lote"] += 1
                continue
            vistos.add(h)
            s = sugerir(desc, t.valor, regras, categorias, tipos)
            if not s.categoria:
                resumo["sem_categoria"] += 1
            linhas.append({
                "ID": uuid.uuid4().hex[:8],
                "Data": t.data,
                "Competência": t.data.strftime("%Y-%m"),
                "Descrição": desc,
                "Valor": abs(t.valor),
                "Tipo": s.tipo,
                "Categoria": s.categoria,
                "Centro de custo": s.centro,
                "Conta/Cartão": conta,
                "Parcela": t.parcela,
                "Origem": t.origem,
                "Titular": titular,
                "Hash": h,
                "Confiança": s.confianca,
                "Aprovar": False,
            })
            resumo["novos"] += 1
    linhas.sort(key=lambda l: (l["Data"], l["Descrição"]))
    return linhas, resumo


def para_planilha(linha):
    """Linha pronta para a API do Sheets (USER_ENTERED): data dd/mm/aaaa, valor número, demais texto."""
    out = []
    for c in COLUNAS_STAGING:
        v = linha[c]
        if c == "Data":
            v = v.strftime("%d/%m/%Y")
        elif c == "Valor":
            v = float(dinheiro(v))
        out.append(v)
    return out


def salvar_csv(linhas, caminho):
    """CSV no padrão brasileiro (; e vírgula decimal) para Arquivo > Importar no Google Planilhas."""
    os.makedirs(os.path.dirname(caminho) or ".", exist_ok=True)
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLUNAS_STAGING)
        for l in linhas:
            r = para_planilha(l)
            r[COLUNAS_STAGING.index("Valor")] = dinheiro(l["Valor"]).replace(".", ",")
            r[COLUNAS_STAGING.index("Aprovar")] = "FALSE"
            w.writerow(r)


def main(argv=None):
    p = argparse.ArgumentParser(description="Importa extratos e faturas para a aba Import_Staging.")
    p.add_argument("arquivos", nargs="+")
    p.add_argument("--conta", required=True, help='Apelido da conta ou cartão, ex.: "Nubank". Nunca o número.')
    p.add_argument("--titular", default="")
    p.add_argument("--formato", default="auto", choices=["auto", "cartao", "conta"])
    p.add_argument("--regras", help="CSV da aba Regras_Categoria")
    p.add_argument("--categorias", help="CSV da aba Categorias (para só sugerir categorias que existem)")
    p.add_argument("--existentes", help="Arquivo com um hash por linha (Lancamentos e Import_Staging)")
    p.add_argument("--saida", help="Caminho do CSV de saída")
    p.add_argument("--json", action="store_true", help="Imprime JSON com linhas prontas para a API do Sheets")
    a = p.parse_args(argv)

    if parece_sensivel(a.conta):
        p.error("--conta parece conter um número. Use só o apelido, ex.: Nubank.")

    nomes, tipos = carregar_categorias(a.categorias)
    linhas, resumo = processar(a.arquivos, a.conta, a.titular, a.formato, carregar_regras(a.regras),
                               nomes, tipos, carregar_hashes(a.existentes))

    if a.json:
        json.dump({"colunas": COLUNAS_STAGING, "linhas": [para_planilha(l) for l in linhas], "resumo": resumo},
                  sys.stdout, ensure_ascii=False, indent=1)
        print()
        return 0

    saida = a.saida or os.path.join("saida", f"staging_{datetime.now():%Y%m%d_%H%M%S}.csv")
    salvar_csv(linhas, saida)
    r = resumo
    print(f"{r['lidos']} lidos · {r['novos']} novos · {r['duplicados_planilha']} já estavam na planilha · "
          f"{r['duplicados_lote']} repetidos no arquivo · {r['sem_categoria']} sem categoria · "
          f"{r['numeros_removidos']} descrições com número removido")
    print(f"Arquivo: {saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
