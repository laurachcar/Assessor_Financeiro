/**
 * ASSESSOR FINANCEIRO — 01_Config.gs
 * --------------------------------------------------------------
 * Esquema das abas, valores padrão e funções utilitárias.
 * Tudo que define "como a planilha é" mora aqui. Para mudar uma coluna,
 * mude o cabeçalho aqui e rode "Instalar / reparar sistema" no menu.
 */

const SISTEMA = {
  nome: 'Assessor Financeiro',
  versao: '0.1.0',
  tz: 'America/Sao_Paulo'
};

/** Nomes das abas (17 visíveis + 2 ocultas). */
const ABAS = {
  CONFIG: 'Config',
  CARTOES: 'Cartoes',
  LOJAS: 'Lojas',
  CATEGORIAS: 'Categorias',
  REGRAS: 'Regras_Categoria',
  STAGING: 'Import_Staging',
  LANCAMENTOS: 'Lancamentos',
  FIXOS: 'Fixos_Recorrentes',
  PARCELAS: 'Parcelas_Cartao',
  ORCAMENTO: 'Orcamento_Anual',
  PROJECAO: 'Projecao_Caixa',
  COMPRAS: 'Compras_Futuras',
  PRECOS: 'Historico_Precos',
  INVESTIMENTOS: 'Investimentos',
  METAS: 'Metas',
  PERFIL: 'Perfil_Investidor',
  PROJETOS: 'Projetos_Renda',
  RELATORIOS: 'Relatorios', // oculta: o Claude escreve, o script envia
  LOG: 'Log'                // oculta: alertas, execuções, erros
};

/** Ordem em que as abas aparecem. */
const ORDEM_ABAS = [
  ABAS.LANCAMENTOS, ABAS.STAGING, ABAS.ORCAMENTO, ABAS.PROJECAO, ABAS.COMPRAS,
  ABAS.METAS, ABAS.INVESTIMENTOS, ABAS.PROJETOS, ABAS.FIXOS, ABAS.PARCELAS,
  ABAS.CATEGORIAS, ABAS.REGRAS, ABAS.CARTOES, ABAS.LOJAS, ABAS.PRECOS,
  ABAS.PERFIL, ABAS.CONFIG, ABAS.RELATORIOS, ABAS.LOG
];

const LANC_COLS = ['ID', 'Data', 'Competência', 'Descrição', 'Valor', 'Tipo', 'Categoria',
  'Centro de custo', 'Conta/Cartão', 'Parcela', 'Origem', 'Titular', 'Hash'];

