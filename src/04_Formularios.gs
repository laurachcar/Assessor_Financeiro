/**
 * 04_Formularios — menu Assessor e os 11 formulários de entrada.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Assessor')
    .addSubMenu(ui.createMenu('Cadastros')
      .addItem('Configurações gerais', 'abrirConfiguracoes')
      .addItem('Cartões', 'abrirCartoes')
      .addItem('Contas', 'abrirContas')
      .addItem('Centros de custo', 'abrirCentros'))
    .addSubMenu(ui.createMenu('Movimento')
      .addItem('Novo lançamento', 'abrirLancamento')
      .addItem('Fixos e recorrentes', 'abrirFixos'))
    .addSubMenu(ui.createMenu('Planejamento')
      .addItem('Categorias e metas de gasto', 'abrirCategorias')
      .addItem('Compras futuras', 'abrirCompras'))
    .addSubMenu(ui.createMenu('Investimentos')
      .addItem('Aporte mensal e reserva', 'abrirAporte')
      .addItem('Metas de investimento', 'abrirMetas'))
    .addSubMenu(ui.createMenu('Importação')
      .addItem('Aprovar lançamentos importados', 'abrirImportados'))
    .addSeparator()
    .addItem('Atualizar relatórios', 'atualizarRelatorios')
    .addItem('Enviar relatórios pendentes', 'carteiro')
    .addSeparator()
    .addItem('Instalar / reparar sistema', 'instalarSistema')
    .addToUi();
}

function abrirConfiguracoes() { abrirFormulario_('configuracoes'); }
function abrirCartoes() { abrirFormulario_('cartoes'); }
function abrirContas() { abrirFormulario_('contas'); }
function abrirCentros() { abrirFormulario_('centros'); }
function abrirLancamento() { abrirFormulario_('lancamento'); }
function abrirFixos() { abrirFormulario_('fixos'); }
function abrirCategorias() { abrirFormulario_('categorias'); }
function abrirCompras() { abrirFormulario_('compras'); }
function abrirAporte() { abrirFormulario_('aporte'); }
function abrirMetas() { abrirFormulario_('metas'); }
function abrirImportados() { abrirFormulario_('importados'); }

function abrirFormulario_(id) {
  const t = HtmlService.createTemplateFromFile('Formulario');
  t.formId = id;
  const html = t.evaluate().setWidth(id === 'importados' ? 900 : 480).setHeight(id === 'importados' ? 600 : 640);
  SpreadsheetApp.getUi().showModalDialog(html, FORMULARIOS[id].titulo);
}

/** Listas que vêm de outras abas (só registros ativos). */
function opcoesDinamicas_() {
  const ativos = function (aba, col, flag) {
    return lerTabela_(aba).filter(function (l) { return ehSim(l[flag]); }).map(function (l) { return String(l[col]); });
  };
  const cartoes = ativos('Cartoes', 'Cartão', 'Ativo');
  const contas = ativos('Contas', 'Conta', 'Ativa');
  const categorias = lerTabela_('Categorias');
  const subPor = mapaSubcategorias(categorias);
  const todasSub = [];
  Object.keys(subPor).forEach(function (k) { subPor[k].forEach(function (s) { if (todasSub.indexOf(s) < 0) todasSub.push(s); }); });
  return {
    subcategoriasPor: subPor,
    subcategorias: todasSub,
    categorias: ativos('Categorias', 'Categoria', 'Ativa'),
    centros: ativos('Centros_Custo', 'Centro de custo', 'Ativo'),
    cartoes: cartoes,
    contas: contas,
    contasECartoes: contas.concat(cartoes)
  };
}

