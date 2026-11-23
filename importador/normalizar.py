"""Funções de normalização compartilhadas com o Apps Script.

O hash precisa dar EXATAMENTE o mesmo resultado que hashLancamento_() em src/01_Config.gs,
senão a planilha não reconhece duplicados. Há um teste que compara os dois.
"""
import hashlib
import re
import unicodedata
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

# 12 ou mais dígitos, aceitando espaço, ponto, traço ou barra entre eles
_SENSIVEL = re.compile(r"(?:\d[\s.\-/]?){11,}\d")


def normalizar(texto: str) -> str:
    """Igual a normalizar_() do Apps Script: minúsculas, sem acento, espaços simples."""
    s = unicodedata.normalize("NFD", str(texto or "").lower())
    s = "".join(ch for ch in s if not ("̀" <= ch <= "ͯ"))
    return re.sub(r"\s+", " ", s).strip()


def parece_sensivel(texto: str) -> bool:
    """Verdadeiro se houver algo que pareça número de cartão, conta ou documento."""
    return bool(_SENSIVEL.search(str(texto or "")))


def limpar_sensivel(texto: str) -> str:
    """Troca sequências longas de dígitos por [nº removido]. Nunca gravamos esses números."""
    return _SENSIVEL.sub("[nº removido]", str(texto or "")).strip()


def valor_decimal(bruto) -> Decimal:
    """Aceita 1234.5, '1.234,50', 'R$ -1.234,50', '-45,90', '(45.90)'. Lança ValueError se não for número."""
    if isinstance(bruto, (int, float, Decimal)):
        return Decimal(str(bruto))
    s = str(bruto or "").strip()
    negativo = s.startswith("(") and s.endswith(")")
    s = re.sub(r"[R$\s()]", "", s).replace("US", "")
    if not s:
        raise ValueError("valor vazio")
    if "," in s and "." in s:
        # o separador que aparece por último é o decimal
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        v = Decimal(s)
    except InvalidOperation as e:
        raise ValueError(f"valor inválido: {bruto!r}") from e
    return -v if negativo else v


def dinheiro(v: Decimal) -> str:
    """Duas casas, arredondando para cima no meio (como toFixed em valores de moeda)."""
    return str(Decimal(v).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def hash_lancamento(data: date, valor: Decimal, descricao: str) -> str:
    """Mesmo cálculo de hashLancamento_(): sha256('yyyy-MM-dd|valor|descrição normalizada'), 8 primeiros bytes em hex."""
    base = f"{data.isoformat()}|{dinheiro(abs(valor))}|{normalizar(descricao)}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:16]
