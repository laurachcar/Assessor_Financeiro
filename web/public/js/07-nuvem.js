/* ===== App web: login (Supabase Auth), carga dos dados da conta e agentes de IA no servidor ===== */
let appIniciado = false;
let usoIA = null;   // { usados, limite }

function textoUsoIA() { return usoIA ? ` · ${usoIA.usados} de ${usoIA.limite} perguntas no mês` : ''; }

// ------------------------------------------------------------ início
(async function iniciar() {
  let cfg;
  try {
    const r = await fetch('/api/config');
    cfg = await r.json();
    if (!r.ok) throw new Error(cfg.erro || 'configuração indisponível');
  } catch (e) {
    telaLogin('erro', 'O servidor ainda não está configurado (' + e.message + ').');
    return;
  }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY') { telaLogin('nova-senha'); return; }
    if (evento === 'SIGNED_OUT') { location.reload(); return; }
    if (sessao && !appIniciado) entrarNoApp(sessao.user);
  });
  const { data } = await sb.auth.getSession();
  if (data.session) entrarNoApp(data.session.user);
  else if (!/type=recovery/.test(location.hash)) telaLogin('entrar');
})();

// ------------------------------------------------------------ telas de login
function telaLogin(modo, aviso) {
  document.body.classList.add('sem-sessao');
  document.getElementById('tela-login').hidden = false;
  const corpo = document.getElementById('login-corpo');
  const msg = aviso ? `<div class="msg ${modo === 'erro' ? 'erro' : 'ok'}">${esc(aviso)}</div>` : '';
  const forms = {
    erro: '',
    entrar: `<form data-login="entrar"><label for="l-email">E-mail</label><input id="l-email" name="email" type="email" autocomplete="email" required>
      <label for="l-senha">Senha</label><input id="l-senha" name="senha" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit">Entrar</button></form>
      <div class="login-links"><button class="link" data-ir="criar">Criar conta</button><button class="link" data-ir="esqueci">Esqueci a senha</button></div>`,
    criar: `<form data-login="criar"><label for="l-nome">Seu nome</label><input id="l-nome" name="nome" autocomplete="given-name" required maxlength="60">
      <label for="l-email">E-mail</label><input id="l-email" name="email" type="email" autocomplete="email" required>
      <label for="l-senha">Senha (mínimo 8 caracteres)</label><input id="l-senha" name="senha" type="password" autocomplete="new-password" minlength="8" required>
      <label class="check" style="font-weight:400"><input type="checkbox" name="termos" required> Li e aceito os termos de uso e a política de privacidade.</label>
      <button class="btn" type="submit">Criar conta</button></form>
      <div class="login-links"><button class="link" data-ir="entrar">Já tenho conta</button></div>`,
    esqueci: `<form data-login="esqueci"><label for="l-email">E-mail da conta</label><input id="l-email" name="email" type="email" autocomplete="email" required>
      <button class="btn" type="submit">Enviar link para trocar a senha</button></form>
      <div class="login-links"><button class="link" data-ir="entrar">Voltar</button></div>`,
    'nova-senha': `<form data-login="nova-senha"><label for="l-senha">Nova senha (mínimo 8 caracteres)</label><input id="l-senha" name="senha" type="password" autocomplete="new-password" minlength="8" required>
      <button class="btn" type="submit">Salvar nova senha</button></form>`
  };
  corpo.innerHTML = msg + forms[modo];
  const primeiro = corpo.querySelector('input');
  if (primeiro) primeiro.focus();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ir]');
  if (b) { e.preventDefault(); telaLogin(b.dataset.ir); }
  if (e.target.closest('#btn-sair')) sair();
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-login]');
  if (!f) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  const botao = f.querySelector('button[type=submit]');
  botao.disabled = true;
  const modo = f.dataset.login;
  let r;
  try {
    if (modo === 'entrar') r = await sb.auth.signInWithPassword({ email: v.email.trim(), password: v.senha });
    else if (modo === 'criar') r = await sb.auth.signUp({ email: v.email.trim(), password: v.senha, options: { emailRedirectTo: location.origin, data: { nome: v.nome.trim(), aceitou_termos_em: new Date().toISOString() } } });
    else if (modo === 'esqueci') r = await sb.auth.resetPasswordForEmail(v.email.trim(), { redirectTo: location.origin });
    else if (modo === 'nova-senha') r = await sb.auth.updateUser({ password: v.senha });
  } catch (x) { r = { error: x }; }
  botao.disabled = false;
  if (r.error) { mostrarErroLogin(traduzirErro(r.error)); return; }
  if (modo === 'criar' && !r.data.session) telaLogin('entrar', 'Conta criada! Enviamos um link de confirmação para ' + v.email.trim() + '. Clique nele e depois entre aqui.');
  else if (modo === 'esqueci') telaLogin('entrar', 'Se esse e-mail tiver conta, chega um link para trocar a senha em instantes.');
  else if (modo === 'nova-senha') { avisoRapido('Senha trocada.'); const { data } = await sb.auth.getSession(); if (data.session && !appIniciado) entrarNoApp(data.session.user); }
});

