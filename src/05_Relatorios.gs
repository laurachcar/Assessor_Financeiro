/**
 * 05_Relatorios — Orçado x realizado, Projeção de caixa, Calendário de compras e Painel.
 */

const FMT_REAL = '"R$" #,##0.00';
const FMT_PCT = '0%';

function hoje_() { return new Date(); }

function atualizarRelatorios() {
  atualizarOrcado_();
  const plano = atualizarProjecaoECalendario_();
  const parcelas = atualizarParcelas_();
  plano.parcelas = parcelas;
  atualizarPainel_(plano);
}

// ---------------------------------------------------------------- orçado x realizado

function atualizarOrcado_() {
  const sh = aba_('Orcado_Realizado');
  const anoAtual = hoje_().getFullYear();
  let ano = Number(sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colAno).getValue()) || anoAtual;
  let centro = String(sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colCentro).getValue() || 'Todos');

  const lancamentos = lerTabela_('Lancamentos');
  const categorias = lerTabela_('Categorias');
  const centros = ['Todos'].concat(lerTabela_('Centros_Custo').map(function (c) { return String(c['Centro de custo']); }));
  if (centros.indexOf(centro) < 0) centro = 'Todos';
  const anos = {};
  anos[anoAtual] = true;
  lancamentos.forEach(function (l) { const d = parseData(l['Data']); if (d) anos[d.getFullYear()] = true; });

  const mesesDecorridos = ano < anoAtual ? 12 : (ano > anoAtual ? 0 : hoje_().getMonth() + 1);
  const linhas = montarOrcadoRealizado(categorias, lancamentos, ano, centro, mesesDecorridos);

  sh.clearContents();
  sh.getRange(FILTRO_ORCADO.linha, 1, 1, 4).setValues([['Ano', ano, 'Centro de custo', centro]]);
  sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colAno).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(anos).sort(), true).build());
  sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colCentro).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(centros, true).build());

  const cab = ['Categoria', 'Meta mensal'].concat(NOMES_MESES)
    .concat(['Total ' + ano, 'Meta até agora', '% da meta', 'Total ' + (ano - 1), 'Variação']);
  const corpo = linhas.map(function (l) {
    return [l.categoria, l.metaMensal].concat(l.meses)
      .concat([l.total, l.metaAcumulada, l.pctMeta === null ? '' : l.pctMeta, l.anoAnterior, l.variacao === null ? '' : l.variacao]);
  });
  const tot = ['TOTAL', soma_(linhas, 'metaMensal')];
  for (let i = 0; i < 12; i++) tot.push(arred2(linhas.reduce(function (s, l) { return s + l.meses[i]; }, 0)));
  const totAno = soma_(linhas, 'total'), totMeta = soma_(linhas, 'metaAcumulada'), totAnt = soma_(linhas, 'anoAnterior');
  tot.push(totAno, totMeta, totMeta ? totAno / totMeta : '', totAnt, totAnt ? (totAno - totAnt) / totAnt : '');

  const tabela = [cab].concat(corpo).concat([tot]);
  sh.getRange(3, 1, tabela.length, cab.length).setValues(tabela);
  sh.getRange(3, 1, 1, cab.length).setFontWeight('bold').setBackground('#f1f3f4');
  sh.getRange(3 + tabela.length - 1, 1, 1, cab.length).setFontWeight('bold');
  sh.getRange(4, 2, tabela.length - 1, 16).setNumberFormat(FMT_REAL);
  sh.getRange(4, 17, tabela.length - 1, 1).setNumberFormat(FMT_PCT);
  sh.getRange(4, 18, tabela.length - 1, 1).setNumberFormat(FMT_REAL);
  sh.getRange(4, 19, tabela.length - 1, 1).setNumberFormat(FMT_PCT);
  // cores: verde até 80%, amarelo de 80% a 100%, vermelho acima
  const cores = tabela.slice(1).map(function (r) {
    const p = r[16];
    if (p === '' || p === null) return ['#ffffff'];
    return [p >= 1 ? '#f4c7c3' : (p >= 0.8 ? '#fce8b2' : '#d9ead3')];
  });
  sh.getRange(4, 17, cores.length, 1).setBackgrounds(cores);
  sh.setFrozenRows(3);
  return linhas;
}

function soma_(lista, campo) { return arred2(lista.reduce(function (s, l) { return s + (Number(l[campo]) || 0); }, 0)); }

