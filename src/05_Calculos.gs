/**
 * ASSESSOR FINANCEIRO — 05_Calculos.gs
 * --------------------------------------------------------------
 * Lê a planilha, aplica as regras de 04_Logica.gs e escreve os resultados.
 * Nada aqui usa IA nem tokens.
 */

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Menu: recalcula tudo. silencioso = sem pop-up (gatilhos). */
function recalcularTudo(silencioso) {
  atualizarParcelas_();
  atualizarMetas_();
  atualizarProjecaoECompras_();
  atualizarProjetos_();
  atualizarOrcamento();
  if (silencioso !== true) ss_().toast('Tudo recalculado.', SISTEMA.nome, 4);
}

/* ---------------- Lançamentos aprovados ---------------- */

/** Lançamentos que contam (exclui Transferência). */
function lancamentosValidos_() {
  return lerTabela_(ABAS.LANCAMENTOS).filter(l => l['Tipo'] !== 'Transferência' && l['Competência']);
}

/** Move da Import_Staging para Lançamentos as linhas com "Aprovar" marcado. */
function aprovarStaging() {
  const st = aba_(ABAS.STAGING);
  const linhas = lerTabela_(ABAS.STAGING).filter(l => l['Aprovar'] === true);
  if (!linhas.length) { SpreadsheetApp.getUi().alert('Nenhuma linha marcada em "Aprovar".'); return; }

  const hashes = {};
  lerTabela_(ABAS.LANCAMENTOS).forEach(l => { hashes[l['Hash']] = true; });
  const categorias = lerTabela_(ABAS.CATEGORIAS).map(c => c['Categoria']);

  let movidos = 0, duplicados = 0;
  const problemas = [];
  linhas.forEach(l => {
    if (!l['Categoria'] || categorias.indexOf(l['Categoria']) < 0) { problemas.push(l['Descrição'] + ': categoria inválida'); return; }
    if (!l['Centro de custo'] || l['Centro de custo'] === 'A definir') { problemas.push(l['Descrição'] + ': defina o centro de custo'); return; }
    if (pareceNumeroSensivel_(l['Descrição'])) { problemas.push(l['Descrição'].slice(0, 20) + '...: contém número sensível'); return; }
    const h = l['Hash'] || hashLancamento_(l['Data'], l['Valor'], l['Descrição']);
    if (hashes[h]) { duplicados++; l._remover = true; return; }
    hashes[h] = true;
    const obj = {};
    LANC_COLS.forEach(c => { obj[c] = l[c]; });
    obj['Hash'] = h;
    obj['ID'] = obj['ID'] || Utilities.getUuid().slice(0, 8);
    obj['Competência'] = obj['Competência'] || competencia_(obj['Data']);
    obj['Titular'] = obj['Titular'] || cfg_('titular', '');
    anexar_(ABAS.LANCAMENTOS, obj);
    l._remover = true;
    movidos++;
  });

  // Apaga de baixo para cima para não bagunçar os números das linhas
  linhas.filter(l => l._remover).map(l => l._linha).sort((a, b) => b - a).forEach(r => st.deleteRow(r));

  recalcularTudo(true);
  let msg = movidos + ' lançamento(s) aprovado(s). ' + duplicados + ' duplicado(s) descartado(s).';
  if (problemas.length) msg += '\n\nFicaram na importação para corrigir:\n- ' + problemas.join('\n- ');
  SpreadsheetApp.getUi().alert(msg);
}

/* ---------------- Parcelas ---------------- */

