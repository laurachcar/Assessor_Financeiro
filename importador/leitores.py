"""Leitores de extrato e fatura. Cada leitor devolve uma lista de Transacao.

Convenção de sinal de saída: valor NEGATIVO = dinheiro saindo; POSITIVO = entrando.
Faturas de cartão em CSV costumam vir com a compra positiva; o leitor inverte.
"""
import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from .normalizar import valor_decimal


@dataclass
class Transacao:
    data: date
    descricao: str
    valor: Decimal            # negativo = saída
    parcela: str = ""         # 'n/N' ou ''
    origem: str = "csv"
    extras: dict = field(default_factory=dict)


# ---------------------------------------------------------------- datas

def ler_data(bruto: str) -> date:
    s = str(bruto or "").strip()[:19]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y", "%Y%m%d", "%d-%m-%Y", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            return datetime.strptime(s if fmt != "%Y%m%d" else s[:8], fmt).date()
        except ValueError:
            continue
    raise ValueError(f"data inválida: {bruto!r}")


# 'Parcela 2/5', 'Parcela 2 de 5' em qualquer lugar; '2/5' solto só no fim (para não confundir com datas como 05/11)
_PARCELA_ROTULO = re.compile(r"parcela\s*(\d{1,2})\s*(?:/|de)\s*(\d{1,2})", re.I)
_PARCELA_FIM = re.compile(r"\b(\d{1,2})\s*/\s*(\d{1,2})\s*$")


def extrair_parcela(texto: str):
    """Tira a parcela da descrição. Devolve (descrição limpa, 'n/N')."""
    s = str(texto or "")
    m = _PARCELA_ROTULO.search(s) or _PARCELA_FIM.search(s)
    if not m:
        return s.strip(), ""
    n, total = int(m.group(1)), int(m.group(2))
    if not (1 <= n <= total <= 48):
        return s.strip(), ""
    limpa = (s[:m.start()] + s[m.end():]).strip(" -–|")
    return re.sub(r"\s{2,}", " ", limpa).strip(), f"{n}/{total}"


# ---------------------------------------------------------------- OFX

def ler_ofx(texto: str) -> list:
    """OFX (bancos e cartões). Em OFX, débitos já vêm negativos."""
    out = []
    for bloco in re.findall(r"<STMTTRN>(.*?)(?:</STMTTRN>|(?=<STMTTRN>)|(?=</BANKTRANLIST>))", texto, re.S | re.I):
        def tag(nome):
            m = re.search(rf"<{nome}>([^<\r\n]*)", bloco, re.I)
            return m.group(1).strip() if m else ""
        desc = tag("MEMO") or tag("NAME")
        if tag("NAME") and tag("MEMO") and tag("NAME").lower() not in tag("MEMO").lower():
            desc = f"{tag('NAME')} {tag('MEMO')}"
        desc, parcela = extrair_parcela(desc)
        out.append(Transacao(data=ler_data(tag("DTPOSTED")[:8]), descricao=desc, valor=valor_decimal(tag("TRNAMT")),
                             parcela=parcela, origem="ofx"))
    return out


# ---------------------------------------------------------------- CSV

SINONIMOS = {
    "data": ["data", "date", "data de compra", "data lancamento", "data lançamento", "data da compra", "dt"],
    "descricao": ["descricao", "descrição", "title", "historico", "histórico", "lancamento", "lançamento",
                  "estabelecimento", "description", "memo"],
    "valor": ["valor (em r$)", "valor", "amount", "valor r$", "valor (r$)", "quantia"],
    "parcela": ["parcela", "parcelas", "installment"],
}


def _mapear_colunas(cab):
    norm = [str(c or "").strip().lower() for c in cab]
    mapa = {}
    for campo, nomes in SINONIMOS.items():
        for nome in nomes:  # ordem dos sinônimos = prioridade
            if nome in norm:
                mapa[campo] = norm.index(nome)
                break
    return mapa


def detectar_formato(cab) -> str:
    """'cartao' quando a compra vem positiva (faturas); 'conta' quando o valor já vem com sinal."""
    norm = [str(c or "").strip().lower() for c in cab]
    if norm[:3] == ["date", "title", "amount"]:                      # Nubank cartão
        return "cartao"
    if any("final do cart" in c or "nome no cart" in c for c in norm):  # C6 e outros cartões
        return "cartao"
    return "conta"


def ler_csv(texto: str, formato: str = "auto") -> list:
    """CSV de banco ou cartão. formato: 'auto', 'cartao' ou 'conta'."""
    amostra = texto[:2000]
    delim = ";" if amostra.count(";") > amostra.count(",") else ","
    linhas = [l for l in csv.reader(io.StringIO(texto.lstrip("﻿")), delimiter=delim) if any(c.strip() for c in l)]
    if not linhas:
        return []
    # o cabeçalho é a primeira linha que tem data, descrição e valor
    for i, l in enumerate(linhas[:15]):
        mapa = _mapear_colunas(l)
        if {"data", "descricao", "valor"} <= set(mapa):
            cab, corpo = l, linhas[i + 1:]
            break
    else:
        raise ValueError("Não encontrei colunas de data, descrição e valor no CSV.")
    if formato == "auto":
        formato = detectar_formato(cab)

    out = []
    for l in corpo:
        try:
            d = ler_data(l[mapa["data"]])
            v = valor_decimal(l[mapa["valor"]])
        except (ValueError, IndexError):
            continue  # linhas de total, saldo, rodapé
        desc = l[mapa["descricao"]].strip()
        parcela = ""
        if "parcela" in mapa and mapa["parcela"] < len(l):
            p = l[mapa["parcela"]].strip()
            m = re.match(r"^(\d{1,2})\s*(?:/|de)\s*(\d{1,2})$", p, re.I)
            parcela = f"{int(m.group(1))}/{int(m.group(2))}" if m else ""
        if not parcela:
            desc, parcela = extrair_parcela(desc)
        if formato == "cartao":
            v = -v  # compra positiva na fatura = saída
        out.append(Transacao(data=d, descricao=desc, valor=v, parcela=parcela, origem="csv"))
    return out


def ler_arquivo(caminho: str, formato: str = "auto") -> list:
    with open(caminho, "rb") as f:
        bruto = f.read()
    for enc in ("utf-8-sig", "latin-1"):
        try:
            texto = bruto.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if caminho.lower().endswith(".ofx") or "<OFX>" in texto.upper()[:5000]:
        return ler_ofx(texto)
    return ler_csv(texto, formato)