/** Cabeçalhos de cada aba. Orcamento_Anual é montada pelo script. */
const CABECALHOS = {
  [ABAS.CONFIG]: ['Chave', 'Valor', 'Descrição'],
  [ABAS.CARTOES]: ['Apelido', 'Dia de fechamento', 'Dia de vencimento', 'Retorno (%)', 'Tipo de retorno', 'Anuidade (R$/ano)', 'Ativo'],
  [ABAS.LOJAS]: ['Loja', 'Domínio', 'Ativa', 'Prioridade', 'Observações'],
  [ABAS.CATEGORIAS]: ['Categoria', 'Grupo', 'Centro de custo', 'Tipo', 'Meta mensal (R$)'],
  [ABAS.REGRAS]: ['Palavra-chave', 'Categoria', 'Centro de custo'],
  [ABAS.LANCAMENTOS]: LANC_COLS,
  [ABAS.STAGING]: LANC_COLS.concat(['Confiança', 'Aprovar']),
  [ABAS.FIXOS]: ['Descrição', 'Tipo', 'Valor', 'Dia', 'Categoria', 'Centro de custo', 'Início', 'Fim'],
  [ABAS.PARCELAS]: ['Compra', 'Conta/Cartão', 'Valor da parcela', 'Parcela atual', 'Total de parcelas', 'Competência atual', 'Competência da última'],
  [ABAS.PROJECAO]: ['Mês', 'Entradas', 'Fixos', 'Parcelas já assumidas', 'Aportes', 'Variáveis (média 3 meses)', 'Sobra livre', 'Compras planejadas no mês', 'Sobra após compras'],
  [ABAS.COMPRAS]: ['Produto', 'Link', 'Preço de referência', 'Preço-alvo', 'Máx. parcelas sem juros', 'Prioridade', 'Prazo limite',
    'Último preço', 'Loja', 'Mês sugerido', 'Parcelas sugeridas', 'Valor da parcela', 'Cartão sugerido', 'Comprar após o dia', 'Status', 'Observação'],
  [ABAS.PRECOS]: ['Produto', 'Data', 'Loja', 'Preço', 'Frete', 'Cashback estimado', 'Preço comparado', 'URL da fonte', 'Fora da lista'],
  [ABAS.INVESTIMENTOS]: ['Instituição', 'Produto', 'Classe', 'Valor (R$)', 'Data', 'Liquidez', 'Vencimento', 'Meta vinculada'],
  [ABAS.METAS]: ['Meta', 'Horizonte', 'Valor-alvo (R$)', 'Prazo', 'Prioridade', '% do aporte', 'Aporte mensal (R$)',
    'Acumulado (R$)', '% concluído', 'Instrumento', 'Status'],
  [ABAS.PERFIL]: ['Data', 'Respostas', 'Perfil resultante', 'Perfil atual', 'Perfil sugerido', 'Decisão'],
  [ABAS.PROJETOS]: ['Projeto', 'Investimento inicial (R$)', 'Custo mensal (R$)', 'Receita pessimista (R$/mês)', 'Receita base (R$/mês)',
    'Receita otimista (R$/mês)', 'ROI mensal (base)', 'Payback base (meses)', 'Regra de escala', 'Status'],
  [ABAS.RELATORIOS]: ['Data', 'Tipo', 'Assunto', 'Corpo (HTML)', 'Status', 'Enviado em'],
  [ABAS.LOG]: ['Data', 'Tipo', 'Chave', 'Detalhe']
};

/** Abas que só devem mudar pelos formulários (proteção com aviso). */
const ABAS_PROTEGIDAS = [ABAS.CONFIG, ABAS.CARTOES, ABAS.LOJAS, ABAS.CATEGORIAS, ABAS.LANCAMENTOS, ABAS.FIXOS,
  ABAS.PARCELAS, ABAS.PROJECAO, ABAS.COMPRAS, ABAS.PRECOS, ABAS.INVESTIMENTOS, ABAS.METAS, ABAS.PERFIL, ABAS.PROJETOS];