function mostrarErroLogin(txt) {
  const corpo = document.getElementById('login-corpo');
  corpo.querySelectorAll('.msg').forEach(m => m.remove());
  corpo.insertAdjacentHTML('afterbegin', `<div class="msg erro">${esc(txt)}</div>`);
}

function traduzirErro(e) {
  const m = String((e && e.message) || e);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Entre ou use "Esqueci a senha".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  return 'Não deu certo: ' + m;
}

async function sair() {
  if (pendentes > 0) await salvarTudo(true);
  if (pendentes > 0 && !window.confirm('Há alterações que ainda não foram salvas. Sair mesmo assim?')) return;
  await sb.auth.signOut();
}

// ------------------------------------------------------------ entrar no app
async function entrarNoApp(user) {
  if (appIniciado) return;
  appIniciado = true;
  usuario = user;
  if (/type=recovery|access_token/.test(location.hash)) history.replaceState(null, '', location.pathname);
  const nome = (user.user_metadata && user.user_metadata.nome) || '';
  let primeiroAcesso = false;
  const { data, error } = await sb.from('estados').select('dados, versao, atualizado_em').eq('user_id', user.id).maybeSingle();
  if (error) {
    appIniciado = false;
    telaLogin('erro', 'Não consegui carregar seus dados (' + error.message + '). Recarregue a página.');
    return;
  }
  if (data) {
    db = data.dados; versaoNuvem = data.versao; salvoEm = new Date(data.atualizado_em);
  } else {
    primeiroAcesso = true;
    semear();
    db.cfg.nome = nome; db.cfg.email = user.email || '';
  }
  if (!db.Carteira) db.Carteira = [];
  migrar();
  document.getElementById('tela-login').hidden = true;
  document.body.classList.remove('sem-sessao');
  montarCaixaConta();
  iaDisponivel = true;
  render();
  pendentes = 0; nuvemStatus = 'ok'; atualizarBotaoSalvar();
  if (primeiroAcesso) {
    pendentes = 1; await salvarTudo(true);
    avisoRapido('Bem-vindo(a)' + (nome ? ', ' + nome : '') + '! Estes são dados de exemplo para você explorar. Em Cadastro, use "Começar com meus dados" ou "Restaurar backup".');
  }
  atualizarUsoIA();
}

function montarCaixaConta() {
  if (document.getElementById('conta-box')) return;
  const box = document.createElement('div');
  box.id = 'conta-box'; box.className = 'conta-box';
  box.innerHTML = `<span class="conta-email" title="${esc(usuario.email)}">${esc(usuario.email)}</span><button class="btn sec peq" id="btn-sair">Sair</button>`;
  document.querySelector('.topo').appendChild(box);
}

async function atualizarUsoIA() {
  try {
    const [{ data: perfil }, { count }] = await Promise.all([
      sb.from('perfis').select('plano, planos(limite_ia_mes)').eq('id', usuario.id).single(),
      sb.from('uso_ia').select('id', { count: 'exact', head: true }).gte('criado_em', inicioMesLocal())
    ]);
    if (perfil) usoIA = { usados: count || 0, limite: (perfil.planos && perfil.planos.limite_ia_mes) || 0 };
  } catch (e) { /* só informativo */ }
}
function inicioMesLocal() { return new Date(HOJE.getFullYear(), HOJE.getMonth(), 1).toISOString(); }

// ------------------------------------------------------------ agentes de IA (rodam no servidor)
/** Chama /api/agente e vai mostrando o texto conforme chega. Devolve o texto final. */
async function agenteIA(agente, corpo, aoReceber) {
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('sua sessão expirou, entre de novo');
  const r = await fetch('/api/agente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
    body: JSON.stringify(Object.assign({ agente }, corpo))
  });
  if (!r.ok) {
    let erro = 'o agente não respondeu (' + r.status + ')';
    try { const j = await r.json(); if (j.erro) erro = j.erro; if (j.limite) usoIA = { usados: j.usados, limite: j.limite }; } catch (x) { /* corpo vazio */ }
    throw new Error(erro);
  }
  const usados = Number(r.headers.get('X-IA-Usados')), limite = Number(r.headers.get('X-IA-Limite'));
  if (limite) usoIA = { usados, limite };
  const leitor = r.body.getReader(), dec = new TextDecoder();
  let texto = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    texto += dec.decode(value, { stream: true });
    const i = texto.indexOf('\u0000ERRO:');
    if (i >= 0) throw new Error(texto.slice(i + 6).trim());
    if (aoReceber) aoReceber(texto);
  }
  return texto.trim();
}

