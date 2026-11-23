"""Testes do importador. Rodar: python3 -m unittest discover -s importador -p "test_*.py" (na raiz do repositório)."""
import os
import shutil
import subprocess
import sys
import unittest
from datetime import date
from decimal import Decimal

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

from importador.categorizar import sugerir  # noqa: E402
from importador.importar import processar, para_planilha  # noqa: E402
from importador.leitores import extrair_parcela, ler_arquivo  # noqa: E402
from importador.normalizar import hash_lancamento, limpar_sensivel, normalizar, parece_sensivel, valor_decimal  # noqa: E402

EX = os.path.join(AQUI, "exemplos")
CATS = {"Transporte": "Saída", "Refeição": "Saída", "Pipa": "Saída", "Assinaturas": "Saída", "Mercado": "Saída",
        "Casa": "Saída", "Empresa": "Saída", "Pagamento de fatura": "Transferência", "Salário": "Entrada"}


class TestNormalizar(unittest.TestCase):
    def test_valores_brasileiros_e_americanos(self):
        self.assertEqual(valor_decimal("1.234,56"), Decimal("1234.56"))
        self.assertEqual(valor_decimal("R$ -45,90"), Decimal("-45.90"))
        self.assertEqual(valor_decimal("1,234.56"), Decimal("1234.56"))
        self.assertEqual(valor_decimal("(10.00)"), Decimal("-10.00"))
        self.assertEqual(valor_decimal("89,90"), Decimal("89.90"))

    def test_normalizar_igual_ao_apps_script(self):
        self.assertEqual(normalizar("  Padaria   ÇÃO  Real "), "padaria cao real")

    def test_numero_sensivel(self):
        self.assertTrue(parece_sensivel("Compra 4111 1111 1111 1111"))
        self.assertTrue(parece_sensivel("conta 0001-2345678-9 000"))
        self.assertFalse(parece_sensivel("Uber Trip 2/5"))
        self.assertEqual(limpar_sensivel("Compra 4111111111111111 Loja"), "Compra [nº removido] Loja")

    @unittest.skipUnless(shutil.which("node"), "node não instalado")
    def test_hash_igual_ao_apps_script(self):
        """Roda a mesma conta do Apps Script (hashLancamento_) em Node e compara."""
        js = (
            "const c=require('crypto');"
            "const n=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim();"
            "const b='2026-11-12|'+Number(45.9).toFixed(2)+'|'+n('Padaria  Real ÇÃO');"
            "process.stdout.write(c.createHash('sha256').update(b,'utf8').digest('hex').slice(0,16));"
        )
        esperado = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
        self.assertEqual(hash_lancamento(date(2026, 11, 12), Decimal("-45.90"), "Padaria  Real ÇÃO"), esperado)


class TestLeitores(unittest.TestCase):
    def test_parcela(self):
        self.assertEqual(extrair_parcela("Loja de Moveis - Parcela 2/5"), ("Loja de Moveis", "2/5"))
        self.assertEqual(extrair_parcela("Show em 05/11 Ingresso"), ("Show em 05/11 Ingresso", ""))
        self.assertEqual(extrair_parcela("Notebook 3/10"), ("Notebook", "3/10"))

    def test_nubank_cartao_compra_vira_saida(self):
        t = ler_arquivo(os.path.join(EX, "nubank_cartao.csv"))
        self.assertEqual(len(t), 8)
        self.assertEqual(t[0].valor, Decimal("-23.90"))          # compra = saída
        self.assertEqual(t[4].valor, Decimal("1500.00"))         # pagamento recebido = entrada
        self.assertEqual(t[3].parcela, "2/5")

    def test_nubank_conta_mantem_sinal(self):
        t = ler_arquivo(os.path.join(EX, "nubank_conta.csv"))
        self.assertEqual([str(x.valor) for x in t], ["11000.00", "-3800.00", "-7905.21", "-45.90"])
        self.assertEqual(t[0].data, date(2026, 11, 1))

    def test_c6_fatura_ponto_e_virgula_e_parcela_em_coluna(self):
        t = ler_arquivo(os.path.join(EX, "c6_fatura.csv"))
        self.assertEqual(len(t), 3)
        self.assertEqual(t[0].valor, Decimal("-89.90"))
        self.assertEqual(t[1].parcela, "1/3")
        self.assertEqual(t[0].parcela, "")

    def test_ofx(self):
        t = ler_arquivo(os.path.join(EX, "banco.ofx"))
        self.assertEqual(len(t), 2)
        self.assertEqual(t[0].data, date(2026, 11, 14))
        self.assertEqual(t[0].valor, Decimal("-130.00"))
        self.assertIn("AX MARKETING", t[1].descricao)


class TestCategorizar(unittest.TestCase):
    def test_regra_da_usuaria_ganha_do_padrao(self):
        s = sugerir("Uber *Trip", Decimal("-20"), [("uber", "Empresa", "AX")], set(CATS), CATS)
        self.assertEqual((s.categoria, s.centro, s.confianca), ("Empresa", "AX", "alta"))

    def test_padrao_embutido(self):
        s = sugerir("Ifood *Restaurante", Decimal("-50"), [], set(CATS), CATS)
        self.assertEqual((s.categoria, s.confianca), ("Refeição", "média"))

    def test_fatura_vira_transferencia(self):
        s = sugerir("Pagamento de fatura", Decimal("-7905.21"), [], set(CATS), CATS)
        self.assertEqual((s.tipo, s.categoria), ("Transferência", "Pagamento de fatura"))

    def test_palavra_inteira(self):
        s = sugerir("Competição de corrida", Decimal("-80"), [], set(CATS), CATS)
        self.assertEqual(s.categoria, "")  # "pet" dentro de "competição" não conta

    def test_categoria_inexistente_nao_e_sugerida(self):
        s = sugerir("Drogasil", Decimal("-30"), [], set(CATS), CATS)  # Saúde não está na lista
        self.assertEqual((s.categoria, s.centro, s.confianca), ("", "A definir", "baixa"))


class TestProcessar(unittest.TestCase):
    def test_lote_completo(self):
        arq = os.path.join(EX, "nubank_cartao.csv")
        linhas, r = processar([arq], "Nubank", "Laura", regras=[], categorias=set(CATS), tipos=CATS)
        self.assertEqual(r["lidos"], 8)
        self.assertEqual(r["duplicados_lote"], 1)                 # Uber repetido
        self.assertEqual(r["numeros_removidos"], 1)
        self.assertTrue(all("4111" not in l["Descrição"] for l in linhas))
        self.assertTrue(all(l["Valor"] > 0 for l in linhas))      # valor sempre positivo, o tipo diz o sentido
        self.assertTrue(all(l["Aprovar"] is False for l in linhas))
        fatura = [l for l in linhas if l["Categoria"] == "Pagamento de fatura"][0]
        self.assertEqual(fatura["Tipo"], "Transferência")

    def test_reimportar_nao_duplica(self):
        arq = os.path.join(EX, "nubank_cartao.csv")
        linhas, _ = processar([arq], "Nubank")
        _, r2 = processar([arq], "Nubank", existentes={l["Hash"] for l in linhas})
        self.assertEqual(r2["novos"], 0)

    def test_linha_para_planilha(self):
        linhas, _ = processar([os.path.join(EX, "c6_fatura.csv")], "C6 Black")
        l = para_planilha(linhas[0])
        self.assertEqual(l[1], "02/11/2026")
        self.assertEqual(l[2], "2026-11")
        self.assertEqual(l[4], 89.9)
        self.assertEqual(len(l), 15)


if __name__ == "__main__":
    unittest.main()
