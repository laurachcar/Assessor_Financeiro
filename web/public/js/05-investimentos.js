/* ===== v3: página Investimentos, metas e agente investidor ===== */
TIPOS_INVESTIMENTO.splice(TIPOS_INVESTIMENTO.length - 1, 0, 'Internacional');
const PERFIS = ['Conservador', 'Moderado', 'Arrojado'];
const FEM = { Conservador: 'conservadora', Moderado: 'moderada', Arrojado: 'arrojada' };
FORMULARIOS.configuracoes.campos.push({ nome: 'perfil', rotulo: 'Seu perfil de investidora', tipo: 'lista', opcoes: PERFIS });
ABAS.Metas_Investimento.cabecalho = ABAS.Metas_Investimento.cabecalho.concat(['Objetivo', 'Perfil']);
FORMULARIOS.metas.campos.splice(1, 0, { nome: 'Objetivo', tipo: 'texto', rotulo: 'Objetivo (para que é esse dinheiro)' });
FORMULARIOS.metas.campos.splice(FORMULARIOS.metas.campos.length - 1, 0, { nome: 'Perfil', tipo: 'lista', opcoes: ['Automático'].concat(PERFIS), padrao: 'Automático', rotulo: 'Perfil de risco da meta' });
PAGINAS_PRINCIPAIS.push(['investir', 'Investimentos']);

/** Classes de ativos e premissas de rentabilidade bruta ao ano (estimativas, editáveis pelo CDI). */
function classesInvest() {
  const cdi = Number(db.cfg.cdi_aa) || 13;
  return {
    liquidez: { nome: 'Pós-fixado com liquidez', taxa: cdi, vol: 0.5, ex: 'Tesouro Selic, CDB 100% CDI com liquidez diária', cor: '#1a73e8' },
    credito: { nome: 'CDB, LCI e LCA', taxa: arred2(cdi * 1.06), vol: 1, ex: 'CDB 105-110% CDI ou LCI/LCA isentas de IR', cor: '#4285f4' },
    ipca: { nome: 'Inflação (IPCA+)', taxa: 11.5, vol: 6, ex: 'Tesouro IPCA+, debêntures incentivadas', cor: '#0b8043' },
    pre: { nome: 'Prefixado', taxa: arred2(cdi + 0.5), vol: 5, ex: 'Tesouro Prefixado, CDB prefixado', cor: '#33b679' },
    multi: { nome: 'Multimercado', taxa: arred2(cdi * 0.97), vol: 6, ex: 'Fundos multimercado ou previdência', cor: '#9e69af' },
    fii: { nome: 'Fundos imobiliários', taxa: 11, vol: 12, ex: 'FIIs de papel e de tijolo (ou ETF de FIIs)', cor: '#e8710a' },
    acoes: { nome: 'Ações Brasil', taxa: 15, vol: 25, ex: 'ETF do Ibovespa ou ações boas pagadoras de dividendos', cor: '#d93025' },
    intl: { nome: 'Internacional', taxa: 12, vol: 20, ex: 'ETF do S&P 500 na B3 ou BDRs', cor: '#7b61ff' },
    cripto: { nome: 'Cripto', taxa: 15, vol: 60, ex: 'ETF de cripto na B3, no máximo 5%', cor: '#f9ab00' }
  };
}

/** Carteiras modelo, sempre diversificadas (pesos em %). */
const MODELOS = {
  Conservador: { liquidez: 35, credito: 25, ipca: 20, pre: 5, multi: 5, fii: 5, intl: 5 },
  Moderado: { liquidez: 15, credito: 15, ipca: 20, pre: 5, multi: 5, fii: 15, acoes: 10, intl: 15 },
  Arrojado: { liquidez: 10, credito: 5, ipca: 15, fii: 15, acoes: 25, intl: 25, cripto: 5 }
};

function classeDoAtivo(a) {
  const t = normalizarTexto(a['Ativo'] + ' ' + a['Tipo']);
  const tipo = a['Tipo'];
  if (tipo === 'FII') return 'fii';
  if (tipo === 'Ações') return 'acoes';
  if (tipo === 'Cripto') return 'cripto';
  if (tipo === 'Internacional' || /s&p|ivvb|bdr|exterior|internacional/.test(t)) return 'intl';
  if (tipo === 'Fundos' || tipo === 'Previdência') return 'multi';
  if (/selic|liquidez/.test(t)) return 'liquidez';
  if (tipo === 'Tesouro Direto') return /prefix/.test(t) ? 'pre' : 'ipca';
  if (/ipca/.test(t)) return 'ipca';
  if (/prefix/.test(t)) return 'pre';
  if (tipo === 'CDB/LCI/LCA' || tipo === 'Renda fixa (outros)') return 'credito';
  return 'multi';
}

function taxaMes(aa) { return Math.pow(1 + aa / 100, 1 / 12) - 1; }

/** Taxa e volatilidade de uma carteira com pesos {classe: %}. */
function perfilCarteira(pesos) {
  const C = classesInvest();
  const tot = Object.values(pesos).reduce((s, v) => s + v, 0) || 1;
  let taxa = 0, varc = 0;
  Object.keys(pesos).forEach(k => { const w = pesos[k] / tot; taxa += w * C[k].taxa; varc += Math.pow(w * C[k].vol, 2); });
  return { taxa: arred2(taxa), vol: arred2(Math.sqrt(varc)) };
}