// Agente Buyer com IA: um botão no painel do Buyer pede uma revisão do plano.
let buyerOcupado = false;

function contextoBuyer() {
  const recs = planoBuyer();
  return {
    hoje: diaChave(HOJE), nome: db.cfg.nome || '',
    reserva_compras: db.cfg.reserva_compras, aporte_compras: db.cfg.aporte_compras, teto_parcelas: db.cfg.teto_parcelas,
    cartoes: db.Cartoes.filter(c => ehSim(c['Ativo'])).map(c => ({ cartao: c['Cartão'], fechamento: c['Dia fechamento'], vencimento: c['Dia vencimento'], cashback_pct: c['% cashback'], beneficios: c['Benefícios'] || '', garantia_estendida: c['Garantia estendida'] || '' })),
    plano: recs.map(r => ({
      item: r.item['Item'], valor: r.item['Valor estimado'], urgencia: r.urg || r.item['Urgência'], preco_alvo: r.item['Preço alvo'] || '',
      sem_juros_ate: r.item['Sem juros até'] || '', desconto_pix_pct: r.item['Desconto Pix %'] || '',
      ofertas_salvas: (r.item['Ofertas'] || []).map(o => ({ loja: o.loja, preco: o.preco })),
      situacao: r.status, quando: r.quando, pagamento: r.pag ? r.pag.forma + (r.pag.n > 1 ? ' ' + r.pag.n + 'x' : '') : '', economia_estimada: r.economia, falta: r.falta || 0
    }))
  };
}

async function perguntarBuyer() {
  if (buyerOcupado) return;
  buyerOcupado = true;
  db.BuyerIA = { texto: 'Pensando...', em: diaChave(HOJE), ocupado: true };
  render();
  try {
    const txt = await agenteIA('buyer', { contexto: contextoBuyer() }, parcial => { const el = document.getElementById('buyer-ia-txt'); if (el) el.innerHTML = md(parcial); });
    db.BuyerIA = { texto: txt, em: diaChave(HOJE) };
  } catch (e) {
    db.BuyerIA = { texto: 'Não consegui a análise agora: ' + e.message + '.', em: diaChave(HOJE), erro: true };
  }
  buyerOcupado = false;
  guardar(); render();
}

const painelAgenteV4 = painelAgente;
painelAgente = function (recs) {
  const ia = db.BuyerIA;
  const bloco = `<div class="buyer-ia"><div class="linha" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span class="nota">Quer uma segunda opinião? O agente com IA revisa o plano e sugere as próximas ações.${textoUsoIA()}</span>
      <button class="btn peq" data-buyer-ia="1" ${buyerOcupado ? 'disabled' : ''}>${buyerOcupado ? 'Analisando...' : ia ? 'Analisar de novo' : 'Analisar meu plano com IA'}</button></div>
    ${ia ? `<div class="resposta ${ia.erro ? 'msg erro' : ''}" id="buyer-ia-txt">${md(ia.texto)}</div>${ia.ocupado ? '' : `<div class="aviso-legal">Análise de ${dataBR(ia.em)}. Confira preços e condições na loja antes de comprar.</div>`}` : ''}
  </div>`;
  return painelAgenteV4(recs).replace('<div class="baloes">', bloco + '<div class="baloes">');
};

document.addEventListener('click', e => {
  if (e.target.closest('[data-buyer-ia]')) { e.preventDefault(); perguntarBuyer(); }
});

// "Começar com meus dados" mantém o nome e o e-mail da conta
const meusDadosV4 = meusDados;
meusDados = function () {
  const nome = db.cfg.nome, email = db.cfg.email;
  meusDadosV4();
  db.cfg.nome = nome || db.cfg.nome; db.cfg.email = email || db.cfg.email;
};

// "Recomeçar exemplo" também mantém o nome e o e-mail da conta
const semearV4 = semear;
semear = function () {
  const cfg = db && db.cfg ? { nome: db.cfg.nome, email: db.cfg.email } : null;
  semearV4();
  if (cfg) { db.cfg.nome = cfg.nome || db.cfg.nome; db.cfg.email = cfg.email || db.cfg.email; }
};
