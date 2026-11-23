/**
 * 03_Planilha — leitura e gravação nas abas, instalação e proteção.
 */

function planilha_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function aba_(nome) {
  const sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('A aba "' + nome + '" não existe. Use Assessor > Instalar / reparar sistema.');
  return sh;
}

/** Lê uma aba de dados como lista de objetos { coluna: valor }, com _linha (número da linha). */
function lerTabela_(nome) {
  const sh = aba_(nome);
  const ultima = sh.getLastRow();
  const cab = ABAS[nome].cabecalho;
  if (ultima < 2) return [];
  const valores = sh.getRange(2, 1, ultima - 1, cab.length).getValues();
  const r = [];
  valores.forEach(function (linha, i) {
    if (linha.every(function (v) { return v === '' || v === null; })) return;
    const o = { _linha: i + 2 };
    cab.forEach(function (c, j) { o[c] = linha[j]; });
    r.push(o);
  });
  return r;
}

function objetoParaLinha_(nome, obj) {
  return ABAS[nome].cabecalho.map(function (c) {
    const v = obj[c];
    if (v === undefined || v === null) return '';
    // meses "AAAA-MM" e parcelas como texto, para a planilha não converter em data
    if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) return "'" + v;
    return v;
  });
}

function acrescentarLinhas_(nome, objetos) {
  if (!objetos.length) return;
  const sh = aba_(nome);
  const linhas = objetos.map(function (o) { return objetoParaLinha_(nome, o); });
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
}

function gravarLinha_(nome, numeroLinha, obj) {
  const linha = objetoParaLinha_(nome, obj);
  aba_(nome).getRange(numeroLinha, 1, 1, linha.length).setValues([linha]);
}

function gravarCelula_(nome, numeroLinha, coluna, valor) {
  const col = ABAS[nome].cabecalho.indexOf(coluna) + 1;
  aba_(nome).getRange(numeroLinha, col).setValue(valor);
}

function log_(acao, detalhe) {
  try {
    const sh = planilha_().getSheetByName('Log');
    if (sh) sh.appendRow([new Date(), acao, String(detalhe || '').slice(0, 1000)]);
  } catch (e) { /* log nunca derruba a operação */ }
}

function novoId_(prefixo) {
  return prefixo + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') +
    Math.floor(Math.random() * 1000);
}

// ---------------------------------------------------------------- configurações

function lerConfig_() {
  const cfg = {};
  CONFIG_PADRAO.forEach(function (c) { cfg[c[0]] = c[1]; });
  lerTabela_('Configuracoes').forEach(function (l) { if (l['Chave']) cfg[l['Chave']] = l['Valor']; });
  return cfg;
}

function gravarConfig_(valores) {
  const existentes = lerTabela_('Configuracoes');
  Object.keys(valores).forEach(function (k) {
    const linha = existentes.filter(function (l) { return l['Chave'] === k; })[0];
    if (linha) gravarCelula_('Configuracoes', linha._linha, 'Valor', valores[k]);
    else {
      const padrao = CONFIG_PADRAO.filter(function (c) { return c[0] === k; })[0];
      acrescentarLinhas_('Configuracoes', [{ 'Chave': k, 'Valor': valores[k], 'Descrição': padrao ? padrao[2] : '' }]);
    }
  });
}

/** E-mail de destino: o configurado ou, se vazio, o do dono do script. */
function emailDestino_() {
  const cfg = lerConfig_();
  if (cfg.email) return String(cfg.email);
  try { return Session.getEffectiveUser().getEmail(); } catch (e) { return ''; }
}

// ---------------------------------------------------------------- instalação