// ---------------------------------------------------------------- projeção e calendário

function dadosProjecao_() {
  const cfg = lerConfig_();
  const cartoes = lerTabela_('Cartoes').filter(function (c) { return ehSim(c['Ativo']); });
  const nomesCartoes = lerTabela_('Cartoes').map(function (c) { return c['Cartão']; });
  const contas = lerTabela_('Contas').filter(function (c) { return ehSim(c['Ativa']) && c['Tipo'] !== 'Investimento'; });
  const lancamentos = lerTabela_('Lancamentos');
  const mesInicial = mesChave(hoje_());
  const ultimoAporte = lerTabela_('Aporte_Reserva').sort(function (a, b) { return mesDe(a['Mês']) < mesDe(b['Mês']) ? -1 : 1; }).pop();
  return {
    cfg: cfg, cartoes: cartoes, nomesCartoes: nomesCartoes, mesInicial: mesInicial,
    saldoInicial: soma_(contas, 'Saldo atual'),
    fixos: lerTabela_('Fixos'),
    faturas: faturasPorMes(lancamentos.filter(function (l) { return mesDe(l['Mês fatura']) >= mesInicial; }), nomesCartoes),
    parcelas: parcelasPorMes(lancamentos, nomesCartoes),
    aporte: Number(cfg.aporte_mensal) || (ultimoAporte ? Number(ultimoAporte['Aporte']) : 0),
    compras: lerTabela_('Compras_Futuras')
  };
}

function atualizarProjecaoECalendario_() {
  const d = dadosProjecao_();
  const base = projetarCaixa({
    saldoInicial: d.saldoInicial, fixos: d.fixos, faturas: d.faturas, nomesCartoes: d.nomesCartoes,
    aporte: d.aporte, mesInicial: d.mesInicial, meses: 12
  });
  const plano = planejarCompras({
    projecao: base, compras: d.compras, cargaParcelas: d.parcelas, teto: d.cfg.teto_parcelas,
    maxParcelas: d.cfg.max_parcelas, cartoes: d.cartoes
  });
  const projecao = projetarCaixa({
    saldoInicial: d.saldoInicial, fixos: d.fixos, faturas: d.faturas, nomesCartoes: d.nomesCartoes,
    aporte: d.aporte, mesInicial: d.mesInicial, meses: 12, compras: plano.porMes
  });

  // Projeção
  const sp = aba_('Projecao_Caixa');
  sp.clearContents();
  sp.getRange(1, 1, 1, 2).setValues([['Saldo atual das contas', d.saldoInicial]]);
  const cab = ['Mês', 'Saldo inicial', 'Entradas', 'Saídas fixas', 'Faturas de cartão', 'Compras planejadas', 'Aporte', 'Saldo final', 'Situação'];
  const linhas = projecao.map(function (r) {
    return [rotuloMes(r.mes), r.saldoInicial, r.entradas, r.saidasFixas, r.faturas, r.compras, r.aporte, r.saldoFinal,
      r.saldoFinal < 0 ? 'Negativo' : 'OK'];
  });
  sp.getRange(3, 1, linhas.length + 1, cab.length).setValues([cab].concat(linhas));
  sp.getRange(3, 1, 1, cab.length).setFontWeight('bold').setBackground('#f1f3f4');
  sp.getRange(1, 2).setNumberFormat(FMT_REAL);
  sp.getRange(4, 2, linhas.length, 7).setNumberFormat(FMT_REAL);
  sp.getRange(4, 9, linhas.length, 1).setBackgrounds(linhas.map(function (l) { return [l[8] === 'OK' ? '#d9ead3' : '#f4c7c3']; }));

  // Calendário
  const sc = aba_('Calendario_Compras');
  sc.clearContents();
  const cabC = ['Item', 'Categoria', 'Frequência', 'Prioridade', 'Valor', 'Melhor mês', 'Parcelas', 'Valor da parcela', 'Cartão', 'Dia de compra', 'Dias até pagar', 'Onde comprar', 'Motivo'];
  const linhasC = plano.itens.map(function (i) {
    return [i.item, i.categoria + (i.subcategoria ? ' / ' + i.subcategoria : ''), i.frequencia, i.prioridade, i.valor,
      i.mes ? rotuloMes(i.mes) : '—', i.parcelas, i.valorParcela, i.cartao, i.dia, i.diasAtePagar, i.onde, i.motivo];
  });
  sc.getRange(1, 1).setValue('Teto de parcelas: R$ ' + Number(d.cfg.teto_parcelas || 0).toFixed(2) +
    ' por mês · máximo de ' + d.cfg.max_parcelas + ' parcelas · compre no dia seguinte ao fechamento do cartão indicado');
  sc.getRange(3, 1, linhasC.length + 1, cabC.length).setValues([cabC].concat(linhasC));
  sc.getRange(3, 1, 1, cabC.length).setFontWeight('bold').setBackground('#f1f3f4');
  if (linhasC.length) {
    sc.getRange(4, 5, linhasC.length, 1).setNumberFormat(FMT_REAL);
    sc.getRange(4, 8, linhasC.length, 1).setNumberFormat(FMT_REAL);
  }
  return { projecao: projecao, plano: plano, dados: d };
}