/** Chamado pelo HTML: definição do formulário, listas e registros existentes. */
function obterFormulario(id) {
  const def = FORMULARIOS[id];
  if (!def) throw new Error('Formulário desconhecido: ' + id);
  const opcoes = opcoesDinamicas_();
  const campos = def.campos.map(function (c) {
    const copia = Object.assign({}, c);
    if (c.fonte) copia.opcoes = opcoes[c.fonte];
    return copia;
  });
  const r = { id: id, titulo: def.titulo, ajuda: def.ajuda || '', modo: def.modo, campos: campos, registros: [], subcategoriasPor: opcoes.subcategoriasPor };
  if (def.modo === 'upsert') {
    r.chave = def.chave;
    r.registros = lerTabela_(def.aba).map(function (l) { return paraCliente_(def.campos, l); });
  } else if (def.modo === 'config') {
    r.registros = [paraCliente_(def.campos, lerConfig_())];
  } else if (def.modo === 'aprovacao') {
    marcarDuplicadosImportacao();
    r.categorias = opcoes.categorias;
    r.centros = opcoes.centros;
    r.pendentes = lerTabela_('Import_Staging').filter(function (l) { return l['Status'] === 'Pendente'; })
      .map(function (l) {
        return {
          ID: String(l['ID']), Data: l['Data'] instanceof Date ? diaChave(l['Data']) : String(l['Data']),
          'Descrição': l['Descrição'], Valor: Number(l['Valor']), Tipo: l['Tipo'], Categoria: l['Categoria'], Subcategoria: l['Subcategoria'],
          'Centro de custo': l['Centro de custo'], 'Conta/Cartão': l['Conta/Cartão'], Origem: l['Origem']
        };
      });
  }
  return r;
}

/** Converte valores da planilha para o que o HTML entende (datas e meses como texto). */
function paraCliente_(campos, linha) {
  const o = {};
  campos.forEach(function (c) {
    let v = linha[c.nome];
    if (c.tipo === 'data' && v instanceof Date) v = diaChave(v);
    else if (c.tipo === 'mes') v = mesDe(v);
    else if (c.tipo === 'simnao') v = ehSim(v);
    else if (v instanceof Date) v = diaChave(v);
    o[c.nome] = v === undefined ? '' : v;
  });
  return o;
}

/** Chamado pelo HTML ao clicar em Salvar. Devolve { ok, mensagem, erros }. */
function salvarFormulario(id, dados) {
  const def = FORMULARIOS[id];
  if (!def) return { ok: false, erros: ['Formulário desconhecido.'] };
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const v = validarCampos(def.campos, dados, opcoesDinamicas_());
    if (!v.ok) return { ok: false, erros: v.erros };
    let r;
    switch (def.modo) {
      case 'config': r = salvarConfig_(v.valores); break;
      case 'upsert': r = salvarUpsert_(def, v.valores, dados._original); break;
      case 'lancamento': r = salvarLancamento_(v.valores); break;
      case 'aporte': r = salvarAporte_(v.valores); break;
      default: return { ok: false, erros: ['Modo não suportado.'] };
    }
    if (r.ok) {
      log_('salvar ' + id, r.mensagem);
      try { atualizarRelatorios(); } catch (e) { log_('erro atualizar', e.message); }
    }
    return r;
  } finally {
    lock.releaseLock();
  }
}

function salvarConfig_(valores) {
  gravarConfig_(valores);
  return { ok: true, mensagem: 'Configurações salvas.' };
}

function salvarUpsert_(def, valores, chaveOriginal) {
  const registros = lerTabela_(def.aba);
  const chave = String(valores[def.chave]);
  const original = chaveOriginal ? String(chaveOriginal) : '';
  const igual = function (l, k) { return normalizarTexto(l[def.chave]) === normalizarTexto(k); };
  const existente = original ? registros.filter(function (l) { return igual(l, original); })[0] : null;
  const conflito = registros.filter(function (l) { return igual(l, chave) && l !== existente; })[0];
  if (conflito) return { ok: false, erros: ['Já existe "' + chave + '". Escolha-o na lista para editar.'] };
  if (original && !existente) return { ok: false, erros: ['O registro "' + original + '" não existe mais. Recarregue o formulário.'] };

  const extra = validacaoExtra_(def, valores, registros, existente);
  if (extra) return { ok: false, erros: [extra] };

  const obj = Object.assign({}, existente || {}, valores);
  Object.keys(def.automaticos || {}).forEach(function (k) { if (def.automaticos[k] === 'agora') obj[k] = new Date(); });
  if (existente) {
    gravarLinha_(def.aba, existente._linha, obj);
    return { ok: true, mensagem: '"' + chave + '" atualizado.' };
  }
  acrescentarLinhas_(def.aba, [obj]);
  let msg = '"' + chave + '" cadastrado.';
  if (def.aba === 'Metas_Investimento') {
    const soma = somaPercentuaisMetas(lerTabela_('Metas_Investimento'));
    if (soma !== 100) msg += ' Atenção: as metas ativas somam ' + soma + '% do aporte (o certo é 100%).';
  }
  return { ok: true, mensagem: msg };
}