/** Reconstrói Parcelas_Cartao a partir dos lançamentos parcelados. */
function atualizarParcelas_() {
  const sh = aba_(ABAS.PARCELAS);
  const hoje = competencia_(hoje_());
  const linhas = [];
  // Para cada compra parcelada, considera só o lançamento da parcela mais recente
  const porCompra = {};
  lerTabela_(ABAS.LANCAMENTOS).forEach(l => {
    const m = String(l['Parcela'] || '').match(/^(\d+)\/(\d+)$/);
    if (!m || l['Tipo'] !== 'Saída') return;
    const chave = normalizar_(l['Descrição']) + '|' + l['Conta/Cartão'] + '|' + m[2] + '|' + Number(l['Valor']).toFixed(2);
    const atual = Number(m[1]);
    if (!porCompra[chave] || porCompra[chave].atual < atual) porCompra[chave] = { l: l, atual: atual, total: Number(m[2]) };
  });
  Object.keys(porCompra).forEach(k => {
    const p = porCompra[k];
    const ultima = addMeses_(p.l['Competência'], p.total - p.atual);
    if (ultima < hoje) return; // já terminou
    linhas.push([p.l['Descrição'], p.l['Conta/Cartão'], n0_(p.l['Valor']), p.atual, p.total, p.l['Competência'], ultima]);
  });
  limparDados_(sh);
  if (linhas.length) sh.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
}

/** Soma das parcelas já assumidas em cada mês. */
function parcelasPorMes_() {
  const mapa = {};
  lerTabela_(ABAS.PARCELAS).forEach(p => {
    const futuras = parcelasFuturas_(p['Competência atual'], p['Parcela atual'] + '/' + p['Total de parcelas'], n0_(p['Valor da parcela']));
    futuras.forEach(f => { mapa[f.mes] = (mapa[f.mes] || 0) + f.valor; });
  });
  return mapa;
}

/* ---------------- Metas e reserva ---------------- */

function atualizarMetas_() {
  const sh = aba_(ABAS.METAS);
  const cab = CABECALHOS[ABAS.METAS];
  const metas = lerTabela_(ABAS.METAS);
  const reserva = { saldo: n0_(cfg_('reserva_saldo', 0)), meta: n0_(cfg_('reserva_meta', 10000)), pct: n0_(cfg_('reserva_pct', 0.5)) };
  const ativas = metas.filter(m => m['Status'] === 'Ativa' && normalizar_(m['Meta']) !== 'reserva de emergencia')
    .map(m => ({ nome: m['Meta'], pct: n0_(m['% do aporte']) }));
  const aloc = alocarAporte_(n0_(cfg_('aporte_mensal', 0)), reserva, ativas);

  metas.forEach(m => {
    const ehReserva = normalizar_(m['Meta']) === 'reserva de emergencia';
    let aporte = 0, acumulado = n0_(m['Acumulado (R$)']), alvo = n0_(m['Valor-alvo (R$)']), status = m['Status'];
    if (ehReserva) {
      aporte = aloc.reserva; acumulado = reserva.saldo; alvo = reserva.meta;
      status = aloc.congelada ? 'Congelada' : 'Ativa';
    } else {
      const a = aloc.metas.find(x => x.nome === m['Meta']);
      aporte = a ? a.valor : 0;
    }
    const r = m._linha;
    sh.getRange(r, cab.indexOf('Valor-alvo (R$)') + 1).setValue(alvo);
    sh.getRange(r, cab.indexOf('Aporte mensal (R$)') + 1).setValue(aporte);
    sh.getRange(r, cab.indexOf('Acumulado (R$)') + 1).setValue(acumulado);
    sh.getRange(r, cab.indexOf('% concluído') + 1).setValue(alvo > 0 ? Math.min(1, acumulado / alvo) : '');
    sh.getRange(r, cab.indexOf('Status') + 1).setValue(status);
  });

  if (ativas.length && Math.abs(aloc.somaPct - 1) > 0.001) {
    sh.getRange(1, cab.indexOf('% do aporte') + 1).setNote('Atenção: as metas ativas somam ' + Math.round(aloc.somaPct * 100) +
      '%. O sistema dividiu o aporte proporcionalmente. Ajuste para somar 100%.');
  } else {
    sh.getRange(1, cab.indexOf('% do aporte') + 1).clearNote();
  }
}

/* ---------------- Projeção de caixa e calendário de compras ---------------- */

function ativoNoMes_(fixo, ym) {
  const ini = fixo['Início'] instanceof Date ? competencia_(fixo['Início']) : '0000-00';
  const fim = fixo['Fim'] instanceof Date ? competencia_(fixo['Fim']) : '9999-99';
  return ym >= ini && ym <= fim;
}

