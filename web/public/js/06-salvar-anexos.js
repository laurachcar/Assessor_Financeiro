/* ===== Salvar na nuvem (Supabase) e anexos (imagem/PDF) nas linhas ===== */
let sb = null;                // cliente Supabase, criado em 07-nuvem.js
let usuario = null;           // usuário logado
let versaoNuvem = 0;          // versão do estado gravada no banco (evita sobrescrever outro aparelho)
let salvoEm = null;           // última gravação concluída
let pendentes = 0;            // alterações ainda não gravadas
let salvando = false;
let nuvemStatus = '';         // '', 'ok', 'erro'
let timerAuto = null;

/** Toda alteração marca pendência e agenda a gravação automática. */
guardar = function () { pendentes++; atualizarBotaoSalvar(); agendarAutoSalvar(); };
function agendarAutoSalvar(ms = 1500) { clearTimeout(timerAuto); timerAuto = setTimeout(() => salvarTudo(true), ms); }

function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

function atualizarBotaoSalvar() {
  const b = document.getElementById('btn-salvar'), s = document.getElementById('status-salvar');
  if (!b || !s) return;
  b.disabled = salvando;
  b.textContent = salvando ? 'Salvando...' : 'Salvar';
  b.classList.toggle('pendente', pendentes > 0 && !salvando);
  s.textContent = salvando ? '' : nuvemStatus === 'erro' && pendentes > 0 ? 'Sem conexão: tento de novo em instantes'
    : pendentes > 0 ? pendentes + ' alteração(ões) não salva(s)' : salvoEm ? 'Salvo às ' + hhmm(salvoEm) : '';
  s.className = 'status-salvar ' + (pendentes > 0 ? 'aviso' : 'ok');
}

/** Grava tudo na conta. auto = gravação automática (sem aviso quando dá certo). */
async function salvarTudo(auto) {
  if (!sb || !usuario) return;
  if (salvando) { agendarAutoSalvar(); return; }
  clearTimeout(timerAuto);
  if (!auto) {
    const ativo = document.activeElement;
    if (ativo && /INPUT|SELECT|TEXTAREA/.test(ativo.tagName)) ativo.blur();   // dispara a gravação do campo em edição
  }
  salvando = true; atualizarBotaoSalvar();
  const enviadas = pendentes;
  db.salvoEm = new Date().toISOString();
  let resp;
  try { resp = await sb.rpc('salvar_estado', { p_dados: db, p_versao: versaoNuvem }); } catch (e) { resp = { error: { message: (e && e.message) || 'sem conexão' } }; }
  salvando = false;
  if (resp.error) {
    if (/conflito/i.test(resp.error.message || '')) { atualizarBotaoSalvar(); await resolverConflito(); return; }
    nuvemStatus = 'erro';
    atualizarBotaoSalvar();
    if (!auto) avisoRapido('Não consegui salvar (' + resp.error.message + '). Tento de novo em instantes.');
    agendarAutoSalvar(15000);
    return;
  }
  versaoNuvem = resp.data;
  pendentes = Math.max(0, pendentes - enviadas);
  salvoEm = new Date(); nuvemStatus = 'ok';
  if (pendentes > 0) agendarAutoSalvar();
  atualizarBotaoSalvar();
  if (!auto) avisoRapido('Tudo salvo na sua conta.');
}

/** Outro aparelho (ou aba) gravou depois de nós: a pessoa escolhe qual versão fica. */
async function resolverConflito() {
  const { data, error } = await sb.from('estados').select('dados, versao, atualizado_em').eq('user_id', usuario.id).single();
  if (error || !data) { nuvemStatus = 'erro'; agendarAutoSalvar(15000); return; }
  const quando = new Date(data.atualizado_em);
  const usarNuvem = window.confirm('Seus dados foram alterados em outro aparelho ou aba (' + dataBR(diaChave(quando)) + ' às ' + hhmm(quando) + ').\n\n'
    + 'OK: carregar essa versão mais nova (o que você mudou aqui desde o último salvamento se perde).\n'
    + 'Cancelar: manter o que está nesta tela e gravar por cima.');
  versaoNuvem = data.versao;
  if (usarNuvem) {
    db = data.dados; migrar(); pendentes = 0; salvoEm = quando; nuvemStatus = 'ok';
    render(); atualizarBotaoSalvar(); avisoRapido('Carreguei a versão mais nova.');
  } else salvarTudo();
}

// ------------------------------------------------------------ anexos
const ANEXO_MAX = 15 * 1024 * 1024;
const ANEXO_TIPOS = /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf)$/i;
const urlsAssinadas = {};   // path -> { url, ate }

