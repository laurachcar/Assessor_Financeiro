/* ===== Mesmas definições e regras do sistema (src/01_Config.gs e src/02_Logica.gs) ===== */
/**
 * 01_Config — definições usadas por todos os outros arquivos.
 * Carregue este arquivo primeiro no Apps Script (ordem 01 a 06).
 */

const VERSAO = '0.1.0';

/** Abas que existiam na planilha antiga e conflitam com as novas. */
const ABAS_CONFLITANTES = ['Investimentos'];

/** Tipos de lançamento. Pagamento de fatura é sempre Transferência. */
const TIPOS_LANCAMENTO = ['Entrada', 'Saída', 'Transferência'];
const TIPOS_CONTA = ['Corrente', 'Poupança', 'Investimento', 'Dinheiro'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
const STATUS_COMPRA = ['Planejada', 'Comprada', 'Cancelada'];
const STATUS_IMPORT = ['Pendente', 'Aprovado', 'Descartado', 'Duplicado'];
const STATUS_RELATORIO = ['Pendente', 'Enviado', 'Erro'];
/** Frequência das compras: intervalo em meses entre uma compra e a próxima (0 = só uma vez). */
const FREQUENCIAS = { 'Única': 0, 'Mensal': 1, 'Trimestral': 3, 'Semestral': 6, 'Anual': 12 };

/**
 * As 20 abas do sistema (18 visíveis + Relatorios e Log ocultas).
 * tipo "dados": tabela com cabeçalho na linha 1, gravada pelo menu.
 * tipo "relatorio": montada pelo script a cada atualização.
 */
const ABAS = {
  Painel:             { tipo: 'relatorio', cor: '#1a73e8' },
  Ajuda:              { tipo: 'relatorio', cor: '#9e9e9e' },
  Configuracoes:      { tipo: 'dados', cor: '#5f6368', cabecalho: ['Chave', 'Valor', 'Descrição'] },
  Cartoes:            { tipo: 'dados', cor: '#5f6368', cabecalho: ['Cartão', 'Dia fechamento', 'Dia vencimento', 'Limite', 'Ativo'] },
  Contas:             { tipo: 'dados', cor: '#5f6368', cabecalho: ['Conta', 'Tipo', 'Saldo atual', 'Atualizado em', 'Ativa'] },
  Centros_Custo:      { tipo: 'dados', cor: '#5f6368', cabecalho: ['Centro de custo', 'Descrição', 'Ativo'] },
  Categorias:         { tipo: 'dados', cor: '#f9ab00', cabecalho: ['Categoria', 'Tipo', 'Subcategorias', 'Meta mensal', 'Centro de custo', 'Ativa'] },
  Lancamentos:        { tipo: 'dados', cor: '#188038', cabecalho: ['ID', 'Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Subcategoria', 'Centro de custo', 'Conta/Cartão', 'Parcela', 'Mês fatura', 'Origem', 'Criado em'] },
  Fixos:              { tipo: 'dados', cor: '#188038', cabecalho: ['Descrição', 'Tipo', 'Valor', 'Categoria', 'Subcategoria', 'Centro de custo', 'Conta/Cartão', 'Dia', 'Início', 'Fim', 'Ativo'] },
  Compras_Futuras:    { tipo: 'dados', cor: '#f9ab00', cabecalho: ['Item', 'Valor estimado', 'Prioridade', 'Frequência', 'Mês desejado', 'Parcelas máx', 'Categoria', 'Subcategoria', 'Onde comprar', 'Status', 'Observação'] },
  Aporte_Reserva:     { tipo: 'dados', cor: '#9334e6', cabecalho: ['Mês', 'Aporte', 'Reserva antes', 'Para reserva', 'Reserva depois', 'Para metas', 'Registrado em'] },
  Metas_Investimento: { tipo: 'dados', cor: '#9334e6', cabecalho: ['Meta', 'Valor alvo', '% do aporte', 'Acumulado', 'Prazo', 'Ativa'] },
  Import_Staging:     { tipo: 'dados', cor: '#e8710a', cabecalho: ['ID', 'Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Subcategoria', 'Centro de custo', 'Conta/Cartão', 'Origem', 'Status', 'Observação', 'Importado em'] },
  Orcado_Realizado:   { tipo: 'relatorio', cor: '#d93025' },
  Projecao_Caixa:     { tipo: 'relatorio', cor: '#d93025' },
  Calendario_Compras: { tipo: 'relatorio', cor: '#d93025' },
  Parcelas:           { tipo: 'relatorio', cor: '#d93025' },
  Alertas:            { tipo: 'dados', cor: '#d93025', cabecalho: ['Mês', 'Categoria', 'Nível', 'Realizado', 'Meta', 'Enviado em'] },
  Relatorios:         { tipo: 'dados', oculta: true, cabecalho: ['ID', 'Criado em', 'Assunto', 'Corpo', 'Destinatário', 'Status', 'Enviado em', 'Erro'] },
  Log:                { tipo: 'dados', oculta: true, cabecalho: ['Data', 'Ação', 'Detalhe'] }
};

/** Linha e coluna dos filtros da aba Orcado_Realizado (B1 = ano, D1 = centro de custo). */
const FILTRO_ORCADO = { linha: 1, colAno: 2, colCentro: 4 };

/** Valores padrão da aba Configuracoes. */
const CONFIG_PADRAO = [
  ['email', '', 'E-mail que recebe lembretes, alertas e relatórios'],
  ['nome', '', 'Como o Assessor deve te chamar'],
  ['teto_parcelas', 1500, 'Valor máximo por mês comprometido com parcelas (R$)'],
  ['max_parcelas', 10, 'Número máximo de parcelas sugerido pelo calendário de compras'],
  ['meta_reserva', 10000, 'Valor da reserva de emergência (R$). Ao atingir, a reserva congela'],
  ['pct_reserva', 50, '% do aporte que vai para a reserva enquanto ela não está completa'],
  ['aporte_mensal', 0, 'Aporte mensal planejado (R$), usado na projeção de caixa'],
  ['alerta_pct1', 80, 'Primeiro alerta de orçamento (% da meta)'],
  ['alerta_pct2', 100, 'Segundo alerta de orçamento (% da meta)']
];

/** Categorias que já vêm cadastradas: [categoria, tipo, subcategorias]. */
const CATEGORIAS_PADRAO = [
  ['Moradia', 'Saída', 'Aluguel, Condomínio, Contas de casa'],
  ['Alimentação', 'Saída', 'Mercado, Feira, Outros'],
  ['Lazer', 'Saída', 'Saídas, Alimentação fora, Outros'],
  ['Educação', 'Saída', 'Faculdade, Cursos'],
  ['Compras', 'Saída', 'Roupas, Sapatos, Acessórios, Presentes, Casa e eletro, Estética, Outros'],
  ['Transporte', 'Saída', 'Aplicativo, Combustível, Outros'],
  ['Saúde', 'Saída', 'Médicos, Esporte, Remédios, Outros'],
  ['Assinaturas', 'Saída', ''],
  ['Pets', 'Saída', 'Veterinário, Vacinas, Ração, Outros'],
  ['Impostos', 'Saída', ''],
  ['Dívidas', 'Saída', ''],
  ['Outros', 'Saída', ''],
  ['Salário', 'Entrada', ''],
  ['Renda extra', 'Entrada', ''],
  ['Aluguel recebido', 'Entrada', ''],
  ['Rendimentos', 'Entrada', ''],
  ['Cashback', 'Entrada', ''],
  ['Outras entradas', 'Entrada', '']
];

/**
 * Custos fixos que já vêm cadastrados (começam no mês da instalação).
 * Dívidas de exemplo: uma parcela por mês nos próximos 4 meses.
 * [descrição, tipo, valor, categoria, subcategoria, meses (vazio = sem fim)]
 */
const FIXOS_PADRAO = [
  ['Academia', 'Saída', 120, 'Saúde', 'Esporte', ''],
  ['Faculdade', 'Saída', 550, 'Educação', 'Faculdade', ''],
  ['Parcela do celular', 'Saída', 250, 'Dívidas', '', 4]
];

/** Lista de compras que já vem cadastrada: [item, valor, prioridade, frequência, categoria, subcategoria]. */
const COMPRAS_PADRAO = [
  ['Micro-ondas', '', 'Média', 'Única', 'Compras', 'Casa e eletro'],
  ['Airfryer', '', 'Média', 'Única', 'Compras', 'Casa e eletro'],
  ['Robô aspirador', '', 'Baixa', 'Única', 'Compras', 'Casa e eletro'],
  ['Roupas', '', 'Baixa', 'Única', 'Compras', 'Roupas'],
  ['Sapatos', '', 'Baixa', 'Única', 'Compras', 'Sapatos'],
  ['Vacinas do pet', '', 'Alta', 'Anual', 'Pets', 'Vacinas']
];

const CENTROS_PADRAO = [['Pessoal', 'Gastos pessoais e da casa']];

/**
 * Formulários do menu. Cada campo tem: nome (coluna da aba), tipo, obrigatorio,
 * e opcoes (lista fixa) ou fonte (lista vinda de outra aba).
 * modo "upsert": edita um registro existente pela chave ou cria um novo.
 * modo "append": sempre cria um registro novo.
 */
const FORMULARIOS = {
  configuracoes: {
    titulo: 'Configurações gerais', aba: 'Configuracoes', modo: 'config',
    campos: [
      { nome: 'email', rotulo: 'E-mail para avisos', tipo: 'email', obrigatorio: true },
      { nome: 'nome', rotulo: 'Seu nome', tipo: 'texto' },
      { nome: 'teto_parcelas', rotulo: 'Teto mensal de parcelas (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'max_parcelas', rotulo: 'Máximo de parcelas', tipo: 'inteiro', min: 1, max: 24, obrigatorio: true },
      { nome: 'meta_reserva', rotulo: 'Meta da reserva de emergência (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'pct_reserva', rotulo: '% do aporte para a reserva', tipo: 'percentual', obrigatorio: true },
      { nome: 'aporte_mensal', rotulo: 'Aporte mensal planejado (R$)', tipo: 'moeda' }
    ]
  },
  cartoes: {
    titulo: 'Cartões', aba: 'Cartoes', modo: 'upsert', chave: 'Cartão',
    ajuda: 'Use só o nome do cartão (ex.: Nubank). Nunca digite o número.',
    campos: [
      { nome: 'Cartão', tipo: 'texto', obrigatorio: true },
      { nome: 'Dia fechamento', tipo: 'dia', obrigatorio: true },
      { nome: 'Dia vencimento', tipo: 'dia', obrigatorio: true },
      { nome: 'Limite', tipo: 'moeda' },
      { nome: 'Ativo', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  contas: {
    titulo: 'Contas', aba: 'Contas', modo: 'upsert', chave: 'Conta',
    ajuda: 'Use só o nome da conta (ex.: Itaú corrente). Nunca digite agência ou número.',
    campos: [
      { nome: 'Conta', tipo: 'texto', obrigatorio: true },
      { nome: 'Tipo', tipo: 'lista', opcoes: TIPOS_CONTA, obrigatorio: true },
      { nome: 'Saldo atual', tipo: 'moeda_sinal', obrigatorio: true },
      { nome: 'Ativa', tipo: 'simnao', padrao: 'Sim' }
    ],
    automaticos: { 'Atualizado em': 'agora' }
  },
  centros: {
    titulo: 'Centros de custo', aba: 'Centros_Custo', modo: 'upsert', chave: 'Centro de custo',
    campos: [
      { nome: 'Centro de custo', tipo: 'texto', obrigatorio: true },
      { nome: 'Descrição', tipo: 'texto' },
      { nome: 'Ativo', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  lancamento: {
    titulo: 'Novo lançamento', aba: 'Lancamentos', modo: 'lancamento',
    ajuda: 'Pagamento de fatura de cartão é Transferência, não Saída.',
    campos: [
      { nome: 'Data', tipo: 'data', obrigatorio: true },
      { nome: 'Descrição', tipo: 'texto', obrigatorio: true },
      { nome: 'Valor', tipo: 'moeda', obrigatorio: true, positivo: true },
      { nome: 'Tipo', tipo: 'lista', opcoes: TIPOS_LANCAMENTO, obrigatorio: true },
      { nome: 'Categoria', tipo: 'lista', fonte: 'categorias' },
      { nome: 'Subcategoria', tipo: 'lista', fonte: 'subcategorias', dependeDe: 'Categoria' },
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Conta/Cartão', tipo: 'lista', fonte: 'contasECartoes', obrigatorio: true, rotulo: 'Conta ou cartão da compra' },
      { nome: 'Parcelas', tipo: 'inteiro', min: 1, max: 48, padrao: 1, rotulo: 'Parcelas (só cartão)' }
    ]
  },
  fixos: {
    titulo: 'Fixos e recorrentes', aba: 'Fixos', modo: 'upsert', chave: 'Descrição',
    campos: [
      { nome: 'Descrição', tipo: 'texto', obrigatorio: true },
      { nome: 'Tipo', tipo: 'lista', opcoes: ['Entrada', 'Saída'], obrigatorio: true },
      { nome: 'Valor', tipo: 'moeda', obrigatorio: true, positivo: true },
      { nome: 'Categoria', tipo: 'lista', fonte: 'categorias', obrigatorio: true },
      { nome: 'Subcategoria', tipo: 'lista', fonte: 'subcategorias', dependeDe: 'Categoria' },
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Conta/Cartão', tipo: 'lista', fonte: 'contasECartoes', rotulo: 'Conta ou cartão' },
      { nome: 'Dia', tipo: 'dia', obrigatorio: true },
      { nome: 'Início', tipo: 'mes', obrigatorio: true },
      { nome: 'Fim', tipo: 'mes', rotulo: 'Fim (vazio = sem fim)' },
      { nome: 'Ativo', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  categorias: {
    titulo: 'Categorias e metas de gasto', aba: 'Categorias', modo: 'upsert', chave: 'Categoria',
    campos: [
      { nome: 'Categoria', tipo: 'texto', obrigatorio: true },
      { nome: 'Tipo', tipo: 'lista', opcoes: ['Saída', 'Entrada'], obrigatorio: true },
      { nome: 'Subcategorias', tipo: 'texto', rotulo: 'Subcategorias (separe por vírgula)' },
      { nome: 'Meta mensal', tipo: 'moeda' },
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Ativa', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  compras: {
    titulo: 'Compras futuras', aba: 'Compras_Futuras', modo: 'upsert', chave: 'Item',
    ajuda: 'Compras que se repetem (ex.: Botox 2x ao ano = Semestral) entram no calendário todas as vezes.',
    campos: [
      { nome: 'Item', tipo: 'texto', obrigatorio: true },
      { nome: 'Valor estimado', tipo: 'moeda', rotulo: 'Valor estimado (vazio = ainda não sei)' },
      { nome: 'Prioridade', tipo: 'lista', opcoes: PRIORIDADES, obrigatorio: true },
      { nome: 'Frequência', tipo: 'lista', opcoes: Object.keys(FREQUENCIAS), padrao: 'Única' },
      { nome: 'Mês desejado', tipo: 'mes', rotulo: 'Mês desejado (ou da primeira vez)' },
      { nome: 'Parcelas máx', tipo: 'inteiro', min: 1, max: 48 },
      { nome: 'Categoria', tipo: 'lista', fonte: 'categorias' },
      { nome: 'Subcategoria', tipo: 'lista', fonte: 'subcategorias', dependeDe: 'Categoria' },
      { nome: 'Onde comprar', tipo: 'texto', rotulo: 'Onde comprar (loja ou site)' },
      { nome: 'Status', tipo: 'lista', opcoes: STATUS_COMPRA, padrao: 'Planejada' },
      { nome: 'Observação', tipo: 'texto' }
    ]
  },
  aporte: {
    titulo: 'Aporte mensal e reserva', aba: 'Aporte_Reserva', modo: 'aporte',
    ajuda: 'Enquanto a reserva não chega à meta, ela recebe parte do aporte. Depois congela e tudo vai para as metas.',
    campos: [
      { nome: 'Mês', tipo: 'mes', obrigatorio: true },
      { nome: 'Aporte', tipo: 'moeda', obrigatorio: true, positivo: true },
      { nome: 'Reserva antes', tipo: 'moeda', obrigatorio: true, rotulo: 'Saldo atual da reserva' }
    ]
  },
  metas: {
    titulo: 'Metas de investimento', aba: 'Metas_Investimento', modo: 'upsert', chave: 'Meta',
    ajuda: 'O % do aporte das metas ativas deve somar 100%.',
    campos: [
      { nome: 'Meta', tipo: 'texto', obrigatorio: true },
      { nome: 'Valor alvo', tipo: 'moeda', obrigatorio: true },
      { nome: '% do aporte', tipo: 'percentual', obrigatorio: true },
      { nome: 'Acumulado', tipo: 'moeda' },
      { nome: 'Prazo', tipo: 'mes' },
      { nome: 'Ativa', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  importados: {
    titulo: 'Aprovar lançamentos importados', aba: 'Import_Staging', modo: 'aprovacao', campos: []
  }
};

/**
 * 02_Logica — regras de negócio puras (sem acesso à planilha).
 * Tudo aqui é testado por test/logica.test.js.
 */

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PESO_PRIORIDADE = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };

// ---------------------------------------------------------------- datas e meses

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/** Date -> "AAAA-MM". */
function mesChave(data) { return data.getFullYear() + '-' + pad2(data.getMonth() + 1); }

/** "AAAA-MM-DD" para uso em chaves. */
function diaChave(data) { return mesChave(data) + '-' + pad2(data.getDate()); }

/** Lê um mês vindo da planilha (texto "AAAA-MM" ou Date) e devolve "AAAA-MM" ou ''. */
function mesDe(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date || (typeof valor === 'object' && typeof valor.getFullYear === 'function')) return mesChave(valor);
  const s = String(valor).trim().replace(/^'/, '');
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(Number(m[2]));
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + pad2(Number(m[1]));
  return '';
}

function somarMeses(chave, n) {
  const p = chave.split('-');
  const total = Number(p[0]) * 12 + (Number(p[1]) - 1) + n;
  return Math.floor(total / 12) + '-' + pad2((total % 12) + 1);
}

function difMeses(de, ate) {
  const a = de.split('-'), b = ate.split('-');
  return (Number(b[0]) * 12 + Number(b[1])) - (Number(a[0]) * 12 + Number(a[1]));
}

function proximosMeses(inicio, n) {
  const r = [];
  for (let i = 0; i < n; i++) r.push(somarMeses(inicio, i));
  return r;
}

function diasNoMes(ano, mes1a12) { return new Date(ano, mes1a12, 0).getDate(); }

function rotuloMes(chave) {
  const p = chave.split('-');
  return NOMES_MESES[Number(p[1]) - 1] + '/' + p[0];
}

// ---------------------------------------------------------------- textos e números

function normalizarTexto(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Recusa qualquer sequência de 12 dígitos ou mais (mesmo com espaços, pontos, traços ou barras). */
function contemNumeroSensivel(texto) {
  if (texto === null || texto === undefined) return false;
  const juntos = String(texto).replace(/(\d)[\s.\-\/]+(?=\d)/g, '$1');
  return /\d{12,}/.test(juntos);
}

/** Aceita 1234.56, "1.234,56", "1234,56", "R$ 1.234,56". Devolve NaN se não for número. */
function parseValorBR(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  let s = String(v).replace(/R\$/i, '').replace(/\s/g, '');
  if (s === '') return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Aceita Date, "AAAA-MM-DD" ou "DD/MM/AAAA". Devolve Date (meia-noite local) ou null. */
function parseData(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (v && typeof v === 'object' && typeof v.getFullYear === 'function') return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let a, me, d;
  if (m) { a = +m[1]; me = +m[2]; d = +m[3]; }
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    a = +m[3]; me = +m[2]; d = +m[1];
  }
  const data = new Date(a, me - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== me - 1 || data.getDate() !== d) return null;
  return data;
}

function arred2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function ehSim(v) { return v === true || normalizarTexto(v) === 'sim'; }

// ---------------------------------------------------------------- validação de formulários

/**
 * Valida e converte os dados de um formulário.
 * @param campos definição dos campos (FORMULARIOS[x].campos)
 * @param dados objeto { nomeDoCampo: valorDigitado }
 * @param opcoesDinamicas { fonte: [valores aceitos] }
 * @return { ok, erros: [texto], valores: { campo: valorConvertido } }
 */
function validarCampos(campos, dados, opcoesDinamicas) {
  const erros = [], valores = {};
  opcoesDinamicas = opcoesDinamicas || {};
  campos.forEach(function (c) {
    const rotulo = c.rotulo || c.nome;
    let bruto = dados[c.nome];
    if (bruto === undefined || bruto === null) bruto = '';
    if (typeof bruto === 'string') bruto = bruto.trim();
    if (bruto === '' && c.padrao !== undefined) bruto = c.padrao;

    if (typeof bruto === 'string' && contemNumeroSensivel(bruto)) {
      erros.push(rotulo + ': não digite número de cartão, conta ou documento (12 dígitos ou mais).');
      return;
    }
    if (bruto === '' || bruto === false && c.tipo !== 'simnao') {
      if (c.obrigatorio) erros.push(rotulo + ' é obrigatório.');
      valores[c.nome] = '';
      return;
    }

    let v = bruto;
    switch (c.tipo) {
      case 'texto':
        v = String(bruto);
        if (v.length > 200) erros.push(rotulo + ': máximo de 200 caracteres.');
        break;
      case 'email':
        v = String(bruto);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) erros.push(rotulo + ': e-mail inválido.');
        break;
      case 'moeda':
      case 'moeda_sinal':
        v = parseValorBR(bruto);
        if (isNaN(v)) { erros.push(rotulo + ': valor inválido.'); break; }
        v = arred2(v);
        if (c.tipo === 'moeda' && v < 0) erros.push(rotulo + ' não pode ser negativo.');
        if (c.positivo && v <= 0) erros.push(rotulo + ' deve ser maior que zero.');
        break;
      case 'percentual':
        v = parseValorBR(bruto);
        if (isNaN(v) || v < 0 || v > 100) erros.push(rotulo + ': informe um número entre 0 e 100.');
        break;
      case 'inteiro':
      case 'dia':
        v = Number(String(bruto).replace(',', '.'));
        const min = c.tipo === 'dia' ? 1 : (c.min !== undefined ? c.min : -Infinity);
        const max = c.tipo === 'dia' ? 31 : (c.max !== undefined ? c.max : Infinity);
        if (!Number.isInteger(v) || v < min || v > max) erros.push(rotulo + ': informe um número inteiro entre ' + min + ' e ' + max + '.');
        break;
      case 'data':
        v = parseData(bruto);
        if (!v) erros.push(rotulo + ': data inválida.');
        break;
      case 'mes':
        v = mesDe(bruto);
        if (!v) erros.push(rotulo + ': mês inválido (use AAAA-MM).');
        break;
      case 'simnao':
        v = ehSim(bruto) ? 'Sim' : 'Não';
        break;
      case 'lista': {
        const aceitas = c.dependeDe
          ? ((opcoesDinamicas.subcategoriasPor || {})[String(dados[c.dependeDe] || '').trim()] || [])
          : (c.opcoes || opcoesDinamicas[c.fonte] || []);
        v = String(bruto);
        if (aceitas.indexOf(v) < 0) erros.push(rotulo + ': escolha uma opção da lista.');
        break;
      }
    }
    valores[c.nome] = v;
  });
  return { ok: erros.length === 0, erros: erros, valores: valores };
}

/** "Aluguel, Condomínio" -> ['Aluguel', 'Condomínio']. */
function listaSubcategorias(texto) {
  return String(texto || '').split(/[,;]/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
}

/** { categoria: [subcategorias] } das categorias ativas. */
function mapaSubcategorias(categorias) {
  const r = {};
  categorias.forEach(function (c) { if (ehSim(c['Ativa'])) r[String(c['Categoria'])] = listaSubcategorias(c['Subcategorias']); });
  return r;
}

/** Pagamento de fatura lançado como Saída conta o gasto em dobro. */
function erroRegraFatura(descricao, tipo) {
  if (tipo !== 'Saída') return '';
  const d = normalizarTexto(descricao);
  if (/\bfatura\b/.test(d) || /pagamento (do |de )?cartao/.test(d)) {
    return 'Pagamento de fatura é Transferência, não Saída. As compras do cartão já entram como gasto, uma por uma.';
  }
  return '';
}

// ---------------------------------------------------------------- cartão e parcelas

/**
 * Mês em que a compra sai do caixa (vencimento da fatura).
 * Compra antes do fechamento entra na fatura que fecha no mesmo mês;
 * no dia do fechamento ou depois, na do mês seguinte.
 */
function mesFaturaCartao(data, cartao) {
  const fech = Number(cartao['Dia fechamento']);
  const venc = Number(cartao['Dia vencimento']);
  let mesFech = mesChave(data);
  if (data.getDate() >= fech) mesFech = somarMeses(mesFech, 1);
  return venc > fech ? mesFech : somarMeses(mesFech, 1);
}

/**
 * Gera as linhas de um lançamento. Compra parcelada no cartão vira uma linha por parcela,
 * cada uma no mês seguinte, e o centavo que sobra vai na primeira.
 */
function gerarLancamentos(valores, cartao, idBase) {
  const n = cartao ? Math.max(1, Number(valores['Parcelas']) || 1) : 1;
  const total = arred2(valores['Valor']);
  const parcela = Math.floor(total / n * 100) / 100;
  const primeira = arred2(total - parcela * (n - 1));
  const linhas = [];
  for (let i = 0; i < n; i++) {
    const data = new Date(valores['Data'].getFullYear(), valores['Data'].getMonth() + i,
      Math.min(valores['Data'].getDate(), diasNoMes(valores['Data'].getFullYear() + Math.floor((valores['Data'].getMonth() + i) / 12), ((valores['Data'].getMonth() + i) % 12) + 1)));
    linhas.push({
      'ID': idBase + (n > 1 ? '-' + (i + 1) : ''),
      'Data': data,
      'Descrição': valores['Descrição'],
      'Valor': i === 0 ? primeira : parcela,
      'Tipo': valores['Tipo'],
      'Categoria': valores['Categoria'] || '',
      'Subcategoria': valores['Subcategoria'] || '',
      'Centro de custo': valores['Centro de custo'] || '',
      'Conta/Cartão': valores['Conta/Cartão'],
      'Parcela': n > 1 ? (i + 1) + ' de ' + n : '',
      'Mês fatura': cartao ? somarMeses(mesFaturaCartao(valores['Data'], cartao), i) : ''
    });
  }
  return linhas;
}

/**
 * Melhor dia para comprar em cada cartão no mês dado: o dia seguinte ao fechamento.
 * Escolhe o cartão que dá mais dias até o pagamento.
 */
function melhorCartao(cartoes, chaveMes) {
  let melhor = null;
  const p = chaveMes.split('-');
  const ano = Number(p[0]), mes = Number(p[1]);
  cartoes.forEach(function (c) {
    const fech = Number(c['Dia fechamento']), venc = Number(c['Dia vencimento']);
    if (!fech || !venc) return;
    const dia = Math.min(fech + 1, diasNoMes(ano, mes));
    const compra = new Date(ano, mes - 1, dia);
    const mesVenc = mesFaturaCartao(compra, c);
    const pv = mesVenc.split('-');
    const vencimento = new Date(Number(pv[0]), Number(pv[1]) - 1, Math.min(venc, diasNoMes(Number(pv[0]), Number(pv[1]))));
    const dias = Math.round((vencimento - compra) / 86400000);
    if (!melhor || dias > melhor.dias) melhor = { cartao: c['Cartão'], dia: dia, dias: dias, vencimento: vencimento };
  });
  return melhor;
}

// ---------------------------------------------------------------- reserva e aporte

/**
 * Reserva recebe pct% do aporte até chegar à meta. Ao atingir, congela e
 * tudo vai para as metas, na proporção do "% do aporte" de cada uma.
 */
function distribuirAporte(aporte, reservaAntes, metaReserva, pctReserva, metas) {
  aporte = arred2(aporte); reservaAntes = arred2(reservaAntes);
  const falta = Math.max(0, arred2(metaReserva - reservaAntes));
  const paraReserva = arred2(Math.min(aporte * pctReserva / 100, falta));
  const paraMetas = arred2(aporte - paraReserva);
  const ativas = (metas || []).filter(function (m) { return ehSim(m['Ativa']) && Number(m['% do aporte']) > 0; });
  const soma = ativas.reduce(function (s, m) { return s + Number(m['% do aporte']); }, 0);
  const porMeta = [];
  let distribuido = 0;
  ativas.forEach(function (m, i) {
    let v = arred2(paraMetas * Number(m['% do aporte']) / soma);
    if (i === ativas.length - 1) v = arred2(paraMetas - distribuido);
    distribuido = arred2(distribuido + v);
    porMeta.push({ meta: m['Meta'], valor: v });
  });
  return {
    paraReserva: paraReserva,
    reservaDepois: arred2(reservaAntes + paraReserva),
    paraMetas: paraMetas,
    congelada: falta === 0,
    porMeta: porMeta,
    somaPercentuais: soma
  };
}

function somaPercentuaisMetas(metas) {
  return arred2(metas.filter(function (m) { return ehSim(m['Ativa']); })
    .reduce(function (s, m) { return s + (Number(m['% do aporte']) || 0); }, 0));
}

// ---------------------------------------------------------------- orçado x realizado

/** Soma das Saídas por categoria e mês (1..12) de um ano, com filtro opcional de centro de custo. */
function realizadoPorCategoria(lancamentos, ano, centro) {
  const r = {};
  lancamentos.forEach(function (l) {
    if (l['Tipo'] !== 'Saída') return;
    const d = parseData(l['Data']);
    if (!d || d.getFullYear() !== Number(ano)) return;
    if (centro && centro !== 'Todos' && l['Centro de custo'] !== centro) return;
    const cat = l['Categoria'] || '(sem categoria)';
    if (!r[cat]) r[cat] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    r[cat][d.getMonth()] = arred2(r[cat][d.getMonth()] + Number(l['Valor']));
  });
  return r;
}

/**
 * Linhas da aba Orcado_Realizado.
 * mesesDecorridos: quantos meses do ano entram na meta acumulada (12 para anos passados).
 */
function montarOrcadoRealizado(categorias, lancamentos, ano, centro, mesesDecorridos) {
  const atual = realizadoPorCategoria(lancamentos, ano, centro);
  const anterior = realizadoPorCategoria(lancamentos, Number(ano) - 1, centro);
  const linhas = [];
  const nomes = categorias
    .filter(function (c) { return c['Tipo'] !== 'Entrada' && (ehSim(c['Ativa']) || atual[c['Categoria']]); })
    .filter(function (c) { return !centro || centro === 'Todos' || !c['Centro de custo'] || c['Centro de custo'] === centro || atual[c['Categoria']]; })
    .map(function (c) { return c['Categoria']; });
  Object.keys(atual).forEach(function (k) { if (nomes.indexOf(k) < 0) nomes.push(k); });
  nomes.forEach(function (nome) {
    const cat = categorias.filter(function (c) { return c['Categoria'] === nome; })[0] || {};
    const meta = Number(cat['Meta mensal']) || 0;
    const meses = atual[nome] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const total = arred2(meses.reduce(function (s, v) { return s + v; }, 0));
    const metaAcum = arred2(meta * mesesDecorridos);
    const totalAnt = arred2((anterior[nome] || []).reduce(function (s, v) { return s + v; }, 0));
    linhas.push({
      categoria: nome, metaMensal: meta, meses: meses, total: total,
      metaAcumulada: metaAcum,
      pctMeta: metaAcum > 0 ? total / metaAcum : (total > 0 ? null : 0),
      anoAnterior: totalAnt,
      variacao: totalAnt > 0 ? (total - totalAnt) / totalAnt : null
    });
  });
  return linhas;
}

/**
 * Alertas de orçamento de um mês. Cada nível (80%, 100%) é enviado uma vez por categoria e mês.
 * @param enviados conjunto de chaves "AAAA-MM|Categoria|nível"
 */
function calcularAlertas(realizadoMes, metasPorCategoria, enviados, mes, niveis) {
  const novos = [];
  Object.keys(metasPorCategoria).forEach(function (cat) {
    const meta = Number(metasPorCategoria[cat]) || 0;
    if (meta <= 0) return;
    const real = arred2(realizadoMes[cat] || 0);
    const pct = real / meta * 100;
    const atingidos = niveis.filter(function (n) { return pct >= n; });
    if (!atingidos.length) return;
    const maior = Math.max.apply(null, atingidos);
    if (enviados.has(mes + '|' + cat + '|' + maior)) return;
    novos.push({ mes: mes, categoria: cat, nivel: maior, realizado: real, meta: meta, cobre: atingidos });
  });
  return novos;
}

// ---------------------------------------------------------------- projeção de caixa

function fixoAtivoNoMes(fixo, mes) {
  if (!ehSim(fixo['Ativo'])) return false;
  const ini = mesDe(fixo['Início']), fim = mesDe(fixo['Fim']);
  if (ini && mes < ini) return false;
  if (fim && mes > fim) return false;
  return true;
}

/** Soma por mês das parcelas de cartão já lançadas (pelo mês da fatura). */
function faturasPorMes(lancamentos, nomesCartoes) {
  const r = {};
  lancamentos.forEach(function (l) {
    if (l['Tipo'] !== 'Saída' || nomesCartoes.indexOf(l['Conta/Cartão']) < 0) return;
    const m = mesDe(l['Mês fatura']);
    if (!m) return;
    r[m] = arred2((r[m] || 0) + Number(l['Valor']));
  });
  return r;
}

/** Soma por mês só das parcelas (compras parceladas), para o teto de parcelas. */
function parcelasPorMes(lancamentos, nomesCartoes) {
  return faturasPorMes(lancamentos.filter(function (l) { return !!l['Parcela']; }), nomesCartoes);
}

/**
 * Projeção de 12 meses.
 * Entradas: fixos de Entrada. Saídas: fixos de Saída que não estão no cartão,
 * faturas de cartão (compras já lançadas + fixos no cartão), compras planejadas e aporte.
 */
function projetarCaixa(p) {
  const nomesCartoes = p.nomesCartoes || [];
  const faturas = p.faturas || {};
  const compras = p.compras || {};
  let saldo = arred2(p.saldoInicial);
  return proximosMeses(p.mesInicial, p.meses || 12).map(function (mes) {
    let entradas = 0, fixas = 0, cartaoFixos = 0;
    (p.fixos || []).forEach(function (f) {
      if (!fixoAtivoNoMes(f, mes)) return;
      const v = Number(f['Valor']) || 0;
      if (f['Tipo'] === 'Entrada') entradas += v;
      else if (nomesCartoes.indexOf(f['Conta/Cartão']) >= 0) cartaoFixos += v;
      else fixas += v;
    });
    const fatura = arred2((faturas[mes] || 0) + cartaoFixos);
    const compra = arred2(compras[mes] || 0);
    const aporte = arred2(p.aporte || 0);
    const inicial = saldo;
    saldo = arred2(saldo + entradas - fixas - fatura - compra - aporte);
    return {
      mes: mes, saldoInicial: inicial, entradas: arred2(entradas), saidasFixas: arred2(fixas),
      faturas: fatura, compras: compra, aporte: aporte, saldoFinal: saldo
    };
  });
}

// ---------------------------------------------------------------- calendário de compras

/**
 * Para cada compra planejada (por prioridade), procura o primeiro mês a partir do desejado em que:
 *  - a parcela somada às parcelas já existentes não passa do teto mensal de parcelas;
 *  - o saldo projetado não fica negativo em nenhum mês seguinte.
 * Prefere o menor número de parcelas possível.
 */
function planejarCompras(p) {
  const meses = p.projecao.map(function (r) { return r.mes; });
  const saldos = p.projecao.map(function (r) { return r.saldoFinal; });
  const carga = Object.assign({}, p.cargaParcelas || {});
  const teto = Number(p.teto) > 0 ? Number(p.teto) : Infinity;
  const maxGlobal = Math.max(1, Number(p.maxParcelas) || 1);
  const consumo = meses.map(function () { return 0; });
  const porMes = {};
  const compras = expandirCompras(p.compras || [], meses[0], meses.length).sort(function (a, b) {
      return (PESO_PRIORIDADE[a['Prioridade']] || 9) - (PESO_PRIORIDADE[b['Prioridade']] || 9) ||
        String(mesDe(a['Mês desejado']) || '').localeCompare(String(mesDe(b['Mês desejado']) || '')) ||
        Number(a['Valor estimado']) - Number(b['Valor estimado']);
    });

  const resultado = compras.map(function (c) {
    const base = {
      item: c['Item'], prioridade: c['Prioridade'], frequencia: c['Frequência'] || 'Única',
      categoria: c['Categoria'] || '', subcategoria: c['Subcategoria'] || '', onde: c['Onde comprar'] || ''
    };
    const valor = arred2(c['Valor estimado']);
    if (!(valor > 0)) {
      return Object.assign(base, { valor: '', mes: '', parcelas: '', valorParcela: '', cartao: '', dia: '', diasAtePagar: '',
        motivo: 'Informe o valor estimado para planejar' });
    }
    const maxN = Math.min(maxGlobal, Number(c['Parcelas máx']) || maxGlobal);
    const desejado = mesDe(c['Mês desejado']);
    const inicio = Math.max(0, desejado ? difMeses(meses[0], desejado) : 0);
    for (let s = inicio; s < meses.length; s++) {
      for (let n = 1; n <= maxN; n++) {
        const parcela = arred2(valor / n);
        let ok = true;
        for (let i = 0; i < n && ok; i++) {
          const m = somarMeses(meses[s], i);
          if (n > 1 && (carga[m] || 0) + parcela > teto + 0.001) ok = false;
        }
        if (!ok) continue;
        // saldo: a partir de s, cada mês perde as parcelas já vencidas
        for (let j = s; j < meses.length && ok; j++) {
          const pagas = Math.min(n, j - s + 1);
          if (saldos[j] - consumo[j] - parcela * pagas < -0.001) ok = false;
        }
        if (!ok) continue;
        for (let i = 0; i < n; i++) {
          const m = somarMeses(meses[s], i);
          if (n > 1) carga[m] = arred2((carga[m] || 0) + parcela);
          porMes[m] = arred2((porMes[m] || 0) + parcela);
        }
        for (let j = s; j < meses.length; j++) consumo[j] = arred2(consumo[j] + parcela * Math.min(n, j - s + 1));
        const cartao = n > 1 || (p.cartoes || []).length ? melhorCartao(p.cartoes || [], meses[s]) : null;
        let motivo = s === inicio ? 'Cabe no mês desejado' : 'Adiado: caixa ou teto de parcelas não comportam antes';
        if (!desejado && s === 0) motivo = 'Cabe já';
        return Object.assign(base, {
          valor: valor, mes: meses[s], parcelas: n,
          valorParcela: parcela, cartao: cartao ? cartao.cartao : '', dia: cartao ? cartao.dia : '',
          diasAtePagar: cartao ? cartao.dias : '', motivo: motivo
        });
      }
    }
    return Object.assign(base, {
      valor: valor, mes: '', parcelas: '', valorParcela: '',
      cartao: '', dia: '', diasAtePagar: '', motivo: 'Não cabe nos próximos ' + meses.length + ' meses'
    });
  });
  return { itens: resultado, porMes: porMes };
}

/**
 * Compras planejadas, com as recorrentes repetidas no horizonte.
 * Ex.: Botox semestral a partir de jan -> jan e jul. Uma compra recorrente sem mês começa no mês atual.
 */
function expandirCompras(compras, mesInicial, horizonte) {
  const fim = somarMeses(mesInicial, horizonte - 1);
  const r = [];
  compras.forEach(function (c) {
    if ((c['Status'] || 'Planejada') !== 'Planejada') return;
    const intervalo = FREQUENCIAS[c['Frequência']] || 0;
    if (!intervalo) { r.push(c); return; }
    let mes = mesDe(c['Mês desejado']) || mesInicial;
    while (mes < mesInicial) mes = somarMeses(mes, intervalo);
    for (; mes <= fim; mes = somarMeses(mes, intervalo)) {
      r.push(Object.assign({}, c, { 'Mês desejado': mes }));
    }
  });
  return r;
}

// ---------------------------------------------------------------- parcelas por cartão

/**
 * Compras parceladas agrupadas: cartão, total de parcelas, quantas faltam e quanto falta pagar.
 * Uma parcela conta como paga quando a fatura dela vence antes do mês atual.
 */
function resumoParcelas(lancamentos, nomesCartoes, mesAtual) {
  const grupos = {}, ordem = [];
  lancamentos.forEach(function (l) {
    if (!l['Parcela'] || l['Tipo'] !== 'Saída' || nomesCartoes.indexOf(l['Conta/Cartão']) < 0) return;
    const id = String(l['ID']).replace(/-\d+$/, '');
    if (!grupos[id]) { grupos[id] = []; ordem.push(id); }
    grupos[id].push(l);
  });
  const porCartaoMes = {};
  const compras = ordem.map(function (id) {
    const ls = grupos[id];
    const total = Number(String(ls[0]['Parcela']).split(' de ')[1]) || ls.length;
    let pagas = 0, restante = 0, ultima = '';
    ls.forEach(function (l) {
      const m = mesDe(l['Mês fatura']);
      if (m > ultima) ultima = m;
      if (m && m < mesAtual) pagas++;
      else {
        restante += Number(l['Valor']);
        const c = l['Conta/Cartão'];
        porCartaoMes[c] = porCartaoMes[c] || {};
        porCartaoMes[c][m] = arred2((porCartaoMes[c][m] || 0) + Number(l['Valor']));
      }
    });
    const d = parseData(ls[0]['Data']);
    return {
      cartao: ls[0]['Conta/Cartão'], descricao: ls[0]['Descrição'], categoria: ls[0]['Categoria'] || '',
      subcategoria: ls[0]['Subcategoria'] || '', data: d, totalParcelas: total,
      valorParcela: arred2(ls[ls.length - 1]['Valor']), pagas: pagas, restantes: total - pagas,
      valorRestante: arred2(restante), ultimaFatura: ultima
    };
  });
  compras.sort(function (a, b) { return a.cartao < b.cartao ? -1 : a.cartao > b.cartao ? 1 : (a.ultimaFatura < b.ultimaFatura ? -1 : 1); });
  return { compras: compras, porCartaoMes: porCartaoMes };
}

// ---------------------------------------------------------------- importação

function chaveDuplicidade(l) {
  const d = parseData(l['Data']);
  return [d ? diaChave(d) : '', arred2(l['Valor']).toFixed(2), normalizarTexto(l['Descrição']), normalizarTexto(l['Conta/Cartão'])].join('|');
}

/**
 * Marca como Duplicado o que já existe em Lançamentos ou repete dentro da própria importação.
 * Devolve, na ordem, true (duplicado) ou false para cada linha pendente.
 */
function detectarDuplicados(pendentes, existentes) {
  const vistos = new Set(existentes.map(chaveDuplicidade));
  return pendentes.map(function (l) {
    const k = chaveDuplicidade(l);
    if (vistos.has(k)) return true;
    vistos.add(k);
    return false;
  });
}