/** Média mensal dos gastos variáveis nos 3 últimos meses fechados. */
function mediaVariaveis_(mesAtual, fixosSaidaMes, parcelasMap) {
  const lanc = lancamentosValidos_().filter(l => l['Tipo'] === 'Saída');
  let soma = 0, meses = 0;
  for (let k = 1; k <= 3; k++) {
    const ym = addMeses_(mesAtual, -k);
    const doMes = lanc.filter(l => l['Competência'] === ym);
    if (!doMes.length) continue;
    const total = doMes.reduce((s, l) => s + n0_(l['Valor']), 0);
    soma += Math.max(0, total - fixosSaidaMes(ym) - (parcelasMap[ym] || 0));
    meses++;
  }
  return meses ? soma / meses : 0;
}

function atualizarProjecaoECompras_() {
  const mes0 = competencia_(hoje_());
  const fixos = lerTabela_(ABAS.FIXOS);
  const parcelasMap = parcelasPorMes_();
  const fixosDo = (tipo) => (ym) => fixos.filter(f => f['Tipo'] === tipo && ativoNoMes_(f, ym)).reduce((s, f) => s + n0_(f['Valor']), 0);
  const fixosSaida = fixosDo('Saída'), fixosEntrada = fixosDo('Entrada');
  const variaveis = mediaVariaveis_(mes0, fixosSaida, parcelasMap);
  const aporte = n0_(cfg_('aporte_mensal', 0));
  const rendaBase = n0_(cfg_('renda_base', 0));

  const meses = [];
  for (let k = 0; k < 12; k++) {
    const ym = addMeses_(mes0, k);
    const entradas = fixosEntrada(ym) || rendaBase;
    const fx = fixosSaida(ym);
    const parc = parcelasMap[ym] || 0;
    const sobra = entradas - fx - parc - aporte - variaveis;
    meses.push({ mes: ym, entradas: entradas, fixos: fx, parcelas: parc, aportes: aporte, variaveis: variaveis, sobra: sobra });
  }

  // Calendário de compras
  const sh = aba_(ABAS.COMPRAS);
  const cab = CABECALHOS[ABAS.COMPRAS];
  const compras = lerTabela_(ABAS.COMPRAS);
  const ativos = compras.filter(c => (c['Status'] || 'Ativo') === 'Ativo');
  const itens = ativos.map(c => ({
    produto: c['Produto'],
    preco: n0_(c['Último preço']) || n0_(c['Preço de referência']),
    precoAlvo: n0_(c['Preço-alvo']),
    maxParcelas: Math.max(1, n0_(c['Máx. parcelas sem juros'])),
    prioridade: PRIORIDADES.indexOf(c['Prioridade']) >= 0 ? c['Prioridade'] : 'Média',
    prazo: c['Prazo limite'] instanceof Date ? competencia_(c['Prazo limite']) : null
  }));
  const mesesSazonais = String(cfg_('meses_sazonais', '3,7,11,12')).split(',').map(s => Number(s.trim())).filter(Boolean);
  const plano = calendarioCompras_(itens, meses, {
    teto: n0_(cfg_('teto_parcelas', 600)),
    mesesSazonais: mesesSazonais,
    janelaSazonal: n0_(cfg_('janela_sazonal_meses', 3))
  });
  const cartoes = lerTabela_(ABAS.CARTOES).filter(c => c['Ativo'] === true)
    .map(c => ({ apelido: c['Apelido'], fechamento: n0_(c['Dia de fechamento']), retorno: n0_(c['Retorno (%)']) }));
  const cartao = escolherCartao_(cartoes, Number(Utilities.formatDate(hoje_(), SISTEMA.tz, 'd')));

  const planejadoPorMes = {};
  ativos.forEach((c, i) => {
    const p = plano[i];
    const r = c._linha;
    const set = (col, v) => sh.getRange(r, cab.indexOf(col) + 1).setValue(v);
    set('Mês sugerido', p.mes ? rotuloMes_(p.mes) : '');
    set('Parcelas sugeridas', p.parcelas ? p.parcelas + 'x' : '');
    set('Valor da parcela', p.valorParcela);
    set('Cartão sugerido', cartao && p.mes ? cartao.apelido + (cartao.retorno ? ' (' + (cartao.retorno * 100).toFixed(1) + '% de retorno)' : '') : '');
    set('Comprar após o dia', cartao && p.mes ? cartao.comprarApos : '');
    const obsAtual = String(c['Observação'] || '');
    const foraLista = obsAtual.indexOf('Fora da lista') === 0 ? obsAtual.split(' | ')[0] + ' | ' : '';
    set('Observação', foraLista + (p.status === 'Fora do orçamento' ? 'FORA DO ORÇAMENTO: ' : '') + p.motivo);
    if (p.mes) {
      for (let k = 0; k < p.parcelas; k++) {
        const ym = addMeses_(p.mes, k);
        planejadoPorMes[ym] = (planejadoPorMes[ym] || 0) + p.valorParcela;
      }
    }
  });

  // Projeção
  const pj = aba_(ABAS.PROJECAO);
  limparDados_(pj);
  const linhas = meses.map(m => [rotuloMes_(m.mes), m.entradas, m.fixos, m.parcelas, m.aportes, m.variaveis, m.sobra,
    planejadoPorMes[m.mes] || 0, m.sobra - (planejadoPorMes[m.mes] || 0)]);
  pj.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  pj.getRange(1, 11).setValue('Variáveis = média dos 3 últimos meses fechados, sem fixos e parcelas. Reserva e Transferências ficam fora.');
}