/** Projeção mês a mês em 3 cenários (pessimista, base, otimista). */
function projetar(pv, aporte, meses, taxa, vol) {
  const cen = { pess: taxa - vol * 0.6, base: taxa, otim: taxa + vol * 0.6 };
  const r = { meses: [], pess: [], base: [], otim: [], aportes: [] };
  const v = { pess: pv, base: pv, otim: pv };
  for (let m = 0; m <= meses; m++) {
    if (m > 0) Object.keys(cen).forEach(k => { v[k] = v[k] * (1 + taxaMes(Math.max(-60, cen[k]))) + aporte; });
    r.meses.push(m); r.aportes.push(arred2(pv + aporte * m));
    Object.keys(cen).forEach(k => r[k].push(arred2(v[k])));
  }
  return r;
}

function aporteNecessario(pv, alvo, meses, aa) {
  if (meses <= 0) return Math.max(0, alvo - pv);
  const i = taxaMes(aa), f = Math.pow(1 + i, meses);
  return Math.max(0, arred2((alvo - pv * f) * i / (f - 1)));
}

function mesesParaAlvo(pv, aporte, alvo, aa) {
  const i = taxaMes(aa);
  let v = pv;
  for (let m = 0; m <= 600; m++) { if (v >= alvo) return m; v = v * (1 + i) + aporte; }
  return null;
}

function perfilPorPrazo(meses) {
  const usuario = PERFIS.indexOf(db.cfg.perfil) >= 0 ? db.cfg.perfil : 'Moderado';
  const pz = meses <= 12 ? 'Conservador' : meses <= 48 ? 'Moderado' : 'Arrojado';
  return PERFIS[Math.min(PERFIS.indexOf(usuario), PERFIS.indexOf(pz))];
}

function carteiraAtual() {
  const C = classesInvest();
  const ativos = (db.Carteira || []).filter(a => ehSim(a['Ativa'])).map(a => {
    const classe = classeDoAtivo(a);
    const taxa = (Number(a['Rentabilidade % a.a.']) || 0) + (Number(a['Dividendos % a.a.']) || 0) || C[classe].taxa;
    return { a, classe, saldo: Number(a['Saldo atual']) || 0, aplicado: Number(a['Valor aplicado']) || 0, taxa, vol: C[classe].vol };
  });
  const total = arred2(ativos.reduce((s, x) => s + x.saldo, 0));
  const porClasse = {};
  ativos.forEach(x => { porClasse[x.classe] = arred2((porClasse[x.classe] || 0) + x.saldo); });
  const pesos = {};
  Object.keys(porClasse).forEach(k => { pesos[k] = total ? porClasse[k] / total * 100 : 0; });
  const taxa = total ? ativos.reduce((s, x) => s + x.saldo * x.taxa, 0) / total : 0;
  const vol = total ? Math.sqrt(ativos.reduce((s, x) => s + Math.pow(x.saldo / total * x.vol, 2), 0)) : 0;
  const nClasses = Object.values(pesos).filter(p => p >= 5).length;
  const maior = Object.keys(pesos).sort((a, b) => pesos[b] - pesos[a])[0];
  const nota = nClasses >= 5 && pesos[maior] < 40 ? 'Boa' : nClasses >= 3 && pesos[maior] < 60 ? 'Média' : 'Baixa';
  return { ativos, total, porClasse, pesos, taxa: arred2(taxa), vol: arred2(vol), nClasses, maior, nota };
}

function mesesAte(prazo) {
  const p = mesDe(prazo);
  return p ? Math.max(0, difMeses(MES, p)) : null;
}

/** Situação de cada meta: perfil, aporte que ela recebe, aporte necessário e projeção. */
function analisarMetas() {
  const aporte = Number(db.cfg.aporte_mensal) || 0;
  const reserva = db.Aporte_Reserva.length ? Number(db.Aporte_Reserva[db.Aporte_Reserva.length - 1]['Reserva depois']) : 0;
  const reservaCompleta = reserva >= Number(db.cfg.meta_reserva);
  const paraMetas = reservaCompleta ? aporte : aporte * (1 - (Number(db.cfg.pct_reserva) || 0) / 100);
  return (db.Metas_Investimento || []).filter(m => ehSim(m['Ativa'])).map(m => {
    const meses = mesesAte(m['Prazo']);
    const perfil = PERFIS.indexOf(m['Perfil']) >= 0 ? m['Perfil'] : perfilPorPrazo(meses === null ? 60 : meses);
    const pc = perfilCarteira(MODELOS[perfil]);
    const pv = Number(m['Acumulado']) || 0, alvo = Number(m['Valor alvo']) || 0;
    const recebe = arred2(paraMetas * (Number(m['% do aporte']) || 0) / 100);
    const precisa = meses === null ? null : aporteNecessario(pv, alvo, meses, pc.taxa);
    const chega = mesesParaAlvo(pv, recebe, alvo, pc.taxa);
    const status = alvo && pv >= alvo ? 'atingida' : precisa === null ? 'sem-prazo' : recebe + 0.5 >= precisa ? 'no-ritmo' : 'atrasada';
    return { m, meses, perfil, pc, pv, alvo, recebe, precisa, chega, status };
  });
}

