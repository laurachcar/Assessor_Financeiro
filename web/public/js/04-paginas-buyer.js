/* ===== v2: navegação em 3 páginas, Cadastro (tabela base) e Buyer (agente de compras) ===== */
const DIA_MS = 86400000;
function addDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function difDias(a, b) { return Math.round((b - a) / DIA_MS); }
function hoje0() { return new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate()); }
function dm(d) { return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1); }
function somaValores(lista) { return arred2(lista.reduce((s, l) => s + (Number(l['Valor']) || 0), 0)); }
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ------------------------------------------------------------ novos campos
FORMULARIOS.configuracoes.campos.push(
  { nome: 'reserva_compras', rotulo: 'Saldo da reserva para compras (R$)', tipo: 'moeda' },
  { nome: 'aporte_compras', rotulo: 'Quanto vai para a reserva de compras por mês (R$)', tipo: 'moeda' },
  { nome: 'cdi_aa', rotulo: 'Rendimento da reserva (% ao ano, ex.: CDI)', tipo: 'percentual' }
);
ABAS.Cartoes.cabecalho = ABAS.Cartoes.cabecalho.concat(['Benefícios', 'Garantia estendida']);
FORMULARIOS.cartoes.campos.splice(FORMULARIOS.cartoes.campos.length - 1, 0,
  { nome: 'Benefícios', tipo: 'texto', rotulo: 'Benefícios (ex.: pontos, sala VIP, seguro compra)' },
  { nome: 'Garantia estendida', tipo: 'simnao', rotulo: 'Dá garantia estendida', padrao: 'Não' });

const URGENCIAS = ['Urgente', 'Alta', 'Média', 'Baixa', 'Esperar oferta'];
const URG_COR = { 'Urgente': '#d93025', 'Alta': '#e8710a', 'Média': '#f9ab00', 'Baixa': '#0b8043', 'Esperar oferta': '#7b61ff' };
const URG_JANELA = { 'Urgente': 3, 'Alta': 30, 'Média': 90, 'Baixa': 180, 'Esperar oferta': 365 };
const URG_PRIORIDADE = { 'Urgente': 'Alta', 'Alta': 'Alta', 'Média': 'Média', 'Baixa': 'Baixa', 'Esperar oferta': 'Baixa' };
/** Quanto de desconto por dia de espera vale a pena para cada urgência. */
const URG_CUSTO_ESPERA = { 'Urgente': 0.05, 'Alta': 0.003, 'Média': 0.001, 'Baixa': 0.0004, 'Esperar oferta': 0 };
const SEGMENTOS = { eletro: 'Eletro e eletrônicos', moda: 'Moda', servico: 'Serviços', pet: 'Pet', geral: 'Geral' };
const CORES_CARTAO = ['#7b61ff', '#e8710a', '#0b8043', '#d93025', '#1a73e8', '#c2185b', '#00897b'];
const COR_CONTAS = '#5f6368';

function urgenciaDe(c) { return URGENCIAS.indexOf(c['Urgência']) >= 0 ? c['Urgência'] : ({ 'Alta': 'Alta', 'Média': 'Média', 'Baixa': 'Baixa' }[c['Prioridade']] || 'Média'); }
function corCartao(nome) { const i = db.Cartoes.findIndex(c => c['Cartão'] === nome); return i < 0 ? COR_CONTAS : CORES_CARTAO[i % CORES_CARTAO.length]; }
function cartoesAtivos() { return db.Cartoes.filter(c => ehSim(c['Ativo'])); }

function migrar() {
  const cfg = db.cfg;
  if (cfg.reserva_compras === undefined) cfg.reserva_compras = 0;
  if (cfg.aporte_compras === undefined) cfg.aporte_compras = 0;
  if (cfg.cdi_aa === undefined || cfg.cdi_aa === '') cfg.cdi_aa = 13;
  db.Cartoes.forEach(c => { if (c['Benefícios'] === undefined) c['Benefícios'] = ''; if (c['Garantia estendida'] === undefined) c['Garantia estendida'] = 'Não'; });
  db.Compras_Futuras.forEach(c => {
    c['Urgência'] = urgenciaDe(c);
    if (!c['Tipo item']) c['Tipo item'] = segmentoItem(c) === 'servico' ? 'Serviço' : 'Produto';
    if (!Array.isArray(c['Ofertas'])) c['Ofertas'] = [];
    if (c['Link'] === undefined) c['Link'] = '';
  });
}

/** Dados de exemplo da v2: reserva de compras, benefícios dos cartões e lista de desejos com links. */
function enriquecerExemplo(d) {
  Object.assign(d.cfg, { reserva_compras: 6500, aporte_compras: 800, cdi_aa: 13 });
  d.Cartoes.forEach(c => {
    if (c['Cartão'] === 'Nubank') Object.assign(c, { 'Benefícios': 'Cashback na conta', 'Garantia estendida': 'Não' });
    if (c['Cartão'] === 'C6 Black') Object.assign(c, { 'Benefícios': 'Pontos Átomos, sala VIP, seguro compra', 'Garantia estendida': 'Sim' });
  });
  const extra = {
    'Airfryer': { 'Link': 'https://www.amazon.com.br/s?k=airfryer+5l', 'Urgência': 'Alta', 'Sem juros até': 10, 'Desconto Pix %': 5, 'Preço alvo': 450,
      'Ofertas': [{ loja: 'Magalu', preco: 519, link: 'https://www.magazineluiza.com.br/busca/airfryer/' }] },
    'Robô aspirador': { 'Link': 'https://lista.mercadolivre.com.br/robo-aspirador', 'Urgência': 'Esperar oferta', 'Sem juros até': 10, 'Desconto Pix %': 8, 'Preço alvo': 1400, 'Ofertas': [] },
    'Vacinas do pet': { 'Urgência': 'Alta', 'Tipo item': 'Serviço', 'Desconto Pix %': 5 },
    'Botox': { 'Urgência': 'Média', 'Tipo item': 'Serviço', 'Sem juros até': 3, 'Desconto Pix %': 10 },
    'Boca': { 'Urgência': 'Baixa', 'Tipo item': 'Serviço', 'Sem juros até': 6, 'Desconto Pix %': 10 },
    'Roupas': { 'Valor estimado': 600, 'Urgência': 'Baixa', 'Sem juros até': 6 },
    'Sapatos': { 'Valor estimado': 450, 'Urgência': 'Esperar oferta', 'Sem juros até': 5 },
    'Veterinário do pet': { 'Valor estimado': 250, 'Urgência': 'Urgente', 'Tipo item': 'Serviço' }
  };
  d.Compras_Futuras.forEach(c => { Object.assign(c, extra[c['Item']] || {}); c['Prioridade'] = URG_PRIORIDADE[c['Urgência']] || c['Prioridade']; });
  d.Compras_Futuras.push({ 'Item': 'Fone bluetooth', 'Tipo item': 'Produto', 'Valor estimado': 699, 'Prioridade': 'Média', 'Urgência': 'Média', 'Frequência': 'Única', 'Mês desejado': '',
    'Parcelas máx': '', 'Categoria': 'Compras', 'Subcategoria': 'Acessórios', 'Onde comprar': 'amazon.com.br', 'Link': 'https://www.amazon.com.br/s?k=fone+bluetooth+cancelamento+de+ruido',
    'Status': 'Planejada', 'Observação': 'Com cancelamento de ruído', 'Sem juros até': 10, 'Desconto Pix %': 0, 'Preço alvo': 550,
    'Ofertas': [{ loja: 'Mercado Livre', preco: 649, link: 'https://lista.mercadolivre.com.br/fone-bluetooth-cancelamento-ruido' }, { loja: 'Kabum', preco: 679, link: 'https://www.kabum.com.br/busca/fone-bluetooth' }] });
}

// ------------------------------------------------------------ calendário comercial
function nesimoDiaSemana(ano, mes0, diaSemana, n) {
  const p = new Date(ano, mes0, 1);
  return new Date(ano, mes0, 1 + ((diaSemana - p.getDay() + 7) % 7) + (n - 1) * 7);
}

/** Datas comerciais do Brasil em um ano, com o desconto médio esperado por segmento (estimativa). */
function eventosComerciais(ano) {
  const D = (m, d) => new Date(ano, m, d);
  const bf = nesimoDiaSemana(ano, 10, 5, 4);
  const maes = nesimoDiaSemana(ano, 4, 0, 2), pais = nesimoDiaSemana(ano, 7, 0, 2);
  return [
    { nome: 'Liquidação de janeiro', inicio: D(0, 2), fim: D(0, 31), desc: { moda: 0.35, eletro: 0.10, geral: 0.10, pet: 0.05 }, dica: 'Queima de estoque depois do Natal: a melhor época do ano para roupas e sapatos.' },
    { nome: 'Dia do Consumidor', inicio: D(2, 13), fim: D(2, 17), desc: { eletro: 0.15, moda: 0.15, geral: 0.15, pet: 0.10, servico: 0.05 }, dica: 'Semana de ofertas de março, a "Black Friday do primeiro semestre".' },
    { nome: 'Dia das Mães', inicio: addDias(maes, -7), fim: maes, desc: { eletro: 0.10, moda: 0.10, geral: 0.08, servico: 0.05 }, dica: 'Promoções de eletroportáteis, beleza e moda.' },
    { nome: 'Liquidação de inverno', inicio: D(6, 1), fim: D(7, 15), desc: { moda: 0.35 }, dica: 'Troca de coleção: roupas e sapatos de inverno em promoção.' },
    { nome: 'Prime Day', inicio: D(6, 8), fim: D(6, 16), desc: { eletro: 0.20, geral: 0.15, pet: 0.10 }, aprox: true, dica: 'Ofertas da Amazon em julho. A data exata sai poucas semanas antes.' },
    { nome: 'Dia dos Pais', inicio: addDias(pais, -7), fim: pais, desc: { eletro: 0.10, geral: 0.08 }, dica: 'Eletrônicos e acessórios com desconto moderado.' },
    { nome: 'Semana do Brasil', inicio: D(8, 1), fim: D(8, 15), desc: { eletro: 0.15, moda: 0.15, geral: 0.15, pet: 0.10, servico: 0.05 }, dica: 'Ofertas do varejo na primeira quinzena de setembro.' },
    { nome: 'Dia das Crianças', inicio: D(9, 5), fim: D(9, 12), desc: { geral: 0.08 }, dica: 'Foco em brinquedos e games.' },
    { nome: '11.11', inicio: D(10, 10), fim: D(10, 11), desc: { eletro: 0.20, geral: 0.15, moda: 0.10 }, dica: 'Dia dos Solteiros: forte em marketplaces (AliExpress, Shopee, Mercado Livre).' },
    { nome: 'Black Friday', inicio: addDias(bf, -1), fim: addDias(bf, 2), desc: { eletro: 0.30, moda: 0.25, geral: 0.25, pet: 0.20, servico: 0.10 }, dica: 'Maior desconto do ano em eletro e eletrônicos. Compare com o preço de outubro para fugir da "metade do dobro".' },
    { nome: 'Cyber Monday', inicio: addDias(bf, 3), fim: addDias(bf, 3), desc: { eletro: 0.25, geral: 0.15 }, dica: 'Repescagem online da Black Friday.' },
    { nome: 'Natal', inicio: D(11, 1), fim: D(11, 24), desc: {}, alta: true, dica: 'Os preços sobem antes do Natal: o Buyer evita comprar nesse período.' },
    { nome: 'Pós-Natal', inicio: D(11, 26), fim: D(11, 31), desc: { moda: 0.25, eletro: 0.10, geral: 0.10 }, dica: 'Começo da queima de estoque.' }
  ];
}