/** Envia o arquivo para a pasta da pessoa no Storage (bucket privado "anexos"). */
async function guardarArquivo(file) {
  const meta = { id: 'A' + Date.now() + Math.floor(Math.random() * 1000), nome: String(file.name || 'colado.png').slice(0, 120), tipo: file.type, tam: file.size, em: diaChave(HOJE) };
  const seguro = meta.nome.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = usuario.id + '/' + meta.id + '-' + seguro;
  const { error } = await sb.storage.from('anexos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return Object.assign(meta, { onde: 'conta', path });
}

/** Link temporário (1 hora) para ver o arquivo. Anexos da versão antiga (navegador/Claude) não vêm no backup. */
async function urlAnexo(a) {
  if (!a.path) return '';
  const c = urlsAssinadas[a.path];
  if (c && c.ate > Date.now()) return c.url;
  const { data, error } = await sb.storage.from('anexos').createSignedUrl(a.path, 3600);
  if (error || !data) return '';
  urlsAssinadas[a.path] = { url: data.signedUrl, ate: Date.now() + 3500 * 1000 };
  return data.signedUrl;
}

async function apagarArquivo(a) {
  try { if (a.path) await sb.storage.from('anexos').remove([a.path]); } catch (e) { /* o registro sai da linha mesmo assim */ }
}

function nomeLinha(aba, r) { return r['Descrição'] || r['Item'] || r['Ativo'] || r['Cartão'] || r['Conta'] || r['Categoria'] || r['Meta'] || r['Centro de custo'] || (r['Mês'] ? rotuloMes(mesDe(r['Mês'])) : 'linha'); }

function btnAnexo(aba, i, r) {
  const n = (r['Anexos'] || []).length + (r['Nota'] ? 1 : 0);
  return `<button class="btn sec clipe ${n ? 'tem' : ''}" data-anexo="${esc(aba)}" data-idx="${i}" title="Anexos e nota" aria-label="Anexos e nota de ${esc(nomeLinha(aba, r))}">📎${n ? ' ' + n : ''}</button>`;
}

let anexoAlvo = null;   // { aba, idx }
let anexoMsg = '';
function fecharAnexos() { anexoAlvo = null; const p = document.getElementById('painel-anexo'); if (p) p.hidden = true; }

async function abrirAnexos(aba, idx) {
  anexoAlvo = { aba, idx };
  let p = document.getElementById('painel-anexo');
  if (!p) { p = document.createElement('div'); p.id = 'painel-anexo'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); document.body.appendChild(p); }
  const r = db[aba][idx];
  if (!r) { fecharAnexos(); return; }
  const anexos = r['Anexos'] || [];
  const urls = await Promise.all(anexos.map(a => urlAnexo(a).catch(() => '')));
  p.hidden = false;
  p.innerHTML = `<div class="anexo-caixa">
    <div class="linha" style="justify-content:space-between"><h2 style="margin:0">Anexos de "${esc(nomeLinha(aba, r))}"</h2><button class="btn sec peq" data-ax="fechar">Fechar</button></div>
    <div class="nota">${aba === 'Lancamentos' && r['Data'] ? dataBR(r['Data']) + ' · ' + brl(r['Valor']) + ' · ' + esc(r['Conta/Cartão']) : ''}</div>
    <label for="anexo-nota">Nota</label><textarea id="anexo-nota" rows="2" placeholder="Ex.: comprovante enviado ao RH, garantia até 2027...">${esc(r['Nota'] || '')}</textarea>
    <div class="anexo-lista">${anexos.map((a, k) => `<div class="anexo">
        ${urls[k] && /^image\//.test(a.tipo) ? `<a href="${esc(urls[k])}" target="_blank" rel="noopener"><img src="${esc(urls[k])}" alt="${esc(a.nome)}"></a>` : `<a class="pdf" href="${esc(urls[k] || '#')}" target="_blank" rel="noopener">${/pdf/.test(a.tipo) ? 'PDF' : 'Arquivo'}</a>`}
        <div class="anexo-nome" title="${esc(a.nome)}">${esc(a.nome)}</div>
        <div class="nota">${(a.tam / 1024 / 1024).toFixed(1).replace('.', ',')} MB · ${a.path ? 'na sua conta' : 'da versão antiga (não veio no backup)'}</div>
        <button class="btn sec peq" data-ax="remover" data-k="${k}">Remover</button>
      </div>`).join('') || '<p class="nota">Nenhum arquivo ainda.</p>'}</div>
    <label class="btn" style="display:inline-block;margin-top:10px">Adicionar imagem ou PDF<input type="file" id="anexo-arq" accept="image/*,application/pdf" multiple hidden></label>
    <span class="nota" style="margin-left:8px">ou cole um print aqui (Ctrl+V)</span>
    <div class="msg-anexo">${anexoMsg ? `<div class="msg ${/^Erro/.test(anexoMsg) ? 'erro' : 'ok'}">${esc(anexoMsg)}</div>` : ''}</div>
  </div>`;
  anexoMsg = '';
}

async function adicionarArquivos(files, abrir = true) {
  if (!anexoAlvo) return;
  const r = db[anexoAlvo.aba][anexoAlvo.idx];
  r['Anexos'] = r['Anexos'] || [];
  const erros = []; let ok = 0;
  const caixa = document.querySelector('#painel-anexo .msg-anexo');
  if (caixa) caixa.innerHTML = '<div class="msg ok">Enviando...</div>';
  for (const f of files) {
    if (!ANEXO_TIPOS.test(f.type)) { erros.push(f.name + ': só imagem ou PDF'); continue; }
    if (f.size > ANEXO_MAX) { erros.push(f.name + ': maior que 15 MB'); continue; }
    try { r['Anexos'].push(await guardarArquivo(f)); ok++; } catch (e) { erros.push(f.name + ': ' + ((e && (e.code || e.message)) || 'não foi possível guardar')); }
  }
  guardar();
  anexoMsg = erros.length ? 'Erro: ' + erros.join('; ') : ok + ' arquivo(s) anexado(s).';
  const alvo = anexoAlvo;
  if (!abrir) { anexoAlvo = null; render(); avisoRapido(anexoMsg); anexoMsg = ''; return; }
  render(); await abrirAnexos(alvo.aba, alvo.idx);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button');
  if (!t) { if (e.target.id === 'painel-anexo') fecharAnexos(); return; }
  if (t.id === 'btn-salvar') { salvarTudo(); return; }
  if (t.dataset.anexo) { e.preventDefault(); abrirAnexos(t.dataset.anexo, Number(t.dataset.idx)); return; }
  if (!t.dataset.ax || !anexoAlvo) return;
  if (t.dataset.ax === 'fechar') fecharAnexos();
  else if (t.dataset.ax === 'remover') {
    const r = db[anexoAlvo.aba][anexoAlvo.idx], k = Number(t.dataset.k), a = r['Anexos'][k];
    if (!confirmar('Remover o anexo "' + a.nome + '"?')) return;
    r['Anexos'].splice(k, 1); await apagarArquivo(a); guardar();
    const alvo = anexoAlvo; render(); abrirAnexos(alvo.aba, alvo.idx);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'anexo-arq') { adicionarArquivos([...e.target.files]); }
  else if (e.target.id === 'anexo-nota' && anexoAlvo) {
    const r = db[anexoAlvo.aba][anexoAlvo.idx];
    const v = e.target.value.trim().slice(0, 1000);
    if (contemNumeroSensivel(v)) { anexoMsg = 'Erro: não escreva número de cartão, conta ou documento na nota.'; abrirAnexos(anexoAlvo.aba, anexoAlvo.idx); return; }
    r['Nota'] = v; guardar(); render();
  }
  else if (e.target.id === 'rap-arq') { rapidoArquivos = [...e.target.files]; const l = document.getElementById('rap-arq-n'); if (l) l.textContent = rapidoArquivos.length ? rapidoArquivos.length + ' arquivo(s)' : ''; }
});
document.addEventListener('paste', e => {
  if (!anexoAlvo || document.getElementById('painel-anexo').hidden) return;
  const fs = [...(e.clipboardData && e.clipboardData.files || [])];
  if (fs.length) { e.preventDefault(); adicionarArquivos(fs); }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarTudo(); }
  if (e.key === 'Escape' && anexoAlvo) fecharAnexos();
});
window.addEventListener('beforeunload', e => { if (pendentes > 0) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendentes > 0) salvarTudo(true); });

