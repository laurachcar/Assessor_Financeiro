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

/**
 * As 19 abas do sistema (17 visíveis + Relatorios e Log ocultas).
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
  Categorias:         { tipo: 'dados', cor: '#f9ab00', cabecalho: ['Categoria', 'Tipo', 'Meta mensal', 'Centro de custo', 'Ativa'] },
  Lancamentos:        { tipo: 'dados', cor: '#188038', cabecalho: ['ID', 'Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Centro de custo', 'Conta/Cartão', 'Parcela', 'Mês fatura', 'Origem', 'Criado em'] },
  Fixos:              { tipo: 'dados', cor: '#188038', cabecalho: ['Descrição', 'Tipo', 'Valor', 'Categoria', 'Centro de custo', 'Conta/Cartão', 'Dia', 'Início', 'Fim', 'Ativo'] },
  Compras_Futuras:    { tipo: 'dados', cor: '#f9ab00', cabecalho: ['Item', 'Valor estimado', 'Prioridade', 'Mês desejado', 'Parcelas máx', 'Categoria', 'Status', 'Observação'] },
  Aporte_Reserva:     { tipo: 'dados', cor: '#9334e6', cabecalho: ['Mês', 'Aporte', 'Reserva antes', 'Para reserva', 'Reserva depois', 'Para metas', 'Registrado em'] },
  Metas_Investimento: { tipo: 'dados', cor: '#9334e6', cabecalho: ['Meta', 'Valor alvo', '% do aporte', 'Acumulado', 'Prazo', 'Ativa'] },
  Import_Staging:     { tipo: 'dados', cor: '#e8710a', cabecalho: ['ID', 'Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Centro de custo', 'Conta/Cartão', 'Origem', 'Status', 'Observação', 'Importado em'] },
  Orcado_Realizado:   { tipo: 'relatorio', cor: '#d93025' },
  Projecao_Caixa:     { tipo: 'relatorio', cor: '#d93025' },
  Calendario_Compras: { tipo: 'relatorio', cor: '#d93025' },
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

/** Categorias que já vêm cadastradas. */
const CATEGORIAS_PADRAO = [
  ['Moradia', 'Saída'], ['Condomínio', 'Saída'], ['Contas da casa', 'Saída'],
  ['Mercado', 'Saída'], ['Alimentação fora', 'Saída'], ['Transporte', 'Saída'],
  ['Saúde', 'Saída'], ['Educação', 'Saída'], ['Lazer', 'Saída'],
  ['Vestuário', 'Saída'], ['Beleza e cuidados', 'Saída'], ['Assinaturas', 'Saída'],
  ['Presentes', 'Saída'], ['Viagem', 'Saída'], ['Impostos e taxas', 'Saída'],
  ['Casa e manutenção', 'Saída'], ['Pets', 'Saída'], ['Outros', 'Saída'],
  ['Salário', 'Entrada'], ['Renda extra', 'Entrada'], ['Rendimentos', 'Entrada'],
  ['Reembolsos', 'Entrada']
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
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Conta/Cartão', tipo: 'lista', fonte: 'contasECartoes', obrigatorio: true },
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
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Conta/Cartão', tipo: 'lista', fonte: 'contasECartoes' },
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
      { nome: 'Meta mensal', tipo: 'moeda' },
      { nome: 'Centro de custo', tipo: 'lista', fonte: 'centros' },
      { nome: 'Ativa', tipo: 'simnao', padrao: 'Sim' }
    ]
  },
  compras: {
    titulo: 'Compras futuras', aba: 'Compras_Futuras', modo: 'upsert', chave: 'Item',
    campos: [
      { nome: 'Item', tipo: 'texto', obrigatorio: true },
      { nome: 'Valor estimado', tipo: 'moeda', obrigatorio: true, positivo: true },
      { nome: 'Prioridade', tipo: 'lista', opcoes: PRIORIDADES, obrigatorio: true },
      { nome: 'Mês desejado', tipo: 'mes' },
      { nome: 'Parcelas máx', tipo: 'inteiro', min: 1, max: 48 },
      { nome: 'Categoria', tipo: 'lista', fonte: 'categorias' },
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