function rotuloMes_(ym) { return MESES_PT[mesDe_(ym) - 1] + '/' + ym.slice(0, 4); }

function limparDados_(sh) {
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
}

/* ---------------- Projetos de renda ---------------- */

function atualizarProjetos_() {
  const sh = aba_(ABAS.PROJETOS);
  const cab = CABECALHOS[ABAS.PROJETOS];
  lerTabela_(ABAS.PROJETOS).forEach(p => {
    const a = avaliarProjeto_(n0_(p['Investimento inicial (R$)']), n0_(p['Custo mensal (R$)']), n0_(p['Receita base (R$/mês)']));
    sh.getRange(p._linha, cab.indexOf('ROI mensal (base)') + 1).setValue(a.roiMensal);
    sh.getRange(p._linha, cab.indexOf('Payback base (meses)') + 1).setValue(a.payback === null ? 'Sem retorno' : a.payback);
  });
}

/* ---------------- Orçamento anual (orçado vs. realizado) ---------------- */

function atualizarOrcamento() {
  const sh = aba_(ABAS.ORCAMENTO);
  const ano = Number(cfg_('orcamento_ano', '')) || Number(Utilities.formatDate(hoje_(), SISTEMA.tz, 'yyyy'));
  const centro = cfg_('orcamento_centro', 'Todos') || 'Todos';
  const categorias = lerTabela_(ABAS.CATEGORIAS).filter(c => c['Tipo'] !== 'Transferência' && (centro === 'Todos' || c['Centro de custo'] === centro));

  // realizado[categoria][ano-mes]
  const realizado = {};
  lancamentosValidos_().forEach(l => {
    if (centro !== 'Todos' && l['Centro de custo'] !== centro) return;
    const k = l['Categoria'];
    realizado[k] = realizado[k] || {};
    realizado[k][l['Competência']] = (realizado[k][l['Competência']] || 0) + n0_(l['Valor']);
  });

  sh.clear();
  sh.clearConditionalFormatRules();
  const centros = ['Todos'].concat(resolverOpcoes_('centros'));
  sh.getRange('A1').setValue('Ano:');
  sh.getRange('B1').setValue(ano);
  sh.getRange('C1').setValue('Centro de custo:');
  sh.getRange('D1').setValue(centro).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(centros, true).build());
  sh.getRange('F1').setValue('Mude o ano ou o centro para filtrar. Verde/amarelo/vermelho = uso da meta mensal (80% e 100%).');
  sh.getRange('A1:D1').setFontWeight('bold');

  const cab = ['Categoria', 'Centro de custo', 'Tipo', 'Meta mensal'].concat(MESES_PT)
    .concat(['Total ' + ano, 'Meta ' + ano, '% da meta', 'Total ' + (ano - 1), 'Variação ano a ano']);
  sh.getRange(3, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#e7f1fb');
  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
  if (!categorias.length) return;

  const linhas = categorias.map(c => {
    const r = realizado[c['Categoria']] || {};
    const meses = MESES_PT.map((_, i) => r[ano + '-' + String(i + 1).padStart(2, '0')] || 0);
    const total = meses.reduce((s, v) => s + v, 0);
    let totalAnt = 0;
    for (let i = 1; i <= 12; i++) totalAnt += r[(ano - 1) + '-' + String(i).padStart(2, '0')] || 0;
    const meta = n0_(c['Meta mensal (R$)']);
    return [c['Categoria'], c['Centro de custo'], c['Tipo'], meta].concat(meses)
      .concat([total, meta * 12, meta > 0 ? total / (meta * 12) : '', totalAnt, totalAnt > 0 ? (total - totalAnt) / totalAnt : '']);
  });
  // Totais por tipo
  ['Entrada', 'Saída', 'Investimento'].forEach(tipo => {
    const doTipo = linhas.filter(l => l[2] === tipo);
    if (!doTipo.length) return;
    const soma = j => doTipo.reduce((s, l) => s + (typeof l[j] === 'number' ? l[j] : 0), 0);
    const tot = ['TOTAL ' + tipo.toUpperCase(), '', tipo, soma(3)];
    for (let j = 4; j < 16; j++) tot.push(soma(j));
    tot.push(soma(16), soma(17), soma(17) > 0 ? soma(16) / soma(17) : '', soma(19), soma(19) > 0 ? (soma(16) - soma(19)) / soma(19) : '');
    linhas.push(tot);
  });

  const n = linhas.length;
  sh.getRange(4, 1, n, cab.length).setValues(linhas);
  sh.getRange(4, 4, n, 1).setNumberFormat('R$ #,##0.00');
  sh.getRange(4, 5, n, 12).setNumberFormat('R$ #,##0.00');
  sh.getRange(4, 17, n, 2).setNumberFormat('R$ #,##0.00');
  sh.getRange(4, 19, n, 1).setNumberFormat('0%');
  sh.getRange(4, 20, n, 1).setNumberFormat('R$ #,##0.00');
  sh.getRange(4, 21, n, 1).setNumberFormat('+0%;-0%');
  if (n > categorias.length) {
    sh.getRange(4 + categorias.length, 1, n - categorias.length, cab.length).setFontWeight('bold').setBackground('#f1f3f4');
  }

  // Cores só para categorias de saída com meta
  const area = sh.getRange(4, 5, categorias.length, 12);
  const amarelo = n0_(cfg_('alerta_amarelo', 0.8));
  const regras = [
    // Fórmulas da API do Apps Script usam a sintaxe em inglês (vírgula como separador)
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($C4="Saída",$D4>0,E4>=$D4)')
      .setBackground('#fbebeb').setFontColor('#c5221f').setRanges([area]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($C4="Saída",$D4>0,E4>=$D4*' + amarelo + ')')
      .setBackground('#f9eeda').setRanges([area]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($C4="Saída",$D4>0,E4>0)')
      .setBackground('#e5f4e4').setRanges([area]).build()
  ];
  sh.setConditionalFormatRules(regras);
  sh.autoResizeColumn(1);
}

/** Realizado do mês por categoria (para alertas). */
function realizadoDoMes_(ym) {
  const out = {};
  lancamentosValidos_().filter(l => l['Competência'] === ym && l['Tipo'] === 'Saída')
    .forEach(l => { out[l['Categoria']] = (out[l['Categoria']] || 0) + n0_(l['Valor']); });
  return out;
}
