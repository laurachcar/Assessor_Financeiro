# Assessor Financeiro — fases 1 e 2

Sistema de controle financeiro em Google Planilhas + Apps Script. Esta versão roda inteira dentro da planilha, sem IA e sem custo de tokens.

## O que já funciona

- 18 abas + 2 ocultas (Relatorios e Log), criadas automaticamente
- Categorias com subcategorias (ex.: Moradia > Aluguel, Condomínio, Contas de casa; Pipa > Veterinário, Vacinas)
- Aba **Parcelas**: cada compra parcelada por cartão, com total de parcelas, quantas faltam e quanto falta pagar, e o total por cartão nos próximos 12 meses
- Menu **Assessor** com 11 formulários de entrada de informações, com validação
- Orçado vs. realizado por categoria, mês a mês, com filtro de ano e centro de custo e comparação com o ano anterior
- Projeção de caixa de 12 meses
- Calendário de compras: melhor mês, parcelas, cartão, dia de compra e onde comprar, inclusive compras que se repetem (ex.: Botox semestral, Boca anual)
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
2. **Cadastros > Cartões**: Nubank, C6, Amex, com dia de fechamento e dia de vencimento.
3. **Investimentos > Aporte mensal e reserva**: aporte do mês e saldo atual da reserva.
4. **Investimentos > Metas de investimento**: casa própria, imóveis por consórcio, etc. O % do aporte das metas deve somar 100%.
5. **Planejamento > Categorias e metas de gasto**: meta mensal de cada categoria. As categorias e subcategorias já vêm cadastradas e podem ser editadas.
6. **Movimento > Fixos e recorrentes**: Tênis, USP, Imposto, as dívidas (4 meses de imposto e 4 de USP) e o aluguel da vaga já vêm cadastrados a partir do mês da instalação. Confira o dia e a conta de cada um e acrescente salário, aluguel, condomínio...
7. **Planejamento > Compras futuras**: sua lista já vem cadastrada (micro-ondas, airfryer, robô aspirador, Botox, Boca, roupas, sapatos, veterinário e vacinas da Pipa). Informe o valor e onde comprar; sem valor, o item aparece no calendário pedindo o valor. Para acrescentar, use o mesmo formulário.

## Regras importantes

- **Lance cada compra no cartão em que foi feita.** É isso que monta a aba Parcelas e o mês da fatura.
- **Pagamento de fatura é Transferência**, não Saída. As compras do cartão já entram como gasto, uma por uma. Se a fatura também entrar como Saída, o gasto conta em dobro.
- As abas mostram um aviso se você editar direto. Use o menu: ele valida tudo antes de gravar.
- Nunca digite número de cartão ou conta. O sistema recusa qualquer sequência de 12 dígitos ou mais.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/01_Config.gs` | Abas, colunas, valores padrão, categorias iniciais e a definição dos 11 formulários |
| `src/02_Logica.gs` | Regras de negócio puras: validação, parcelas e fatura, reserva, orçado, alertas, projeção, calendário, duplicados |
| `src/03_Planilha.gs` | Leitura e gravação nas abas, instalação/reparo, proteção com aviso, `onEdit` |
| `src/04_Formularios.gs` | Menu **Assessor**, carregamento e gravação dos formulários, aprovação de importados |
| `src/05_Relatorios.gs` | Orçado x realizado, Projeção de caixa, Calendário de compras e Painel |
| `src/06_Gatilhos.gs` | Lembrete do dia 1, alertas de orçamento, rotina diária e carteiro |
| `src/Formulario.html` | Janela única que desenha qualquer formulário a partir da definição |
| `src/appsscript.json` | Fuso de São Paulo, runtime V8 e permissões |

## Como o Claude conversa com a planilha (fases 3 a 5)

- **Importação:** gravar linhas em `Import_Staging` com Status `Pendente` (colunas ID, Data, Descrição, Valor, Tipo, Categoria, Centro de custo, Conta/Cartão, Origem). Duplicados são descartados ao abrir **Importação > Aprovar lançamentos importados** e na rotina diária.
- **Relatórios:** gravar uma linha na aba oculta `Relatorios` com Assunto, Corpo (HTML) e Status `Pendente`, ou chamar `registrarRelatorio(assunto, corpoHtml)`. O carteiro envia de hora em hora; também dá para enviar na hora pelo menu.

## Testes

Precisa só do Node 18 ou mais novo, sem instalar nada.

```
npm test                      # roda os dois
node test/logica.test.js      # regras de negócio (20 testes)
node test/simulacao.test.js   # fluxo completo com planilha simulada (15 cenários)
```

## Próximas fases

3. Importador de extrato e fatura (Claude lê CSV, OFX ou PDF e grava em Import_Staging)
4. Monitor de preços semanal (tarefa agendada do Claude)
5. Analista e Conselheiro (resumo semanal, relatório mensal, perfil de investidor)
6. Chat Assessor e versão para venda
