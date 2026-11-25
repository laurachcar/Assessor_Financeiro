let pendConf = null, pendT = 0;
function avisoRapido(txt) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom, 0px));background:var(--texto);color:var(--bg);padding:10px 16px;border-radius:8px;z-index:50;max-width:90vw;font-size:13px'; document.body.appendChild(el); }
  el.textContent = txt; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 4500);
}
/** Dentro do Claude o navegador não mostra confirm(): pede um segundo clique. */
function confirmar(msg) {
  if (!window.claude) return window.confirm(msg);
  if (pendConf === msg && Date.now() - pendT < 6000) { pendConf = null; return true; }
  pendConf = msg; pendT = Date.now(); avisoRapido(msg + ' Clique de novo para confirmar.');
  return false;
}