// ---------------------------------------------------------------- parcelas por cartão

/** Aba Parcelas: cada compra parcelada (por cartão) e o total de parcelas por cartão nos próximos 12 meses. */
function atualizarParcelas_() {
  const sh = aba_('Parcelas');
  const mes = mesChave(hoje_());
  const nomes = lerTabela_('Cartoes').map(function (c) { return c['Cartão']; });
  const r = resumoParcelas(lerTabela_('Lancamentos'), nomes, mes);
  const meses = proximosMeses(mes, 12);
  sh.clearContents();

  const cab = ['Cartão', 'Compra', 'Categoria', 'Data da compra', 'Parcelas', 'Valor da parcela', 'Pagas', 'Faltam', 'Falta pagar', 'Última fatura'];
  const linhas = r.compras.map(function (c) {
    return [c.cartao, c.descricao, c.categoria + (c.subcategoria ? ' / ' + c.subcategoria : ''), c.data || '', c.totalParcelas,
      c.valorParcela, c.pagas, c.restantes, c.valorRestante, c.ultimaFatura ? rotuloMes(c.ultimaFatura) : ''];
  });
  sh.getRange(1, 1).setValue('Compras parceladas por cartão');
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(12);
  sh.getRange(2, 1, linhas.length + 1, cab.length).setValues([cab].concat(linhas));
  sh.getRange(2, 1, 1, cab.length).setFontWeight('bold').setBackground('#f1f3f4');
  if (linhas.length) {
    sh.getRange(3, 4, linhas.length, 1).setNumberFormat('dd/mm/yyyy');
    sh.getRange(3, 6, linhas.length, 1).setNumberFormat(FMT_REAL);
    sh.getRange(3, 9, linhas.length, 1).setNumberFormat(FMT_REAL);
  }

  const inicio = linhas.length + 5;
  const cartoes = Object.keys(r.porCartaoMes).sort();
  const cab2 = ['Parcelas por mês'].concat(meses.map(rotuloMes)).concat(['Total']);
  const tabela = cartoes.map(function (c) {
    const vals = meses.map(function (m) { return r.porCartaoMes[c][m] || 0; });
    return [c].concat(vals).concat([arred2(vals.reduce(function (a, b) { return a + b; }, 0))]);
  });
  const totais = ['TOTAL'];
  for (let i = 1; i < cab2.length; i++) totais.push(arred2(tabela.reduce(function (s, l) { return s + l[i]; }, 0)));
  const bloco = [cab2].concat(tabela).concat([totais]);
  sh.getRange(inicio, 1, bloco.length, cab2.length).setValues(bloco);
  sh.getRange(inicio, 1, 1, cab2.length).setFontWeight('bold').setBackground('#f1f3f4');
  sh.getRange(inicio + bloco.length - 1, 1, 1, cab2.length).setFontWeight('bold');
  sh.getRange(inicio + 1, 2, bloco.length - 1, cab2.length - 1).setNumberFormat(FMT_REAL);
  sh.setFrozenRows(2);
  return r;
}

// ---------------------------------------------------------------- painel

