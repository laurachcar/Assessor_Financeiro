/**
 * ASSESSOR FINANCEIRO — 03_Formularios.gs
 * --------------------------------------------------------------
 * Telas de "Entrada de informações". Cada formulário é descrito por um objeto
 * em FORMULARIOS; um único arquivo HTML (Formulario.html) desenha qualquer um.
 * A validação acontece AQUI no servidor: o que não passa, não é gravado.
 *
 * Modos:
 *  - 'config' : grava pares chave/valor na aba Config
 *  - 'upsert' : atualiza a linha com a mesma chave ou cria uma nova
 *  - 'append' : sempre cria uma linha nova
 */

const CENTROS_PADRAO = ['Pessoal', 'AX', 'Pró-labore'];

const FORMULARIOS = {
  lancamento: {
    titulo: 'Lançamento manual', aba: ABAS.LANCAMENTOS, modo: 'append',
    descricao: 'Entra direto em Lançamentos. Pagamento de fatura é Transferência (não conta como gasto).',
    campos: [
      { nome: 'Data', tipo: 'data', obrig: true, padrao: 'hoje' },
      { nome: 'Descrição', tipo: 'texto', obrig: true },
      { nome: 'Valor', tipo: 'moeda', obrig: true, min: 0.01, ajuda: 'Sempre positivo. O tipo define se entra ou sai.' },
      { nome: 'Tipo', tipo: 'selecao', obrig: true, opcoes: TIPOS_LANC, padrao: 'Saída' },
      { nome: 'Categoria', tipo: 'selecao', obrig: true, opcoesDe: 'categorias' },
      { nome: 'Centro de custo', tipo: 'selecao', obrig: true, opcoesDe: 'centros', padrao: 'Pessoal' },
      { nome: 'Conta/Cartão', tipo: 'selecao', opcoesDe: 'contas' },
      { nome: 'Parcela', tipo: 'texto', ajuda: 'Ex.: 1/10. Deixe vazio se for à vista.' },
      { nome: 'Titular', tipo: 'texto', padrao: 'cfg:titular' }
    ]
  },
  fixos: {
    titulo: 'Fixos e recorrentes', aba: ABAS.FIXOS, modo: 'upsert', chave: 'Descrição',
    descricao: 'Contas e entradas que se repetem todo mês. Usados na projeção de caixa.',
    campos: [
      { nome: 'Descrição', tipo: 'texto', obrig: true },
      { nome: 'Tipo', tipo: 'selecao', obrig: true, opcoes: ['Saída', 'Entrada'], padrao: 'Saída' },
      { nome: 'Valor', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'Dia', tipo: 'inteiro', min: 1, max: 31, ajuda: 'Dia do mês em que vence ou entra.' },
      { nome: 'Categoria', tipo: 'selecao', obrig: true, opcoesDe: 'categorias' },
      { nome: 'Centro de custo', tipo: 'selecao', obrig: true, opcoesDe: 'centros', padrao: 'Pessoal' },
      { nome: 'Início', tipo: 'data' },
      { nome: 'Fim', tipo: 'data', ajuda: 'Vazio = sem data para acabar.' }
    ]
  },
  compras: {
    titulo: 'Compras futuras', aba: ABAS.COMPRAS, modo: 'upsert', chave: 'Produto',
    descricao: 'O sistema calcula o melhor mês, as parcelas e o cartão. O Claude monitora o preço toda semana.',
    campos: [
      { nome: 'Produto', tipo: 'texto', obrig: true, ajuda: 'Seja específica: modelo, tamanho, cor.' },
      { nome: 'Link', tipo: 'url' },
      { nome: 'Preço de referência', tipo: 'moeda', obrig: true, min: 0.01 },
      { nome: 'Preço-alvo', tipo: 'moeda', ajuda: 'Opcional. Abaixo disso, compra.' },
      { nome: 'Máx. parcelas sem juros', tipo: 'inteiro', min: 1, max: 24, padrao: 1 },
      { nome: 'Prioridade', tipo: 'selecao', obrig: true, opcoes: PRIORIDADES, padrao: 'Média' },
      { nome: 'Prazo limite', tipo: 'data', ajuda: 'Opcional. Precisa comprar até quando?' },
      { nome: 'Status', tipo: 'selecao', opcoes: ['Ativo', 'Pausado', 'Comprado', 'Desisti'], padrao: 'Ativo' }
    ]
  },
  categorias: {
    titulo: 'Categorias e metas de gasto', aba: ABAS.CATEGORIAS, modo: 'upsert', chave: 'Categoria',
    descricao: 'A meta mensal alimenta o orçado vs. realizado e os alertas de 80% e 100%.',
    campos: [
      { nome: 'Categoria', tipo: 'texto', obrig: true },
      { nome: 'Grupo', tipo: 'texto' },
      { nome: 'Centro de custo', tipo: 'sugestao', obrig: true, opcoesDe: 'centros', padrao: 'Pessoal', ajuda: 'Pode criar um novo centro digitando.' },
      { nome: 'Tipo', tipo: 'selecao', obrig: true, opcoes: TIPOS_LANC, padrao: 'Saída' },
      { nome: 'Meta mensal (R$)', tipo: 'moeda', min: 0, ajuda: 'Deixe 0 para não ter alerta.' }
    ]
  },
  reserva: {
    titulo: 'Aporte mensal e reserva', modo: 'config',
    descricao: 'Enquanto a reserva não bate a meta, ela recebe a fatia indicada do aporte. Depois congela e a fatia vai para as metas.',
    campos: [
      { nome: 'aporte_mensal', rotulo: 'Aporte mensal para investimentos (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'reserva_saldo', rotulo: 'Saldo atual da reserva de emergência (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'reserva_meta', rotulo: 'Meta da reserva (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'reserva_pct', rotulo: 'Fatia do aporte para a reserva (%)', tipo: 'percentual', obrig: true, min: 0, max: 100 }
    ]
  },
  metas: {
    titulo: 'Metas de investimento', aba: ABAS.METAS, modo: 'upsert', chave: 'Meta',
    descricao: 'O % do aporte das metas (fora a reserva) deve somar 100%.',
    campos: [
      { nome: 'Meta', tipo: 'texto', obrig: true },
      { nome: 'Horizonte', tipo: 'selecao', obrig: true, opcoes: ['Curto', 'Médio', 'Longo'], ajuda: 'Curto: até 2 anos. Médio: 2 a 5. Longo: mais de 5.' },
      { nome: 'Valor-alvo (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'Prazo', tipo: 'data' },
      { nome: 'Prioridade', tipo: 'selecao', opcoes: PRIORIDADES, padrao: 'Média' },
      { nome: '% do aporte', tipo: 'percentual', min: 0, max: 100, ajuda: 'Não preencha para a reserva de emergência.' },
      { nome: 'Acumulado (R$)', tipo: 'moeda', min: 0 },
      { nome: 'Instrumento', tipo: 'texto', ajuda: 'Ex.: consórcio, Tesouro, CDB, previdência.' },
      { nome: 'Status', tipo: 'selecao', opcoes: ['Ativa', 'Pausada', 'Concluída'], padrao: 'Ativa' }
    ]
  },
  posicao: {
    titulo: 'Posição de investimento', aba: ABAS.INVESTIMENTOS, modo: 'upsert', chave: 'Produto',
    descricao: 'Um registro por produto. Atualize o valor quando quiser.',
    campos: [
      { nome: 'Instituição', tipo: 'sugestao', obrig: true, opcoes: ['XP', 'C6 Bank', 'Nubank', 'Arq', 'Nomad', 'Mercado Pago'] },
      { nome: 'Produto', tipo: 'texto', obrig: true },
      { nome: 'Classe', tipo: 'selecao', obrig: true, opcoes: ['Renda fixa pós-fixada', 'Renda fixa prefixada', 'Renda fixa inflação',
        'Fundo', 'FII', 'Ações', 'Renda variável global', 'Dólar / exterior', 'Previdência', 'Cripto', 'Outro'] },
      { nome: 'Valor (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'Data', tipo: 'data', obrig: true, padrao: 'hoje' },
      { nome: 'Liquidez', tipo: 'selecao', opcoes: ['Diária', 'D+30', 'D+90', 'No vencimento', 'Outra'] },
      { nome: 'Vencimento', tipo: 'data' },
      { nome: 'Meta vinculada', tipo: 'selecao', opcoesDe: 'metas' }
    ]
  },
  projetos: {
    titulo: 'Projetos de renda', aba: ABAS.PROJETOS, modo: 'upsert', chave: 'Projeto',
    descricao: 'O sistema calcula ROI e payback do cenário base. O Analista acompanha a regra de escala.',
    campos: [
      { nome: 'Projeto', tipo: 'texto', obrig: true },
      { nome: 'Investimento inicial (R$)', tipo: 'moeda', obrig: true, min: 200, ajuda: 'A partir de R$ 200.' },
      { nome: 'Custo mensal (R$)', tipo: 'moeda', min: 0, padrao: 0 },
      { nome: 'Receita pessimista (R$/mês)', tipo: 'moeda', min: 0 },
      { nome: 'Receita base (R$/mês)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'Receita otimista (R$/mês)', tipo: 'moeda', min: 0 },
      { nome: 'Regra de escala', tipo: 'textarea', ajuda: 'Ex.: dobrar o investimento após 2 meses com ROI acima de 20%.' },
      { nome: 'Status', tipo: 'selecao', opcoes: ['Ideia', 'Em teste', 'Ativo', 'Encerrado'], padrao: 'Ideia' }
    ]
  },
  cartoes: {
    titulo: 'Cartões', aba: ABAS.CARTOES, modo: 'upsert', chave: 'Apelido',
    descricao: 'Só apelido. Nunca digite o número do cartão.',
    campos: [
      { nome: 'Apelido', tipo: 'texto', obrig: true, ajuda: 'Ex.: Nubank, C6 Black, Amex.' },
      { nome: 'Dia de fechamento', tipo: 'inteiro', obrig: true, min: 1, max: 31 },
      { nome: 'Dia de vencimento', tipo: 'inteiro', obrig: true, min: 1, max: 31 },
      { nome: 'Retorno (%)', tipo: 'percentual', min: 0, max: 20, padrao: 0, ajuda: 'Cashback em %. Para pontos ou milhas, o valor equivalente em %.' },
      { nome: 'Tipo de retorno', tipo: 'selecao', opcoes: ['Cashback', 'Pontos', 'Milhas', 'Nenhum'], padrao: 'Nenhum' },
      { nome: 'Anuidade (R$/ano)', tipo: 'moeda', min: 0, padrao: 0 },
      { nome: 'Ativo', tipo: 'checkbox', padrao: true }
    ]
  },
  lojas: {
    titulo: 'Lojas', aba: ABAS.LOJAS, modo: 'upsert', chave: 'Loja',
    descricao: 'A busca de preços começa sempre pelas lojas ativas.',
    campos: [
      { nome: 'Loja', tipo: 'texto', obrig: true },
      { nome: 'Domínio', tipo: 'texto', obrig: true, ajuda: 'Ex.: amazon.com.br' },
      { nome: 'Ativa', tipo: 'checkbox', padrao: true },
      { nome: 'Prioridade', tipo: 'inteiro', min: 1, max: 3, padrao: 1, ajuda: '1 = primeira a ser consultada.' },
      { nome: 'Observações', tipo: 'texto' }
    ]
  },
  configuracoes: {
    titulo: 'Configurações gerais', modo: 'config',
    descricao: 'Regras gerais do sistema.',
    campos: [
      { nome: 'email_destino', rotulo: 'E-mail que recebe lembretes e relatórios', tipo: 'email', obrig: true },
      { nome: 'titular', rotulo: 'Titular', tipo: 'texto', obrig: true },
      { nome: 'renda_base', rotulo: 'Renda base mensal (R$)', tipo: 'moeda', min: 0, ajuda: 'Usada só se não houver entradas fixas cadastradas.' },
      { nome: 'teto_parcelas', rotulo: 'Teto da soma de parcelas por mês (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'meses_sazonais', rotulo: 'Meses de promoção (números separados por vírgula)', tipo: 'texto', obrig: true },
      { nome: 'queda_minima_alerta', rotulo: 'Queda mínima de preço para alertar (R$)', tipo: 'moeda', obrig: true, min: 0 },
      { nome: 'monitor_max_itens', rotulo: 'Máximo de itens no monitor semanal', tipo: 'inteiro', obrig: true, min: 1, max: 50 },
      { nome: 'tom_relatorios', rotulo: 'Tom dos relatórios', tipo: 'texto' }
    ]
  }
};

/* ---------- Abertura pelo menu ---------- */
function abrirFormulario_(id) {
  const t = HtmlService.createTemplateFromFile('Formulario');
  t.formId = id;
  const html = t.evaluate().setWidth(540).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, FORMULARIOS[id].titulo);
}
function abrirLancamento() { abrirFormulario_('lancamento'); }
function abrirFixos() { abrirFormulario_('fixos'); }
function abrirCompras() { abrirFormulario_('compras'); }
function abrirCategorias() { abrirFormulario_('categorias'); }
function abrirReserva() { abrirFormulario_('reserva'); }
function abrirMetas() { abrirFormulario_('metas'); }
function abrirPosicao() { abrirFormulario_('posicao'); }
function abrirProjetos() { abrirFormulario_('projetos'); }
function abrirCartoes() { abrirFormulario_('cartoes'); }
function abrirLojas() { abrirFormulario_('lojas'); }
function abrirConfiguracoes() { abrirFormulario_('configuracoes'); }

/* ---------- Dados para o HTML ---------- */

function resolverOpcoes_(fonte) {
  switch (fonte) {
    case 'categorias': return lerTabela_(ABAS.CATEGORIAS).map(c => c['Categoria']).filter(String);
    case 'centros': {
      const s = CENTROS_PADRAO.slice();
      lerTabela_(ABAS.CATEGORIAS).forEach(c => { if (c['Centro de custo'] && s.indexOf(c['Centro de custo']) < 0) s.push(c['Centro de custo']); });
      return s;
    }
    case 'contas': return lerTabela_(ABAS.CARTOES).map(c => c['Apelido']).filter(String).concat(['Conta corrente', 'Pix', 'Dinheiro']);
    case 'metas': return [''].concat(lerTabela_(ABAS.METAS).map(m => m['Meta']).filter(String));
    default: return [];
  }
}

/** Converte valor da planilha para o formato do campo HTML. */
function paraCampo_(campo, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (campo.tipo === 'data') return (v instanceof Date) ? Utilities.formatDate(v, SISTEMA.tz, 'yyyy-MM-dd') : '';
  if (campo.tipo === 'percentual') return Math.round(n0_(v) * 10000) / 100;
  if (campo.tipo === 'checkbox') return v === true || v === 'TRUE';
  return v;
}

/** Chamado pelo HTML ao abrir: devolve a definição pronta para desenhar. */
function getFormulario(id) {
  const def = FORMULARIOS[id];
  if (!def) throw new Error('Formulário desconhecido: ' + id);
  const campos = def.campos.map(c => {
    const out = Object.assign({}, c);
    out.rotulo = c.rotulo || c.nome;
    if (c.opcoesDe) out.opcoes = resolverOpcoes_(c.opcoesDe);
    let p = c.padrao;
    if (p === 'hoje') p = Utilities.formatDate(new Date(), SISTEMA.tz, 'yyyy-MM-dd');
    else if (typeof p === 'string' && p.indexOf('cfg:') === 0) p = cfg_(p.slice(4), '');
    out.padrao = (p === undefined) ? '' : p;
    return out;
  });
  const resp = { id: id, titulo: def.titulo, descricao: def.descricao || '', modo: def.modo, chave: def.chave || null, campos: campos };
  if (def.modo === 'config') {
    resp.valores = {};
    campos.forEach(c => { resp.valores[c.nome] = paraCampo_(c, cfg_(c.nome, '')); });
  }
  if (def.modo === 'upsert') {
    resp.existentes = lerTabela_(def.aba).map(l => {
      const o = {};
      campos.forEach(c => { o[c.nome] = paraCampo_(c, l[c.nome]); });
      return o;
    });
  }
  return resp;
}

/* ---------- Validação e gravação ---------- */

function converterCampo_(campo, bruto) {
  const rot = campo.rotulo || campo.nome;
  const vazio = bruto === '' || bruto === null || bruto === undefined;
  if (campo.tipo === 'checkbox') return bruto === true || bruto === 'true' || bruto === 'on';
  if (vazio) {
    if (campo.obrig) throw new Error('"' + rot + '" é obrigatório.');
    return '';
  }
  let v;
  switch (campo.tipo) {
    case 'moeda': case 'numero': case 'inteiro': case 'percentual':
      v = num_(bruto);
      if (isNaN(v)) throw new Error('"' + rot + '" precisa ser um número.');
      if (campo.tipo === 'inteiro' && Math.floor(v) !== v) throw new Error('"' + rot + '" precisa ser um número inteiro.');
      if (campo.min !== undefined && v < campo.min) throw new Error('"' + rot + '" precisa ser no mínimo ' + campo.min + '.');
      if (campo.max !== undefined && v > campo.max) throw new Error('"' + rot + '" pode ser no máximo ' + campo.max + '.');
      if (campo.tipo === 'percentual') v = v / 100;
      return v;
    case 'data': {
      const m = String(bruto).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) throw new Error('"' + rot + '" precisa ser uma data válida.');
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(bruto))) throw new Error('"' + rot + '" não é um e-mail válido.');
      return String(bruto).trim();
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(String(bruto).trim())) throw new Error('"' + rot + '" precisa começar com http:// ou https://');
      return String(bruto).trim();
    case 'selecao':
      if (campo.opcoes && campo.opcoes.indexOf(bruto) < 0) throw new Error('"' + rot + '": opção inválida.');
      return bruto;
    default: {
      const s = String(bruto).trim();
      if (pareceNumeroSensivel_(s)) throw new Error('"' + rot + '" parece conter número de cartão, conta ou documento. Use só apelidos.');
      return s;
    }
  }
}

/** Chamado pelo HTML ao salvar. Retorna mensagem de sucesso ou lança erro. */
function salvarFormulario(id, dados) {
  const def = FORMULARIOS[id];
  if (!def) throw new Error('Formulário desconhecido.');
  const campos = getFormulario(id).campos; // com opções resolvidas
  const obj = {};
  campos.forEach(c => { obj[c.nome] = converterCampo_(c, dados[c.nome]); });

  const regra = VALIDACOES_EXTRAS[id];
  if (regra) regra(obj);

  let msg;
  if (def.modo === 'config') {
    Object.keys(obj).forEach(k => setConfig_(k, obj[k]));
    msg = 'Configurações salvas.';
  } else if (def.modo === 'upsert') {
    const r = upsert_(def.aba, def.chave, obj);
    msg = '"' + obj[def.chave] + '" ' + r + '.';
  } else {
    anexar_(def.aba, obj);
    msg = 'Lançamento salvo.';
  }

  const pos = DEPOIS_DE_SALVAR[id];
  if (pos) pos(obj);
  return msg;
}

/** Regras que dependem de mais de um campo. Lançam erro para impedir a gravação. */
const VALIDACOES_EXTRAS = {
  lancamento: function (o) {
    if (o['Parcela']) {
      const m = String(o['Parcela']).match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
      if (!m || Number(m[1]) < 1 || Number(m[1]) > Number(m[2])) throw new Error('Parcela deve estar no formato n/N, ex.: 1/10.');
      o['Parcela'] = Number(m[1]) + '/' + Number(m[2]);
    }
    o['Hash'] = hashLancamento_(o['Data'], o['Valor'], o['Descrição']);
    const dup = lerTabela_(ABAS.LANCAMENTOS).some(l => l['Hash'] === o['Hash']);
    if (dup) throw new Error('Já existe um lançamento com a mesma data, valor e descrição.');
    o['ID'] = Utilities.getUuid().slice(0, 8);
    o['Competência'] = competencia_(o['Data']);
    o['Origem'] = 'manual';
  },
  metas: function (o) {
    const ehReserva = normalizar_(o['Meta']) === 'reserva de emergencia';
    if (ehReserva && o['% do aporte'] !== '') throw new Error('A reserva de emergência usa a fatia definida em "Aporte mensal e reserva". Deixe % do aporte vazio.');
    if (!ehReserva && o['Status'] === 'Ativa') {
      const outras = lerTabela_(ABAS.METAS).filter(m => m['Status'] === 'Ativa'
        && normalizar_(m['Meta']) !== normalizar_(o['Meta']) && normalizar_(m['Meta']) !== 'reserva de emergencia');
      const soma = outras.reduce((s, m) => s + n0_(m['% do aporte']), 0) + n0_(o['% do aporte']);
      if (soma > 1.0001) throw new Error('A soma do % do aporte das metas ativas ficaria em ' + Math.round(soma * 100) + '%. O máximo é 100%.');
    }
  },
  lojas: function (o) {
    o['Domínio'] = String(o['Domínio']).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(o['Domínio'])) throw new Error('Domínio inválido. Ex.: amazon.com.br');
  },
  configuracoes: function (o) {
    const meses = String(o['meses_sazonais']).split(',').map(s => Number(s.trim()));
    if (meses.some(m => !(m >= 1 && m <= 12))) throw new Error('Meses de promoção: use números de 1 a 12 separados por vírgula.');
  }
};

/** O que recalcular depois de cada gravação. */
const DEPOIS_DE_SALVAR = {
  lancamento: function () { atualizarParcelas_(); atualizarProjecaoECompras_(); atualizarOrcamento(); },
  fixos: function () { atualizarProjecaoECompras_(); },
  compras: function (o) { marcarLoja_(o['Produto']); atualizarProjecaoECompras_(); },
  categorias: function () { atualizarOrcamento(); },
  reserva: function () { atualizarMetas_(); atualizarProjecaoECompras_(); },
  metas: function () { atualizarMetas_(); },
  projetos: function () { atualizarProjetos_(); },
  cartoes: function () { atualizarProjecaoECompras_(); },
  configuracoes: function () { atualizarProjecaoECompras_(); }
};

/** Preenche Loja e marca "fora da lista" conforme o domínio do link. */
function marcarLoja_(produto) {
  const sh = aba_(ABAS.COMPRAS);
  const item = lerTabela_(ABAS.COMPRAS).find(c => c['Produto'] === produto);
  if (!item || !item['Link']) return;
  const host = String(item['Link']).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const loja = lerTabela_(ABAS.LOJAS).find(l => l['Ativa'] === true && (host === l['Domínio'] || host.endsWith('.' + l['Domínio'])));
  const cab = CABECALHOS[ABAS.COMPRAS];
  sh.getRange(item._linha, cab.indexOf('Loja') + 1).setValue(loja ? loja['Loja'] : host);
  if (!loja) sh.getRange(item._linha, cab.indexOf('Observação') + 1).setValue('Fora da lista de lojas: conferir manualmente');
}
