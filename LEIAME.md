# Assessor Financeiro — fases 1 e 2

Sistema de controle financeiro em Google Planilhas + Apps Script. Esta versão roda inteira dentro da planilha, sem IA e sem custo de tokens.

## O que já funciona

- 17 abas + 2 ocultas (Relatorios e Log), criadas automaticamente
- Menu **Assessor** com 11 formulários de entrada de informações, com validação
- Orçado vs. realizado por categoria, mês a mês, com filtro de ano e centro de custo e comparação com o ano anterior
- Projeção de caixa de 12 meses
- Calendário de compras: melhor mês, parcelas, cartão e dia de compra
- Reserva de emergência: recebe 50% do aporte até R$ 10 mil, depois congela e redistribui para as metas
- Lembrete por e-mail no dia 1 de cada mês, às 8h
- Alertas de orçamento por e-mail em 80% e 100% da meta, sem repetir
- Carteiro que envia os relatórios que o Claude escrever (fases 4 e 5)
- Aprovação dos lançamentos importados, com descarte de duplicados

## Instalação (uns 10 minutos)

Use uma **planilha nova**. A planilha antiga tem uma aba chamada "Investimentos", que conflita com a nova. A migração do histórico é feita depois.

1. Abra [sheets.new](https://sheets.new) e dê o nome **Assessor Financeiro**.
2. Menu **Extensões > Apps Script**.
3. No Apps Script, clique na engrenagem (Configurações do projeto) e marque **"Mostrar arquivo de manifesto appsscript.json no editor"**.
4. Volte ao Editor (ícone `< >`). Crie os arquivos **na ordem 01 a 06** (o Apps Script carrega os arquivos na ordem em que aparecem, e o 01 define o que os outros usam). Para cada arquivo da pasta `src`:
   - Arquivos `.gs`: clique em **+ > Script**, dê o nome sem a extensão (ex.: `01_Config`) e cole o conteúdo.
   - `Formulario.html`: clique em **+ > HTML**, nome `Formulario` (exatamente assim), e cole o conteúdo.
   - `appsscript.json`: abra o que já existe e substitua todo o conteúdo.
   - Apague o arquivo `Código.gs` que veio por padrão.
5. Clique em **Salvar** (ícone de disquete).
6. Volte para a planilha e recarregue a página (F5). Aparece o menu **Assessor**.
7. **Assessor > Instalar / reparar sistema.** O Google vai pedir autorização:
   - "O Google não verificou este app": clique em **Avançado > Acessar Assessor Financeiro (não seguro)**. O app é seu, está na sua conta; o aviso aparece em todo script pessoal.
   - Permita: editar esta planilha, mostrar janelas, criar gatilhos e enviar e-mail em seu nome.

## Primeiro uso (nesta ordem)

1. **Cadastros > Configurações gerais**: confira o e-mail e o teto de parcelas.
2. **Cadastros > Cartões**: Nubank, C6, Amex, com dia de fechamento e retorno.
3. **Investimentos > Aporte mensal e reserva**: aporte do mês e saldo atual da reserva.
4. **Investimentos > Metas de investimento**: casa própria, imóveis por consórcio, etc. O % do aporte das metas deve somar 100%.
5. **Planejamento > Categorias e metas de gasto**: meta mensal de cada categoria (as categorias da planilha antiga já vêm cadastradas).
6. **Movimento > Fixos e recorrentes**: salário, aluguel, condomínio, USP...
7. **Planejamento > Compras futuras**: o que você quer comprar.

## Regras importantes

- **Pagamento de fatura é Transferência**, não Saída. As compras do cartão já entram como gasto, uma por uma. Se a fatura também entrar como Saída, o gasto conta em dobro.
- As abas mostram um aviso se você editar direto. Use o menu: ele valida tudo antes de gravar.
- Nunca digite número de cartão ou conta. O sistema recusa qualquer sequência de 12 dígitos ou mais.

## Testes

```
node test/logica.test.js      # regras de negócio (17 testes)
node test/simulacao.test.js   # fluxo completo com planilha simulada (14 cenários)
```

## Próximas fases

3. Importador de extrato e fatura (Claude lê CSV, OFX ou PDF e grava em Import_Staging)
4. Monitor de preços semanal (tarefa agendada do Claude)
5. Analista e Conselheiro (resumo semanal, relatório mensal, perfil de investidor)
6. Chat Assessor e versão para venda