const TIPOS_LANC = ['Entrada', 'Saída', 'Investimento', 'Transferência'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

/** Valores iniciais da aba Config. */
const CONFIG_PADRAO = [
  ['email_destino', 'laura@axmarketing.com.br', 'Recebe lembretes, alertas e relatórios'],
  ['titular', 'Laura', 'Titular padrão dos lançamentos'],
  ['renda_base', 0, 'Usada na projeção quando não há entradas fixas cadastradas'],
  ['teto_parcelas', 600, 'Soma máxima de parcelas por mês (R$)'],
  ['aporte_mensal', 0, 'Quanto vai para investimentos todo mês (R$)'],
  ['reserva_meta', 10000, 'Meta da reserva de emergência (R$)'],
  ['reserva_pct', 0.5, 'Fatia do aporte que vai para a reserva até ela bater a meta'],
  ['reserva_saldo', 0, 'Saldo atual da reserva (R$)'],
  ['tom_relatorios', 'Direto nos cortes, consultivo nas decisões', 'Tom dos relatórios do Claude'],
  ['meses_sazonais', '3,7,11,12', 'Meses de promoção: 3 Dia do Consumidor, 7 Prime Day, 11 Black Friday/11.11, 12 Natal'],
  ['janela_sazonal_meses', 3, 'Prioridade Média espera data sazonal se ela vier em até N meses'],
  ['alerta_amarelo', 0.8, 'Alerta quando a categoria passa desta fração da meta'],
  ['alerta_vermelho', 1, 'Alerta de estouro da meta'],
  ['queda_minima_alerta', 10, 'Queda mínima de preço para alertar (R$)'],
  ['monitor_max_itens', 15, 'Máximo de itens verificados por semana'],
  ['orcamento_ano', '', 'Filtro: ano do Orçamento Anual (vazio = ano atual)'],
  ['orcamento_centro', 'Todos', 'Filtro: centro de custo do Orçamento Anual']
];

const LOJAS_PADRAO = [
  ['Mercado Livre', 'mercadolivre.com.br', true, 1, 'Só loja oficial ou vendedor bem avaliado'],
  ['Amazon', 'amazon.com.br', true, 1, 'Preferir "vendido e entregue por Amazon"'],
  ['Shopee', 'shopee.com.br', true, 2, 'Só loja oficial'],
  ['Shein', 'shein.com', true, 2, ''],
  ['Zara', 'zara.com', true, 2, ''],
  ['Magalu', 'magazineluiza.com.br', true, 1, '']
];

/** Categorias iniciais, baseadas na planilha antiga (editáveis no formulário). */
const CATEGORIAS_PADRAO = [
  // Categoria, Grupo, Centro de custo, Tipo, Meta
  ['Casa', 'Moradia', 'Pessoal', 'Saída', 0],
  ['Mercado', 'Alimentação', 'Pessoal', 'Saída', 0],
  ['Refeição', 'Alimentação', 'Pessoal', 'Saída', 0],
  ['Transporte', 'Transporte', 'Pessoal', 'Saída', 0],
  ['Pipa', 'Pet', 'Pessoal', 'Saída', 0],
  ['Educação', 'Educação', 'Pessoal', 'Saída', 0],
  ['Saúde', 'Saúde e bem-estar', 'Pessoal', 'Saída', 0],
  ['Wellness', 'Saúde e bem-estar', 'Pessoal', 'Saída', 0],
  ['Lazer', 'Lazer', 'Pessoal', 'Saída', 0],
  ['Assinaturas', 'Lazer', 'Pessoal', 'Saída', 0],
  ['Presente', 'Lazer', 'Pessoal', 'Saída', 0],
  ['Juros e tarifas', 'Financeiro', 'Pessoal', 'Saída', 0],
  ['Empresa', 'Operação', 'AX', 'Saída', 0],
  ['Impostos empresa', 'Operação', 'AX', 'Saída', 0],
  ['Salário', 'Renda', 'Pessoal', 'Entrada', 0],
  ['Pró-labore', 'Renda', 'Pró-labore', 'Entrada', 0],
  ['Benefícios', 'Renda', 'Pessoal', 'Entrada', 0],
  ['Reembolso', 'Renda', 'Pessoal', 'Entrada', 0],
  ['Receita AX', 'Renda', 'AX', 'Entrada', 0],
  ['Outras entradas', 'Renda', 'Pessoal', 'Entrada', 0],
  ['Aporte', 'Investimento', 'Pessoal', 'Investimento', 0],
  ['Pagamento de fatura', 'Movimentação', 'Pessoal', 'Transferência', 0],
  ['Transferência entre contas', 'Movimentação', 'Pessoal', 'Transferência', 0]
];

/* =================== UTILITÁRIOS =================== */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/** Retorna a aba pelo nome ou lança erro claro. */
function aba_(nome) {
  const sh = ss_().getSheetByName(nome);
  if (!sh) throw new Error('A aba "' + nome + '" não existe. Rode Assessor > Instalar / reparar sistema.');
  return sh;
}

/** Lê uma aba como lista de objetos {cabeçalho: valor}, com _linha (número da linha). */
function lerTabela_(nome) {
  const sh = aba_(nome);
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const cab = v[0];
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(c => c === '' || c === null)) continue;
    const o = { _linha: i + 1 };
    cab.forEach((c, j) => {
      let x = v[i][j];
      // O Sheets às vezes transforma "2026-11" em data: devolvemos sempre 'yyyy-MM'
      if (String(c).indexOf('Competência') === 0 && x instanceof Date) x = competencia_(x);
      o[c] = x;
    });
    out.push(o);
  }
  return out;
}