function validacaoExtra_(def, valores, registros, existente) {
  if (def.aba === 'Cartoes' && valores['Dia fechamento'] === valores['Dia vencimento']) {
    return 'Dia de fechamento e de vencimento não podem ser iguais.';
  }
  if (def.aba === 'Fixos' && valores['Fim'] && valores['Fim'] < valores['Início']) {
    return 'O fim não pode ser antes do início.';
  }
  if (def.aba === 'Metas_Investimento' && ehSim(valores['Ativa'])) {
    const outras = registros.filter(function (l) { return l !== existente; });
    const soma = somaPercentuaisMetas(outras) + Number(valores['% do aporte']);
    if (soma > 100.001) return 'Com esta meta, o % do aporte passaria de 100% (' + arred2(soma) + '%). Reduza outra meta antes.';
  }
  if (def.aba === 'Contas' || def.aba === 'Cartoes') {
    const outraAba = def.aba === 'Contas' ? 'Cartoes' : 'Contas';
    const col = def.aba === 'Contas' ? 'Cartão' : 'Conta';
    const nome = normalizarTexto(valores[def.chave]);
    if (lerTabela_(outraAba).some(function (l) { return normalizarTexto(l[col]) === nome; })) {
      return 'Já existe ' + (def.aba === 'Contas' ? 'um cartão' : 'uma conta') + ' com esse nome. Use nomes diferentes.';
    }
  }
  return '';
}

function salvarLancamento_(valores) {
  const erroFatura = erroRegraFatura(valores['Descrição'], valores['Tipo']);
  if (erroFatura) return { ok: false, erros: [erroFatura] };
  if (valores['Tipo'] !== 'Transferência' && !valores['Categoria']) {
    return { ok: false, erros: ['Categoria é obrigatória para Entrada e Saída.'] };
  }
  const cartao = lerTabela_('Cartoes').filter(function (c) { return c['Cartão'] === valores['Conta/Cartão']; })[0] || null;
  if (!cartao && Number(valores['Parcelas']) > 1) {
    return { ok: false, erros: ['Parcelamento só existe no cartão de crédito.'] };
  }
  if (cartao && valores['Tipo'] !== 'Saída') {
    return { ok: false, erros: ['No cartão só entram compras (Saída). Pagamento da fatura é Transferência a partir da conta.'] };
  }
  const linhas = gerarLancamentos(valores, cartao, novoId_('L'));
  const agora = new Date();
  linhas.forEach(function (l) { l['Origem'] = 'Manual'; l['Criado em'] = agora; });
  acrescentarLinhas_('Lancamentos', linhas);
  verificarAlertasOrcamento();
  return {
    ok: true,
    mensagem: linhas.length > 1 ? 'Compra lançada em ' + linhas.length + ' parcelas.' : 'Lançamento gravado.'
  };
}

function salvarAporte_(valores) {
  const mes = valores['Mês'];
  if (lerTabela_('Aporte_Reserva').some(function (l) { return mesDe(l['Mês']) === mes; })) {
    return { ok: false, erros: ['O aporte de ' + rotuloMes(mes) + ' já foi registrado.'] };
  }
  const cfg = lerConfig_();
  const metas = lerTabela_('Metas_Investimento');
  const soma = somaPercentuaisMetas(metas);
  const d = distribuirAporte(valores['Aporte'], valores['Reserva antes'], Number(cfg.meta_reserva), Number(cfg.pct_reserva), metas);
  if (d.paraMetas > 0 && soma !== 100) {
    return { ok: false, erros: ['As metas de investimento ativas somam ' + soma + '% do aporte. Ajuste para 100% antes de registrar.'] };
  }
  acrescentarLinhas_('Aporte_Reserva', [{
    'Mês': mes, 'Aporte': valores['Aporte'], 'Reserva antes': valores['Reserva antes'],
    'Para reserva': d.paraReserva, 'Reserva depois': d.reservaDepois, 'Para metas': d.paraMetas,
    'Registrado em': new Date()
  }]);
  d.porMeta.forEach(function (pm) {
    const m = metas.filter(function (x) { return x['Meta'] === pm.meta; })[0];
    gravarCelula_('Metas_Investimento', m._linha, 'Acumulado', arred2((Number(m['Acumulado']) || 0) + pm.valor));
  });
  const partes = ['Reserva: R$ ' + d.paraReserva.toFixed(2) + (d.congelada ? ' (congelada, meta atingida)' : '')];
  d.porMeta.forEach(function (pm) { partes.push(pm.meta + ': R$ ' + pm.valor.toFixed(2)); });
  return { ok: true, mensagem: 'Aporte registrado. ' + partes.join(' · ') };
}