// anexos já no formulário rápido do Cadastro
let rapidoArquivos = [];
const salvarRapidoV3 = salvarRapido;
salvarRapido = function () {
  const antes = db.Lancamentos.length;
  const ok = salvarRapidoV3();
  if (ok && rapidoArquivos.length && db.Lancamentos.length > antes) {
    const idx = antes, files = rapidoArquivos;
    rapidoArquivos = [];
    anexoAlvo = { aba: 'Lancamentos', idx };
    adicionarArquivos(files, false);
  }
  return ok;
};
const formRapidoV3 = formRapido;
formRapido = function () {
  return formRapidoV3().replace('<div><button class="btn" id="rap-salvar" type="submit">Lançar</button></div>',
    '<div><label class="btn sec" style="margin:0;display:block;text-align:center;font-weight:600">📎 Anexar<input type="file" id="rap-arq" accept="image/*,application/pdf" multiple hidden></label><div class="nota" id="rap-arq-n">' + (rapidoArquivos.length ? rapidoArquivos.length + ' arquivo(s)' : '') + '</div></div><div><button class="btn" id="rap-salvar" type="submit">Lançar</button></div>');
};

// anexos nos cards do Buyer
const cardItemV3 = cardItem;
cardItem = function (r) {
  return cardItemV3(r).replace(`<button class="btn sec peq" data-bx="editar" data-idx="${r.idx}">Editar</button>`,
    `<button class="btn sec peq" data-bx="editar" data-idx="${r.idx}">Editar</button>${btnAnexo('Compras_Futuras', r.idx, r.item).replace('btn sec clipe', 'btn sec peq clipe')}`);
};

// botão Salvar fixo no topo
(function () {
  const topo = document.querySelector('.topo');
  const resetar = document.getElementById('resetar');
  const box = document.createElement('div');
  box.className = 'salvar-box';
  box.innerHTML = '<span id="status-salvar" class="status-salvar" aria-live="polite"></span><button class="btn" id="btn-salvar" title="Salvar tudo (Ctrl+S)">Salvar</button>';
  topo.insertBefore(box, resetar);
})();