// ------------------------------------------------------------ gráfico de projeção
function graficoProjecao(proj, alvo) {
  const w = 720, h = 240, mg = { e: 70, d: 14, t: 14, b: 26 };
  const n = proj.meses.length - 1;
  const max = Math.max(...proj.otim, alvo || 0) * 1.04, min = Math.min(...proj.pess, ...proj.aportes) * 0.97;
  const x = i => mg.e + i / n * (w - mg.e - mg.d);
  const y = v => mg.t + (max - v) / ((max - min) || 1) * (h - mg.t - mg.b);
  const linha = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = linha(proj.otim) + ' ' + proj.pess.map((v, i) => 'L' + x(n - i).toFixed(1) + ' ' + y(proj.pess[n - i]).toFixed(1)).join(' ') + ' Z';
  const ticks = [max, (max + min) / 2, min];
  const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : Math.round(v / 1000) + ' mil';
  const passo = n > 24 ? 12 : n > 12 ? 3 : 2;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Projeção da carteira">
    ${ticks.map(t => `<line x1="${mg.e}" x2="${w - mg.d}" y1="${y(t)}" y2="${y(t)}" stroke="var(--borda)"/><text x="${mg.e - 6}" y="${y(t) + 4}" text-anchor="end">R$ ${fmt(t)}</text>`).join('')}
    ${proj.meses.filter(i => i % passo === 0).map(i => `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${i === 0 ? 'hoje' : n > 24 ? (i / 12) + ' a' : i + 'm'}</text>`).join('')}
    ${alvo && alvo <= max ? `<line x1="${mg.e}" x2="${w - mg.d}" y1="${y(alvo)}" y2="${y(alvo)}" stroke="var(--ok)" stroke-dasharray="5 4"/><text x="${w - mg.d}" y="${y(alvo) - 5}" text-anchor="end" style="fill:var(--ok)">meta</text>` : ''}
    <path d="${area}" fill="var(--primaria)" opacity=".14"/>
    <path d="${linha(proj.aportes)}" fill="none" stroke="var(--barra2)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <path d="${linha(proj.base)}" fill="none" stroke="var(--primaria)" stroke-width="2.5"/>
    <circle cx="${x(n)}" cy="${y(proj.base[n])}" r="4" fill="var(--primaria)"><title>${brl(proj.base[n])}</title></circle>
  </svg>
  <div class="linha nota" style="gap:14px"><span><span class="bolinha" style="background:var(--primaria)"></span> cenário base</span><span><span class="bolinha" style="background:var(--primaria);opacity:.3"></span> faixa pessimista a otimista</span><span><span class="bolinha" style="background:var(--barra2)"></span> só o que você aportou</span></div>`;
}

function barraAlocacao(pesos) {
  const C = classesInvest();
  const ks = Object.keys(pesos).filter(k => pesos[k] > 0).sort((a, b) => pesos[b] - pesos[a]);
  return `<div class="aloc">${ks.map(k => `<div style="width:${pesos[k]}%;background:${C[k].cor}" title="${esc(C[k].nome)} ${Math.round(pesos[k])}%"></div>`).join('')}</div>
  <div class="aloc-leg">${ks.map(k => `<span><span class="bolinha" style="background:${C[k].cor}"></span>${esc(C[k].nome)} <b>${Math.round(pesos[k])}%</b></span>`).join('')}</div>`;
}

// ------------------------------------------------------------ opções de carteira (usadas pelo chat)
/** As 3 carteiras diversificadas para um valor inicial, um aporte e um prazo, com a projeção de 12 meses. */
function opcoesCarteira(pv, aporte, meses, alvo, recomendado) {
  const C = classesInvest();
  return PERFIS.map(p => {
    const pc = perfilCarteira(MODELOS[p]);
    const pr = projetar(pv, aporte, 12, pc.taxa, pc.vol);
    const chega = alvo ? mesesParaAlvo(pv, aporte, alvo, pc.taxa) : null;
    const precisa = alvo && meses ? aporteNecessario(pv, alvo, meses, pc.taxa) : null;
    return { perfil: p, pesos: MODELOS[p], taxa: pc.taxa, vol: pc.vol, v12: pr.base[12], v12p: pr.pess[12], v12o: pr.otim[12], ganho12: arred2(pr.base[12] - pv - aporte * 12), chega, precisa, recomendado: p === recomendado,
      itens: Object.keys(MODELOS[p]).map(k => ({ k, nome: C[k].nome, ex: C[k].ex, peso: MODELOS[p][k], cor: C[k].cor, aporte: arred2(aporte * MODELOS[p][k] / 100) })) };
  });
}

function htmlOpcoes(card) {
  const ops = opcoesCarteira(card.pv, card.aporte, card.meses, card.alvo, card.recomendado);
  return `<div class="opcoes-cart">
    <div class="nota" style="grid-column:1/-1">${esc(card.titulo)}: começa com ${brl(card.pv)}, aporte de ${brl(card.aporte)}/mês${card.alvo ? ', meta de ' + brl(card.alvo) : ''}${card.meses ? ' em ' + card.meses + ' meses' : ''}.</div>
    ${ops.map(o => `<div class="op ${o.recomendado ? 'rec-op' : ''}">
      <div class="linha" style="justify-content:space-between"><b>Carteira ${FEM[o.perfil]}</b>${o.recomendado ? '<span class="pill ok">recomendada</span>' : ''}</div>
      <div class="aloc" style="margin:8px 0 6px">${o.itens.map(i => `<div style="width:${i.peso}%;background:${i.cor}" title="${esc(i.nome)} ${i.peso}%"></div>`).join('')}</div>
      <table>${o.itens.map(i => `<tr><td><span class="bolinha" style="background:${i.cor}"></span> ${esc(i.nome)}<div class="nota">${esc(i.ex)}</div></td><td class="r">${i.peso}%</td><td class="r">${card.aporte ? brl(i.aporte) + '/mês' : ''}</td></tr>`).join('')}</table>
      <div class="proj12">Em 12 meses: <b>${brl(o.v12)}</b><div class="nota">faixa ${brl(o.v12p)} a ${brl(o.v12o)} · rende ~${String(o.taxa).replace('.', ',')}% a.a. · rendimento ${brl(o.ganho12)}</div>
      ${o.chega !== null ? `<div class="nota">Chega na meta em ${o.chega} meses</div>` : card.alvo ? '<div class="nota">Não chega na meta em 50 anos com esse aporte</div>' : ''}
      ${o.precisa !== null ? `<div class="nota">Para cumprir o prazo: ${brl(o.precisa)}/mês</div>` : ''}</div>
    </div>`).join('')}
  </div>`;
}

// ------------------------------------------------------------ agente investidor
function interpretar(texto) {
  const t = normalizarTexto(texto);
  const r = {};
  const metas = (db.Metas_Investimento || []).filter(m => ehSim(m['Ativa']));
  r.meta = metas.find(m => t.indexOf(normalizarTexto(m['Meta'])) >= 0) || null;
  const valores = [...String(texto).matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s*(mil|k)?/gi)].map(m => { let v = Number(m[1].replace(/\./g, '').replace(',', '.')); if (m[2]) v *= 1000; return { v, i: m.index, txt: m[0] }; }).filter(x => x.v >= 50);
  const mens = valores.find(x => /mes|mensal|por mes/.test(normalizarTexto(String(texto).slice(x.i, x.i + x.txt.length + 14))));
  if (mens) r.aporte = mens.v;
  const outros = valores.filter(x => x !== mens);
  if (outros.length) r.alvo = Math.max(...outros.map(x => x.v));
  const anos = t.match(/(\d+)\s*anos?/), meses = t.match(/(\d+)\s*mes(es)?\b/);
  if (anos) r.meses = Number(anos[1]) * 12; else if (meses && !mens) r.meses = Number(meses[1]);
  r.perfil = PERFIS.find(p => t.indexOf(normalizarTexto(p)) >= 0) || null;
  r.reserva = /reserva|emergencia/.test(t);
  r.carteira = /carteira|diversific|rebalance|minha alocacao|meus investimentos/.test(t);
  return r;
}

/** Resposta local (sem internet): texto + o cartão com as 3 carteiras diversificadas. */
function responderLocal(texto) {
  const q = interpretar(texto);
  const cart = carteiraAtual();
  const metas = analisarMetas();
  const aporteTotal = Number(db.cfg.aporte_mensal) || 0;
  const linhas = [];
  let card;
  if (q.reserva && !q.meta) {
    const meta = Number(db.cfg.meta_reserva) || 0;
    const reserva = db.Aporte_Reserva.length ? Number(db.Aporte_Reserva[db.Aporte_Reserva.length - 1]['Reserva depois']) : 0;
    linhas.push(`Sua reserva de emergência está em ${brl(reserva)} de ${brl(meta)}.`);
    linhas.push('Reserva precisa de liquidez diária e risco baixíssimo: Tesouro Selic ou CDB 100% do CDI com liquidez diária de banco grande. Nada de ações, FII ou cripto aqui.');
    linhas.push(reserva >= meta ? 'Ela já está completa: o aporte inteiro pode ir para as metas, numa carteira diversificada como as abaixo.' : `Faltam ${brl(meta - reserva)}. Enquanto isso, ${db.cfg.pct_reserva}% do aporte vai para ela. Com a reserva cheia, o resto segue nas carteiras abaixo.`);
    card = { titulo: 'Depois da reserva, para as metas', pv: 0, aporte: aporteTotal, meses: 12, alvo: 0, recomendado: perfilPorPrazo(36) };
  } else if (q.meta || (!q.carteira && metas.length && !q.alvo)) {
    const alvoM = q.meta ? metas.find(a => a.m === q.meta) : metas.slice().sort((a, b) => (a.status === 'atrasada' ? -1 : 1) - (b.status === 'atrasada' ? -1 : 1))[0];
    if (!alvoM) { linhas.push('Essa meta está inativa. Ative em Metas e objetivos.'); card = null; }
    else {
      const m = alvoM;
      const aporte = q.aporte || m.recebe;
      const meses = q.meses || m.meses || 60;
      const perfil = q.perfil || m.perfil;
      linhas.push(`Meta **${m.m['Meta']}**${m.m['Objetivo'] ? ' (' + m.m['Objetivo'] + ')' : ''}: você tem ${brl(m.pv)} de ${brl(m.alvo)}${m.meses !== null ? ', prazo em ' + m.meses + ' meses' : ''}.`);
      linhas.push(`Com ${brl(aporte)}/mês numa carteira ${FEM[perfil]} (~${String(perfilCarteira(MODELOS[perfil]).taxa).replace('.', ',')}% a.a. bruto), ${(() => { const c = mesesParaAlvo(m.pv, aporte, m.alvo, perfilCarteira(MODELOS[perfil]).taxa); return c === null ? 'a meta não fecha: é preciso aumentar o aporte ou o prazo.' : 'você chega lá em cerca de ' + c + ' meses (' + (c / 12).toFixed(1).replace('.', ',') + ' anos).'; })()}`);
      const prec = aporteNecessario(m.pv, m.alvo, meses, perfilCarteira(MODELOS[perfil]).taxa);
      linhas.push(prec > aporte + 0.5 ? `Para cumprir em ${meses} meses, o aporte precisaria ser de ${brl(prec)}/mês. Dá para fechar a diferença aumentando o % do aporte dessa meta, alongando o prazo ou usando o cashback e os rendimentos.` : `O aporte atual dá conta do prazo de ${meses} meses.`);
      linhas.push(`Para ${meses <= 12 ? 'prazo curto, priorize renda fixa e liquidez' : meses <= 48 ? 'médio prazo, o núcleo é renda fixa (pós e IPCA+) com um pedaço em FII, ações e exterior' : 'longo prazo, cabe mais renda variável e exterior, sempre com uma base de IPCA+'}. Veja as três opções diversificadas:`);
      card = { titulo: 'Opções para ' + m.m['Meta'], pv: m.pv, aporte, meses, alvo: m.alvo, recomendado: perfil };
    }
  } else if (q.carteira) {
    const C = classesInvest();
    linhas.push(`Sua carteira tem ${brl(cart.total)} em ${cart.nClasses} classe(s) com peso relevante. Diversificação: **${cart.nota}**.`);
    if (cart.maior) linhas.push(`A maior fatia é ${C[cart.maior].nome}, com ${Math.round(cart.pesos[cart.maior])}%.${cart.pesos[cart.maior] > 40 ? ' Isso concentra o risco: direcione os próximos aportes para as classes que faltam em vez de vender.' : ''}`);
    const faltam = Object.keys(MODELOS[perfilPorPrazo(60)]).filter(k => !(cart.pesos[k] >= 3)).map(k => C[k].nome);
    if (faltam.length) linhas.push('Classes que faltam para ficar parecida com a carteira modelo: ' + faltam.join(', ') + '.');
    linhas.push(`Rendimento médio estimado: ~${String(cart.taxa).replace('.', ',')}% a.a. Veja como ficariam os próximos 12 meses em cada carteira:`);
    card = { titulo: 'Rebalanceando com os aportes', pv: cart.total, aporte: aporteTotal, meses: 12, alvo: 0, recomendado: q.perfil || perfilPorPrazo(60) };
  } else {
    const alvo = q.alvo || 0, meses = q.meses || (alvo ? 60 : 12), aporte = q.aporte || aporteTotal;
    const perfil = q.perfil || perfilPorPrazo(meses);
    linhas.push(alvo ? `Para juntar ${brl(alvo)} em ${meses} meses com ${brl(aporte)}/mês, a carteira mais adequada é a ${FEM[perfil]}.` : `Com ${brl(aporte)}/mês, estas são as carteiras diversificadas que eu montaria.`);
    linhas.push('Quer que eu guarde isso como meta? Cadastre em Metas e objetivos, ao lado, e me pergunte pelo nome dela.');
    card = { titulo: alvo ? 'Simulação' : 'Carteiras sugeridas', pv: 0, aporte, meses, alvo, recomendado: perfil };
  }
  linhas.push('_Estimativas brutas, antes do IR, com premissas médias. Não é recomendação individual de um consultor certificado._');
  return { texto: linhas.join('\n\n'), card };
}

function md(txt) { return esc(txt).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<i class="nota">$2</i>').replace(/\n/g, '<br>'); }

let chatOcupado = false;
/** IA ligada quando há uma sessão ativa (o agente roda no servidor). Definido em 07-nuvem.js. */
let iaDisponivel = null;

function contextoIA() {
  const cart = carteiraAtual();
  return {
    hoje: diaChave(HOJE), nome: db.cfg.nome || '', perfil: db.cfg.perfil || 'Moderado', aporte_mensal: db.cfg.aporte_mensal, cdi_aa: db.cfg.cdi_aa,
    reserva_emergencia: { meta: db.cfg.meta_reserva, saldo: db.Aporte_Reserva.length ? db.Aporte_Reserva[db.Aporte_Reserva.length - 1]['Reserva depois'] : 0 },
    carteira: cart.ativos.map(x => ({ ativo: x.a['Ativo'], tipo: x.a['Tipo'], saldo: x.saldo, taxa_aa: x.taxa, meta: x.a['Meta'] })),
    diversificacao: cart.nota,
    metas: analisarMetas().map(a => ({ meta: a.m['Meta'], objetivo: a.m['Objetivo'] || '', alvo: a.alvo, acumulado: a.pv, prazo_meses: a.meses, aporte_recebido_mes: a.recebe, aporte_necessario_mes: a.precisa, perfil: a.perfil, situacao: a.status })),
    premissas_classes: Object.fromEntries(Object.entries(classesInvest()).map(([k, c]) => [c.nome, { taxa_aa: c.taxa, volatilidade: c.vol, exemplos: c.ex }])),
    carteiras_modelo: MODELOS
  };
}

/** Responde na hora com o cálculo local e, se a IA estiver ligada, troca pela resposta do agente no servidor. */
async function enviarChat(texto) {
  if (chatOcupado || !texto.trim()) return;
  db.ChatInvest = db.ChatInvest || [];
  db.ChatInvest.push({ role: 'user', text: texto.trim(), em: diaChave(HOJE) });
  const local = responderLocal(texto);
  const msg = { role: 'assistant', text: local.texto, card: local.card, em: diaChave(HOJE) };
  db.ChatInvest.push(msg);
  db.ChatInvest = db.ChatInvest.slice(-40);
  guardar();
  if (!iaDisponivel) { render(); rolarChat(); return; }
  chatOcupado = true;
  msg.text = 'Pensando...'; msg.ia = true;
  render(); rolarChat();
  const historico = db.ChatInvest.slice(-9, -2).map(m => ({ role: m.role, content: m.role === 'user' ? m.text : (m.textoIA || m.text) }));
  try {
    const res = await agenteIA('investidor', { pergunta: texto.trim(), historico, contexto: contextoIA(), calculo: local.texto }, parcial => {
      msg.text = parcial; const el = document.getElementById('ultima-ia'); if (el) el.innerHTML = md(parcial); rolarChat();
    });
    msg.text = res; msg.textoIA = res;
  } catch (e) {
    msg.ia = false;
    msg.text = local.texto + '\n\n_(' + ((e && e.message) || 'O agente não respondeu agora') + '; mostrei o cálculo local.)_';
  }
  chatOcupado = false;
  guardar(); render(); rolarChat();
}

function rolarChat() { const el = document.getElementById('chat-msgs'); if (el) el.scrollTop = el.scrollHeight; }

const SUGESTOES = () => {
  const metas = (db.Metas_Investimento || []).filter(m => ehSim(m['Ativa']));
  return (metas[0] ? ['Como atinjo a meta ' + metas[0]['Meta'] + '?'] : []).concat(['Minha carteira está diversificada?', 'Onde deixo a reserva de emergência?', 'Quero juntar R$ 50 mil em 3 anos com R$ 1.200 por mês']);
};

let metaEdit = null, metaMsg = null;
function formMeta() {
  const def = FORMULARIOS.metas;
  const reg = metaEdit !== null ? db.Metas_Investimento[metaEdit] : null;
  const campo = c => {
    let v = reg ? reg[c.nome] : (c.padrao !== undefined ? c.padrao : '');
    if (v === undefined || v === null) v = '';
    if (c.tipo === 'simnao') return `<label class="check"><input type="checkbox" name="${esc(c.nome)}" ${!reg || ehSim(v) ? 'checked' : ''}> ${esc(c.rotulo || c.nome)}</label>`;
    if (c.tipo === 'lista') return `<div><label>${esc(c.rotulo || c.nome)}</label><select name="${esc(c.nome)}">${c.opcoes.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    if (c.tipo === 'mes') v = mesDe(v);
    if (typeof v === 'number') v = String(v).replace('.', ',');
    const rot = { 'Acumulado': 'Já tenho (R$)', 'Valor alvo': 'Quanto quero juntar (R$)', 'Prazo': 'Até quando', '% do aporte': '% do aporte mensal' }[c.nome] || c.rotulo || c.nome;
    return `<div class="${c.nome === 'Objetivo' ? 'w2' : ''}"><label>${esc(rot)}${c.obrigatorio ? ' *' : ''}</label><input type="${c.tipo === 'mes' ? 'month' : 'text'}" name="${esc(c.nome)}" value="${esc(v)}" ${/moeda|percentual/.test(c.tipo) ? 'inputmode="decimal"' : ''}></div>`;
  };
  const msg = metaMsg ? `<div class="msg ${metaMsg.ok ? 'ok' : 'erro'}">${metaMsg.texto.map(esc).join('<br>')}</div>` : '';
  metaMsg = null;
  return `<form id="form-meta" class="form-wish" autocomplete="off">${def.campos.map(campo).join('')}
    <div class="linha"><button class="btn" type="submit">${reg ? 'Salvar meta' : 'Adicionar meta'}</button>${reg ? '<button class="btn sec" type="button" data-ix="cancelar-meta">Cancelar</button>' : ''}</div></form>${msg}`;
}