/**
 * Chamado pelo HTML de aprovação.
 * decisoes: [{ ID, acao: 'aprovar'|'descartar', Categoria, Subcategoria, 'Centro de custo' }]
 */
function processarImportados(decisoes) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const staging = lerTabela_('Import_Staging');
    const existentes = lerTabela_('Lancamentos');
    const opcoes = opcoesDinamicas_();
    const cartoes = lerTabela_('Cartoes');
    const aprovar = [], erros = [];
    let descartados = 0, duplicados = 0;
    const agora = new Date();

    decisoes.forEach(function (d) {
      const l = staging.filter(function (s) { return String(s['ID']) === String(d.ID) && s['Status'] === 'Pendente'; })[0];
      if (!l) return;
      if (d.acao === 'descartar') {
        gravarCelula_('Import_Staging', l._linha, 'Status', 'Descartado');
        descartados++;
        return;
      }
      if (d.acao !== 'aprovar') return;
      const obj = Object.assign({}, l, {
        'Categoria': d.Categoria || l['Categoria'], 'Centro de custo': d['Centro de custo'] || l['Centro de custo'],
        'Subcategoria': d.Subcategoria !== undefined ? d.Subcategoria : (l['Subcategoria'] || '')
      });
      if (obj['Subcategoria'] && (opcoes.subcategoriasPor[obj['Categoria']] || []).indexOf(obj['Subcategoria']) < 0) obj['Subcategoria'] = '';
      if (obj['Tipo'] !== 'Transferência' && opcoes.categorias.indexOf(obj['Categoria']) < 0) {
        erros.push('"' + obj['Descrição'] + '": escolha uma categoria.'); return;
      }
      const erroFatura = erroRegraFatura(obj['Descrição'], obj['Tipo']);
      if (erroFatura) { erros.push('"' + obj['Descrição'] + '": ' + erroFatura); return; }
      if (detectarDuplicados([obj], existentes.concat(aprovar))[0]) {
        gravarCelula_('Import_Staging', l._linha, 'Status', 'Duplicado');
        gravarCelula_('Import_Staging', l._linha, 'Observação', 'Já existe em Lançamentos');
        duplicados++;
        return;
      }
      const cartao = cartoes.filter(function (c) { return c['Cartão'] === obj['Conta/Cartão']; })[0];
      const data = parseData(obj['Data']);
      aprovar.push({
        'ID': 'I' + obj['ID'], 'Data': data, 'Descrição': obj['Descrição'], 'Valor': arred2(obj['Valor']),
        'Tipo': obj['Tipo'], 'Categoria': obj['Categoria'], 'Subcategoria': obj['Subcategoria'], 'Centro de custo': obj['Centro de custo'] || '',
        'Conta/Cartão': obj['Conta/Cartão'], 'Parcela': '',
        'Mês fatura': cartao && data ? mesFaturaCartao(data, cartao) : '',
        'Origem': 'Importado: ' + (obj['Origem'] || ''), 'Criado em': agora, _linhaStaging: l._linha
      });
    });

    acrescentarLinhas_('Lancamentos', aprovar);
    aprovar.forEach(function (a) { gravarCelula_('Import_Staging', a._linhaStaging, 'Status', 'Aprovado'); });
    const msg = aprovar.length + ' aprovados, ' + descartados + ' descartados, ' + duplicados + ' duplicados ignorados.';
    log_('importados', msg + (erros.length ? ' Erros: ' + erros.join(' ') : ''));
    if (aprovar.length) { verificarAlertasOrcamento(); atualizarRelatorios(); }
    return { ok: erros.length === 0, mensagem: msg, erros: erros };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Marca duplicados entre os pendentes de Import_Staging (contra Lançamentos e entre si).
 * Rode depois que o Claude gravar uma importação (fase 3) ou ao abrir a aprovação.
 */
function marcarDuplicadosImportacao() {
  const pendentes = lerTabela_('Import_Staging').filter(function (l) { return l['Status'] === 'Pendente'; });
  const dup = detectarDuplicados(pendentes, lerTabela_('Lancamentos'));
  let n = 0;
  pendentes.forEach(function (l, i) {
    if (!dup[i]) return;
    gravarCelula_('Import_Staging', l._linha, 'Status', 'Duplicado');
    gravarCelula_('Import_Staging', l._linha, 'Observação', 'Duplicado descartado automaticamente');
    n++;
  });
  if (n) log_('importados', n + ' duplicados descartados automaticamente');
  return n;
}
