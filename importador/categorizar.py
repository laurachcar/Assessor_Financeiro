"""Sugestão de tipo, categoria e centro de custo.

Ordem de decisão:
 1. Regras da aba Regras_Categoria (as suas correções viram regras) → confiança alta
 2. Padrões embutidos abaixo (comuns no Brasil) → confiança média
 3. Nada encontrado → sem categoria, centro "A definir", confiança baixa (você decide na revisão)

Só sugere categorias que existem na aba Categorias, quando a lista é informada.
"""
import csv
import re
from dataclasses import dataclass

from .normalizar import normalizar

# palavra-chave (normalizada) → (categoria, centro de custo)
PADROES = [
    ("pagamento de fatura", "Pagamento de fatura", "Pessoal"),
    ("pagamento recebido", "Pagamento de fatura", "Pessoal"),
    ("pagto fatura", "Pagamento de fatura", "Pessoal"),
    ("uber", "Transporte", "Pessoal"),
    ("99app", "Transporte", "Pessoal"),
    ("99 pop", "Transporte", "Pessoal"),
    ("posto", "Transporte", "Pessoal"),
    ("estacionamento", "Transporte", "Pessoal"),
    ("ifood", "Refeição", "Pessoal"),
    ("rappi", "Refeição", "Pessoal"),
    ("restaurante", "Refeição", "Pessoal"),
    ("padaria", "Mercado", "Pessoal"),
    ("carrefour", "Mercado", "Pessoal"),
    ("pao de acucar", "Mercado", "Pessoal"),
    ("supermercado", "Mercado", "Pessoal"),
    ("mercado", "Mercado", "Pessoal"),
    ("pet", "Pipa", "Pessoal"),
    ("cobasi", "Pipa", "Pessoal"),
    ("petz", "Pipa", "Pessoal"),
    ("farmacia", "Saúde", "Pessoal"),
    ("drogasil", "Saúde", "Pessoal"),
    ("droga raia", "Saúde", "Pessoal"),
    ("spotify", "Assinaturas", "Pessoal"),
    ("netflix", "Assinaturas", "Pessoal"),
    ("apple.com", "Assinaturas", "Pessoal"),
    ("google", "Empresa", "AX"),
    ("canva", "Empresa", "AX"),
    ("capcut", "Empresa", "AX"),
    ("iof", "Juros e tarifas", "Pessoal"),
    ("juros", "Juros e tarifas", "Pessoal"),
    ("anuidade", "Juros e tarifas", "Pessoal"),
    ("tarifa", "Juros e tarifas", "Pessoal"),
    ("das simples", "Impostos empresa", "AX"),
    ("condominio", "Casa", "Pessoal"),
    ("enel", "Casa", "Pessoal"),
    ("comgas", "Casa", "Pessoal"),
]


@dataclass
class Sugestao:
    tipo: str
    categoria: str
    centro: str
    confianca: str


def carregar_regras(caminho: str) -> list:
    """CSV com colunas: Palavra-chave, Categoria, Centro de custo (exportado da aba Regras_Categoria)."""
    if not caminho:
        return []
    regras = []
    with open(caminho, encoding="utf-8-sig") as f:
        for l in csv.DictReader(f):
            chave = normalizar(l.get("Palavra-chave", ""))
            if chave:
                regras.append((chave, l.get("Categoria", "").strip(), l.get("Centro de custo", "").strip() or "Pessoal"))
    return regras


def _contem(desc_norm, chave):
    # palavra inteira: "pet" casa com "pet fun", mas não com "competição"
    return re.search(r"(?<![a-z0-9])" + re.escape(chave) + r"(?![a-z0-9])", desc_norm) is not None


def _procurar(desc_norm, lista):
    # a palavra-chave mais longa que aparece ganha (mais específica)
    achados = [r for r in lista if r[0] and _contem(desc_norm, r[0])]
    return max(achados, key=lambda r: len(r[0])) if achados else None


def sugerir(descricao: str, valor, regras: list, categorias_validas=None, tipos_por_categoria=None) -> Sugestao:
    d = normalizar(descricao)
    tipo = "Saída" if valor < 0 else "Entrada"
    achado, conf = _procurar(d, regras), "alta"
    if not achado:
        achado, conf = _procurar(d, PADROES), "média"
    if achado and categorias_validas is not None and achado[1] not in categorias_validas:
        achado = None
    if not achado:
        return Sugestao(tipo=tipo, categoria="", centro="A definir", confianca="baixa")
    cat, centro = achado[1], achado[2]
    if cat == "Pagamento de fatura":
        tipo = "Transferência"
    elif tipos_por_categoria and tipos_por_categoria.get(cat) in ("Investimento", "Transferência"):
        tipo = tipos_por_categoria[cat]
    elif tipos_por_categoria and tipos_por_categoria.get(cat) in ("Entrada", "Saída") and tipos_por_categoria[cat] != tipo:
        # ex.: estorno de uma compra (valor positivo numa categoria de gasto): mantém Entrada, mas baixa a confiança
        conf = "baixa"
    return Sugestao(tipo=tipo, categoria=cat, centro=centro, confianca=conf)
