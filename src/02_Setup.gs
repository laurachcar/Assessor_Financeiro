/**
 * ASSESSOR FINANCEIRO — 02_Setup.gs
 * --------------------------------------------------------------
 * Menu, instalação das abas, proteção e gatilhos automáticos.
 * "Instalar / reparar sistema" pode ser rodado quantas vezes quiser:
 * ele só cria o que falta e nunca apaga dados.
 */

/** Roda sozinho toda vez que a planilha abre. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Assessor')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Movimento')
      .addItem('Lançamento manual', 'abrirLancamento')
      .addItem('Fixos e recorrentes', 'abrirFixos')
      .addItem('Aprovar lançamentos importados', 'aprovarStaging'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Planejamento')
      .addItem('Compras futuras', 'abrirCompras')
      .addItem('Categorias e metas de gasto', 'abrirCategorias'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Investimentos')
      .addItem('Aporte mensal e reserva', 'abrirReserva')
      .addItem('Metas de investimento', 'abrirMetas')
      .addItem('Posição de investimento', 'abrirPosicao')
      .addItem('Projetos de renda', 'abrirProjetos'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Cadastros')
      .addItem('Cartões', 'abrirCartoes')
      .addItem('Lojas', 'abrirLojas')
      .addItem('Configurações gerais', 'abrirConfiguracoes'))
    .addSeparator()
    .addItem('Recalcular tudo', 'recalcularTudo')
    .addItem('Atualizar orçamento anual', 'atualizarOrcamento')
    .addSeparator()
    .addItem('Instalar / reparar sistema', 'instalarSistema')
    .addToUi();
}

/** Gatilho simples: mudar o filtro do Orçamento Anual remonta a tabela. */
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== ABAS.ORCAMENTO) return;
    if (e.range.getRow() === 1 && (e.range.getColumn() === 2 || e.range.getColumn() === 4)) {
      setConfig_('orcamento_ano', sh.getRange('B1').getValue());
      setConfig_('orcamento_centro', sh.getRange('D1').getValue());
      atualizarOrcamento();
    }
  } catch (err) { /* gatilho simples não pode mostrar erro */ }
}