function eventosEntre(ini, fim) {
  let r = [];
  for (let a = ini.getFullYear(); a <= fim.getFullYear(); a++) r = r.concat(eventosComerciais(a));
  return r.filter(e => e.fim >= ini && e.inicio <= fim).sort((a, b) => a.inicio - b.inicio);
}

function descontoEvento(ev, seg) { return ev.desc[seg] !== undefined ? ev.desc[seg] : 0; }

function segmentoItem(c) {
  const t = normalizarTexto([c['Item'], c['Categoria'], c['Subcategoria']].join(' '));
  if (c['Tipo item'] === 'Serviço' || /estetica|veterinari|vacina|consulta|botox|curso|boca|dentista|harmoniza/.test(t)) return 'servico';
  if (/eletro|airfryer|air fryer|micro|aspirador|notebook|celular|smartphone|\btv\b|televis|fone|geladeira|maquina|tablet|monitor|eletronic|console|camera|relogio/.test(t)) return 'eletro';
  if (/roupa|sapato|tenis|acessorio|bolsa|moda|vestido|calca|casaco/.test(t)) return 'moda';
  if (/pipa|racao|\bpet\b/.test(t)) return 'pet';
  return 'geral';
}

// ------------------------------------------------------------ cartões: vencimento, limite e formas de pagamento
function vencimentoCompra(data, cartao) {
  const mv = mesFaturaCartao(data, cartao).split('-').map(Number);
  const venc = new Date(mv[0], mv[1] - 1, Math.min(Number(cartao['Dia vencimento']), diasNoMes(mv[0], mv[1])));
  return { venc, dias: difDias(data, venc) };
}

function faturaEmAberto(l, c) {
  const m = mesDe(l['Mês fatura']);
  return m > MES || (m === MES && HOJE.getDate() < Number(c['Dia vencimento']));
}

function limiteDisponivel(c) {
  const lim = Number(c['Limite']) || 0;
  if (!lim) return Infinity;
  return arred2(lim - somaValores(db.Lancamentos.filter(l => l['Conta/Cartão'] === c['Cartão'] && l['Tipo'] === 'Saída' && faturaEmAberto(l, c))));
}

/**
 * Compara Pix/débito com cada cartão: desconto à vista, cashback, dias até pagar e
 * quanto a reserva rende enquanto as parcelas sem juros não vencem. Menor custo efetivo primeiro.
 */
function opcoesPagamento(preco, item, dIni, dFim, carga) {
  const i = Math.pow(1 + (Number(db.cfg.cdi_aa) || 0) / 100, 1 / 12) - 1;
  const pix = Math.min(50, Number(item['Desconto Pix %']) || 0);
  const nSemJuros = Math.max(1, Math.min(24, Number(item['Sem juros até']) || 1));
  const teto = Number(db.cfg.teto_parcelas) || Infinity;
  const seg = segmentoItem(item);
  const ops = [{
    forma: 'Pix ou débito', tipo: 'conta', n: 1, dia: dIni, valorPago: arred2(preco * (1 - pix / 100)), cashback: 0, ganho: 0,
    custo: arred2(preco * (1 - pix / 100)), notas: [pix ? pix + '% de desconto à vista' : 'sem desconto à vista informado', 'sai da reserva no dia']
  }];
  cartoesAtivos().forEach(c => {
    if (!Number(c['Dia fechamento']) || !Number(c['Dia vencimento'])) return;
    let melhor = null;
    for (let d = dIni, k = 0; d <= dFim && k < 45; d = addDias(d, 1), k++) {
      const r = vencimentoCompra(d, c);
      if (!melhor || r.dias > melhor.dias) melhor = Object.assign({ dia: d }, r);
    }
    const n = nSemJuros, parcela = arred2(preco / n);
    let vp = 0;
    for (let k = 0; k < n; k++) vp += parcela / Math.pow(1 + i, melhor.dias / 30 + k);
    const ganho = arred2(preco - vp), cb = arred2(preco * (Number(c['% cashback']) || 0) / 100);
    let passaTeto = false;
    if (n > 1) for (let k = 0; k < n; k++) { const m = somarMeses(mesChave(melhor.venc), k); if ((carga[m] || 0) + parcela > teto + 0.001) passaTeto = true; }
    const disp = limiteDisponivel(c);
    const garantia = ehSim(c['Garantia estendida']);
    const notas = [n > 1 ? n + 'x sem juros de ' + brl(parcela) : 'à vista no cartão', '1ª fatura vence ' + dm(melhor.venc) + ' (' + melhor.dias + ' dias)'];
    if (cb) notas.push('cashback ' + brl(cb));
    if (garantia && seg === 'eletro') notas.push('garantia estendida');
    if (c['Benefícios']) notas.push(c['Benefícios']);
    if (disp < preco) notas.push('limite livre só ' + brl(Math.max(0, disp)));
    if (passaTeto) notas.push('passa do teto de parcelas');
    ops.push({ forma: c['Cartão'], tipo: 'cartao', n, parcela, dia: melhor.dia, venc: melhor.venc, dias: melhor.dias, valorPago: preco, cashback: cb, ganho,
      custo: arred2(preco - cb - ganho - (garantia && seg === 'eletro' ? 0.001 : 0)), semLimite: disp < preco, passaTeto, notas });
  });
  return ops.sort((a, b) => (a.semLimite ? 1 : 0) - (b.semLimite ? 1 : 0) || (a.passaTeto ? 1 : 0) - (b.passaTeto ? 1 : 0) || a.custo - b.custo);
}

function melhorOferta(c) {
  const base = Number(c['Valor estimado']) || 0;
  const ofs = (c['Ofertas'] || []).filter(o => Number(o.preco) > 0).slice().sort((a, b) => a.preco - b.preco);
  if (ofs.length && (!base || ofs[0].preco < base)) return { preco: Number(ofs[0].preco), loja: ofs[0].loja, link: ofs[0].link, economia: base ? arred2(base - ofs[0].preco) : 0 };
  return base ? { preco: base, loja: c['Onde comprar'] || dominio(c['Link']), link: c['Link'] || '', economia: 0 } : null;
}