/** Cria o que falta e conserta o que estiver quebrado. Pode rodar quantas vezes quiser. */
function instalarSistema() {
  const ss = planilha_();
  const ui = uiSegura_();
  const conflito = ABAS_CONFLITANTES.filter(function (n) { return ss.getSheetByName(n); });
  if (conflito.length) {
    const msg = 'Esta planilha tem a aba "' + conflito.join('", "') + '", da planilha antiga. ' +
      'Instale o Assessor numa planilha nova (sheets.new). A migração do histórico é feita depois.';
    if (ui) ui.alert('Assessor Financeiro', msg, ui.ButtonSet.OK);
    log_('instalar', 'cancelado: ' + msg);
    return { ok: false, mensagem: msg };
  }

  const criadas = [];
  Object.keys(ABAS).forEach(function (nome) {
    let sh = ss.getSheetByName(nome);
    if (!sh) { sh = ss.insertSheet(nome); criadas.push(nome); }
    const def = ABAS[nome];
    if (def.cabecalho) {
      const atual = sh.getRange(1, 1, 1, def.cabecalho.length).getValues()[0];
      if (atual.join('|') !== def.cabecalho.join('|')) sh.getRange(1, 1, 1, def.cabecalho.length).setValues([def.cabecalho]);
      sh.getRange(1, 1, 1, def.cabecalho.length).setFontWeight('bold').setBackground('#f1f3f4');
      sh.setFrozenRows(1);
    }
    if (def.cor) sh.setTabColor(def.cor);
    if (def.oculta) sh.hideSheet();
  });

  formatarColunas_();
  semearDados_();
  protegerAbas_();
  instalarGatilhos_();
  atualizarRelatorios();
  escreverAjuda_();

  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);
  ss.setActiveSheet(aba_('Painel'));

  const msg = 'Sistema instalado (versão ' + VERSAO + '). ' +
    (criadas.length ? criadas.length + ' abas criadas.' : 'Nenhuma aba faltando; tudo reparado.');
  log_('instalar', msg);
  ss.toast(msg, 'Assessor Financeiro', 8);
  return { ok: true, mensagem: msg, criadas: criadas };
}

function formatarColunas_() {
  const formatos = {
    Lancamentos: { 'Data': 'dd/mm/yyyy', 'Valor': '"R$" #,##0.00', 'Mês fatura': '@', 'Parcela': '@', 'Criado em': 'dd/mm/yyyy hh:mm' },
    Fixos: { 'Valor': '"R$" #,##0.00', 'Início': '@', 'Fim': '@' },
    Contas: { 'Saldo atual': '"R$" #,##0.00', 'Atualizado em': 'dd/mm/yyyy' },
    Cartoes: { 'Limite': '"R$" #,##0.00' },
    Categorias: { 'Meta mensal': '"R$" #,##0.00' },
    Compras_Futuras: { 'Valor estimado': '"R$" #,##0.00', 'Mês desejado': '@' },
    Aporte_Reserva: { 'Mês': '@', 'Aporte': '"R$" #,##0.00', 'Reserva antes': '"R$" #,##0.00', 'Para reserva': '"R$" #,##0.00', 'Reserva depois': '"R$" #,##0.00', 'Para metas': '"R$" #,##0.00' },
    Metas_Investimento: { 'Valor alvo': '"R$" #,##0.00', 'Acumulado': '"R$" #,##0.00', 'Prazo': '@' },
    Import_Staging: { 'Data': 'dd/mm/yyyy', 'Valor': '"R$" #,##0.00' },
    Alertas: { 'Mês': '@', 'Realizado': '"R$" #,##0.00', 'Meta': '"R$" #,##0.00' }
  };
  Object.keys(formatos).forEach(function (nome) {
    const sh = aba_(nome);
    Object.keys(formatos[nome]).forEach(function (col) {
      const i = ABAS[nome].cabecalho.indexOf(col) + 1;
      sh.getRange(2, i, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat(formatos[nome][col]);
    });
  });
}

function semearDados_() {
  const cfg = lerTabela_('Configuracoes').map(function (l) { return l['Chave']; });
  const faltando = CONFIG_PADRAO.filter(function (c) { return cfg.indexOf(c[0]) < 0; });
  if (faltando.length) {
    acrescentarLinhas_('Configuracoes', faltando.map(function (c) {
      let valor = c[1];
      if (c[0] === 'email') { try { valor = Session.getEffectiveUser().getEmail(); } catch (e) { valor = ''; } }
      return { 'Chave': c[0], 'Valor': valor, 'Descrição': c[2] };
    }));
  }
  if (!lerTabela_('Centros_Custo').length) {
    acrescentarLinhas_('Centros_Custo', CENTROS_PADRAO.map(function (c) { return { 'Centro de custo': c[0], 'Descrição': c[1], 'Ativo': 'Sim' }; }));
  }
  if (!lerTabela_('Categorias').length) {
    acrescentarLinhas_('Categorias', CATEGORIAS_PADRAO.map(function (c) {
      return { 'Categoria': c[0], 'Tipo': c[1], 'Subcategorias': c[2], 'Meta mensal': '', 'Centro de custo': '', 'Ativa': 'Sim' };
    }));
  }
  const mes = mesChave(hoje_());
  if (!lerTabela_('Fixos').length) {
    acrescentarLinhas_('Fixos', FIXOS_PADRAO.map(function (f) {
      return { 'Descrição': f[0], 'Tipo': f[1], 'Valor': f[2], 'Categoria': f[3], 'Subcategoria': f[4], 'Centro de custo': '',
        'Conta/Cartão': '', 'Dia': 10, 'Início': mes, 'Fim': f[5] ? somarMeses(mes, f[5] - 1) : '', 'Ativo': 'Sim' };
    }));
  }
  if (!lerTabela_('Compras_Futuras').length) {
    acrescentarLinhas_('Compras_Futuras', COMPRAS_PADRAO.map(function (c) {
      return { 'Item': c[0], 'Valor estimado': c[1], 'Prioridade': c[2], 'Frequência': c[3], 'Mês desejado': '', 'Parcelas máx': '',
        'Categoria': c[4], 'Subcategoria': c[5], 'Onde comprar': '', 'Status': 'Planejada', 'Observação': '' };
    }));
  }
}

/** Proteção só de aviso: quem editar direto vê um alerta, mas o script grava normalmente. */
function protegerAbas_() {
  Object.keys(ABAS).forEach(function (nome) {
    const sh = aba_(nome);
    const existentes = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    existentes.forEach(function (p) { p.remove(); });
    const p = sh.protect().setDescription('Assessor: use o menu para editar').setWarningOnly(true);
    if (nome === 'Orcado_Realizado') {
      p.setUnprotectedRanges([
        sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colAno),
        sh.getRange(FILTRO_ORCADO.linha, FILTRO_ORCADO.colCentro)
      ]);
    }
  });
}