function instalarSistema() {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(SISTEMA.tz);

  ORDEM_ABAS.forEach(nome => criarAba_(nome));
  semear_();
  formatar_();
  proteger_();
  instalarGatilhos_();

  // Remove a aba padrão vazia de planilhas novas
  ['Página1', 'Sheet1', 'Planilha1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  ss.getSheetByName(ABAS.RELATORIOS).hideSheet();
  ss.getSheetByName(ABAS.LOG).hideSheet();

  recalcularTudo(true);
  log_('setup', 'instalacao', 'Versão ' + SISTEMA.versao);
  SpreadsheetApp.getUi().alert('Assessor Financeiro instalado.\n\nPróximos passos no menu Assessor:\n' +
    '1. Cadastros > Configurações gerais\n2. Cadastros > Cartões\n3. Investimentos > Aporte mensal e reserva\n' +
    '4. Planejamento > Categorias e metas de gasto\n5. Movimento > Fixos e recorrentes');
}

function criarAba_(nome) {
  const ss = ss_();
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome, ss.getSheets().length); // criadas na ordem de ORDEM_ABAS
  if (nome === ABAS.ORCAMENTO) return sh; // montada por atualizarOrcamento()
  const cab = CABECALHOS[nome];
  const atual = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (atual.join('|') !== cab.join('|')) {
    if (sh.getLastRow() <= 1) {
      sh.getRange(1, 1, 1, cab.length).setValues([cab]);
    } else {
      // Aba com dados e cabeçalho diferente: adiciona só as colunas que faltam, no fim
      cab.forEach(c => {
        if (atual.indexOf(c) < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue(c);
      });
      log_('setup', 'cabecalho_divergente', nome);
    }
  }
  sh.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#e7f1fb');
  sh.setFrozenRows(1);
  return sh;
}

/** Preenche valores iniciais só onde a aba está vazia. */
function semear_() {
  const cfg = aba_(ABAS.CONFIG);
  const existentes = cfg.getDataRange().getValues().map(r => r[0]);
  CONFIG_PADRAO.forEach(r => { if (existentes.indexOf(r[0]) < 0) cfg.appendRow(r); });
  CFG_CACHE_ = null;

  if (aba_(ABAS.LOJAS).getLastRow() <= 1) LOJAS_PADRAO.forEach(r => aba_(ABAS.LOJAS).appendRow(r));
  if (aba_(ABAS.CATEGORIAS).getLastRow() <= 1) CATEGORIAS_PADRAO.forEach(r => aba_(ABAS.CATEGORIAS).appendRow(r));

  const metas = lerTabela_(ABAS.METAS);
  if (!metas.some(m => normalizar_(m['Meta']) === 'reserva de emergencia')) {
    anexar_(ABAS.METAS, {
      'Meta': 'Reserva de emergência', 'Horizonte': 'Curto', 'Valor-alvo (R$)': cfg_('reserva_meta', 10000),
      'Prioridade': 'Alta', 'Instrumento': 'Liquidez diária, baixo risco', 'Status': 'Ativa'
    });
  }
}

function formatar_() {
  const moedaFmt = 'R$ #,##0.00';
  const fmt = (nome, colunas, f) => {
    const sh = aba_(nome);
    colunas.forEach(c => {
      const j = CABECALHOS[nome].indexOf(c) + 1;
      if (j > 0) sh.getRange(2, j, sh.getMaxRows() - 1, 1).setNumberFormat(f);
    });
  };
  // Texto puro: impede o Sheets de converter "2026-11" ou "1/10" em data
  fmt(ABAS.LANCAMENTOS, ['Competência', 'Parcela'], '@');
  fmt(ABAS.STAGING, ['Competência', 'Parcela'], '@');
  fmt(ABAS.PARCELAS, ['Competência atual', 'Competência da última'], '@');
  fmt(ABAS.PROJECAO, ['Mês'], '@');
  fmt(ABAS.COMPRAS, ['Mês sugerido', 'Parcelas sugeridas'], '@');
  fmt(ABAS.LANCAMENTOS, ['Valor'], moedaFmt);
  fmt(ABAS.STAGING, ['Valor'], moedaFmt);
  fmt(ABAS.LANCAMENTOS, ['Data'], 'dd/MM/yyyy');
  fmt(ABAS.STAGING, ['Data'], 'dd/MM/yyyy');
  fmt(ABAS.FIXOS, ['Valor'], moedaFmt);
  fmt(ABAS.FIXOS, ['Início', 'Fim'], 'dd/MM/yyyy');
  fmt(ABAS.PARCELAS, ['Valor da parcela'], moedaFmt);
  fmt(ABAS.PROJECAO, ['Entradas', 'Fixos', 'Parcelas já assumidas', 'Aportes', 'Variáveis (média 3 meses)', 'Sobra livre',
    'Compras planejadas no mês', 'Sobra após compras'], moedaFmt);
  fmt(ABAS.COMPRAS, ['Preço de referência', 'Preço-alvo', 'Último preço', 'Valor da parcela'], moedaFmt);
  fmt(ABAS.COMPRAS, ['Prazo limite'], 'dd/MM/yyyy');
  fmt(ABAS.PRECOS, ['Preço', 'Frete', 'Cashback estimado', 'Preço comparado'], moedaFmt);
  fmt(ABAS.INVESTIMENTOS, ['Valor (R$)'], moedaFmt);
  fmt(ABAS.METAS, ['Valor-alvo (R$)', 'Aporte mensal (R$)', 'Acumulado (R$)'], moedaFmt);
  fmt(ABAS.METAS, ['% do aporte', '% concluído'], '0%');
  fmt(ABAS.METAS, ['Prazo'], 'dd/MM/yyyy');
  fmt(ABAS.CARTOES, ['Retorno (%)'], '0.0%');
  fmt(ABAS.CARTOES, ['Anuidade (R$/ano)'], moedaFmt);
  fmt(ABAS.CATEGORIAS, ['Meta mensal (R$)'], moedaFmt);
  fmt(ABAS.PROJETOS, ['Investimento inicial (R$)', 'Custo mensal (R$)', 'Receita pessimista (R$/mês)', 'Receita base (R$/mês)',
    'Receita otimista (R$/mês)'], moedaFmt);
  fmt(ABAS.PROJETOS, ['ROI mensal (base)'], '0.0%');

  // Caixa de seleção "Aprovar" na área de importação
  const st = aba_(ABAS.STAGING);
  const jA = CABECALHOS[ABAS.STAGING].indexOf('Aprovar') + 1;
  st.getRange(2, jA, st.getMaxRows() - 1, 1).insertCheckboxes();
}

/** Proteção com aviso: editar direto mostra um alerta lembrando de usar o menu. */
function proteger_() {
  ABAS_PROTEGIDAS.forEach(nome => {
    const sh = aba_(nome);
    const ja = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (ja.length === 0) {
      sh.protect().setDescription('Use o menu Assessor para alterar').setWarningOnly(true);
    }
  });
}

/** Recria os gatilhos de tempo (sem duplicar). */
function instalarGatilhos_() {
  const nomes = ['lembreteMensal', 'rotinaDiaria', 'enviarRelatoriosPendentes'];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (nomes.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('lembreteMensal').timeBased().onMonthDay(1).atHour(8).inTimezone(SISTEMA.tz).create();
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(7).inTimezone(SISTEMA.tz).create();
  ScriptApp.newTrigger('enviarRelatoriosPendentes').timeBased().everyHours(1).create();
}

/** Rotina diária: recalcula e verifica alertas de orçamento. */
function rotinaDiaria() {
  try {
    recalcularTudo(true);
    alertasOrcamento();
  } catch (e) {
    log_('erro', 'rotinaDiaria', e.stack || e);
  }
}
