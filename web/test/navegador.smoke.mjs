/**
 * Teste de fumaça no navegador (Playwright), sem Supabase nem Claude de verdade:
 * troca a biblioteca do Supabase por uma falsa em memória e simula /api/*.
 * Rodar: npm run build && npm run test:navegador
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// playwright instalado no projeto ou globalmente
const { chromium } = createRequire(import.meta.url)('playwright');

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const FAKE = `
window.__banco = { estados: null, versao: 0, rpcs: 0, uploads: [] };
window.supabase = { createClient() {
  let sessao = null; const ouvintes = [];
  const user = { id: 'u1', email: 'ana@exemplo.com', user_metadata: { nome: 'Ana' } };
  const avisar = (ev) => ouvintes.forEach(f => f(ev, sessao));
  const consulta = (tabela) => {
    const q = { select() { return q; }, eq() { return q; }, gte() { return q; },
      async maybeSingle() { const b = window.__banco; return { data: b.estados ? { dados: b.estados, versao: b.versao, atualizado_em: new Date().toISOString() } : null, error: null }; },
      async single() { if (tabela === 'perfis') return { data: { plano: 'gratis', planos: { limite_ia_mes: 20 } } }; return q.maybeSingle(); },
      then(ok) { ok({ count: 3 }); } };
    return q;
  };
  return {
    auth: {
      onAuthStateChange(f) { ouvintes.push(f); },
      async getSession() { return { data: { session: sessao } }; },
      async signInWithPassword({ email, password }) { if (password !== 'segredo123') return { error: { message: 'Invalid login credentials' } }; sessao = { user, access_token: 't' }; setTimeout(() => avisar('SIGNED_IN')); return { data: { session: sessao } }; },
      async signOut() { sessao = null; avisar('SIGNED_OUT'); return {}; }
    },
    from: consulta,
    async rpc(nome, args) { const b = window.__banco; if (args.p_versao !== b.versao) return { error: { message: 'conflito' } }; b.estados = JSON.parse(JSON.stringify(args.p_dados)); b.versao++; b.rpcs++; return { data: b.versao }; },
    storage: { from() { return {
      async upload(path) { window.__banco.uploads.push(path); return { error: null }; },
      async createSignedUrl(path) { return { data: { signedUrl: 'data:image/png;base64,iVBORw0KGgo=' } }; },
      async remove() { return {}; } }; } }
  };
} };`;

const srv = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/config') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ supabaseUrl: 'http://falso', supabaseAnonKey: 'anon' })); return; }
  if (url.pathname === '/api/agente') {
    let corpo = ''; for await (const c of req) corpo += c;
    const j = JSON.parse(corpo);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-IA-Usados': '4', 'X-IA-Limite': '20' });
    res.write('Resposta do agente ' + j.agente + '. '); setTimeout(() => { res.end('**Fim**.'); }, 100); return;
  }
  if (url.pathname === '/vendor/supabase.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(FAKE); return; }
  try {
    const arq = join(pub, url.pathname === '/' ? 'index.html' : url.pathname);
    res.setHeader('Content-Type', tipos[extname(arq)] || 'application/octet-stream');
    res.end(await readFile(arq));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(ok => srv.listen(0, ok));
const base = 'http://localhost:' + srv.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const erros = [];
page.on('pageerror', e => { erros.push(e.message); console.error('ERRO NA PÁGINA:', e.message); });
page.on('dialog', d => d.accept());
try {
  await page.goto(base);
  await page.waitForSelector('form[data-login="entrar"]');
  // senha errada
  await page.fill('#l-email', 'ana@exemplo.com'); await page.fill('#l-senha', 'errada');
  await page.click('form[data-login] button[type=submit]');
  await page.waitForSelector('text=E-mail ou senha incorretos.');
  // login certo: primeiro acesso cria os dados de exemplo e salva
  await page.fill('#l-senha', 'segredo123');
  await page.click('form[data-login] button[type=submit]');
  await page.waitForSelector('#conta-box >> text=ana@exemplo.com');
  await page.waitForFunction(() => window.__banco.rpcs >= 1);
  assert.equal(await page.evaluate(() => window.__banco.estados.cfg.nome), 'Ana');
  assert.equal(await page.isVisible('#tela-login'), false);
  await page.screenshot({ path: '/tmp/assessor-painel.png' });

  // cada página abre sem erro
  for (const aba of await page.$$eval('#abas button, #abas a', els => els.map(e => e.textContent.trim()))) {
    await page.click(`#abas >> text="${aba}"`);
    await page.waitForTimeout(150);
  }

  // Buyer: análise com IA
  await page.click('#abas >> text="Buyer"');
  await page.click('[data-buyer-ia]');
  await page.waitForSelector('#buyer-ia-txt >> text=Resposta do agente buyer');
  await page.waitForFunction(() => /Fim/.test(document.getElementById('buyer-ia-txt').textContent));
  await page.screenshot({ path: '/tmp/assessor-buyer.png' });

  // Investimentos: chat com o agente investidor
  await page.click('#abas >> text="Investimentos"');
  await page.fill('#chat-in', 'Minha carteira está diversificada?');
  await page.press('#chat-in', 'Enter');
  await page.waitForSelector('text=Resposta do agente investidor');
  await page.waitForFunction(() => /Fim/.test(document.getElementById('chat-msgs').textContent));
  await page.screenshot({ path: '/tmp/assessor-investir.png' });

  // gravação automática levou o chat para o banco
  await page.waitForFunction(() => (window.__banco.estados.ChatInvest || []).some(m => /Resposta do agente investidor/.test(m.text)), null, { timeout: 5000 });

  // conflito: outro aparelho grava; ao salvar, a pessoa escolhe carregar a versão nova (dialog aceito)
  await page.evaluate(() => { window.__banco.versao += 5; window.__banco.estados.cfg.nome = 'Ana (outro aparelho)'; });
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => db.cfg.nome === 'Ana (outro aparelho)');

  // recarregar: dados vêm do "banco"
  assert.deepEqual(erros, []);
  console.log('OK: login, primeiro acesso, páginas, Buyer IA, Investidor IA, gravação automática e conflito');
} finally {
  await browser.close(); srv.close();
}
if (erros.length) { console.error(erros); process.exit(1); }