function salvarMeta(form) {
  const def = FORMULARIOS.metas;
  const dados = {};
  def.campos.forEach(c => { const el = form.querySelector(`[name="${CSS.escape(c.nome)}"]`); dados[c.nome] = c.tipo === 'simnao' ? el.checked : el.value; });
  const v = validarCampos(def.campos, dados, opcoes());
  if (!v.ok) { metaMsg = { ok: false, texto: v.erros }; return; }
  const original = metaEdit !== null ? db.Metas_Investimento[metaEdit]['Meta'] : '';
  const r = salvarUpsert(def, v.valores, original);
  metaMsg = r.ok ? { ok: true, texto: [r.mensagem] } : { ok: false, texto: r.erros };
  if (r.ok) { metaEdit = null; guardar(); }
}

let horizonteProj = 12;
function telaInvestir() {
  const cart = carteiraAtual();
  const C = classesInvest();
  const aporte = Number(db.cfg.aporte_mensal) || 0;
  const proj = projetar(cart.total, aporte, horizonteProj, cart.taxa, cart.vol);
  const metas = analisarMetas();
  const rendMes = arred2(cart.ativos.reduce((s, x) => s + x.saldo * taxaMes(x.taxa), 0));
  const ganho = arred2(cart.total - cart.ativos.reduce((s, x) => s + x.aplicado, 0));
  const somaPct = somaPercentuaisMetas(db.Metas_Investimento);
  const chat = (db.ChatInvest || []);
  const ultimaIA = chat.length - 1;
  const STATUS = { 'atingida': ['ok', 'Atingida'], 'no-ritmo': ['ok', 'No ritmo'], 'atrasada': ['erro', 'Abaixo do ritmo'], 'sem-prazo': ['aviso', 'Sem prazo'] };
  return `<div class="titulo-pag"><h2>Investimentos</h2><p>Sua carteira, para onde ela vai em 12 meses e um agente para planejar as metas.</p></div>
  <div class="kpis">
    <div class="kpi destaque"><div class="rot">Patrimônio investido</div><div class="val">${brl(cart.total)}</div><div class="det">ganho até aqui ${brl(ganho)} · ${cart.ativos.length} ativo(s)</div></div>
    <div class="kpi"><div class="rot">Rendimento estimado por mês</div><div class="val pos">${brl(rendMes)}</div><div class="det">média de ~${String(cart.taxa).replace('.', ',')}% ao ano</div></div>
    <div class="kpi"><div class="rot">Em 12 meses (cenário base)</div><div class="val">${brl(projetar(cart.total, aporte, 12, cart.taxa, cart.vol).base[12])}</div><div class="det">com aporte de ${brl(aporte)}/mês</div></div>
    <div class="kpi"><div class="rot">Diversificação</div><div class="val ${cart.nota === 'Boa' ? 'pos' : cart.nota === 'Baixa' ? 'neg' : ''}">${cart.nota}</div><div class="det">${cart.nClasses} classe(s) relevantes${cart.maior ? ' · maior: ' + esc(C[cart.maior].nome) + ' ' + Math.round(cart.pesos[cart.maior]) + '%' : ''}</div></div>
  </div>
  <div class="dupla2 secao">
    <div class="card"><div class="linha" style="justify-content:space-between"><h2 style="margin:0">Projeção da carteira</h2>
        <div class="seg">${[[12, '12 meses'], [60, '5 anos'], [120, '10 anos']].map(([n, r]) => `<button type="button" data-hz="${n}" class="${n === horizonteProj ? 'ativo t-Transferência' : ''}">${r}</button>`).join('')}</div></div>
      ${cart.total || aporte ? graficoProjecao(proj, 0) : '<p class="nota">Cadastre seus investimentos para ver a projeção.</p>'}
      <div class="totais-filtro"><span>Pessimista <b>${brl(proj.pess[horizonteProj])}</b></span><span>Base <b>${brl(proj.base[horizonteProj])}</b></span><span>Otimista <b>${brl(proj.otim[horizonteProj])}</b></span><span>Aportado <b>${brl(proj.aportes[horizonteProj])}</b></span></div>
      <p class="nota">Cada ativo cresce pela rentabilidade + dividendos que você cadastrou (ou pela premissa da classe), com os dividendos reinvestidos. A faixa usa a oscilação típica de cada classe. Aporte mensal em Cadastro &gt; Configurações.</p>
    </div>
    <div class="card"><h2>Alocação atual</h2>${cart.total ? barraAlocacao(cart.pesos) : '<p class="nota">Sem ativos.</p>'}
      <div class="tabela secao"><table>
        <tr><th>Ativo</th><th class="r">Saldo</th><th class="r">Em 12 meses</th></tr>
        ${cart.ativos.map(x => `<tr><td><span class="bolinha" style="background:${C[x.classe].cor}"></span> ${esc(x.a['Ativo'])}<div class="nota">${esc(C[x.classe].nome)}${x.a['Meta'] ? ' · ' + esc(x.a['Meta']) : ''} · ${String(arred2(x.taxa)).replace('.', ',')}% a.a.</div></td><td class="r">${brl(x.saldo)}</td><td class="r">${brl(x.saldo * Math.pow(1 + x.taxa / 100, 1))}</td></tr>`).join('') || '<tr><td colspan="3" class="nota">Nenhum ativo.</td></tr>'}
      </table></div>
      <button class="btn sec peq secao" data-ix="editar-carteira">Editar carteira em Cadastro</button>
    </div>
  </div>
  <div class="card secao"><div class="linha" style="justify-content:space-between"><h2 style="margin:0">Metas e objetivos</h2><span class="pill ${somaPct === 100 ? 'ok' : 'aviso'}">${somaPct}% do aporte distribuído</span></div>
    <div class="metas-grid secao">${metas.map(a => { const pct = a.alvo ? Math.min(1, a.pv / a.alvo) : 0; const st = STATUS[a.status]; const idx = db.Metas_Investimento.indexOf(a.m); return `<div class="meta-card">
      <div class="linha" style="justify-content:space-between"><b>${esc(a.m['Meta'])}</b><span class="pill ${st[0]}">${st[1]}</span></div>
      ${a.m['Objetivo'] ? `<div class="nota">${esc(a.m['Objetivo'])}</div>` : ''}
      <div class="preco-meta">${brl(a.pv)} <span class="nota">de ${brl(a.alvo)}</span></div>
      <div class="mini-barra"><div style="width:${Math.round(pct * 100)}%;background:var(--ok)"></div></div>
      <div class="nota" style="margin-top:6px">${a.meses !== null ? 'Prazo: ' + rotuloMes(mesDe(a.m['Prazo'])) + ' (' + a.meses + ' meses)' : 'Sem prazo'} · perfil ${a.perfil.toLowerCase()} (~${String(a.pc.taxa).replace('.', ',')}% a.a.)</div>
      <div class="nota">Recebe ${brl(a.recebe)}/mês${a.precisa !== null ? ' · precisa de ' + brl(a.precisa) + '/mês' : ''}${a.chega !== null ? ' · chega em ' + a.chega + ' meses' : ''}</div>
      <div class="acoes" style="margin-top:8px"><button class="btn peq" data-ix="perguntar" data-meta="${esc(a.m['Meta'])}">Perguntar ao agente</button><button class="btn sec peq" data-ix="editar-meta" data-idx="${idx}">Editar</button><button class="btn sec peq" data-ix="excluir-meta" data-idx="${idx}">Excluir</button></div>
    </div>`; }).join('') || '<p class="nota">Nenhuma meta ativa. Cadastre a primeira abaixo.</p>'}</div>
    <h3 class="secao" style="font-size:14px">${metaEdit !== null ? 'Editar meta' : 'Nova meta ou objetivo'}</h3>
    ${formMeta()}
    <p class="nota">Perfil automático: até 1 ano conservador, até 4 anos moderado, mais que isso arrojado (sem passar do seu perfil, ${esc(db.cfg.perfil || 'Moderado')}, que você muda em Cadastro &gt; Configurações).</p>
  </div>
  <div class="card secao" id="card-chat">
    <div class="agente-topo"><div class="avatar" aria-hidden="true">I</div><div><h2>Agente investidor</h2><div class="nota" id="ia-status">${iaDisponivel === null ? 'Conectando...' : iaDisponivel ? 'Agente com IA ligado' + (typeof textoUsoIA === 'function' ? textoUsoIA() : '') : 'Modo offline: respostas calculadas aqui'}</div></div>
      ${chat.length ? '<button class="btn sec peq" data-ix="limpar-chat" style="margin-left:auto">Limpar conversa</button>' : ''}</div>
    <div class="chat" id="chat-msgs">
      ${chat.length ? '' : `<div class="bolha ia">Oi${db.cfg.nome ? ', ' + esc(db.cfg.nome) : ''}! Sou o agente investidor. Me pergunte sobre uma meta, sobre a sua carteira ou simule um objetivo novo (ex.: "quero juntar R$ 80 mil em 4 anos"). Sempre te mostro três carteiras diversificadas com a projeção de 12 meses.</div>`}
      ${chat.map((m, i) => `<div class="bolha ${m.role === 'user' ? 'eu' : 'ia'} ${m.card ? 'larga' : ''}"><div ${i === ultimaIA && m.role === 'assistant' ? 'id="ultima-ia"' : ''}>${md(m.text)}</div>${m.card ? htmlOpcoes(m.card) : ''}</div>`).join('')}
    </div>
    <div class="sugestoes">${SUGESTOES().map(s => `<button type="button" data-ix="sugestao" data-txt="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form id="form-chat" class="linha" autocomplete="off"><input id="chat-in" placeholder="Pergunte ao agente investidor..." style="flex:1;min-width:0" ${chatOcupado ? 'disabled' : ''}><button class="btn" type="submit" ${chatOcupado ? 'disabled' : ''}>Enviar</button></form>
  </div>`;
}

document.addEventListener('click', e => {
  if (abaAtual !== 'investir') return;
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.hz) { horizonteProj = Number(t.dataset.hz); render(); return; }
  const a = t.dataset.ix;
  if (!a) return;
  e.preventDefault();
  if (a === 'editar-carteira') { abaAtual = 'cadastro'; planAtual = 'Carteira'; render(); window.scrollTo(0, 0); }
  else if (a === 'editar-meta') { metaEdit = Number(t.dataset.idx); render(); document.getElementById('form-meta').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (a === 'cancelar-meta') { metaEdit = null; render(); }
  else if (a === 'excluir-meta') { const m = db.Metas_Investimento[Number(t.dataset.idx)]; if (!confirmar('Excluir a meta "' + m['Meta'] + '"?')) return; db.Metas_Investimento.splice(Number(t.dataset.idx), 1); metaEdit = null; guardar(); render(); }
  else if (a === 'perguntar') { enviarChat('Como atinjo a meta ' + t.dataset.meta + '?'); setTimeout(() => { const c = document.getElementById('card-chat'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }, 50); }
  else if (a === 'sugestao') enviarChat(t.dataset.txt);
  else if (a === 'limpar-chat') { db.ChatInvest = []; guardar(); render(); }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'form-chat') { e.preventDefault(); const i = document.getElementById('chat-in'); const v = i.value; i.value = ''; enviarChat(v); }
  else if (e.target.id === 'form-meta') { e.preventDefault(); salvarMeta(e.target); render(); }
});

const renderV2 = render;
render = function () {
  if (abaAtual !== 'investir') return renderV2();
  migrar();
  desenharAbas();
  try { localStorage.setItem('assessor-aba', abaAtual); } catch (e) { /* sem armazenamento */ }
  document.getElementById('conteudo').innerHTML = telaInvestir();
  rolarChat();
};
const migrarV2 = migrar;
migrar = function () {
  migrarV2();
  if (!db.cfg.perfil) db.cfg.perfil = 'Moderado';
  if (!Array.isArray(db.ChatInvest)) db.ChatInvest = [];
  (db.Metas_Investimento || []).forEach(m => { if (m['Objetivo'] === undefined) m['Objetivo'] = ''; if (!m['Perfil']) m['Perfil'] = 'Automático'; });
};
const enriquecerV2 = enriquecerExemplo;
enriquecerExemplo = function (d) {
  enriquecerV2(d);
  d.cfg.perfil = 'Moderado';
  d.Metas_Investimento.forEach(m => { if (m['Meta'] === 'Casa própria') m['Objetivo'] = 'Entrada do apartamento'; if (m['Meta'] === 'Imóvel por consórcio') m['Objetivo'] = 'Lances do consórcio'; m['Perfil'] = 'Automático'; });
};

// abre na última página usada
try { const a = localStorage.getItem('assessor-aba'); if (a && (PAGINAS_PRINCIPAIS.concat(PAGINAS_EXTRAS)).some(p => p[0] === a)) abaAtual = a; } catch (e) { /* sem armazenamento */ }