/** Converte um objeto em linha na ordem do cabeçalho da aba. */
function paraLinha_(nome, obj) {
  return CABECALHOS[nome].map(c => (obj[c] === undefined ? '' : obj[c]));
}

function anexar_(nome, obj) { aba_(nome).appendRow(paraLinha_(nome, obj)); }

/** Atualiza (ou insere) uma linha identificada pelo valor da coluna-chave. */
function upsert_(nome, colChave, obj) {
  const sh = aba_(nome);
  const linhas = lerTabela_(nome);
  const alvo = String(obj[colChave]).trim().toLowerCase();
  const existente = linhas.find(l => String(l[colChave]).trim().toLowerCase() === alvo);
  if (existente) {
    const atual = Object.assign({}, existente, obj);
    sh.getRange(existente._linha, 1, 1, CABECALHOS[nome].length).setValues([paraLinha_(nome, atual)]);
    return 'atualizado';
  }
  anexar_(nome, obj);
  return 'criado';
}

/* ---------- Config (chave/valor) ---------- */
let CFG_CACHE_ = null;

function lerConfig_() {
  if (CFG_CACHE_) return CFG_CACHE_;
  const v = aba_(ABAS.CONFIG).getDataRange().getValues();
  const m = {};
  for (let i = 1; i < v.length; i++) if (v[i][0] !== '') m[v[i][0]] = v[i][1];
  CFG_CACHE_ = m;
  return m;
}

function cfg_(chave, padrao) {
  const m = lerConfig_();
  return (chave in m && m[chave] !== '') ? m[chave] : padrao;
}

function setConfig_(chave, valor) {
  const sh = aba_(ABAS.CONFIG);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === chave) { sh.getRange(i + 1, 2).setValue(valor); CFG_CACHE_ = null; return; }
  }
  sh.appendRow([chave, valor, '']);
  CFG_CACHE_ = null;
}

/* ---------- Números, datas e textos ---------- */

/** Aceita 1234.5, "1.234,50", "R$ 1.234,50", "30%". Retorna NaN se não for número. */
function num_(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  let s = String(v).replace(/R\$|\s|%/g, '');
  if (s === '') return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}

function n0_(v) { const x = num_(v); return isNaN(x) ? 0 : x; }

/** 'yyyy-MM' de uma data. */
function competencia_(d) { return Utilities.formatDate(new Date(d), SISTEMA.tz, 'yyyy-MM'); }

function hoje_() { return new Date(); }

function normalizar_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Hash anti-duplicidade: data + valor + descrição normalizada. */
function hashLancamento_(data, valor, descricao) {
  const base = Utilities.formatDate(new Date(data), SISTEMA.tz, 'yyyy-MM-dd') + '|' + Number(valor).toFixed(2) + '|' + normalizar_(descricao);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base, Utilities.Charset.UTF_8);
  return bytes.slice(0, 8).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Verdadeiro se o texto parece conter número de cartão, conta ou documento (12+ dígitos seguidos). */
function pareceNumeroSensivel_(texto) {
  const so = String(texto || '').replace(/[\s.\-\/]/g, '');
  return /\d{12,}/.test(so);
}

function log_(tipo, chave, detalhe) {
  try { aba_(ABAS.LOG).appendRow([new Date(), tipo, chave, String(detalhe || '').slice(0, 5000)]); } catch (e) { /* log nunca derruba a rotina */ }
}

function jaLogado_(tipo, chave) {
  const v = aba_(ABAS.LOG).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][1] === tipo && v[i][2] === chave) return true;
  return false;
}

function moeda_(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