function atualizarPainel_(r) {
  const sh = aba_('Painel');
  const mes = mesChave(hoje_());
  const lanc = lerTabela_('Lancamentos').filter(function (l) { const d = parseData(l['Data']); return d && mesChave(d) === mes; });
  const entradas = arred2(lanc.filter(function (l) { return l['Tipo'] === 'Entrada'; }).reduce(function (s, l) { return s + Number(l['Valor']); }, 0));
  const saidas = arred2(lanc.filter(function (l) { return l['Tipo'] === 'Saída'; }).reduce(function (s, l) { return s + Number(l['Valor']); }, 0));
  const cfg = r.dados.cfg;
  const aportes = lerTabela_('Aporte_Reserva').sort(function (a, b) { return mesDe(a['Mês']) < mesDe(b['Mês']) ? -1 : 1; });
  const reserva = aportes.length ? Number(aportes[aportes.length - 1]['Reserva depois']) : 0;
  const negativos = r.projecao.filter(function (p) { return p.saldoFinal < 0; }).map(function (p) { return rotuloMes(p.mes); });
  const estourados = resumoOrcamentoMes_(mes).filter(function (c) { return c.pct >= 0.8; });

  const linhas = [
    ['Assessor Financeiro — ' + rotuloMes(mes), ''],
    ['', ''],
    ['Entradas do mês', entradas],
    ['Saídas do mês', saidas],
    ['Resultado do mês', arred2(entradas - saidas)],
    ['Saldo atual das contas', r.dados.saldoInicial],
    ['Saldo projetado em 12 meses', r.projecao.length ? r.projecao[r.projecao.length - 1].saldoFinal : 0],
    ['Meses com saldo negativo', negativos.length ? negativos.join(', ') : 'Nenhum'],
    ['', ''],
    ['Reserva de emergência', reserva],
    ['Meta da reserva', Number(cfg.meta_reserva)],
    ['Situação da reserva', reserva >= Number(cfg.meta_reserva) ? 'Completa (congelada)' : 'Recebendo ' + cfg.pct_reserva + '% do aporte'],
    ['% do aporte nas metas', somaPercentuaisMetas(lerTabela_('Metas_Investimento')) + '%'],
    ['', ''],
    ['Categorias acima de 80% da meta', estourados.length ? estourados.map(function (c) { return c.categoria + ' (' + Math.round(c.pct * 100) + '%)'; }).join(', ') : 'Nenhuma'],
    ['Próxima compra planejada', proximaCompra_(r.plano.itens)],
    ['Parcelas em aberto', parcelasEmAberto_(r.parcelas)],
    ['Importações aguardando aprovação', lerTabela_('Import_Staging').filter(function (l) { return l['Status'] === 'Pendente'; }).length],
    ['', ''],
    ['Atualizado em', new Date()]
  ];
  sh.clearContents();
  sh.getRange(1, 1, linhas.length, 2).setValues(linhas);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  [3, 4, 5, 6, 7, 10, 11].forEach(function (l) { sh.getRange(l, 2).setNumberFormat(FMT_REAL); });
  sh.getRange(linhas.length, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(2, 420);
}

function parcelasEmAberto_(p) {
  if (!p || !p.compras.length) return 'Nenhuma';
  const porCartao = {};
  p.compras.forEach(function (c) { if (c.restantes > 0) porCartao[c.cartao] = arred2((porCartao[c.cartao] || 0) + c.valorRestante); });
  const partes = Object.keys(porCartao).map(function (c) { return c + ': R$ ' + porCartao[c].toFixed(2); });
  return partes.length ? partes.join(' · ') : 'Nenhuma';
}

function proximaCompra_(itens) {
  const p = itens.filter(function (i) { return i.mes; }).sort(function (a, b) { return a.mes < b.mes ? -1 : 1; })[0];
  if (!p) return 'Nenhuma';
  return p.item + ' em ' + rotuloMes(p.mes) + (p.cartao ? ', no ' + p.cartao + ' dia ' + p.dia : '') +
    (p.parcelas > 1 ? ', ' + p.parcelas + 'x de R$ ' + Number(p.valorParcela).toFixed(2) : '');
}

/** Realizado x meta de cada categoria no mês (usado no Painel e nos alertas). */
function resumoOrcamentoMes_(mes) {
  const real = {};
  lerTabela_('Lancamentos').forEach(function (l) {
    const d = parseData(l['Data']);
    if (l['Tipo'] !== 'Saída' || !d || mesChave(d) !== mes) return;
    const c = l['Categoria'] || '(sem categoria)';
    real[c] = arred2((real[c] || 0) + Number(l['Valor']));
  });
  return lerTabela_('Categorias').filter(function (c) { return Number(c['Meta mensal']) > 0; }).map(function (c) {
    const r = real[c['Categoria']] || 0;
    return { categoria: c['Categoria'], realizado: r, meta: Number(c['Meta mensal']), pct: r / Number(c['Meta mensal']) };
  });
}