function dominio(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

// ------------------------------------------------------------ o agente
/** Uma recomendação por item planejado: quando comprar, onde, com qual pagamento e quanto economiza. */
function planoBuyer() {
  const c = calcular();
  const carga = Object.assign({}, c.parcelas);
  const hj = hoje0();
  let livre = Number(db.cfg.reserva_compras) || 0;
  const aporte = Number(db.cfg.aporte_compras) || 0;
  const ordemUrg = u => URGENCIAS.indexOf(u);
  const itens = db.Compras_Futuras.map((item, idx) => ({ item, idx })).filter(x => (x.item['Status'] || 'Planejada') === 'Planejada');
  const recs = itens.map(({ item, idx }) => {
    const urg = urgenciaDe(item), seg = segmentoItem(item);
    let ini = hj;
    const md = mesDe(item['Mês desejado']);
    if (md && md > MES) { const p = md.split('-').map(Number); ini = new Date(p[0], p[1] - 1, 1); }
    let fim = addDias(ini, URG_JANELA[urg]);
    const prazo = parseData(item['Prazo']);
    if (prazo && prazo >= hj && prazo < fim) fim = prazo;
    if (md && !prazo && urg !== 'Esperar oferta') { const p = md.split('-').map(Number); const fimMes = new Date(p[0], p[1], 0); if (fimMes > fim) fim = fimMes; }
    return { item, idx, urg, seg, ini, fim, oferta: melhorOferta(item) };
  }).sort((a, b) => ordemUrg(a.urg) - ordemUrg(b.urg) || a.ini - b.ini);

  return recs.map(r => {
    const { item, urg, seg, ini, fim, oferta } = r;
    if (!oferta) return Object.assign(r, { status: 'sem-valor', quando: 'Informe o valor', resumo: 'Sem valor estimado: coloque o preço que você viu para o Buyer planejar.' });
    // candidatos: comprar no início da janela ou em cada data comercial dentro dela
    const cands = [{ nome: ini > hj ? 'A partir de ' + dm(ini) : 'Agora', ini, fim: addDias(ini, urg === 'Urgente' ? 0 : 7), desc: 0, ev: null }];
    eventosEntre(ini, fim).forEach(ev => {
      const d = ev.inicio < ini ? ini : ev.inicio;
      const desc = descontoEvento(ev, seg);
      if (desc > 0 && !ev.alta) cands.push({ nome: ev.nome, ini: d, fim: ev.fim > fim ? fim : ev.fim, desc, ev });
    });
    const custoEspera = URG_CUSTO_ESPERA[urg];
    cands.forEach(k => { k.score = k.desc - custoEspera * difDias(hj, k.ini); });
    let best = cands.slice().sort((a, b) => b.score - a.score || a.ini - b.ini)[0];
    if (best.score < 0.02) best = cands[0];
    // se a janela inicial cai no Natal, empurra para depois
    const natal = eventosEntre(best.ini, best.ini).find(e => e.alta);
    const precoEsperado = arred2(oferta.preco * (1 - best.desc));
    const ops = opcoesPagamento(precoEsperado, item, best.ini, best.fim < best.ini ? best.ini : best.fim, carga);
    const pag = ops[0];
    if (pag.tipo === 'cartao' && pag.n > 1) for (let k = 0; k < pag.n; k++) { const m = somarMeses(mesChave(pag.venc), k); carga[m] = arred2((carga[m] || 0) + pag.parcela); }
    livre = arred2(livre - precoEsperado);
    const falta = livre < 0 ? Math.min(-livre, precoEsperado) : 0;
    const mesesAporte = falta && aporte ? Math.ceil(falta / aporte) : 0;
    const alvo = Number(item['Preço alvo']) || 0;
    const diasAte = difDias(hj, best.ini);
    let status = diasAte <= 3 ? 'agora' : 'aguardar';
    if (falta) status = 'atencao';
    const economia = arred2(oferta.preco - pag.custo + (Number(item['Valor estimado']) ? oferta.economia : 0));
    const quando = best.ev ? best.ev.nome + (best.ev.aprox ? ' (data aproximada)' : '') + ', ' + (best.ini <= hj ? 'já começou' : dm(best.ini)) : (best.ini > hj ? 'A partir de ' + dm(best.ini) : 'Pode comprar agora');
    // dica de dia: se for comprar agora no cartão, quando a próxima virada de fatura dá mais prazo
    let dicaAntes = '';
    if (ini > hj) {
      const ant = eventosEntre(hj, addDias(ini, -1)).filter(e => !e.alta && descontoEvento(e, seg) >= 0.15)[0];
      if (ant) dicaAntes = 'Se puder antecipar, ' + ant.nome + ' (' + (ant.inicio <= hj ? 'já começou' : dm(ant.inicio)) + ') costuma dar ~' + Math.round(descontoEvento(ant, seg) * 100) + '% de desconto em ' + SEGMENTOS[seg].toLowerCase() + '.';
    }
    let dicaDia = '';
    if (!best.ev && pag.tipo === 'cartao' && pag.dia > best.ini) dicaDia = 'Melhor dia: ' + dm(pag.dia) + ', logo depois do fechamento do ' + pag.forma + '.';
    return Object.assign(r, {
      status, best, cands, quando, dicaAntes, precoEsperado, ops, pag, falta, mesesAporte, alvo, economia, dicaDia, natal,
      data: pag.dia || best.ini,
      resumo: (best.ev ? 'Espere ' + best.ev.nome + ': desconto médio de ' + Math.round(best.desc * 100) + '% em ' + SEGMENTOS[seg].toLowerCase() + '.' : (urg === 'Urgente' ? 'É urgente: compre já.' : 'Nenhuma data comercial vale a espera dentro do prazo.'))
    });
  });
}

// ------------------------------------------------------------ navegação
const PAGINAS_PRINCIPAIS = [['painel', 'Painel'], ['cadastro', 'Cadastro'], ['buyer', 'Buyer']];
const PAGINAS_EXTRAS = [['orcado', 'Orçado x realizado'], ['projecao', 'Projeção de caixa'], ['parcelas', 'Parcelas por cartão'], ['rendimentos', 'Cashback e rendimentos'],
  ['investimentos', 'Reserva e metas'], ['importacao', 'Importação'], ['alertas', 'Alertas e e-mails']];

function desenharAbas() {
  document.getElementById('abas').innerHTML = PAGINAS_PRINCIPAIS.map(([id, nome]) => `<button data-aba="${id}" class="prim ${id === abaAtual ? 'ativo' : ''}">${nome}</button>`).join('')
    + '<span class="sep"></span>' + PAGINAS_EXTRAS.map(([id, nome]) => `<button data-aba="${id}" class="sec2 ${id === abaAtual ? 'ativo' : ''}">${nome}</button>`).join('');
}

function render() {
  migrar();
  desenharAbas();
  try { localStorage.setItem('assessor-aba', abaAtual); } catch (e) { /* sem armazenamento */ }
  const c = calcular();
  const fn = { painel: telaPainel, cadastro: telaCadastro, buyer: telaBuyer, lancamentos: telaLancamentos, orcado: telaOrcado, projecao: telaProjecao, calendario: telaCalendario, parcelas: telaParcelas, rendimentos: telaRendimentos, planilha: telaCadastro, investimentos: telaInvestimentos, importacao: telaImportacao, alertas: telaAlertas, cadastros: telaCadastros }[abaAtual] || telaPainel;
  document.getElementById('conteudo').innerHTML = fn(c);
  if (abaAtual === 'investimentos') montarForm('aporte', document.getElementById('form-aporte'));
  if (abaAtual === 'cadastros') montarForm(formAtual, document.getElementById('form-cad'));
  if (abaAtual === 'lancamentos') montarForm('lancamento', document.getElementById('form-lanc'));
  if (foco) { const el = document.getElementById(foco); if (el) el.focus(); foco = null; }
}
let foco = null;

// ------------------------------------------------------------ CADASTRO
let rapido = { tipo: 'Saída', data: '', desc: '', valor: '', cat: '', sub: '', conta: '', centro: '', parcelas: 1, recorrente: false };
let rapidoMsg = null;
let filtroCad = { periodo: MES, tipo: '', cat: '', conta: '', busca: '' };

const SUBABAS_CAD = [
  ['Lancamentos', 'Lançamentos'], ['Fixos', 'Fixos e dívidas'], ['Parcelas', 'Parcelamentos'], ['Cartoes', 'Cartões'], ['Contas', 'Contas'],
  ['Categorias', 'Categorias'], ['Centros_Custo', 'Centros de custo'], ['Carteira', 'Investimentos'], ['Metas_Investimento', 'Metas'], ['Aporte_Reserva', 'Aportes'], ['Configuracoes', 'Configurações']
];
function subabasCadastro() {
  return `<div class="subabas">${SUBABAS_CAD.map(([id, nome]) => {
    const n = id === 'Configuracoes' ? '' : id === 'Parcelas' ? calcular().resumoParc.compras.filter(x => x.restantes > 0).length : (db[id] || []).length;
    return `<button data-plan="${id}" class="${id === planAtual ? 'ativo' : ''}">${nome} <span class="nota">${n}</span></button>`;
  }).join('')}</div>`;
}

function categoriasDoTipo(tipo) {
  const at = db.Categorias.filter(c => ehSim(c['Ativa']));
  return (tipo === 'Transferência' ? [] : at.filter(c => c['Tipo'] === tipo)).map(c => String(c['Categoria']));
}

function formRapido() {
  const op = opcoes();
  const r = rapido;
  if (!r.data) r.data = diaChave(HOJE);
  const contas = r.tipo === 'Saída' ? op.contasECartoes : op.contas;
  const ehCartao = op.cartoes.indexOf(r.conta) >= 0;
  const cats = categoriasDoTipo(r.tipo);
  const subs = op.subcategoriasPor[r.cat] || [];
  const sel = (id, lista, v, vazio) => `<select id="${id}"><option value="">${vazio || '—'}</option>${lista.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const msg = rapidoMsg ? `<div class="msg ${rapidoMsg.ok ? 'ok' : 'erro'}">${rapidoMsg.texto.map(esc).join('<br>')}</div>` : '';
  rapidoMsg = null;
  return `<div class="card">
    <div class="linha" style="justify-content:space-between">
      <h2 style="margin:0">Novo lançamento</h2>
      <div class="seg">${TIPOS_LANCAMENTO.map(t => `<button type="button" data-rtipo="${t}" class="t-${t} ${t === r.tipo ? 'ativo' : ''}">${t}</button>`).join('')}</div>
    </div>
    <form id="rap-form" class="rapido" autocomplete="off">
      <div><label>Data</label><input type="date" id="rap-data" value="${esc(r.data)}"></div>
      <div class="w2"><label>Descrição *</label><input id="rap-desc" value="${esc(r.desc)}" placeholder="${r.tipo === 'Entrada' ? 'Ex.: Salário' : r.tipo === 'Saída' ? 'Ex.: Mercado' : 'Ex.: Pagamento fatura Nubank'}"></div>
      <div><label>Valor (R$) *</label><input id="rap-valor" value="${esc(r.valor)}" inputmode="decimal" placeholder="0,00"></div>
      ${r.tipo === 'Transferência' ? '' : `<div><label>Categoria *</label>${sel('rap-cat', cats, r.cat)}</div><div><label>Subcategoria</label>${sel('rap-sub', subs, r.sub)}</div>`}
      <div><label>${r.tipo === 'Saída' ? 'Conta ou cartão *' : 'Conta *'}</label>${sel('rap-conta', contas, r.conta)}</div>
      ${r.tipo === 'Saída' ? `<div><label>Parcelas</label><input type="number" id="rap-parc" min="1" max="48" value="${esc(r.parcelas)}" ${ehCartao ? '' : 'disabled title="Parcelamento só no cartão"'}></div>` : ''}
      ${r.tipo === 'Transferência' ? '' : `<div><label>Centro de custo</label>${sel('rap-centro', op.centros, r.centro)}</div>`}
      ${r.tipo === 'Transferência' ? '' : `<label class="check"><input type="checkbox" id="rap-rec" ${r.recorrente ? 'checked' : ''}> Repete todo mês</label>`}
      <div><button class="btn" id="rap-salvar" type="submit">Lançar</button></div>
    </form>
    ${msg}
    <p class="nota" style="margin:8px 0 0">${r.tipo === 'Transferência' ? 'Use Transferência para pagamento de fatura e para mover dinheiro entre contas. Não conta como gasto.' : r.recorrente ? 'Vai lançar hoje e também criar um fixo que se repete todo dia ' + (parseData(r.data) || HOJE).getDate() + ' (entra na projeção de caixa).' : r.tipo === 'Saída' ? 'Compra parcelada no cartão vira uma linha por parcela, cada uma na fatura certa.' : 'Entradas vão sempre para uma conta.'}</p>
  </div>`;
}

function salvarRapido() {
  const r = rapido;
  const dados = { 'Data': r.data, 'Descrição': r.desc, 'Valor': r.valor, 'Tipo': r.tipo, 'Categoria': r.tipo === 'Transferência' ? '' : r.cat, 'Subcategoria': r.tipo === 'Transferência' ? '' : r.sub,
    'Centro de custo': r.tipo === 'Transferência' ? '' : r.centro, 'Conta/Cartão': r.conta, 'Parcelas': r.tipo === 'Saída' ? r.parcelas : 1 };
  const v = validarCampos(FORMULARIOS.lancamento.campos, dados, opcoes());
  if (!v.ok) { rapidoMsg = { ok: false, texto: v.erros }; return false; }
  if (r.recorrente && r.tipo !== 'Transferência') {
    if (db.Fixos.some(f => normalizarTexto(f['Descrição']) === normalizarTexto(r.desc))) { rapidoMsg = { ok: false, texto: ['Já existe um fixo chamado "' + r.desc + '". Mude a descrição ou edite em Fixos e dívidas.'] }; return false; }
  }
  const res = salvarLancamento(v.valores);
  if (!res.ok) { rapidoMsg = { ok: false, texto: res.erros }; return false; }
  const textos = [res.mensagem];
  if (r.recorrente && r.tipo !== 'Transferência') {
    const d = v.valores['Data'];
    db.Fixos.push({ 'Descrição': r.desc, 'Tipo': r.tipo, 'Valor': v.valores['Valor'], 'Categoria': r.cat, 'Subcategoria': r.sub, 'Centro de custo': r.centro, 'Conta/Cartão': r.conta,
      'Dia': d.getDate(), 'Início': mesChave(d), 'Fim': '', 'Ativo': 'Sim' });
    textos.push('Fixo criado: todo dia ' + d.getDate() + '.');
  }
  guardar();
  rapidoMsg = { ok: true, texto: textos };
  Object.assign(rapido, { desc: '', valor: '', parcelas: 1, recorrente: false });
  foco = 'rap-desc';
  return true;
}

function lancFiltrados() {
  const f = filtroCad;
  const busca = normalizarTexto(f.busca);
  const ini = addDias(hoje0(), -((HOJE.getDay() + 6) % 7)), fim = addDias(ini, 6);
  return db.Lancamentos.map((r, i) => ({ r, i })).filter(({ r }) => {
    if (f.periodo === 'semana') { const d = parseData(r['Data']); if (!d || d < ini || d > fim) return false; }
    else if (f.periodo !== 'todos' && mesDe(r['Data']) !== f.periodo) return false;
    if (f.tipo && r['Tipo'] !== f.tipo) return false;
    if (f.cat && r['Categoria'] !== f.cat) return false;
    if (f.conta && r['Conta/Cartão'] !== f.conta) return false;
    if (busca && normalizarTexto([r['Descrição'], r['Categoria'], r['Subcategoria']].join(' ')).indexOf(busca) < 0) return false;
    return true;
  }).sort((a, b) => (a.r['Data'] < b.r['Data'] ? 1 : a.r['Data'] > b.r['Data'] ? -1 : b.i - a.i));
}

function telaLancCadastro() {
  const p = PLANILHAS.find(x => x.aba === 'Lancamentos');
  const op = opcoes();
  const campos = camposPlan(p, false);
  const linhas = lancFiltrados();
  const meses = [...new Set(db.Lancamentos.map(l => mesDe(l['Data'])).filter(Boolean).concat([MES]))].sort().reverse();
  const f = filtroCad;
  const s = (id, lista, v, todos) => `<select id="${id}"><option value="">${todos}</option>${lista.map(o => { const val = Array.isArray(o) ? o[0] : o, txt = Array.isArray(o) ? o[1] : o; return `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`; }).join('')}</select>`;
  const regs = linhas.map(x => x.r);
  const ent = somaValores(regs.filter(l => l['Tipo'] === 'Entrada')), sai = somaValores(regs.filter(l => l['Tipo'] === 'Saída')), tr = somaValores(regs.filter(l => l['Tipo'] === 'Transferência'));
  const LIM = 400;
  const msg = planMsg ? `<div class="msg ${planMsg.ok ? 'ok' : 'erro'}">${planMsg.texto.map(esc).join('<br>')}</div>` : '';
  planMsg = null;
  return `<div class="filtros">
      <div><label>Período</label><select id="fc-periodo"><option value="semana" ${f.periodo === 'semana' ? 'selected' : ''}>Esta semana</option>${meses.map(m => `<option value="${m}" ${m === f.periodo ? 'selected' : ''}>${rotuloMes(m)}</option>`).join('')}<option value="todos" ${f.periodo === 'todos' ? 'selected' : ''}>Tudo</option></select></div>
      <div><label>Tipo</label>${s('fc-tipo', TIPOS_LANCAMENTO, f.tipo, 'Todos')}</div>
      <div><label>Categoria</label>${s('fc-cat', op.categorias, f.cat, 'Todas')}</div>
      <div><label>Conta ou cartão</label>${s('fc-conta', op.contasECartoes, f.conta, 'Todos')}</div>
      <div><label>Buscar</label><input id="fc-busca" value="${esc(f.busca)}" placeholder="descrição..."></div>
    </div>
    ${msg}
    <div class="totais-filtro"><span>${linhas.length} lançamento(s)</span><span>Entradas <b class="pos">${brl(ent)}</b></span><span>Saídas <b class="neg">${brl(sai)}</b></span><span>Resultado <b class="${ent - sai < 0 ? 'neg' : 'pos'}">${brl(ent - sai)}</b></span>${tr ? `<span>Transferências <b>${brl(tr)}</b></span>` : ''}</div>
    <div class="tabela"><table class="grade-plan">
      <tr><th></th>${campos.map(c => `<th>${esc(c.nome)}${c.obrigatorio ? ' *' : ''}</th>`).join('')}${p.extras.map(x => `<th>${esc(x)}</th>`).join('')}</tr>
      ${linhas.slice(0, LIM).map(({ r, i }) => `<tr data-linha="${i}" class="t-${esc(r['Tipo'])}"><td><button class="btn sec" data-del="${i}" title="Excluir linha">×</button>${btnAnexo(p.aba, i, r)}</td>${campos.map(c => `<td>${celula(c, r[c.nome], i, op, r)}</td>`).join('')}${p.extras.map(x => `<td class="calc">${x === 'Mês fatura' && r[x] ? rotuloMes(mesDe(r[x])) : esc(r[x])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="20" class="nota">Nada neste filtro.</td></tr>`}
    </table></div>
    <p class="nota">${linhas.length > LIM ? 'Mostrando os ' + LIM + ' mais recentes. Use os filtros para ver o resto. ' : ''}Edite direto na tabela: a alteração é salva quando você sai do campo. Se algo estiver errado, o campo fica vermelho e nada é gravado.</p>`;
}

function telaCadastro(c) {
  if (!SUBABAS_CAD.some(s => s[0] === planAtual)) planAtual = 'Lancamentos';
  const lancMes = db.Lancamentos.filter(l => mesDe(l['Data']) === MES);
  const ent = somaValores(lancMes.filter(l => l['Tipo'] === 'Entrada')), sai = somaValores(lancMes.filter(l => l['Tipo'] === 'Saída'));
  const fixosSai = arred2(db.Fixos.filter(f => ehSim(f['Ativo']) && f['Tipo'] === 'Saída' && fixoAtivoNoMes(f, MES)).reduce((s, f) => s + Number(f['Valor']), 0));
  const nFixos = db.Fixos.filter(f => ehSim(f['Ativo']) && fixoAtivoNoMes(f, MES)).length;
  const parcAberto = arred2(c.resumoParc.compras.reduce((s, x) => s + (x.restantes > 0 ? x.valorRestante : 0), 0));
  const parcMes = arred2(c.parcelas[MES] || 0);
  let corpo;
  if (planAtual === 'Lancamentos') corpo = telaLancCadastro();
  else if (planAtual === 'Parcelas') corpo = telaParcelas(c);
  else corpo = telaPlanilha();
  const acoes = `<div class="linha" style="margin-top:12px">
      <button class="btn sec peq" id="exp-json">Baixar backup</button>
      <label class="btn sec peq" style="margin:0;font-weight:600">Restaurar backup<input type="file" id="imp-json" accept=".json,application/json" hidden></label>
      ${planAtual === 'Parcelas' ? '' : '<button class="btn sec peq" id="exp-csv">Baixar CSV desta aba</button>'}
      <button class="btn sec peq" id="meus-dados">Começar com os meus dados</button>
    </div>`;
  return `<div class="titulo-pag"><h2>Cadastro</h2><p>A base do sistema: tudo que entra e sai, parcelas, fixos, cartões e contas.</p></div>
  ${formRapido()}
  <div class="kpis secao">
    <div class="kpi"><div class="rot">Entradas em ${rotuloMes(MES)}</div><div class="val pos">${brl(ent)}</div></div>
    <div class="kpi"><div class="rot">Saídas em ${rotuloMes(MES)}</div><div class="val neg">${brl(sai)}</div><div class="det">resultado ${brl(ent - sai)}</div></div>
    <div class="kpi"><div class="rot">Fixos do mês</div><div class="val">${brl(fixosSai)}</div><div class="det">${nFixos} fixo(s) e dívida(s) ativos</div></div>
    <div class="kpi"><div class="rot">Parcelas em aberto</div><div class="val">${brl(parcAberto)}</div><div class="det">${brl(parcMes)} nas faturas deste mês</div></div>
  </div>
  <div class="card secao">${subabasCadastro()}${corpo}${acoes}</div>`;
}

// ------------------------------------------------------------ BUYER
let semanaIni = addDias(hoje0(), -((HOJE.getDay() + 6) % 7));
let diaSel = diaChave(HOJE);
let buyerEdit = null;     // índice do item em edição
let buyerMsg = null;
let buyerAberto = {};     // { idx: 'comprei' | 'oferta' }
let filtroWish = 'todos';
let editReserva = false;

function linhasCalendario() {
  const cart = cartoesAtivos().map(c => ({ nome: c['Cartão'], cor: corCartao(c['Cartão']), cartao: c, filtro: l => l['Conta/Cartão'] === c['Cartão'] }));
  const nomesC = db.Cartoes.map(c => c['Cartão']);
  cart.push({ nome: 'Pix, débito e boleto', cor: COR_CONTAS, cartao: null, filtro: l => nomesC.indexOf(l['Conta/Cartão']) < 0 });
  return cart;
}

function calendarioSemanal(recs) {
  const dias = [0, 1, 2, 3, 4, 5, 6].map(k => addDias(semanaIni, k));
  const fimSem = dias[6];
  const saidas = db.Lancamentos.filter(l => l['Tipo'] === 'Saída');
  const porDia = {};
  saidas.forEach(l => { const k = diaChave(parseData(l['Data'])); (porDia[k] = porDia[k] || []).push(l); });
  const linhas = linhasCalendario();
  const hjK = diaChave(HOJE);
  const evs = eventosEntre(semanaIni, fimSem);
  const marcas = d => {
    const k = diaChave(d), r = [];
    evs.filter(e => e.inicio <= d && e.fim >= d).forEach(e => r.push(`<span class="marca ev" title="${esc(e.dica)}">${esc(e.nome)}</span>`));
    cartoesAtivos().forEach(c => {
      if (Number(c['Dia fechamento']) === d.getDate()) r.push(`<span class="marca fecha" title="Fecha a fatura: a partir de amanhã a compra cai na fatura seguinte">fecha ${esc(c['Cartão'])}</span>`);
      if (Number(c['Dia vencimento']) === d.getDate()) r.push(`<span class="marca fecha">vence ${esc(c['Cartão'])}</span>`);
    });
    recs.filter(x => x.data && diaChave(x.data) === k).forEach(x => r.push(`<span class="marca compra" title="Recomendação do Buyer">comprar ${esc(x.item['Item'])}</span>`));
    return r.length ? `<div class="marcas">${r.join('')}</div>` : '';
  };
  const mesRef = mesChave(HOJE);
  const noMes = ln => somaValores(saidas.filter(l => ln.filtro(l) && mesDe(l['Data']) === mesRef));
  const semana = ln => somaValores(saidas.filter(l => { const d = parseData(l['Data']); return ln.filtro(l) && d >= semanaIni && d <= fimSem; }));
  const rot = `${semanaIni.getDate()} de ${MESES_LONGOS[semanaIni.getMonth()]} a ${fimSem.getDate()} de ${MESES_LONGOS[fimSem.getMonth()]}`;
  const sel = (porDia[diaSel] || []).slice().sort((a, b) => Number(b['Valor']) - Number(a['Valor']));
  const dSel = parseData(diaSel);
  const totalMes = somaValores(saidas.filter(l => mesDe(l['Data']) === mesRef));
  return `<div class="card">
    <div class="semana-nav">
      <span class="rotulo">Semana de ${rot}</span>
      <button class="btn sec peq" data-sem="-1" aria-label="Semana anterior">‹ Anterior</button>
      <button class="btn sec peq" data-sem="0">Hoje</button>
      <button class="btn sec peq" data-sem="1" aria-label="Próxima semana">Próxima ›</button>
    </div>
    <div class="tabela"><table class="cal">
      <tr><th>Cartão</th>${dias.map(d => { const k = diaChave(d); const tot = somaValores(porDia[k] || []); return `<th class="dia ${k === hjK ? 'hoje' : ''} ${k === diaSel ? 'sel' : ''}" data-dia="${k}"><div class="dsem">${DIAS_SEMANA[d.getDay()]}</div><div class="dnum">${d.getDate()}</div><div class="dtot">${tot ? brl(tot) : '&nbsp;'}</div>${marcas(d)}</th>`; }).join('')}<th class="r">Semana</th><th class="r">No mês</th></tr>
      ${linhas.map(ln => {
        const lim = ln.cartao ? Number(ln.cartao['Limite']) || 0 : 0;
        const disp = ln.cartao ? limiteDisponivel(ln.cartao) : 0;
        const usado = lim ? Math.min(1, Math.max(0, (lim - disp) / lim)) : 0;
        return `<tr><td><div class="cartao-nome"><span class="bolinha" style="background:${ln.cor}"></span>${esc(ln.nome)}</div>${lim ? `<div class="mini-barra" title="Limite usado"><div style="width:${Math.round(usado * 100)}%;background:${ln.cor}"></div></div><div class="nota">livre ${brl(disp)}</div>` : ''}</td>
        ${dias.map(d => { const k = diaChave(d); const v = somaValores((porDia[k] || []).filter(ln.filtro)); return `<td class="v ${k === hjK ? 'hoje' : ''} ${v ? '' : 'vazio'}">${v ? `<span class="chip" style="background:${ln.cor}">${brl(v)}</span>` : '·'}</td>`; }).join('')}
        <td class="tot"><b>${brl(semana(ln))}</b></td><td class="tot"><b>${brl(noMes(ln))}</b></td></tr>`;
      }).join('')}
      <tr><th>Total</th>${dias.map(d => `<th class="r" style="text-align:center">${brl(somaValores(porDia[diaChave(d)] || []))}</th>`).join('')}<th class="r">${brl(somaValores(saidas.filter(l => { const d = parseData(l['Data']); return d >= semanaIni && d <= fimSem; })))}</th><th class="r">${brl(totalMes)}</th></tr>
    </table></div>
    <div class="detalhe-dia">
      <b>${dSel ? DIAS_SEMANA[dSel.getDay()] + ', ' + dataBR(diaSel) : ''}</b> <span class="nota">clique em um dia para ver as compras</span>
      ${sel.map(l => `<div class="lin"><span class="bolinha" style="background:${corCartao(l['Conta/Cartão'])}"></span><span class="desc">${esc(l['Descrição'])} <span class="nota">${esc(l['Categoria'])}${l['Parcela'] ? ' · parcela ' + esc(l['Parcela']) : ''}</span></span><span class="nota">${esc(l['Conta/Cartão'])}</span><b>${brl(l['Valor'])}</b></div>`).join('') || '<p class="nota">Nenhuma compra neste dia.</p>'}
    </div>
    <p class="nota">"No mês" soma as saídas de ${rotuloMes(mesRef)} pela data da compra (parcelas aparecem no mês de cada parcela). A barra mostra o limite já usado por faturas em aberto.</p>
  </div>`;
}

function linhaTempo(recs) {
  const ini = hoje0(), dias = 183, fim = addDias(ini, dias);
  const x = d => Math.max(0, Math.min(100, difDias(ini, d) / dias * 100));
  const evs = eventosEntre(ini, fim);
  const lanes = [];
  const pos = (left, larg) => { let i = 0; while (lanes[i] !== undefined && lanes[i] > left) i++; lanes[i] = left + larg; return i; };
  const evH = evs.map(e => { const l = x(e.inicio < ini ? ini : e.inicio), w = Math.max(1.2, x(e.fim) - l); return { e, l, w, lane: pos(l, Math.max(w, e.nome.length * 0.95 + 1)) }; });
  const nEv = lanes.length;
  lanes.length = 0;
  const pins = recs.filter(r => r.data).map(r => { const l = x(r.data); return { r, l, lane: pos(l, r.item['Item'].length * 1.05 + 4) }; });
  const nPins = lanes.length;
  const topEv = 22, topEixo = topEv + nEv * 24 + 6, topPins = topEixo + 10;
  const h = topPins + nPins * 24 + 4;
  const meses = [];
  for (let m = new Date(ini.getFullYear(), ini.getMonth() + 1, 1); m <= fim; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) meses.push(m);
  return `<div class="tabela"><div class="lt" style="height:${h}px">
    ${meses.map(m => `<div class="mes" style="left:${x(m)}%">${MESES_LONGOS[m.getMonth()].slice(0, 3)}</div>`).join('')}
    <div class="hojeLinha" style="left:0" title="Hoje"></div>
    ${evH.map(({ e, l, w, lane }) => `<div class="ev ${e.alta ? 'alta' : ''}" style="left:${l}%;min-width:${w}%;top:${topEv + lane * 24}px" title="${esc(e.dica)}">${esc(e.nome)}</div>`).join('')}
    <div class="eixo" style="top:${topEixo}px"></div>
    ${pins.map(({ r, l, lane }) => `<div class="pin" style="left:calc(${l}% - 6px);top:${topPins + lane * 24}px"><span class="bolinha" style="background:${URG_COR[r.urg]}"></span>${esc(r.item['Item'])} <span class="nota">${dm(r.data)}</span></div>`).join('')}
  </div></div>`;
}

function painelAgente(recs) {
  const grupo = st => recs.filter(r => r.status === st);
  const li = r => `<li><b>${esc(r.item['Item'])}</b>: ${esc(r.quando)}${r.pag ? `, ${esc(r.pag.forma)}${r.pag.n > 1 ? ' ' + r.pag.n + 'x' : ''}` : ''}${r.economia > 1 ? ` <span class="pos">(economia ~${brl(r.economia)})</span>` : ''}</li>`;
  const agora = grupo('agora'), aguardar = grupo('aguardar'), atencao = grupo('atencao'), semValor = grupo('sem-valor');
  const prox = eventosEntre(hoje0(), addDias(hoje0(), 365)).filter(e => !e.alta && Math.max(...Object.values(e.desc).concat([0])) >= 0.15)[0];
  const ecoTotal = arred2(recs.reduce((s, r) => s + (r.economia > 0 ? r.economia : 0), 0));
  return `<div class="card secao">
    <div class="agente-topo"><div class="avatar" aria-hidden="true">B</div><div><h2>Agente Buyer</h2><div class="nota">Planeja cada compra pela urgência, pelas datas comerciais, pelo parcelamento sem juros e pelo cartão que mais devolve.${ecoTotal ? ` Seguindo o plano, a economia estimada é de <b class="pos">${brl(ecoTotal)}</b>.` : ''}</div></div></div>
    <div class="baloes">
      <div class="balao"><h4><span class="bolinha" style="background:var(--ok)"></span>Comprar agora</h4>${agora.length ? `<ul>${agora.map(li).join('')}</ul>` : '<p class="nota">Nada para agora.</p>'}</div>
      <div class="balao"><h4><span class="bolinha" style="background:#f9ab00"></span>Esperar a melhor data</h4>${aguardar.length ? `<ul>${aguardar.map(li).join('')}</ul>` : '<p class="nota">Nada aguardando.</p>'}</div>
      <div class="balao"><h4><span class="bolinha" style="background:var(--erro)"></span>Atenção</h4>${atencao.length || semValor.length ? `<ul>${atencao.map(r => `<li><b>${esc(r.item['Item'])}</b>: a reserva de compras não cobre, faltam ${brl(r.falta)}${r.mesesAporte ? ` (cerca de ${r.mesesAporte} mês(es) de aporte)` : ''}.</li>`).join('')}${semValor.map(r => `<li><b>${esc(r.item['Item'])}</b>: sem valor, informe o preço.</li>`).join('')}</ul>` : '<p class="nota">Tudo cabe na reserva.</p>'}</div>
      ${prox ? `<div class="balao"><h4><span class="bolinha" style="background:var(--roxo)"></span>Próxima data forte</h4><p style="margin:0"><b>${esc(prox.nome)}</b>${prox.aprox ? ' (data aproximada)' : ''}, ${prox.inicio <= hoje0() ? 'acontecendo agora' : dm(prox.inicio) + ', em ' + difDias(hoje0(), prox.inicio) + ' dia(s)'}.</p><p class="nota" style="margin:6px 0 0">${esc(prox.dica)}</p></div>` : ''}
    </div>
    <h3 class="secao" style="font-size:14px;color:var(--texto);margin-bottom:0">Próximos 6 meses</h3>
    ${linhaTempo(recs)}
    <p class="nota">Faixas amarelas: datas comerciais (passe o mouse para ver a dica). Pontos: quando o Buyer sugere comprar cada item, na cor da urgência. Descontos médios são estimativas do varejo brasileiro, não garantia de preço.</p>
  </div>`;
}

function urlsBusca(termo) {
  const q = encodeURIComponent(termo);
  return [['Google Shopping', 'https://www.google.com/search?tbm=shop&q=' + q], ['Buscapé', 'https://www.buscape.com.br/search?q=' + q], ['Zoom', 'https://www.zoom.com.br/search?q=' + q],
    ['Mercado Livre', 'https://lista.mercadolivre.com.br/' + encodeURIComponent(termo.replace(/\s+/g, '-'))], ['Amazon', 'https://www.amazon.com.br/s?k=' + q], ['Magalu', 'https://www.magazineluiza.com.br/busca/' + q + '/']];
}

function linkSeguro(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }

function cardItem(r) {
  const it = r.item, idx = r.idx;
  const urg = r.urg;
  const base = Number(it['Valor estimado']) || 0;
  const of = r.oferta;
  const link = linkSeguro(it['Link']);
  const ofertas = (it['Ofertas'] || []).map((o, k) => Object.assign({ k }, o)).sort((a, b) => a.preco - b.preco);
  const maisBarata = ofertas.length && (!base || ofertas[0].preco < base) ? ofertas[0] : null;
  const aberto = buyerAberto[idx];
  const op = opcoes();
  const rec = r.status === 'sem-valor' ? `<div class="rec"><div class="quando">Informe o valor</div><div class="como">${esc(r.resumo)}</div></div>` : `<div class="rec">
      <div class="quando">${esc(r.quando)}</div>
      <div class="como">${esc(r.resumo)} Preço esperado <b>${brl(r.precoEsperado)}</b>.</div>
      <div class="como">Pague com <b>${esc(r.pag.forma)}</b>${r.pag.tipo === 'cartao' ? (r.pag.n > 1 ? `, ${r.pag.n}x sem juros de ${brl(r.pag.parcela)}` : ', à vista') + `, comprando em ${dm(r.pag.dia)}: a 1ª fatura vence ${dm(r.pag.venc)}` : (r.pag.notas[0] ? ', ' + esc(r.pag.notas[0]) : '')}.${r.pag.cashback ? ` Cashback ${brl(r.pag.cashback)}.` : ''}</div>
      ${r.dicaDia ? `<div class="como nota">${esc(r.dicaDia)}</div>` : ''}
      ${r.dicaAntes ? `<div class="como" style="color:var(--aviso)">${esc(r.dicaAntes)}</div>` : ''}
      ${r.economia > 1 ? `<div class="eco">Economia estimada: ${brl(r.economia)}</div>` : ''}
      ${r.alvo && r.precoEsperado > r.alvo ? `<div class="alerta">Acima do seu preço alvo (${brl(r.alvo)}): só compre se baixar.</div>` : ''}
      ${r.falta ? `<div class="alerta">A reserva de compras não cobre: faltam ${brl(r.falta)}.</div>` : ''}
    </div>`;
  const tabelaPag = r.ops ? `<details><summary>Por que esta forma de pagamento?</summary><div class="tabela"><table>
      <tr><th>Forma</th><th class="r">Custo efetivo</th><th>Detalhes</th></tr>
      ${r.ops.map((o, k) => `<tr><td>${k === 0 ? '★ ' : ''}<b>${esc(o.forma)}</b></td><td class="r">${brl(o.custo)}</td><td style="white-space:normal">${o.notas.map(esc).join(' · ')}${o.ganho ? ' · rendimento da reserva ' + brl(o.ganho) : ''}</td></tr>`).join('')}
    </table></div><p class="nota">Custo efetivo = preço − desconto à vista − cashback − o que a reserva rende (${db.cfg.cdi_aa}% a.a.) enquanto as parcelas não vencem. Ajuste cashback e benefícios em Cadastro &gt; Cartões.</p></details>` : '';
  const ofertasHtml = `<details ${aberto === 'oferta' ? 'open' : ''}><summary>Links e preços (${ofertas.length + (link ? 1 : 0)})${maisBarata ? ' · achei mais barato' : ''}</summary>
      ${link ? `<div class="oferta"><span class="loja">Link principal: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(dominio(link) || 'abrir')}</a></span><b>${base ? brl(base) : ''}</b></div>` : ''}
      ${ofertas.map(o => `<div class="oferta"><span class="loja">${o === maisBarata ? '<span class="pill ok">mais barato</span> ' : ''}${linkSeguro(o.link) ? `<a href="${esc(linkSeguro(o.link))}" target="_blank" rel="noopener">${esc(o.loja || dominio(o.link))}</a>` : esc(o.loja)}</span><b>${brl(o.preco)}</b><button class="btn sec peq" data-bx="del-oferta" data-idx="${idx}" data-k="${o.k}" title="Remover">×</button></div>`).join('')}
      <div class="nota" style="margin-top:6px">Comparar preço em:</div>
      <div class="links-busca">${urlsBusca(it['Item'] + (it['Observação'] ? ' ' + it['Observação'] : '')).map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>
      <div class="form-mini" data-oferta="${idx}">
        <div><label>Loja</label><input name="loja" placeholder="Ex.: Kabum"></div>
        <div><label>Preço</label><input name="preco" inputmode="decimal" placeholder="0,00"></div>
        <div style="grid-column:1/-1"><label>Link</label><input name="link" placeholder="https://..."></div>
        <div><button class="btn peq" data-bx="add-oferta" data-idx="${idx}">Salvar oferta</button></div>
      </div>
    </details>`;
  const pagSug = r.pag || {};
  const comprei = aberto === 'comprei' ? `<div class="form-mini" data-comprei="${idx}" style="border-top:1px solid var(--borda);padding-top:8px">
      <div><label>Data</label><input type="date" name="data" value="${diaChave(HOJE)}"></div>
      <div><label>Valor pago</label><input name="valor" inputmode="decimal" value="${String(r.precoEsperado || base || '').replace('.', ',')}"></div>
      <div><label>Pago com</label><select name="conta">${op.contasECartoes.map(o => `<option ${o === (pagSug.tipo === 'cartao' ? pagSug.forma : op.contas[0]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
      <div><label>Parcelas</label><input type="number" name="parcelas" min="1" max="48" value="${pagSug.tipo === 'cartao' ? pagSug.n : 1}"></div>
      <label class="check" style="grid-column:1/-1;margin:0"><input type="checkbox" name="reserva" checked> Descontar da reserva de compras</label>
      <div><button class="btn peq" data-bx="confirmar-compra" data-idx="${idx}">Confirmar compra</button></div>
    </div>` : '';
  return `<div class="item" style="--urg:${URG_COR[urg]}">
    <div class="cab"><div><h3>${esc(it['Item'])}</h3><div class="sub">${esc(it['Tipo item'] || 'Produto')} · ${esc(SEGMENTOS[r.seg])}${it['Frequência'] && it['Frequência'] !== 'Única' ? ' · ' + esc(it['Frequência']).toLowerCase() : ''}${it['Prazo'] ? ' · até ' + dataBR(it['Prazo']) : ''}</div></div><span class="urg">${esc(urg)}</span></div>
    <div class="preco">${of ? brl(of.preco) : '<span class="pill aviso">sem valor</span>'}${maisBarata && base ? `<s>${brl(base)}</s>` : ''}${of && of.loja ? ` <span class="nota" style="font-weight:500">${esc(of.loja)}</span>` : ''}</div>
    ${rec}
    ${tabelaPag}
    ${ofertasHtml}
    ${it['Observação'] ? `<div class="nota">${esc(it['Observação'])}</div>` : ''}
    <div class="acoes">
      <button class="btn peq" data-bx="comprei" data-idx="${idx}">${aberto === 'comprei' ? 'Fechar' : 'Comprei'}</button>
      <button class="btn sec peq" data-bx="editar" data-idx="${idx}">Editar</button>
      <button class="btn sec peq" data-bx="excluir" data-idx="${idx}">Excluir</button>
      ${link ? `<a class="btn fantasma peq" href="${esc(link)}" target="_blank" rel="noopener" style="text-decoration:none">Abrir link</a>` : ''}
    </div>
    ${comprei}
  </div>`;
}

const CAMPOS_WISH = [
  { nome: 'Item', tipo: 'texto', obrigatorio: true, rotulo: 'O que você quer' },
  { nome: 'Tipo item', tipo: 'lista', opcoes: ['Produto', 'Serviço'], padrao: 'Produto', rotulo: 'Produto ou serviço' },
  { nome: 'Valor estimado', tipo: 'moeda', rotulo: 'Preço que você viu (R$)' },
  { nome: 'Urgência', tipo: 'lista', opcoes: URGENCIAS, obrigatorio: true, padrao: 'Média' },
  { nome: 'Prazo', tipo: 'data', rotulo: 'Preciso até (opcional)' },
  { nome: 'Categoria', tipo: 'lista', fonte: 'categorias' },
  { nome: 'Subcategoria', tipo: 'lista', fonte: 'subcategorias', dependeDe: 'Categoria' },
  { nome: 'Frequência', tipo: 'lista', opcoes: Object.keys(FREQUENCIAS), padrao: 'Única', rotulo: 'Se repete?' },
  { nome: 'Sem juros até', tipo: 'inteiro', min: 1, max: 24, rotulo: 'Loja parcela sem juros em até (x)' },
  { nome: 'Desconto Pix %', tipo: 'percentual', rotulo: 'Desconto no Pix/à vista (%)' },
  { nome: 'Preço alvo', tipo: 'moeda', rotulo: 'Só compro se chegar a (R$)' },
  { nome: 'Observação', tipo: 'texto', rotulo: 'Observação (modelo, cor, tamanho)' }
];

function formWish() {
  const op = opcoes();
  const it = buyerEdit !== null ? db.Compras_Futuras[buyerEdit] : null;
  const v = it ? Object.assign({}, it) : { 'Tipo item': 'Produto', 'Urgência': 'Média', 'Frequência': 'Única', 'Categoria': 'Compras' };
  const campo = c => {
    let val = v[c.nome]; if (val === undefined || val === null) val = '';
    if (c.tipo === 'lista') {
      const lista = c.dependeDe ? (op.subcategoriasPor[v[c.dependeDe]] || []) : (c.opcoes || op[c.fonte] || []);
      return `<div><label>${esc(c.rotulo || c.nome)}${c.obrigatorio ? ' *' : ''}</label><select name="${esc(c.nome)}"><option value="">—</option>${lista.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    }
    const tipo = { data: 'date', inteiro: 'number' }[c.tipo] || 'text';
    if (c.tipo === 'data') { const d = parseData(val); val = d ? diaChave(d) : ''; }
    if (typeof val === 'number' && c.tipo !== 'inteiro') val = String(val).replace('.', ',');
    return `<div class="${c.nome === 'Item' || c.nome === 'Observação' ? 'w2' : ''}"><label>${esc(c.rotulo || c.nome)}${c.obrigatorio ? ' *' : ''}</label><input type="${tipo}" name="${esc(c.nome)}" value="${esc(val)}" ${c.tipo === 'moeda' || c.tipo === 'percentual' ? 'inputmode="decimal"' : ''}></div>`;
  };
  const msg = buyerMsg ? `<div class="msg ${buyerMsg.ok ? 'ok' : 'erro'}">${buyerMsg.texto.map(esc).join('<br>')}</div>` : '';
  buyerMsg = null;
  return `<div class="card secao" id="card-wish">
    <h2>${it ? 'Editar: ' + esc(it['Item']) : 'Quero comprar'}</h2>
    <form id="form-wish" class="form-wish" autocomplete="off">
      ${campo(CAMPOS_WISH[0])}
      <div class="w2"><label>Link do produto ou serviço</label><input name="Link" value="${esc(v['Link'] || '')}" placeholder="https://..."></div>
      ${CAMPOS_WISH.slice(1).map(campo).join('')}
      <div class="linha"><button class="btn" type="submit">${it ? 'Salvar alterações' : 'Adicionar à lista'}</button>${it ? '<button class="btn sec" type="button" data-bx="cancelar-edicao">Cancelar</button>' : ''}</div>
    </form>
    ${msg}
    <p class="nota" style="margin:8px 0 0">Urgente: compra em até 3 dias. Alta: até 30. Média: até 90. Baixa: até 6 meses. Esperar oferta: só na melhor data comercial do ano.</p>
  </div>`;
}

function salvarWish(form) {
  const dados = {};
  CAMPOS_WISH.forEach(c => { const el = form.querySelector(`[name="${CSS.escape(c.nome)}"]`); dados[c.nome] = el ? el.value : ''; });
  const v = validarCampos(CAMPOS_WISH, dados, opcoes());
  const erros = v.erros.slice();
  const link = form.querySelector('[name="Link"]').value.trim();
  if (link && !/^https?:\/\/\S+$/i.test(link)) erros.push('Link: comece com http:// ou https://.');
  if (link.length > 500) erros.push('Link: máximo de 500 caracteres.');
  const nome = String(v.valores['Item'] || '');
  if (nome && db.Compras_Futuras.some((c, i) => i !== buyerEdit && normalizarTexto(c['Item']) === normalizarTexto(nome))) erros.push('Já existe "' + nome + '" na lista. Use Editar no card dele.');
  if (erros.length) { buyerMsg = { ok: false, texto: erros }; return; }
  const val = normalizarDatas(v.valores);
  const reg = buyerEdit !== null ? db.Compras_Futuras[buyerEdit] : { 'Status': 'Planejada', 'Mês desejado': '', 'Parcelas máx': '', 'Ofertas': [] };
  Object.assign(reg, val, { 'Link': link, 'Prioridade': URG_PRIORIDADE[val['Urgência']] || 'Média' });
  if (!reg['Onde comprar'] && link) reg['Onde comprar'] = dominio(link);
  if (buyerEdit === null) db.Compras_Futuras.push(reg);
  buyerMsg = { ok: true, texto: ['"' + nome + '" ' + (buyerEdit !== null ? 'atualizado.' : 'entrou na lista. Veja a recomendação do Buyer no card.')] };
  buyerEdit = null;
  guardar();
}

function confirmarCompra(idx, box) {
  const it = db.Compras_Futuras[idx];
  const g = n => box.querySelector(`[name="${n}"]`);
  const cat = it['Categoria'] && opcoes().categorias.indexOf(it['Categoria']) >= 0 ? it['Categoria'] : (opcoes().categorias.indexOf('Compras') >= 0 ? 'Compras' : opcoes().categorias[0]);
  const dados = { 'Data': g('data').value, 'Descrição': it['Item'], 'Valor': g('valor').value, 'Tipo': 'Saída', 'Categoria': cat, 'Subcategoria': cat === it['Categoria'] ? it['Subcategoria'] || '' : '',
    'Centro de custo': '', 'Conta/Cartão': g('conta').value, 'Parcelas': g('parcelas').value || 1 };
  const v = validarCampos(FORMULARIOS.lancamento.campos, dados, opcoes());
  if (!v.ok) { buyerMsg = { ok: false, texto: v.erros }; return; }
  const res = salvarLancamento(v.valores);
  if (!res.ok) { buyerMsg = { ok: false, texto: res.erros }; return; }
  const textos = ['"' + it['Item'] + '" comprado. ' + res.mensagem];
  if (g('reserva').checked) {
    db.cfg.reserva_compras = arred2((Number(db.cfg.reserva_compras) || 0) - v.valores['Valor']);
    textos.push('Reserva de compras agora: ' + brl(db.cfg.reserva_compras) + '.');
  }
  it['Comprado em'] = diaChave(v.valores['Data']); it['Valor pago'] = v.valores['Valor'];
  const intervalo = FREQUENCIAS[it['Frequência']] || 0;
  if (intervalo) { it['Mês desejado'] = somarMeses(mesChave(v.valores['Data']), intervalo); textos.push('Como se repete, volta para a lista em ' + rotuloMes(it['Mês desejado']) + '.'); }
  else it['Status'] = 'Comprada';
  delete buyerAberto[idx];
  buyerMsg = { ok: true, texto: textos };
  guardar();
}

function telaBuyer() {
  const recs = planoBuyer();
  const reserva = Number(db.cfg.reserva_compras) || 0, aporte = Number(db.cfg.aporte_compras) || 0;
  const comprometido = arred2(recs.reduce((s, r) => s + (r.precoEsperado || 0), 0));
  const livre = arred2(reserva - comprometido);
  const saidas = db.Lancamentos.filter(l => l['Tipo'] === 'Saída');
  const gastoMes = somaValores(saidas.filter(l => mesDe(l['Data']) === MES));
  const media3 = arred2([1, 2, 3].reduce((s, k) => s + somaValores(saidas.filter(l => mesDe(l['Data']) === somarMeses(MES, -k))), 0) / 3);
  const nomesC = db.Cartoes.map(c => c['Cartão']);
  const cartMes = somaValores(saidas.filter(l => mesDe(l['Data']) === MES && nomesC.indexOf(l['Conta/Cartão']) >= 0));
  const porCartao = cartoesAtivos().map(c => `<span class="bolinha" style="background:${corCartao(c['Cartão'])}"></span> ${esc(c['Cartão'])} ${brl(somaValores(saidas.filter(l => mesDe(l['Data']) === MES && l['Conta/Cartão'] === c['Cartão'])))}`).join(' · ');
  const diaMes = HOJE.getDate(), diasMes = diasNoMes(HOJE.getFullYear(), HOJE.getMonth() + 1);
  const msgTopo = buyerMsg && buyerMsg.topo ? `<div class="msg ${buyerMsg.ok ? 'ok' : 'erro'}">${buyerMsg.texto.map(esc).join('<br>')}</div>` : '';
  if (buyerMsg && buyerMsg.topo) buyerMsg = null;
  const filtrados = recs.filter(r => filtroWish === 'todos' || r.status === filtroWish || (filtroWish === 'atencao' && r.status === 'sem-valor'));
  const compradas = db.Compras_Futuras.filter(c => c['Status'] === 'Comprada');
  const cont = st => recs.filter(r => r.status === st || (st === 'atencao' && r.status === 'sem-valor')).length;
  return `<div class="titulo-pag"><h2>Buyer</h2><p>Seu planejador de compras: quanto já foi no mês, quanto sobra na reserva e quando comprar cada coisa.</p></div>
  ${msgTopo}
  <div class="kpis">
    <div class="kpi destaque"><div class="rot">Reserva para compras</div>
      ${editReserva ? `<div class="linha" style="margin-top:6px"><input id="rv-saldo" value="${String(reserva).replace('.', ',')}" inputmode="decimal" style="max-width:130px" aria-label="Saldo da reserva"><input id="rv-aporte" value="${String(aporte).replace('.', ',')}" inputmode="decimal" style="max-width:110px" aria-label="Aporte mensal" title="Aporte mensal"><button class="btn peq" data-bx="salvar-reserva">Salvar</button></div><div class="det">saldo atual · aporte por mês</div>`
        : `<div class="val">${brl(reserva)}</div><div class="det">${livre >= 0 ? 'livre depois da lista: ' + brl(livre) : 'a lista passa a reserva em ' + brl(-livre)}${aporte ? ' · +' + brl(aporte) + '/mês' : ''}</div>
        <div class="mini-barra" title="Quanto da reserva a lista de desejos usa"><div style="width:${reserva > 0 ? Math.min(100, Math.round(comprometido / reserva * 100)) : 0}%"></div></div>
        <div class="linha" style="margin-top:8px"><button class="btn peq" data-bx="editar-reserva">Atualizar saldo</button></div>`}
    </div>
    <div class="kpi"><div class="rot">Gasto em ${rotuloMes(MES)} até hoje</div><div class="val">${brl(gastoMes)}</div><div class="det">média dos 3 meses anteriores ${brl(media3)}</div>
      <div class="mini-barra" title="Gasto do mês contra a média"><div style="width:${media3 ? Math.min(100, Math.round(gastoMes / media3 * 100)) : 0}%;background:${media3 && gastoMes > media3 * diaMes / diasMes * 1.1 ? 'var(--erro)' : 'var(--ok)'}"></div></div>
      <div class="det">dia ${diaMes} de ${diasMes}</div></div>
    <div class="kpi"><div class="rot">Nos cartões em ${rotuloMes(MES)}</div><div class="val">${brl(cartMes)}</div><div class="det">${porCartao || 'Cadastre seus cartões em Cadastro > Cartões'}</div></div>
    <div class="kpi"><div class="rot">Lista de desejos</div><div class="val">${brl(comprometido)}</div><div class="det">${recs.length} item(ns) planejado(s) · ${compradas.length} comprado(s)</div></div>
  </div>
  <h3 class="secao" style="font-size:15px">Calendário da semana</h3>
  ${calendarioSemanal(recs)}
  ${painelAgente(recs)}
  ${formWish()}
  <div class="card secao">
    <div class="linha" style="justify-content:space-between;margin-bottom:10px"><h2 style="margin:0">Lista de desejos</h2>
      <div class="subabas" style="margin:0">${[['todos', 'Todos', recs.length], ['agora', 'Comprar agora', cont('agora')], ['aguardar', 'Esperar', cont('aguardar')], ['atencao', 'Atenção', cont('atencao')]].map(([id, n, q]) => `<button data-fw="${id}" class="${id === filtroWish ? 'ativo' : ''}">${n} <span class="nota">${q}</span></button>`).join('')}</div>
    </div>
    <div class="wish">${filtrados.map(cardItem).join('') || '<p class="nota">Nenhum item aqui. Use "Quero comprar" acima.</p>'}</div>
    ${compradas.length ? `<details class="secao"><summary>Já comprados (${compradas.length})</summary><div class="tabela"><table><tr><th>Item</th><th>Comprado em</th><th class="r">Valor pago</th><th></th></tr>${compradas.map(c => `<tr><td>${esc(c['Item'])}</td><td>${c['Comprado em'] ? dataBR(c['Comprado em']) : ''}</td><td class="r">${c['Valor pago'] ? brl(c['Valor pago']) : ''}</td><td><button class="btn sec peq" data-bx="voltar-lista" data-idx="${db.Compras_Futuras.indexOf(c)}">Voltar para a lista</button></td></tr>`).join('')}</table></div></details>` : ''}
  </div>`;
}

// ------------------------------------------------------------ eventos das páginas novas
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (abaAtual === 'cadastro') {
    if (t.dataset.rtipo) { lerRapido(); rapido.tipo = t.dataset.rtipo; rapido.cat = ''; rapido.sub = ''; if (rapido.tipo !== 'Saída' && opcoes().cartoes.indexOf(rapido.conta) >= 0) rapido.conta = ''; render(); }
    return;
  }
  if (abaAtual !== 'buyer') return;
  if (t.dataset.sem !== undefined) {
    const n = Number(t.dataset.sem);
    semanaIni = n === 0 ? addDias(hoje0(), -((HOJE.getDay() + 6) % 7)) : addDias(semanaIni, 7 * n);
    diaSel = n === 0 ? diaChave(HOJE) : diaChave(semanaIni);
    render(); return;
  }
  if (t.dataset.fw) { filtroWish = t.dataset.fw; render(); return; }
  const acao = t.dataset.bx, idx = Number(t.dataset.idx);
  if (!acao) return;
  e.preventDefault();
  if (acao === 'editar-reserva') { editReserva = true; render(); foco = 'rv-saldo'; const el = document.getElementById('rv-saldo'); if (el) el.focus(); }
  else if (acao === 'salvar-reserva') {
    const s = parseValorBR(document.getElementById('rv-saldo').value), a = parseValorBR(document.getElementById('rv-aporte').value || '0');
    if (isNaN(s) || isNaN(a) || a < 0) { buyerMsg = { ok: false, topo: true, texto: ['Informe valores válidos para o saldo e o aporte.'] }; render(); return; }
    db.cfg.reserva_compras = arred2(s); db.cfg.aporte_compras = arred2(a); editReserva = false; guardar(); render();
  }
  else if (acao === 'comprei') { buyerAberto[idx] = buyerAberto[idx] === 'comprei' ? null : 'comprei'; render(); }
  else if (acao === 'confirmar-compra') { confirmarCompra(idx, t.closest('[data-comprei]')); if (buyerMsg) buyerMsg.topo = true; render(); window.scrollTo(0, 0); }
  else if (acao === 'editar') { buyerEdit = idx; render(); const c = document.getElementById('card-wish'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }
  else if (acao === 'cancelar-edicao') { buyerEdit = null; render(); }
  else if (acao === 'excluir') {
    const it = db.Compras_Futuras[idx];
    if (!confirmar('Tirar "' + it['Item'] + '" da lista?')) return;
    db.Compras_Futuras.splice(idx, 1); buyerAberto = {}; if (buyerEdit !== null) buyerEdit = null; guardar(); render();
  }
  else if (acao === 'voltar-lista') { db.Compras_Futuras[idx]['Status'] = 'Planejada'; guardar(); render(); }
  else if (acao === 'add-oferta') {
    const box = t.closest('[data-oferta]');
    const loja = box.querySelector('[name="loja"]').value.trim(), preco = parseValorBR(box.querySelector('[name="preco"]').value), link = box.querySelector('[name="link"]').value.trim();
    const erros = [];
    if (!(preco > 0)) erros.push('Informe o preço da oferta.');
    if (link && !/^https?:\/\/\S+$/i.test(link)) erros.push('O link deve começar com http:// ou https://.');
    if (!loja && !link) erros.push('Informe a loja ou o link.');
    if (contemNumeroSensivel(loja)) erros.push('Não digite números de cartão ou documento.');
    if (erros.length) { let m = box.querySelector('.msg'); if (!m) { m = document.createElement('div'); m.className = 'msg erro'; box.appendChild(m); } m.style.gridColumn = '1/-1'; m.textContent = erros.join(' '); return; }
    const it = db.Compras_Futuras[idx];
    it['Ofertas'] = it['Ofertas'] || [];
    it['Ofertas'].push({ loja: loja || dominio(link), preco: arred2(preco), link, data: diaChave(HOJE) });
    buyerAberto[idx] = 'oferta'; guardar(); render();
  }
  else if (acao === 'del-oferta') { const it = db.Compras_Futuras[idx]; it['Ofertas'].splice(Number(t.dataset.k), 1); buyerAberto[idx] = 'oferta'; guardar(); render(); }
});

document.addEventListener('click', e => {
  if (abaAtual !== 'buyer') return;
  const th = e.target.closest('th[data-dia]');
  if (th) { diaSel = th.dataset.dia; render(); }
});

function lerRapido() {
  const g = id => document.getElementById(id);
  if (!g('rap-form')) return;
  rapido.data = g('rap-data').value; rapido.desc = g('rap-desc').value; rapido.valor = g('rap-valor').value;
  if (g('rap-cat')) rapido.cat = g('rap-cat').value;
  if (g('rap-sub')) rapido.sub = g('rap-sub').value;
  rapido.conta = g('rap-conta').value;
  if (g('rap-parc')) rapido.parcelas = g('rap-parc').value || 1;
  if (g('rap-centro')) rapido.centro = g('rap-centro').value;
  if (g('rap-rec')) rapido.recorrente = g('rap-rec').checked;
}

document.addEventListener('submit', e => {
  if (e.target.id === 'rap-form') { e.preventDefault(); lerRapido(); salvarRapido(); render(); }
  else if (e.target.id === 'form-wish') { e.preventDefault(); salvarWish(e.target); render(); }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (abaAtual === 'cadastro') {
    if (t.id && t.id.indexOf('fc-') === 0) { filtroCad[t.id.slice(3)] = t.value; render(); return; }
    if (t.id === 'rap-cat' || t.id === 'rap-conta' || t.id === 'rap-rec') {
      lerRapido();
      if (t.id === 'rap-cat') rapido.sub = '';
      if (t.id === 'rap-conta' && opcoes().cartoes.indexOf(rapido.conta) < 0) rapido.parcelas = 1;
      render(); foco = null; const el = document.getElementById(t.id); if (el) el.focus();
    }
    return;
  }
  if (abaAtual === 'buyer' && t.name === 'Categoria' && t.closest('#form-wish')) {
    const sub = t.closest('#form-wish').querySelector('[name="Subcategoria"]');
    if (sub) sub.innerHTML = '<option value="">—</option>' + (opcoes().subcategoriasPor[t.value] || []).map(o => `<option>${esc(o)}</option>`).join('');
  }
});