function uiSegura_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

/** Gatilho simples: recalcula o orçado quando o filtro muda e lembra de usar o menu. */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const nome = sh.getName();
  if (nome === 'Orcado_Realizado' && e.range.getRow() === FILTRO_ORCADO.linha &&
      (e.range.getColumn() === FILTRO_ORCADO.colAno || e.range.getColumn() === FILTRO_ORCADO.colCentro)) {
    atualizarOrcado_();
    return;
  }
  if (ABAS[nome] && ABAS[nome].tipo === 'dados') {
    e.source.toast('Edição direta não passa pela validação. Prefira o menu Assessor.', 'Assessor Financeiro', 5);
  }
}

function escreverAjuda_() {
  const sh = aba_('Ajuda');
  sh.clearContents();
  const linhas = [
    ['Assessor Financeiro ' + VERSAO],
    [''],
    ['Primeiro uso, nesta ordem:'],
    ['1. Cadastros > Configurações gerais: confira o e-mail e o teto de parcelas.'],
    ['2. Cadastros > Cartões: nome, dia de fechamento e dia de vencimento.'],
    ['3. Investimentos > Aporte mensal e reserva: aporte do mês e saldo atual da reserva.'],
    ['4. Investimentos > Metas de investimento: o % do aporte das metas deve somar 100%.'],
    ['5. Planejamento > Categorias e metas de gasto: meta mensal e subcategorias de cada categoria.'],
    ['6. Movimento > Fixos e recorrentes: confira os que já vêm cadastrados (Tênis, USP, Imposto, dívidas, aluguel da vaga) e acrescente salário, aluguel, condomínio...'],
    ['7. Planejamento > Compras futuras: a sua lista já vem cadastrada. Informe valor, onde comprar e acrescente o que quiser.'],
    [''],
    ['Regras importantes:'],
    ['• Pagamento de fatura é Transferência, não Saída. As compras do cartão já entram como gasto, uma por uma.'],
    ['• Use o menu para editar: ele valida tudo antes de gravar.'],
    ['• Nunca digite número de cartão ou conta. O sistema recusa sequências de 12 dígitos ou mais.'],
    ['• Lance cada compra no cartão em que foi feita. A aba Parcelas mostra, por cartão, quantas parcelas faltam e quanto falta pagar.'],
    ['• Orçado x realizado: troque o ano em B1 e o centro de custo em D1.']
  ];
  sh.getRange(1, 1, linhas.length, 1).setValues(linhas);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.setColumnWidth(1, 800);
}
