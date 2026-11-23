# Assessor Financeiro

Controle financeiro pessoal (PF e PJ) em Google Planilhas, com agentes Claude para importar extratos, monitorar preços, analisar gastos e acompanhar investimentos.

> **Este repositório não guarda nenhum dado financeiro.** Os dados ficam só na sua planilha. Extratos reais vão na pasta `extratos/`, que o git ignora.

## Como as peças se encaixam

| Peça | Onde | O que faz | Custo |
| --- | --- | --- | --- |
| Planilha | Google Planilhas | Guarda tudo: lançamentos, metas, compras, investimentos | Grátis |
| `src/` | Apps Script dentro da planilha (publicado pelo GitHub) | Menu Assessor, 11 formulários, orçado vs. realizado, projeção de caixa, calendário de compras, reserva, lembrete e alertas por e-mail | Grátis, sem tokens |
| `importador/` | Python, rodado pelo Claude | Lê CSV e OFX (Nubank, C6, bancos), limpa números sensíveis, sugere categoria, descarta duplicados | Sem tokens |
| `agentes/` | Prompts do Claude | Importador (PDF), monitor de preços, analista, conselheiro, chat | Tokens só onde há julgamento |
| GitHub Actions | Este repositório | Testa todo push e publica `src/` na planilha | Grátis |

## Status

- [x] Fases 1 e 2: planilha, formulários, cálculos, e-mails (`src/`)
- [x] Fase 3: importador de extratos (`importador/`) + prompt do agente
- [ ] Fase 4: monitor de preços semanal (prompt pronto em `agentes/02_monitor_precos.md`; falta agendar)
- [ ] Fase 5: analista e conselheiro (prompts prontos; falta agendar)
- [ ] Fase 6: chat e versão para venda

## Instalação (uma vez só)

### 1. Criar a planilha e o projeto de script

1. Abra [sheets.new](https://sheets.new) e dê o nome **Assessor Financeiro**.
2. Menu **Extensões > Apps Script**. Não precisa colar nada.
3. No Apps Script, clique na engrenagem (**Configurações do projeto**) e copie o **ID do script**.

### 2. Ligar a publicação automática (GitHub → planilha)

Precisa de um computador com Node.js instalado, só nesta etapa.

1. Ative a API do Apps Script na sua conta: [script.google.com/home/usersettings](https://script.google.com/home/usersettings) → **Google Apps Script API: Ativada**.
2. No terminal: `npx @google/clasp@2.4.2 login`. O navegador abre; entre com a sua conta Google.
3. Isso cria o arquivo `~/.clasprc.json` (no Windows: `C:\Users\SEU_USUARIO\.clasprc.json`). Abra e copie todo o conteúdo.
4. No GitHub: **Settings > Secrets and variables > Actions > New repository secret**:
   - `CLASPRC_JSON` = o conteúdo do `.clasprc.json`
   - `SCRIPT_ID` = o ID do script do passo 1
5. Em **Actions > Testar e publicar na planilha > Run workflow**. Em 1 minuto o código está na planilha.

> O `.clasprc.json` dá acesso aos seus scripts do Google. Ele vai só para o Secret do GitHub, nunca para o código.

### 3. Instalar o sistema na planilha

1. Recarregue a planilha (F5). Aparece o menu **Assessor**.
2. **Assessor > Instalar / reparar sistema.** Autorize: "O Google não verificou este app" → **Avançado > Acessar**. O app é seu, na sua conta.
3. Preencha, nesta ordem: Configurações gerais → Cartões → Aporte mensal e reserva → Metas → Categorias e metas de gasto → Fixos e recorrentes → Compras futuras.

Daqui em diante, toda mudança no código que chega na `main` é testada e publicada sozinha.

## Regras que valem para tudo

- Reserva de emergência: recebe 50% do aporte até R$ 10.000; depois congela e essa fatia vai para as metas.
- Soma das parcelas do mês até R$ 600, só sem juros.
- Pagamento de fatura é **Transferência**: as compras do cartão já contam como gasto.
- Nada importado entra em Lançamentos sem a sua aprovação.
- Nenhum número de cartão, conta ou documento é gravado.

## Desenvolvimento

```
npm test                 # regras de negócio + planilha simulada
npm run test:importador  # importador de extratos
python3 -m importador.importar importador/exemplos/nubank_cartao.csv --conta Nubank
```

Instruções para o Claude Code: [CLAUDE.md](CLAUDE.md).
