# Assessor Financeiro: app web

A mesma interface do arquivo HTML (Painel, Cadastro, Buyer, Investimentos), agora com login, dados na nuvem por pessoa e os agentes de IA rodando no servidor.

## Como funciona

| Parte | Onde roda | O que faz |
|---|---|---|
| `public/` | Navegador (Vercel serve os arquivos) | A interface de sempre. `js/01` a `js/06` são os blocos do arquivo HTML; `js/07-nuvem.js` faz login, carrega e salva na conta e chama os agentes |
| `api/agente.js` | Servidor (função do Vercel) | Agentes Investidor e Buyer. Confere o login, o limite do plano e chama o Claude com a chave que só o servidor conhece |
| `api/config.js` | Servidor | Entrega ao navegador o endereço e a chave pública do Supabase |
| `supabase/migrations/0001_inicial.sql` | Supabase | Tabelas, segurança por pessoa (RLS), backup automático e pasta de anexos |

**Dados:** cada pessoa tem uma linha em `estados` com todas as abas em JSON (o mesmo formato do backup). Grava sozinho 1,5 s depois de cada alteração; o botão Salvar e o Ctrl+S continuam funcionando. Se outro aparelho gravou antes, o app pergunta qual versão fica.

**Backup automático:** a cada gravação, o banco guarda a versão anterior em `estados_historico` (no máximo uma por hora, as últimas 72). Os planos pagos do Supabase também fazem backup diário do banco inteiro.

**Anexos:** imagens e PDFs vão para o bucket privado `anexos`, na pasta da pessoa. Ninguém vê arquivos de outra pessoa; os links valem 1 hora.

**Agentes de IA:** as instruções ficam no servidor, então ninguém consegue usar a sua chave para outra coisa. Cada pergunta conta no limite mensal do plano (tabela `planos`: Grátis 20, Pro 300; mude os números quando quiser). Sem IA, o app continua respondendo com o cálculo local.

## Colocar no ar (uns 20 minutos)

### 1. Supabase (banco, login e arquivos)
1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região **South America (São Paulo)**).
2. **SQL Editor > New query**: cole o conteúdo de `supabase/migrations/0001_inicial.sql` e clique em **Run**.
3. **Authentication > Sign In / Providers > Email**: deixe ligado, com "Confirm email" ligado.
4. **Project Settings > API**: anote a **Project URL**, a chave **anon public** e a **service_role** (secreta).

### 2. Chave do Claude
1. Em [console.anthropic.com](https://console.anthropic.com), crie uma API key.
2. Em **Limits**, defina um teto de gasto mensal, para não ter surpresa.

### 3. Vercel (site e servidor)
1. Em [vercel.com](https://vercel.com), **Add New > Project** e importe o repositório `Assessor_Financeiro`.
2. Em **Root Directory**, escolha `web`. O resto o `vercel.json` já configura.
3. Em **Environment Variables**, cadastre:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. **Deploy.** O Vercel dá um endereço `https://....vercel.app`.
5. Volte ao Supabase em **Authentication > URL Configuration** e coloque esse endereço em **Site URL** (os e-mails de confirmação e de troca de senha voltam para ele).

### 4. Trazer os seus dados da versão em arquivo
1. No arquivo antigo, **Cadastro > Baixar backup**.
2. No app novo, crie sua conta, entre e use **Cadastro > Restaurar backup**.
3. Os anexos da versão antiga não vão no backup: anexe de novo os que importarem.

Para virar Pro: no Supabase, **Table Editor > perfis**, troque `plano` para `pro`. Quando o pagamento entrar, isso passa a ser automático.

## Desenvolvimento

```bash
npm install
npm run build             # copia a biblioteca do Supabase para public/vendor
npm test                  # regras dos agentes
npm run test:navegador    # abre o app no Chromium com Supabase e IA simulados
npx vercel dev            # roda local com as variáveis de .env.local (veja .env.example)
```

Opcionais: `ANTHROPIC_MODEL` (padrão `claude-opus-5-5`) e `ANTHROPIC_EFFORT` (padrão `low`, mais barato para conversa). Se o modelo recusar uma pergunta, a API tenta sozinha um modelo reserva.

## Próximos passos
- Pagamento recorrente (Pix e cartão) mudando o `plano` sozinho
- Termos de uso, política de privacidade, apagar conta pelo próprio app (LGPD)
- Primeiro acesso guiado no lugar dos dados de exemplo
- App instalável no celular (PWA)
