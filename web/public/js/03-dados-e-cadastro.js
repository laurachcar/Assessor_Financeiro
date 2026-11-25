/* ===== Demonstração: a planilha vira memória do navegador ===== */
const HOJE = new Date();
const MES = mesChave(HOJE);
const CHAVE_LS = 'assessor-demo-v3';
let db = null;
let abaAtual = 'painel';
let formAtual = 'configuracoes';
let filtroAno = HOJE.getFullYear();
let filtroCentro = 'Todos';

function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function brl(v) {
  const n = arred2(v), p = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + 'R$ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}
function dataBR(s) { const d = parseData(s); return d ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function pct(v) { return Math.round(v * 100) + '%'; }
function guardar() { try { localStorage.setItem(CHAVE_LS, JSON.stringify(db)); } catch (e) { /* sem armazenamento: segue em memória */ } }

// ------------------------------------------------------------ dados de exemplo
function semear() {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const d = {
    cfg: { email: 'voce@exemplo.com', nome: '', teto_parcelas: 1500, max_parcelas: 10, meta_reserva: 10000, pct_reserva: 50, aporte_mensal: 3000, alerta_pct1: 80, alerta_pct2: 100 },
    Cartoes: [
      { 'Cartão': 'Nubank', 'Dia fechamento': 3, 'Dia vencimento': 10, 'Limite': 12000, '% cashback': 1, 'Anuidade mensal': 0, 'Ativo': 'Sim' },
      { 'Cartão': 'C6 Black', 'Dia fechamento': 25, 'Dia vencimento': 5, 'Limite': 15000, '% cashback': 1.5, 'Anuidade mensal': 0, 'Ativo': 'Sim' }
    ],
    Contas: [
      { 'Conta': 'Itaú', 'Tipo': 'Corrente', 'Saldo atual': 9800, 'Ativa': 'Sim' },
      { 'Conta': 'Inter', 'Tipo': 'Corrente', 'Saldo atual': 2700, 'Ativa': 'Sim' },
      { 'Conta': 'XP', 'Tipo': 'Investimento', 'Saldo atual': 8500, 'Ativa': 'Sim' }
    ],
    Centros_Custo: [{ 'Centro de custo': 'Pessoal', 'Descrição': 'Gastos pessoais', 'Ativo': 'Sim' }, { 'Centro de custo': 'Casa', 'Descrição': 'Casa', 'Ativo': 'Sim' }],
    Categorias: [], Lancamentos: [], Fixos: [], Compras_Futuras: [], Aporte_Reserva: [], Metas_Investimento: [],
    Import_Staging: [], Alertas: [], Emails: [],
    Carteira: [
      { 'Ativo': 'CDB liquidez diária (reserva)', 'Tipo': 'CDB/LCI/LCA', 'Instituição': 'XP', 'Valor aplicado': 8000, 'Saldo atual': 8500, 'Rentabilidade % a.a.': 13, 'Dividendos % a.a.': '', 'Meta': '', 'Ativa': 'Sim' },
      { 'Ativo': 'Tesouro IPCA+ 2035', 'Tipo': 'Tesouro Direto', 'Instituição': 'XP', 'Valor aplicado': 38000, 'Saldo atual': 42000, 'Rentabilidade % a.a.': 11, 'Dividendos % a.a.': '', 'Meta': 'Casa própria', 'Ativa': 'Sim' },
      { 'Ativo': 'FII de lajes (exemplo)', 'Tipo': 'FII', 'Instituição': 'XP', 'Valor aplicado': 18000, 'Saldo atual': 18000, 'Rentabilidade % a.a.': 0, 'Dividendos % a.a.': 11, 'Meta': 'Imóvel por consórcio', 'Ativa': 'Sim' }
    ]
  };
  const metas = { 'Moradia': 4500, 'Alimentação': 1500, 'Lazer': 1200, 'Educação': 1300, 'Compras': 1200, 'Transporte': 500, 'Saúde': 900, 'Assinaturas': 150, 'Pets': 400, 'Impostos': 800 };
  const centroDe = { 'Moradia': 'Casa', 'Alimentação': 'Casa', 'Pets': 'Casa' };
  d.Categorias = CATEGORIAS_PADRAO.map(c => ({ 'Categoria': c[0], 'Tipo': c[1], 'Subcategorias': c[2], 'Meta mensal': metas[c[0]] || '', 'Centro de custo': centroDe[c[0]] || '', 'Ativa': 'Sim' }));
  const inicio = somarMeses(MES, -14);
  // fixos de exemplo (com uma dívida por 4 meses) + salário, aluguel e condomínio
  d.Fixos = [
    { 'Descrição': 'Salário (exemplo)', 'Tipo': 'Entrada', 'Valor': 15000, 'Categoria': 'Salário', 'Subcategoria': '', 'Conta/Cartão': 'Itaú', 'Dia': 5, 'Início': inicio, 'Fim': '', 'Ativo': 'Sim' },
    { 'Descrição': 'Renda extra (exemplo)', 'Tipo': 'Entrada', 'Valor': 3000, 'Categoria': 'Renda extra', 'Subcategoria': '', 'Conta/Cartão': 'Inter', 'Dia': 10, 'Início': inicio, 'Fim': '', 'Ativo': 'Sim' },
    { 'Descrição': 'Aluguel (exemplo)', 'Tipo': 'Saída', 'Valor': 3200, 'Categoria': 'Moradia', 'Subcategoria': 'Aluguel', 'Centro de custo': 'Casa', 'Conta/Cartão': 'Itaú', 'Dia': 10, 'Início': inicio, 'Fim': '', 'Ativo': 'Sim' },
    { 'Descrição': 'Condomínio (exemplo)', 'Tipo': 'Saída', 'Valor': 900, 'Categoria': 'Moradia', 'Subcategoria': 'Condomínio', 'Centro de custo': 'Casa', 'Conta/Cartão': 'Itaú', 'Dia': 10, 'Início': inicio, 'Fim': '', 'Ativo': 'Sim' },
    { 'Descrição': 'Streaming', 'Tipo': 'Saída', 'Valor': 55.9, 'Categoria': 'Assinaturas', 'Subcategoria': '', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'Nubank', 'Dia': 12, 'Início': inicio, 'Fim': '', 'Ativo': 'Sim' }
  ].concat(FIXOS_PADRAO.map(f => ({ 'Descrição': f[0], 'Tipo': f[1], 'Valor': f[2], 'Categoria': f[3], 'Subcategoria': f[4], 'Centro de custo': '', 'Conta/Cartão': 'Itaú', 'Dia': 10,
    'Início': f[5] ? MES : inicio, 'Fim': f[5] ? somarMeses(MES, f[5] - 1) : '', 'Ativo': 'Sim' })));
  // histórico: 14 meses de lançamentos variáveis [categoria, subcategoria, descrições, cartão/conta, centro, peso da meta]
  const variaveis = [
    ['Alimentação', 'Mercado', ['Supermercado', 'Hortifruti'], 'Nubank', 'Casa', 0.7], ['Alimentação', 'Feira', ['Feira'], 'Inter', 'Casa', 0.3],
    ['Lazer', 'Alimentação fora', ['Restaurante', 'iFood'], 'C6 Black', 'Pessoal', 0.6], ['Lazer', 'Saídas', ['Bar', 'Cinema', 'Show'], 'C6 Black', 'Pessoal', 0.4],
    ['Transporte', 'Uber', ['Uber'], 'Nubank', 'Pessoal', 1], ['Moradia', 'Contas de casa', ['Luz', 'Internet', 'Gás'], 'Itaú', 'Casa', 0.07],
    ['Compras', 'Roupas', ['Loja de roupas'], 'C6 Black', 'Pessoal', 0.5], ['Compras', 'Presentes', ['Presente'], 'Nubank', 'Pessoal', 0.3],
    ['Saúde', 'Remédios', ['Farmácia'], 'Nubank', 'Pessoal', 0.2], ['Saúde', 'Médicos', ['Consulta'], 'Itaú', 'Pessoal', 0.15],
    ['Pets', 'Ração', ['Ração'], 'Nubank', 'Casa', 0.6]
  ];
  let n = 1;
  for (let k = -14; k <= 0; k++) {
    const mes = somarMeses(MES, k);
    const [a, m] = mes.split('-').map(Number);
    const ultimoDia = k === 0 ? HOJE.getDate() : diasNoMes(a, m);
    const fatorMes = k === 0 ? Math.min(1, ultimoDia / diasNoMes(a, m) + 0.25) : 1;
    d.Fixos.forEach(f => {
      if (!fixoAtivoNoMes(f, mes) || f['Dia'] > ultimoDia) return;
      lancar(d, { 'Data': new Date(a, m - 1, f['Dia']), 'Descrição': f['Descrição'], 'Valor': f['Valor'], 'Tipo': f['Tipo'], 'Categoria': f['Categoria'], 'Subcategoria': f['Subcategoria'], 'Centro de custo': f['Centro de custo'] || '', 'Conta/Cartão': f['Conta/Cartão'], 'Parcelas': 1 }, 'L' + (n++), 'Fixo');
    });
    variaveis.forEach(([cat, sub, descs, conta, centro, peso]) => {
      const meta = metas[cat] * peso;
      let alvo = meta * (k === 0 ? 0.45 + rnd() * 0.3 : 0.65 + rnd() * 0.45) * fatorMes;
      if (k === 0 && sub === 'Mercado') alvo = meta * 1.25;
      if (k === 0 && sub === 'Saídas') alvo = meta * 1.6;
      const qtd = Math.max(1, Math.round(alvo / Math.max(60, meta / 4)));
      for (let i = 0; i < qtd; i++) {
        const dia = Math.min(ultimoDia, 1 + Math.floor(rnd() * ultimoDia));
        lancar(d, { 'Data': new Date(a, m - 1, dia), 'Descrição': descs[i % descs.length], 'Valor': arred2(alvo / qtd), 'Tipo': 'Saída', 'Categoria': cat, 'Subcategoria': sub, 'Centro de custo': centro, 'Conta/Cartão': conta, 'Parcelas': 1 }, 'L' + (n++), 'Manual');
      }
    });
    if (k < 0) {
      lancar(d, { 'Data': new Date(a, m - 1, 15), 'Descrição': 'Cashback Nubank', 'Valor': arred2(15 + rnd() * 15), 'Tipo': 'Entrada', 'Categoria': 'Cashback', 'Subcategoria': 'Nubank', 'Conta/Cartão': 'Itaú', 'Parcelas': 1 }, 'L' + (n++), 'Manual');
      lancar(d, { 'Data': new Date(a, m - 1, 16), 'Descrição': 'Cashback C6 Black', 'Valor': arred2(20 + rnd() * 20), 'Tipo': 'Entrada', 'Categoria': 'Cashback', 'Subcategoria': 'C6 Black', 'Conta/Cartão': 'Itaú', 'Parcelas': 1 }, 'L' + (n++), 'Manual');
      lancar(d, { 'Data': new Date(a, m - 1, 20), 'Descrição': 'Rendimentos XP', 'Valor': arred2(70 + rnd() * 40), 'Tipo': 'Entrada', 'Categoria': 'Rendimentos', 'Subcategoria': 'XP', 'Conta/Cartão': 'Itaú', 'Parcelas': 1 }, 'L' + (n++), 'Manual');
    }
  }
  lancar(d, { 'Data': new Date(HOJE.getFullYear(), HOJE.getMonth() - 2, 14), 'Descrição': 'Micro-ondas', 'Valor': 899, 'Tipo': 'Saída', 'Categoria': 'Compras', 'Subcategoria': 'Casa e eletro', 'Centro de custo': 'Casa', 'Conta/Cartão': 'C6 Black', 'Parcelas': 5 }, 'L' + (n++), 'Manual');
  lancar(d, { 'Data': new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, 8), 'Descrição': 'Tênis de corrida', 'Valor': 780, 'Tipo': 'Saída', 'Categoria': 'Compras', 'Subcategoria': 'Sapatos', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'Nubank', 'Parcelas': 3 }, 'L' + (n++), 'Manual');
  lancar(d, { 'Data': new Date(HOJE.getFullYear(), HOJE.getMonth() - 6, 20), 'Descrição': 'Notebook', 'Valor': 6000, 'Tipo': 'Saída', 'Categoria': 'Educação', 'Subcategoria': 'Cursos', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'C6 Black', 'Parcelas': 10 }, 'L' + (n++), 'Manual');
  lancar(d, { 'Data': new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, 20), 'Descrição': 'Pagamento fatura Nubank', 'Valor': 2140.5, 'Tipo': 'Transferência', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': 'Itaú', 'Parcelas': 1 }, 'L' + (n++), 'Manual');

  d.Compras_Futuras = COMPRAS_PADRAO.filter(c => c[0] !== 'Micro-ondas').map(c => ({ 'Item': c[0], 'Valor estimado': c[1], 'Prioridade': c[2], 'Frequência': c[3], 'Mês desejado': '', 'Parcelas máx': '',
    'Categoria': c[4], 'Subcategoria': c[5], 'Onde comprar': '', 'Status': 'Planejada', 'Observação': '' }));
  d.Compras_Futuras.forEach(c => {
    if (c['Item'] === 'Airfryer') { c['Valor estimado'] = 550; c['Onde comprar'] = 'Amazon'; }
    if (c['Item'] === 'Robô aspirador') { c['Valor estimado'] = 1800; c['Onde comprar'] = 'Mercado Livre'; c['Parcelas máx'] = 10; }
    if (c['Item'] === 'Vacinas do pet') { c['Valor estimado'] = 350; c['Onde comprar'] = 'Clínica veterinária'; c['Mês desejado'] = somarMeses(MES, 2); }
    if (c['Item'] === 'Botox') c['Onde comprar'] = 'Clínica de estética';
  });
  d.Metas_Investimento = [
    { 'Meta': 'Casa própria', 'Valor alvo': 300000, '% do aporte': 60, 'Acumulado': 42000, 'Prazo': '2031-12', 'Ativa': 'Sim' },
    { 'Meta': 'Imóvel por consórcio', 'Valor alvo': 200000, '% do aporte': 40, 'Acumulado': 18000, 'Prazo': '2033-06', 'Ativa': 'Sim' }
  ];
  const ant = somarMeses(MES, -1);
  const dist = distribuirAporte(3000, 7000, 10000, 50, d.Metas_Investimento);
  d.Aporte_Reserva = [{ 'Mês': ant, 'Aporte': 3000, 'Reserva antes': 7000, 'Para reserva': dist.paraReserva, 'Reserva depois': dist.reservaDepois, 'Para metas': dist.paraMetas, 'Registrado em': diaChave(new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, 1)) }];
  const ultimo = d.Lancamentos.filter(l => l['Subcategoria'] === 'Mercado').slice(-1)[0];
  const dHoje = diaChave(HOJE);
  d.Import_Staging = [
    { 'ID': 'I1', 'Data': ultimo['Data'], 'Descrição': ultimo['Descrição'].toUpperCase(), 'Valor': ultimo['Valor'], 'Tipo': 'Saída', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': ultimo['Conta/Cartão'], 'Origem': 'fatura-nubank.pdf', 'Status': 'Pendente', 'Observação': '' },
    { 'ID': 'I2', 'Data': dHoje, 'Descrição': 'Drogaria São Paulo', 'Valor': 84.9, 'Tipo': 'Saída', 'Categoria': 'Saúde', 'Subcategoria': 'Remédios', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'Nubank', 'Origem': 'fatura-nubank.pdf', 'Status': 'Pendente', 'Observação': '' },
    { 'ID': 'I3', 'Data': dHoje, 'Descrição': 'Uber *Trip', 'Valor': 38.5, 'Tipo': 'Saída', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': 'Nubank', 'Origem': 'fatura-nubank.pdf', 'Status': 'Pendente', 'Observação': '' },
    { 'ID': 'I4', 'Data': dHoje, 'Descrição': 'Uber *Trip', 'Valor': 38.5, 'Tipo': 'Saída', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': 'Nubank', 'Origem': 'fatura-nubank.pdf', 'Status': 'Pendente', 'Observação': '' },
    { 'ID': 'I5', 'Data': dHoje, 'Descrição': 'Pagamento fatura C6', 'Valor': 1320, 'Tipo': 'Saída', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': 'Itaú', 'Origem': 'extrato-itau.ofx', 'Status': 'Pendente', 'Observação': '' }
  ];
  d.Emails.push({ quando: diaChave(new Date(HOJE.getFullYear(), HOJE.getMonth(), 1)) + ' 08:00', assunto: 'Lembrete de ' + rotuloMes(MES), corpo: 'Seu checklist do mês: atualize o saldo das contas, lance o que faltou, registre o aporte e revise as compras futuras.' });
  enriquecerExemplo(d);
  db = d;
  verificarAlertas();
  guardar();
}

/** Mesmo caminho do formulário Novo lançamento: gera parcelas e mês da fatura. */
function lancar(d, valores, id, origem) {
  const cartao = d.Cartoes.find(c => c['Cartão'] === valores['Conta/Cartão']) || null;
  gerarLancamentos(valores, cartao, id).forEach(l => {
    l['Data'] = diaChave(l['Data']); l['Origem'] = origem; l['Criado em'] = diaChave(HOJE);
    d.Lancamentos.push(l);
  });
}

function carregar() {
  try { const s = localStorage.getItem(CHAVE_LS); if (s) db = JSON.parse(s); } catch (e) { db = null; }
  if (!db || !db.Lancamentos) semear();
  if (!db.Carteira) db.Carteira = [];
}

// ------------------------------------------------------------ cálculos (iguais aos relatórios)
function opcoes() {
  const at = (aba, col, flag) => db[aba].filter(l => ehSim(l[flag])).map(l => String(l[col]));
  const cartoes = at('Cartoes', 'Cartão', 'Ativo'), contas = at('Contas', 'Conta', 'Ativa');
  const subcategoriasPor = mapaSubcategorias(db.Categorias);
  return { subcategoriasPor, metas: (db.Metas_Investimento || []).map(m => m['Meta']), categorias: at('Categorias', 'Categoria', 'Ativa'), centros: at('Centros_Custo', 'Centro de custo', 'Ativo'), cartoes, contas, contasECartoes: contas.concat(cartoes) };
}

function calcular() {
  const nomesCartoes = db.Cartoes.map(c => c['Cartão']);
  const cartoes = db.Cartoes.filter(c => ehSim(c['Ativo']));
  const saldoInicial = arred2(db.Contas.filter(c => ehSim(c['Ativa']) && c['Tipo'] !== 'Investimento').reduce((s, c) => s + Number(c['Saldo atual']), 0));
  const faturas = faturasPorMes(db.Lancamentos.filter(l => mesDe(l['Mês fatura']) >= MES), nomesCartoes);
  const parcelas = parcelasPorMes(db.Lancamentos, nomesCartoes);
  const aporte = Number(db.cfg.aporte_mensal) || 0;
  const p = { saldoInicial, fixos: db.Fixos, faturas, nomesCartoes, aporte, mesInicial: MES, meses: 12 };
  const base = projetarCaixa(p);
  const plano = planejarCompras({ projecao: base, compras: db.Compras_Futuras, cargaParcelas: parcelas, teto: db.cfg.teto_parcelas, maxParcelas: db.cfg.max_parcelas, cartoes });
  const projecao = projetarCaixa(Object.assign({}, p, { compras: plano.porMes }));
  return { saldoInicial, projecao, plano, parcelas, resumoParc: resumoParcelas(db.Lancamentos, nomesCartoes, MES) };
}

function resumoMes(mes) {
  const real = {};
  db.Lancamentos.forEach(l => {
    if (l['Tipo'] !== 'Saída' || mesDe(l['Data']) !== mes) return;
    const c = l['Categoria'] || '(sem categoria)';
    real[c] = arred2((real[c] || 0) + Number(l['Valor']));
  });
  return db.Categorias.filter(c => Number(c['Meta mensal']) > 0).map(c => ({ categoria: c['Categoria'], realizado: real[c['Categoria']] || 0, meta: Number(c['Meta mensal']), pct: (real[c['Categoria']] || 0) / Number(c['Meta mensal']) }));
}

function verificarAlertas() {
  const enviados = new Set(db.Alertas.map(a => a['Mês'] + '|' + a['Categoria'] + '|' + a['Nível']));
  const real = {}, metas = {};
  resumoMes(MES).forEach(c => { real[c.categoria] = c.realizado; metas[c.categoria] = c.meta; });
  const novos = calcularAlertas(real, metas, enviados, MES, [Number(db.cfg.alerta_pct1) || 80, Number(db.cfg.alerta_pct2) || 100]);
  if (!novos.length) return [];
  const agora = diaChave(HOJE);
  novos.forEach(a => a.cobre.forEach(nv => {
    if (!enviados.has(MES + '|' + a.categoria + '|' + nv)) db.Alertas.push({ 'Mês': MES, 'Categoria': a.categoria, 'Nível': nv, 'Realizado': a.realizado, 'Meta': a.meta, 'Enviado em': agora });
  }));
  db.Emails.push({
    quando: agora, assunto: 'Orçamento: ' + novos.map(a => a.categoria).join(', '),
    corpo: novos.map(a => a.categoria + ': ' + brl(a.realizado) + ' de ' + brl(a.meta) + ' (' + Math.round(a.realizado / a.meta * 100) + '%)' + (a.nivel >= 100 ? ', meta estourada' : ', passou de ' + a.nivel + '%')).join(' · ')
  });
  return novos;
}

// ------------------------------------------------------------ telas
const TELAS = [
  ['painel', 'Painel'], ['lancamentos', 'Lançamentos'], ['orcado', 'Orçado x realizado'], ['projecao', 'Projeção de caixa'],
  ['calendario', 'Calendário de compras'], ['parcelas', 'Parcelas por cartão'], ['rendimentos', 'Cashback e rendimentos'], ['investimentos', 'Reserva e metas'], ['importacao', 'Importação'],
  ['alertas', 'Alertas e e-mails'], ['planilha', 'Planilha'], ['cadastros', 'Menu Assessor']
];

function desenharAbas() {
  document.getElementById('abas').innerHTML = TELAS.map(([id, nome]) => `<button data-aba="${id}" class="${id === abaAtual ? 'ativo' : ''}">${nome}</button>`).join('');
}

function render() {
  desenharAbas();
  const c = calcular();
  const fn = { painel: telaPainel, lancamentos: telaLancamentos, orcado: telaOrcado, projecao: telaProjecao, calendario: telaCalendario, parcelas: telaParcelas, rendimentos: telaRendimentos, planilha: telaPlanilha, investimentos: telaInvestimentos, importacao: telaImportacao, alertas: telaAlertas, cadastros: telaCadastros }[abaAtual];
  document.getElementById('conteudo').innerHTML = fn(c);
  if (abaAtual === 'lancamentos') montarForm('lancamento', document.getElementById('form-lanc'));
  if (abaAtual === 'investimentos') montarForm('aporte', document.getElementById('form-aporte'));
  if (abaAtual === 'cadastros') montarForm(formAtual, document.getElementById('form-cad'));
}

function cardNum(titulo, valor, extra) { return `<div class="card"><h3>${titulo}</h3><div class="num ${valor < 0 ? 'neg' : ''}">${brl(valor)}</div>${extra ? `<div class="nota">${extra}</div>` : ''}</div>`; }

function barraPct(p) {
  const cls = p >= 1 ? 'erro' : (p >= 0.8 ? 'aviso' : '');
  return `<div class="barra"><div class="${cls}" style="width:${Math.min(100, Math.round(p * 100))}%"></div></div>`;
}

function telaPainel(c) {
  const lanc = db.Lancamentos.filter(l => mesDe(l['Data']) === MES);
  const soma = t => arred2(lanc.filter(l => l['Tipo'] === t).reduce((s, l) => s + Number(l['Valor']), 0));
  const ent = soma('Entrada'), sai = soma('Saída');
  const reserva = db.Aporte_Reserva.length ? Number(db.Aporte_Reserva[db.Aporte_Reserva.length - 1]['Reserva depois']) : 0;
  const metaRes = Number(db.cfg.meta_reserva);
  const negativos = c.projecao.filter(p => p.saldoFinal < 0).map(p => rotuloMes(p.mes));
  const orc = resumoMes(MES).sort((a, b) => b.pct - a.pct);
  const prox = c.plano.itens.filter(i => i.mes).sort((a, b) => a.mes < b.mes ? -1 : 1)[0];
  const pend = db.Import_Staging.filter(l => l['Status'] === 'Pendente').length;
  return `
  <div class="grade">
    ${cardNum('Entradas de ' + rotuloMes(MES), ent)}
    ${cardNum('Saídas de ' + rotuloMes(MES), sai)}
    ${cardNum('Resultado do mês', arred2(ent - sai))}
    ${cardNum('Saldo das contas', c.saldoInicial, 'Projetado em 12 meses: ' + brl(c.projecao[11].saldoFinal))}
  </div>
  <div class="grade secao">
    <div class="card"><h2>Orçamento do mês</h2>
      ${orc.map(o => `<div style="margin:8px 0"><div class="linha" style="justify-content:space-between"><span>${esc(o.categoria)}</span><span class="nota">${brl(o.realizado)} de ${brl(o.meta)} · ${pct(o.pct)}</span></div>${barraPct(o.pct)}</div>`).join('')}
    </div>
    <div class="card"><h2>Reserva de emergência</h2>
      <div class="num">${brl(reserva)}</div><div class="nota">Meta ${brl(metaRes)}</div>
      <div style="margin:10px 0"><div class="barra"><div style="width:${Math.min(100, Math.round(reserva / metaRes * 100))}%"></div></div></div>
      <p class="nota">${reserva >= metaRes ? 'Completa: congelada, todo o aporte vai para as metas.' : 'Recebendo ' + db.cfg.pct_reserva + '% do aporte até chegar à meta.'}</p>
      <h2 class="secao">Avisos</h2>
      <p>${negativos.length ? '<span class="pill erro">Saldo negativo em ' + negativos.join(', ') + '</span>' : '<span class="pill ok">Nenhum mês com saldo negativo</span>'}</p>
      <p>Próxima compra: ${prox ? `<b>${esc(prox.item)}</b> em ${rotuloMes(prox.mes)}${prox.cartao ? `, no ${esc(prox.cartao)} dia ${prox.dia}` : ''}${prox.parcelas > 1 ? `, ${prox.parcelas}x de ${brl(prox.valorParcela)}` : ''}` : 'nenhuma'}</p>
      <p>Parcelas em aberto: ${(() => { const pc = {}; c.resumoParc.compras.forEach(x => { if (x.restantes > 0) pc[x.cartao] = (pc[x.cartao] || 0) + x.valorRestante; }); const k = Object.keys(pc); return k.length ? k.map(x => `<b>${esc(x)}</b> ${brl(pc[x])}`).join(' · ') : 'nenhuma'; })()}</p>
      <p>${pend ? `<span class="pill aviso">${pend} importações aguardando aprovação</span>` : 'Nenhuma importação pendente'}</p>
    </div>
  </div>`;
}

function telaLancamentos() {
  const lista = db.Lancamentos.slice().sort((a, b) => (a['Data'] < b['Data'] ? 1 : -1)).slice(0, 60);
  return `<div class="dupla">
    <div class="card"><h2>Novo lançamento</h2><div id="form-lanc"></div></div>
    <div class="card"><h2>Últimos lançamentos</h2><div class="tabela"><table>
      <tr><th>Data</th><th>Descrição</th><th class="r">Valor</th><th>Tipo</th><th>Categoria</th><th>Subcategoria</th><th>Conta/Cartão</th><th>Parcela</th><th>Fatura</th></tr>
      ${lista.map(l => `<tr><td>${dataBR(l['Data'])}</td><td>${esc(l['Descrição'])}</td><td class="r ${l['Tipo'] === 'Entrada' ? 'pos' : ''}">${brl(l['Valor'])}</td><td>${esc(l['Tipo'])}</td><td>${esc(l['Categoria'])}</td><td>${esc(l['Subcategoria'])}</td><td>${esc(l['Conta/Cartão'])}</td><td>${esc(l['Parcela'])}</td><td>${l['Mês fatura'] ? rotuloMes(mesDe(l['Mês fatura'])) : ''}</td></tr>`).join('')}
    </table></div><p class="nota">Mostrando os 60 mais recentes de ${db.Lancamentos.length}.</p></div>
  </div>`;
}

function telaOrcado() {
  const anoAtual = HOJE.getFullYear();
  const anos = [...new Set(db.Lancamentos.map(l => parseData(l['Data']).getFullYear()).concat([anoAtual]))].sort();
  const decorridos = filtroAno < anoAtual ? 12 : (filtroAno > anoAtual ? 0 : HOJE.getMonth() + 1);
  const linhas = montarOrcadoRealizado(db.Categorias, db.Lancamentos, filtroAno, filtroCentro, decorridos).filter(l => l.total > 0 || l.metaMensal > 0);
  const tot = i => arred2(linhas.reduce((s, l) => s + l.meses[i], 0));
  const totAno = arred2(linhas.reduce((s, l) => s + l.total, 0)), totMeta = arred2(linhas.reduce((s, l) => s + l.metaAcumulada, 0)), totAnt = arred2(linhas.reduce((s, l) => s + l.anoAnterior, 0));
  const pctCel = p => p === null ? '' : `<span class="pill ${p >= 1 ? 'erro' : p >= 0.8 ? 'aviso' : 'ok'}">${pct(p)}</span>`;
  const varCel = v => v === null ? '' : `<span class="${v > 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${pct(v)}</span>`;
  return `<div class="card">
    <div class="linha" style="margin-bottom:10px">
      <div><label>Ano</label><select id="f-ano">${anos.map(a => `<option ${a === filtroAno ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div><label>Centro de custo</label><select id="f-centro">${['Todos'].concat(opcoes().centros).map(c => `<option ${c === filtroCentro ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    </div>
    <div class="tabela"><table>
      <tr><th>Categoria</th><th class="r">Meta mensal</th>${NOMES_MESES.map(m => `<th class="r">${m}</th>`).join('')}<th class="r">Total ${filtroAno}</th><th class="r">Meta até agora</th><th>% da meta</th><th class="r">Total ${filtroAno - 1}</th><th>Variação</th></tr>
      ${linhas.map(l => `<tr><td>${esc(l.categoria)}</td><td class="r">${l.metaMensal ? brl(l.metaMensal) : ''}</td>${l.meses.map(v => `<td class="r">${v ? brl(v) : ''}</td>`).join('')}<td class="r"><b>${brl(l.total)}</b></td><td class="r">${brl(l.metaAcumulada)}</td><td>${pctCel(l.pctMeta)}</td><td class="r">${brl(l.anoAnterior)}</td><td>${varCel(l.variacao)}</td></tr>`).join('')}
      <tr><th>TOTAL</th><th></th>${NOMES_MESES.map((m, i) => `<th class="r">${brl(tot(i))}</th>`).join('')}<th class="r">${brl(totAno)}</th><th class="r">${brl(totMeta)}</th><th>${totMeta ? pctCel(totAno / totMeta) : ''}</th><th class="r">${brl(totAnt)}</th><th>${totAnt ? varCel((totAno - totAnt) / totAnt) : ''}</th></tr>
    </table></div>
    <p class="nota">Só entram Saídas. Pagamento de fatura (Transferência) não conta, porque as compras do cartão já entraram uma por uma.</p>
  </div>`;
}

function grafico(projecao) {
  const w = 720, h = 220, m = { e: 64, d: 10, t: 12, b: 28 };
  const vals = projecao.map(p => p.saldoFinal);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const y = v => m.t + (max - v) / ((max - min) || 1) * (h - m.t - m.b);
  const bw = (w - m.e - m.d) / vals.length;
  const ticks = [max, (max + min) / 2, min];
  return `<svg class="grafico" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Saldo final projetado por mês">
    ${ticks.map(t => `<line x1="${m.e}" x2="${w - m.d}" y1="${y(t)}" y2="${y(t)}" stroke="var(--borda)"/><text x="${m.e - 6}" y="${y(t) + 4}" text-anchor="end">${(t / 1000).toFixed(0)} mil</text>`).join('')}
    ${projecao.map((p, i) => `<rect x="${m.e + i * bw + 4}" width="${bw - 8}" y="${Math.min(y(p.saldoFinal), y(0))}" height="${Math.max(1, Math.abs(y(p.saldoFinal) - y(0)))}" rx="3" fill="${p.saldoFinal < 0 ? 'var(--erro)' : 'var(--barra)'}"><title>${rotuloMes(p.mes)}: ${brl(p.saldoFinal)}</title></rect><text x="${m.e + i * bw + bw / 2}" y="${h - 10}" text-anchor="middle">${NOMES_MESES[Number(p.mes.slice(5)) - 1]}</text>`).join('')}
  </svg>`;
}

function telaProjecao(c) {
  return `<div class="card"><h2>Saldo final projetado</h2>${grafico(c.projecao)}</div>
  <div class="card secao"><div class="tabela"><table>
    <tr><th>Mês</th><th class="r">Saldo inicial</th><th class="r">Entradas</th><th class="r">Saídas fixas</th><th class="r">Faturas de cartão</th><th class="r">Compras planejadas</th><th class="r">Aporte</th><th class="r">Saldo final</th><th>Situação</th></tr>
    ${c.projecao.map(r => `<tr><td>${rotuloMes(r.mes)}</td><td class="r">${brl(r.saldoInicial)}</td><td class="r pos">${brl(r.entradas)}</td><td class="r">${brl(r.saidasFixas)}</td><td class="r">${brl(r.faturas)}</td><td class="r">${brl(r.compras)}</td><td class="r">${brl(r.aporte)}</td><td class="r"><b class="${r.saldoFinal < 0 ? 'neg' : ''}">${brl(r.saldoFinal)}</b></td><td><span class="pill ${r.saldoFinal < 0 ? 'erro' : 'ok'}">${r.saldoFinal < 0 ? 'Negativo' : 'OK'}</span></td></tr>`).join('')}
  </table></div>
  <p class="nota">Começa no saldo das contas correntes (${brl(c.saldoInicial)}). Faturas incluem parcelas já lançadas e fixos no cartão. Gastos variáveis do dia a dia não entram: use a folga como orçamento do mês.</p></div>`;
}

function telaCalendario(c) {
  return `<div class="card">
    <p class="nota">Teto de parcelas: ${brl(db.cfg.teto_parcelas)} por mês · máximo de ${db.cfg.max_parcelas} parcelas · compre no dia seguinte ao fechamento do cartão indicado.</p>
    <div class="tabela"><table>
      <tr><th>Item</th><th>Categoria</th><th>Frequência</th><th>Prioridade</th><th class="r">Valor</th><th>Melhor mês</th><th class="r">Parcelas</th><th class="r">Valor da parcela</th><th>Cartão</th><th class="r">Dia de compra</th><th class="r">Dias até pagar</th><th>Onde comprar</th><th>Motivo</th></tr>
      ${c.plano.itens.map(i => `<tr><td><b>${esc(i.item)}</b></td><td>${esc(i.categoria)}${i.subcategoria ? ' / ' + esc(i.subcategoria) : ''}</td><td>${esc(i.frequencia)}</td><td>${esc(i.prioridade)}</td><td class="r">${i.valor !== '' ? brl(i.valor) : '<span class="pill aviso">sem valor</span>'}</td><td>${i.mes ? rotuloMes(i.mes) : '—'}</td><td class="r">${i.parcelas}</td><td class="r">${i.valorParcela !== '' ? brl(i.valorParcela) : ''}</td><td>${esc(i.cartao)}</td><td class="r">${i.dia}</td><td class="r">${i.diasAtePagar}</td><td>${esc(i.onde)}</td><td>${esc(i.motivo)}</td></tr>`).join('')}
    </table></div>
  </div>
  <div class="card secao"><h2>Parcelas já comprometidas por mês</h2><div class="tabela"><table>
    <tr>${proximosMeses(MES, 12).map(m => `<th class="r">${rotuloMes(m)}</th>`).join('')}</tr>
    <tr>${proximosMeses(MES, 12).map(m => `<td class="r">${brl(c.parcelas[m] || 0)}</td>`).join('')}</tr>
  </table></div><p class="nota">Cadastre novas compras em Menu Assessor &gt; Compras futuras.</p></div>`;
}

function telaParcelas(c) {
  const r = c.resumoParc;
  const meses = proximosMeses(MES, 12);
  const cartoes = Object.keys(r.porCartaoMes).sort();
  const totMes = m => arred2(cartoes.reduce((s, k) => s + (r.porCartaoMes[k][m] || 0), 0));
  const porCartao = {};
  r.compras.forEach(x => { porCartao[x.cartao] = porCartao[x.cartao] || { falta: 0, n: 0 }; if (x.restantes > 0) { porCartao[x.cartao].falta += x.valorRestante; porCartao[x.cartao].n++; } });
  return `<div class="grade">${Object.keys(porCartao).sort().map(k => `<div class="card"><h3>${esc(k)}</h3><div class="num">${brl(porCartao[k].falta)}</div><div class="nota">falta pagar em ${porCartao[k].n} compra(s) parcelada(s)</div></div>`).join('')}</div>
  <div class="card secao"><h2>Compras parceladas</h2><div class="tabela"><table>
    <tr><th>Cartão</th><th>Compra</th><th>Categoria</th><th>Data</th><th class="r">Parcelas</th><th class="r">Valor da parcela</th><th class="r">Pagas</th><th class="r">Faltam</th><th class="r">Falta pagar</th><th>Última fatura</th></tr>
    ${r.compras.map(x => `<tr><td><b>${esc(x.cartao)}</b></td><td>${esc(x.descricao)}</td><td>${esc(x.categoria)}${x.subcategoria ? ' / ' + esc(x.subcategoria) : ''}</td><td>${x.data ? dataBR(x.data) : ''}</td><td class="r">${x.totalParcelas}</td><td class="r">${brl(x.valorParcela)}</td><td class="r">${x.pagas}</td><td class="r">${x.restantes ? x.restantes : '<span class="pill ok">quitada</span>'}</td><td class="r">${brl(x.valorRestante)}</td><td>${x.ultimaFatura ? rotuloMes(x.ultimaFatura) : ''}</td></tr>`).join('') || '<tr><td colspan="10">Nenhuma compra parcelada</td></tr>'}
  </table></div></div>
  <div class="card secao"><h2>Parcelas por mês em cada cartão</h2><div class="tabela"><table>
    <tr><th>Cartão</th>${meses.map(m => `<th class="r">${rotuloMes(m)}</th>`).join('')}</tr>
    ${cartoes.map(k => `<tr><td><b>${esc(k)}</b></td>${meses.map(m => `<td class="r">${r.porCartaoMes[k][m] ? brl(r.porCartaoMes[k][m]) : ''}</td>`).join('')}</tr>`).join('')}
    <tr><th>Total</th>${meses.map(m => `<th class="r">${brl(totMes(m))}</th>`).join('')}</tr>
  </table></div><p class="nota">Teto de parcelas: ${brl(db.cfg.teto_parcelas)} por mês. Lance cada compra no cartão em que foi feita para essa conta fechar.</p></div>`;
}

function telaInvestimentos() {
  const soma = somaPercentuaisMetas(db.Metas_Investimento);
  return `<div class="dupla">
    <div class="card"><h2>Registrar aporte do mês</h2><div id="form-aporte"></div></div>
    <div>
      <div class="card"><h2>Metas de investimento <span class="pill ${soma === 100 ? 'ok' : 'erro'}">${soma}% do aporte</span></h2>
        ${db.Metas_Investimento.map(m => `<div style="margin:10px 0"><div class="linha" style="justify-content:space-between"><b>${esc(m['Meta'])}</b><span class="nota">${m['% do aporte']}% do aporte · prazo ${esc(mesDe(m['Prazo']) ? rotuloMes(mesDe(m['Prazo'])) : '—')}</span></div>
          <div class="nota">${brl(m['Acumulado'])} de ${brl(m['Valor alvo'])}</div><div class="barra"><div style="width:${Math.min(100, Number(m['Acumulado']) / Number(m['Valor alvo']) * 100)}%"></div></div></div>`).join('')}
      </div>
      <div class="card secao"><h2>Histórico de aportes</h2><div class="tabela"><table>
        <tr><th>Mês</th><th class="r">Aporte</th><th class="r">Reserva antes</th><th class="r">Para reserva</th><th class="r">Reserva depois</th><th class="r">Para metas</th></tr>
        ${db.Aporte_Reserva.map(a => `<tr><td>${rotuloMes(mesDe(a['Mês']))}</td><td class="r">${brl(a['Aporte'])}</td><td class="r">${brl(a['Reserva antes'])}</td><td class="r">${brl(a['Para reserva'])}</td><td class="r">${brl(a['Reserva depois'])}</td><td class="r">${brl(a['Para metas'])}</td></tr>`).join('')}
      </table></div><p class="nota">A reserva recebe ${db.cfg.pct_reserva}% do aporte até ${brl(db.cfg.meta_reserva)}. Depois congela e tudo vai para as metas.</p></div>
    </div>
  </div>`;
}

function telaImportacao() {
  const op = opcoes();
  const pend = db.Import_Staging.filter(l => l['Status'] === 'Pendente');
  const outros = db.Import_Staging.filter(l => l['Status'] !== 'Pendente');
  const sel = (cls, lista, v) => `<select class="${cls}"><option value="">—</option>${lista.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="card"><h2>Aprovar lançamentos importados</h2>
    <p class="nota">Na fase 3, o Claude lê o extrato ou a fatura (CSV, OFX ou PDF) e grava aqui. Duplicados são descartados sozinhos.</p>
    ${pend.length ? `<div class="tabela"><table id="tab-imp">
      <tr><th>Ação</th><th>Data</th><th>Descrição</th><th class="r">Valor</th><th>Tipo</th><th>Conta/Cartão</th><th>Categoria</th><th>Subcategoria</th><th>Centro de custo</th><th>Origem</th></tr>
      ${pend.map(p => `<tr data-id="${esc(p['ID'])}"><td><select class="acao"><option value="aprovar">Aprovar</option><option value="descartar">Descartar</option><option value="">Deixar</option></select></td><td>${dataBR(p['Data'])}</td><td>${esc(p['Descrição'])}</td><td class="r">${brl(p['Valor'])}</td><td>${esc(p['Tipo'])}</td><td>${esc(p['Conta/Cartão'])}</td><td>${sel('cat', op.categorias, p['Categoria'])}</td><td>${sel('sub', op.subcategoriasPor[p['Categoria']] || [], p['Subcategoria'])}</td><td>${sel('cc', op.centros, p['Centro de custo'])}</td><td class="nota">${esc(p['Origem'])}</td></tr>`).join('')}
    </table></div><div style="margin-top:10px"><button class="btn" id="processar">Processar</button></div>` : '<p>Nenhum lançamento aguardando aprovação.</p>'}
    <div id="msg-imp"></div>
  </div>
  ${outros.length ? `<div class="card secao"><h2>Já processados</h2><div class="tabela"><table><tr><th>Descrição</th><th class="r">Valor</th><th>Status</th><th>Observação</th></tr>
    ${outros.map(o => `<tr><td>${esc(o['Descrição'])}</td><td class="r">${brl(o['Valor'])}</td><td><span class="pill ${o['Status'] === 'Aprovado' ? 'ok' : o['Status'] === 'Duplicado' ? 'aviso' : 'erro'}">${o['Status']}</span></td><td class="nota">${esc(o['Observação'])}</td></tr>`).join('')}
  </table></div></div>` : ''}`;
}

function telaAlertas() {
  return `<div class="dupla">
    <div class="card"><h2>Alertas de orçamento enviados</h2><div class="tabela"><table>
      <tr><th>Mês</th><th>Categoria</th><th>Nível</th><th class="r">Realizado</th><th class="r">Meta</th></tr>
      ${db.Alertas.map(a => `<tr><td>${rotuloMes(a['Mês'])}</td><td>${esc(a['Categoria'])}</td><td><span class="pill ${a['Nível'] >= 100 ? 'erro' : 'aviso'}">${a['Nível']}%</span></td><td class="r">${brl(a['Realizado'])}</td><td class="r">${brl(a['Meta'])}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum</td></tr>'}
    </table></div><p class="nota">Cada nível (80% e 100%) vai uma vez por categoria e mês. Lance um gasto em Lazer ou Mercado para ver um novo alerta.</p></div>
    <div class="card"><h2>Caixa de saída (simulada)</h2>
      ${db.Emails.slice().reverse().map(e => `<div class="email"><div class="assunto">[Assessor] ${esc(e.assunto)}</div><div class="quando">para ${esc(db.cfg.email)} · ${esc(e.quando)}</div><div>${esc(e.corpo)}</div></div>`).join('')}
      <p class="nota">No sistema real: lembrete no dia 1 às 8h, alertas na hora do lançamento e na rotina diária, e o carteiro envia de hora em hora os relatórios que o Claude escrever.</p>
    </div>
  </div>`;
}

const FORMS_MENU = [['configuracoes', 'Cadastros'], ['cartoes', 'Cadastros'], ['contas', 'Cadastros'], ['centros', 'Cadastros'], ['lancamento', 'Movimento'], ['fixos', 'Movimento'], ['categorias', 'Planejamento'], ['compras', 'Planejamento'], ['aporte', 'Investimentos'], ['metas', 'Investimentos']];

function telaCadastros() {
  return `<div class="card"><h2>Menu Assessor</h2>
    <p class="nota">Os mesmos formulários do menu da planilha, com a mesma validação. A aprovação de importados está na aba Importação.</p>
    <div class="lista-forms">${FORMS_MENU.map(([id, grupo]) => `<button data-form="${id}" class="${id === formAtual ? 'ativo' : ''}">${grupo} › ${FORMULARIOS[id].titulo}</button>`).join('')}</div>
    <div class="dupla"><div id="form-cad"></div><div id="dados-cad"></div></div>
  </div>`;
}

// ------------------------------------------------------------ formulários genéricos
const ABA_DB = { Configuracoes: 'cfg' };

function montarForm(id, alvo, registro) {
  const def = FORMULARIOS[id];
  const op = opcoes();
  let valores = registro || null;
  if (def.modo === 'config') valores = Object.assign({}, db.cfg);
  let html = def.ajuda ? `<div class="ajuda">${esc(def.ajuda)}</div>` : '';
  if (def.modo === 'upsert') {
    html += `<label>Editar existente ou criar novo</label><select data-reg="${id}"><option value="">+ Novo</option>${db[def.aba].map((r, i) => `<option value="${i}" ${registro === r ? 'selected' : ''}>${esc(r[def.chave])}</option>`).join('')}</select>`;
  }
  def.campos.forEach(c => {
    let v = valores ? valores[c.nome] : (c.padrao !== undefined ? c.padrao : '');
    if (c.tipo === 'data' && !valores) v = diaChave(HOJE);
    if (c.tipo === 'mes') v = mesDe(v);
    const nome = esc(c.nome);
    if (c.tipo === 'simnao') { html += `<label class="check"><input type="checkbox" name="${nome}" ${ehSim(v) || v === true ? 'checked' : ''}> ${esc(c.rotulo || c.nome)}</label>`; return; }
    html += `<label>${esc(c.rotulo || c.nome)}${c.obrigatorio ? ' *' : ''}</label>`;
    if (c.tipo === 'lista') {
      const lista = c.dependeDe ? (op.subcategoriasPor[valores ? valores[c.dependeDe] : ''] || []) : (c.opcoes || op[c.fonte] || []);
      html += `<select name="${nome}"><option value="">—</option>${lista.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else {
      const tipo = { email: 'email', data: 'date', mes: 'month', inteiro: 'number', dia: 'number' }[c.tipo] || 'text';
      const mostrar = (typeof v === 'number' && (c.tipo === 'moeda' || c.tipo === 'moeda_sinal')) ? String(v).replace('.', ',') : (v === null || v === undefined ? '' : v);
      html += `<input type="${tipo}" name="${nome}" value="${esc(mostrar)}" ${c.tipo === 'moeda' || c.tipo === 'moeda_sinal' ? 'placeholder="0,00" inputmode="decimal"' : ''}>`;
    }
  });
  html += `<div style="margin-top:14px"><button class="btn" data-salvar="${id}">Salvar</button></div><div class="msg-form"></div>`;
  alvo.innerHTML = html;
  alvo.dataset.original = registro && def.chave ? registro[def.chave] : '';
  if (abaAtual === 'cadastros') mostrarDadosCad(id);
}

function mostrarDadosCad(id) {
  const def = FORMULARIOS[id];
  const el = document.getElementById('dados-cad');
  if (!el) return;
  if (def.modo === 'config' || def.modo === 'lancamento' || def.modo === 'aporte') {
    el.innerHTML = `<p class="nota">${def.modo === 'config' ? 'As configurações ficam na aba Configuracoes.' : 'Veja o resultado nas abas Lançamentos e Reserva e metas.'}</p>`;
    return;
  }
  const cab = ABAS[def.aba].cabecalho;
  el.innerHTML = `<div class="tabela"><table><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${db[def.aba].map(r => `<tr>${cab.map(c => `<td>${typeof r[c] === 'number' && /Valor|Saldo|Meta mensal|Limite|Acumulado/.test(c) ? brl(r[c]) : esc(r[c])}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

function coletar(alvo, def) {
  const dados = {};
  def.campos.forEach(c => {
    const i = alvo.querySelector(`[name="${CSS.escape(c.nome)}"]`);
    dados[c.nome] = c.tipo === 'simnao' ? i.checked : i.value;
  });
  return dados;
}

function salvar(id, alvo) {
  const def = FORMULARIOS[id];
  const v = validarCampos(def.campos, coletar(alvo, def), opcoes());
  let r = v.ok ? null : { ok: false, erros: v.erros };
  if (!r) {
    if (def.modo === 'config') { Object.assign(db.cfg, v.valores); r = { ok: true, mensagem: 'Configurações salvas.' }; }
    else if (def.modo === 'upsert') r = salvarUpsert(def, v.valores, alvo.dataset.original);
    else if (def.modo === 'lancamento') r = salvarLancamento(v.valores);
    else if (def.modo === 'aporte') r = salvarAporte(v.valores);
  }
  if (r.ok) { guardar(); render(); }
  const m = (document.querySelector(`[data-salvar="${id}"]`) || alvo).closest('div').parentElement.querySelector('.msg-form') || alvo.querySelector('.msg-form');
  if (m) m.innerHTML = `<div class="msg ${r.ok ? 'ok' : 'erro'}">${(r.ok ? [r.mensagem] : r.erros).map(esc).join('<br>')}</div>`;
}

function salvarUpsert(def, valores, original) {
  const regs = db[def.aba];
  const igual = (l, k) => normalizarTexto(l[def.chave]) === normalizarTexto(k);
  const existente = original ? regs.find(l => igual(l, original)) : null;
  if (regs.some(l => igual(l, valores[def.chave]) && l !== existente)) return { ok: false, erros: ['Já existe "' + valores[def.chave] + '". Escolha-o na lista para editar.'] };
  if (def.aba === 'Cartoes' && valores['Dia fechamento'] === valores['Dia vencimento']) return { ok: false, erros: ['Dia de fechamento e de vencimento não podem ser iguais.'] };
  if (def.aba === 'Fixos' && valores['Fim'] && valores['Fim'] < valores['Início']) return { ok: false, erros: ['O fim não pode ser antes do início.'] };
  if (def.aba === 'Metas_Investimento' && ehSim(valores['Ativa'])) {
    const soma = somaPercentuaisMetas(regs.filter(l => l !== existente)) + Number(valores['% do aporte']);
    if (soma > 100.001) return { ok: false, erros: ['Com esta meta, o % do aporte passaria de 100% (' + arred2(soma) + '%). Reduza outra meta antes.'] };
  }
  if (def.aba === 'Contas' || def.aba === 'Cartoes') {
    const outra = def.aba === 'Contas' ? db.Cartoes.map(c => c['Cartão']) : db.Contas.map(c => c['Conta']);
    if (outra.some(n => normalizarTexto(n) === normalizarTexto(valores[def.chave]))) return { ok: false, erros: ['Já existe ' + (def.aba === 'Contas' ? 'um cartão' : 'uma conta') + ' com esse nome.'] };
  }
  if (existente) { Object.assign(existente, valores); return { ok: true, mensagem: '"' + valores[def.chave] + '" atualizado.' }; }
  regs.push(Object.assign({}, valores));
  return { ok: true, mensagem: '"' + valores[def.chave] + '" cadastrado.' };
}

function salvarLancamento(v) {
  const e = erroRegraFatura(v['Descrição'], v['Tipo']);
  if (e) return { ok: false, erros: [e] };
  if (v['Tipo'] !== 'Transferência' && !v['Categoria']) return { ok: false, erros: ['Categoria é obrigatória para Entrada e Saída.'] };
  const cartao = db.Cartoes.find(c => c['Cartão'] === v['Conta/Cartão']);
  if (!cartao && Number(v['Parcelas']) > 1) return { ok: false, erros: ['Parcelamento só existe no cartão de crédito.'] };
  if (cartao && v['Tipo'] !== 'Saída') return { ok: false, erros: ['No cartão só entram compras (Saída). Pagamento da fatura é Transferência a partir da conta.'] };
  const antes = db.Lancamentos.length;
  lancar(db, v, 'L' + Date.now(), 'Manual');
  const n = db.Lancamentos.length - antes;
  const alertas = verificarAlertas();
  return { ok: true, mensagem: (n > 1 ? 'Compra lançada em ' + n + ' parcelas.' : 'Lançamento gravado.') + (alertas.length ? ' Alerta de orçamento enviado: ' + alertas.map(a => a.categoria + ' ' + a.nivel + '%').join(', ') + '.' : '') };
}

function salvarAporte(v) {
  if (db.Aporte_Reserva.some(l => mesDe(l['Mês']) === v['Mês'])) return { ok: false, erros: ['O aporte de ' + rotuloMes(v['Mês']) + ' já foi registrado.'] };
  const soma = somaPercentuaisMetas(db.Metas_Investimento);
  const d = distribuirAporte(v['Aporte'], v['Reserva antes'], Number(db.cfg.meta_reserva), Number(db.cfg.pct_reserva), db.Metas_Investimento);
  if (d.paraMetas > 0 && soma !== 100) return { ok: false, erros: ['As metas ativas somam ' + soma + '% do aporte. Ajuste para 100% antes.'] };
  db.Aporte_Reserva.push({ 'Mês': v['Mês'], 'Aporte': v['Aporte'], 'Reserva antes': v['Reserva antes'], 'Para reserva': d.paraReserva, 'Reserva depois': d.reservaDepois, 'Para metas': d.paraMetas, 'Registrado em': diaChave(HOJE) });
  db.Aporte_Reserva.sort((a, b) => mesDe(a['Mês']) < mesDe(b['Mês']) ? -1 : 1);
  d.porMeta.forEach(pm => { const m = db.Metas_Investimento.find(x => x['Meta'] === pm.meta); m['Acumulado'] = arred2((Number(m['Acumulado']) || 0) + pm.valor); });
  return { ok: true, mensagem: 'Aporte registrado. Reserva: ' + brl(d.paraReserva) + (d.congelada ? ' (congelada)' : '') + d.porMeta.map(pm => ' · ' + pm.meta + ': ' + brl(pm.valor)).join('') };
}

function processarImportacao() {
  const op = opcoes();
  const erros = [];
  let ap = 0, desc = 0, dup = 0;
  document.querySelectorAll('#tab-imp tr[data-id]').forEach(tr => {
    const l = db.Import_Staging.find(s => s['ID'] === tr.dataset.id);
    const acao = tr.querySelector('.acao').value;
    if (!acao) return;
    if (acao === 'descartar') { l['Status'] = 'Descartado'; desc++; return; }
    const obj = Object.assign({}, l, { 'Categoria': tr.querySelector('.cat').value, 'Subcategoria': tr.querySelector('.sub').value, 'Centro de custo': tr.querySelector('.cc').value });
    if (obj['Tipo'] !== 'Transferência' && op.categorias.indexOf(obj['Categoria']) < 0) { erros.push('"' + obj['Descrição'] + '": escolha uma categoria.'); return; }
    const ef = erroRegraFatura(obj['Descrição'], obj['Tipo']);
    if (ef) { erros.push('"' + obj['Descrição'] + '": ' + ef); return; }
    if (detectarDuplicados([obj], db.Lancamentos)[0]) { l['Status'] = 'Duplicado'; l['Observação'] = 'Já existe em Lançamentos'; dup++; return; }
    const cartao = db.Cartoes.find(c => c['Cartão'] === obj['Conta/Cartão']);
    db.Lancamentos.push({ 'ID': 'I' + obj['ID'], 'Data': obj['Data'], 'Descrição': obj['Descrição'], 'Valor': Number(obj['Valor']), 'Tipo': obj['Tipo'], 'Categoria': obj['Categoria'], 'Subcategoria': obj['Subcategoria'], 'Centro de custo': obj['Centro de custo'], 'Conta/Cartão': obj['Conta/Cartão'], 'Parcela': '', 'Mês fatura': cartao ? mesFaturaCartao(parseData(obj['Data']), cartao) : '', 'Origem': 'Importado: ' + obj['Origem'], 'Criado em': diaChave(HOJE) });
    l['Status'] = 'Aprovado'; ap++;
  });
  if (ap) verificarAlertas();
  guardar(); render();
  document.getElementById('msg-imp').innerHTML = `<div class="msg ${erros.length ? 'erro' : 'ok'}">${esc(ap + ' aprovados, ' + desc + ' descartados, ' + dup + ' duplicados ignorados.')}${erros.map(e => '<br>' + esc(e)).join('')}</div>`;
}

/** Ao abrir a aprovação, descarta duplicados como a planilha faz. */
function marcarDuplicados() {
  const pend = db.Import_Staging.filter(l => l['Status'] === 'Pendente');
  detectarDuplicados(pend, db.Lancamentos).forEach((d, i) => { if (d) { pend[i]['Status'] = 'Duplicado'; pend[i]['Observação'] = 'Duplicado descartado automaticamente'; } });
}

// ------------------------------------------------------------ cartões com cashback e carteira de investimentos
ABAS.Cartoes.cabecalho = ABAS.Cartoes.cabecalho.concat(['% cashback', 'Anuidade mensal']);
FORMULARIOS.cartoes.campos.splice(4, 0,
  { nome: '% cashback', tipo: 'percentual', rotulo: '% de cashback sobre as compras' },
  { nome: 'Anuidade mensal', tipo: 'moeda', rotulo: 'Anuidade por mês (R$)' });
const TIPOS_INVESTIMENTO = ['CDB/LCI/LCA', 'Tesouro Direto', 'Renda fixa (outros)', 'FII', 'Ações', 'Fundos', 'Previdência', 'Cripto', 'Outros'];
ABAS.Carteira = { tipo: 'dados', cabecalho: ['Ativo', 'Tipo', 'Instituição', 'Valor aplicado', 'Saldo atual', 'Rentabilidade % a.a.', 'Dividendos % a.a.', 'Meta', 'Ativa'] };
FORMULARIOS.carteira = {
  titulo: 'Carteira de investimentos', aba: 'Carteira', modo: 'upsert', chave: 'Ativo',
  ajuda: 'Rentabilidade: quanto o ativo rende por ano (ex.: CDB 100% do CDI ≈ 13). Dividendos: quanto paga em proventos por ano sobre o saldo (ex.: FII 11). Use só nomes, nunca número de conta.',
  campos: [
    { nome: 'Ativo', tipo: 'texto', obrigatorio: true },
    { nome: 'Tipo', tipo: 'lista', opcoes: TIPOS_INVESTIMENTO, obrigatorio: true },
    { nome: 'Instituição', tipo: 'texto' },
    { nome: 'Valor aplicado', tipo: 'moeda', obrigatorio: true },
    { nome: 'Saldo atual', tipo: 'moeda', obrigatorio: true },
    { nome: 'Rentabilidade % a.a.', tipo: 'percentual' },
    { nome: 'Dividendos % a.a.', tipo: 'percentual' },
    { nome: 'Meta', tipo: 'lista', fonte: 'metas', rotulo: 'Meta de investimento' },
    { nome: 'Ativa', tipo: 'simnao', padrao: 'Sim' }
  ]
};

/** Cashback de um mês por cartão: estimado pelas compras x % do cartão, recebido pelos lançamentos de Cashback. */
function cashbackMes(mes) {
  return db.Cartoes.map(c => {
    const compras = arred2(db.Lancamentos.filter(l => l['Tipo'] === 'Saída' && l['Conta/Cartão'] === c['Cartão'] && mesDe(l['Data']) === mes).reduce((s, l) => s + Number(l['Valor']), 0));
    const pct = Number(c['% cashback']) || 0;
    const estimado = arred2(compras * pct / 100);
    const recebido = arred2(db.Lancamentos.filter(l => l['Tipo'] === 'Entrada' && l['Categoria'] === 'Cashback' && mesDe(l['Data']) === mes &&
      normalizarTexto(l['Subcategoria'] || l['Descrição']).indexOf(normalizarTexto(c['Cartão'])) >= 0).reduce((s, l) => s + Number(l['Valor']), 0));
    const anuidade = Number(c['Anuidade mensal']) || 0;
    return { cartao: c['Cartão'], compras, pct, estimado, recebido, anuidade, liquido: arred2((recebido || estimado) - anuidade) };
  });
}

/** Rendimento mensal estimado de cada ativo (juros compostos) e dividendos mensais. */
function rendimentosCarteira() {
  return (db.Carteira || []).filter(a => ehSim(a['Ativa'])).map(a => {
    const saldo = Number(a['Saldo atual']) || 0, aplicado = Number(a['Valor aplicado']) || 0;
    const taxa = Number(a['Rentabilidade % a.a.']) || 0, dy = Number(a['Dividendos % a.a.']) || 0;
    return {
      ativo: a['Ativo'], tipo: a['Tipo'], inst: a['Instituição'] || '', meta: a['Meta'] || '', saldo, aplicado,
      ganho: arred2(saldo - aplicado), ganhoPct: aplicado ? (saldo - aplicado) / aplicado : 0,
      rendMes: arred2(saldo * (Math.pow(1 + taxa / 100, 1 / 12) - 1)), divMes: arred2(saldo * dy / 100 / 12),
      saldo12: arred2(saldo * Math.pow(1 + taxa / 100, 1))
    };
  });
}

function telaRendimentos() {
  const meses = proximosMeses(somarMeses(MES, -5), 6);
  const atual = cashbackMes(MES);
  const cart = rendimentosCarteira();
  const tot = k => arred2(cart.reduce((s, a) => s + a[k], 0));
  const recebidoRend = m => arred2(db.Lancamentos.filter(l => l['Tipo'] === 'Entrada' && l['Categoria'] === 'Rendimentos' && mesDe(l['Data']) === m).reduce((s, l) => s + Number(l['Valor']), 0));
  return `<div class="grade">
    ${cardNum('Cashback estimado em ' + rotuloMes(MES), arred2(atual.reduce((s, c) => s + c.estimado, 0)), 'Recebido: ' + brl(atual.reduce((s, c) => s + c.recebido, 0)))}
    ${cardNum('Carteira de investimentos', tot('saldo'), 'Aplicado ' + brl(tot('aplicado')) + ' · ganho ' + brl(tot('ganho')))}
    ${cardNum('Rendimento estimado por mês', tot('rendMes'), 'Pela rentabilidade anual de cada ativo')}
    ${cardNum('Dividendos estimados por mês', tot('divMes'), 'Por ano: ' + brl(tot('divMes') * 12))}
  </div>
  <div class="card secao"><h2>Cashback por cartão</h2><div class="tabela"><table>
    <tr><th>Cartão</th><th class="r">% cashback</th>${meses.map(m => `<th class="r">${rotuloMes(m)}<br><span class="nota">estimado / recebido</span></th>`).join('')}<th class="r">Anuidade/mês</th></tr>
    ${db.Cartoes.map(c => `<tr><td><b>${esc(c['Cartão'])}</b></td><td class="r">${Number(c['% cashback']) || 0}%</td>${meses.map(m => { const x = cashbackMes(m).find(y => y.cartao === c['Cartão']); return `<td class="r">${brl(x.estimado)}<br><span class="nota">${brl(x.recebido)}</span></td>`; }).join('')}<td class="r">${brl(c['Anuidade mensal'] || 0)}</td></tr>`).join('') || '<tr><td colspan="9">Cadastre os cartões na Planilha.</td></tr>'}
  </table></div><p class="nota">Estimado = compras do mês no cartão × % de cashback. Recebido = lançamentos de Entrada na categoria Cashback com o nome do cartão na subcategoria. Cadastre o % de cada cartão em Planilha &gt; Cartões.</p></div>
  <div class="card secao"><h2>Carteira de investimentos</h2><div class="tabela"><table>
    <tr><th>Ativo</th><th>Tipo</th><th>Instituição</th><th>Meta</th><th class="r">Aplicado</th><th class="r">Saldo</th><th class="r">Ganho</th><th class="r">Rendimento/mês</th><th class="r">Dividendos/mês</th><th class="r">Saldo em 12 meses</th></tr>
    ${cart.map(a => `<tr><td><b>${esc(a.ativo)}</b></td><td>${esc(a.tipo)}</td><td>${esc(a.inst)}</td><td>${esc(a.meta)}</td><td class="r">${brl(a.aplicado)}</td><td class="r">${brl(a.saldo)}</td><td class="r ${a.ganho < 0 ? 'neg' : 'pos'}">${brl(a.ganho)} (${pct(a.ganhoPct)})</td><td class="r">${brl(a.rendMes)}</td><td class="r">${brl(a.divMes)}</td><td class="r">${brl(a.saldo12)}</td></tr>`).join('') || '<tr><td colspan="10">Cadastre seus investimentos em Planilha &gt; Investimentos.</td></tr>'}
    ${cart.length ? `<tr><th colspan="4">Total</th><th class="r">${brl(tot('aplicado'))}</th><th class="r">${brl(tot('saldo'))}</th><th class="r">${brl(tot('ganho'))}</th><th class="r">${brl(tot('rendMes'))}</th><th class="r">${brl(tot('divMes'))}</th><th class="r">${brl(tot('saldo12'))}</th></tr>` : ''}
  </table></div>
  <h2 class="secao">Rendimentos recebidos (lançamentos)</h2><div class="tabela"><table><tr>${meses.map(m => `<th class="r">${rotuloMes(m)}</th>`).join('')}</tr><tr>${meses.map(m => `<td class="r">${brl(recebidoRend(m))}</td>`).join('')}</tr></table></div>
  <p class="nota">Estimativas simples: rendimento pela taxa anual composta, dividendos pela taxa anual sobre o saldo atual. Lance o que cair na conta como Entrada > Rendimentos para comparar.</p></div>`;
}

// ------------------------------------------------------------ planilha editável
const PLANILHAS = [
  { aba: 'Lancamentos', titulo: 'Lançamentos', form: 'lancamento', extras: ['Parcela', 'Mês fatura'] },
  { aba: 'Cartoes', titulo: 'Cartões', form: 'cartoes' },
  { aba: 'Contas', titulo: 'Contas', form: 'contas' },
  { aba: 'Centros_Custo', titulo: 'Centros de custo', form: 'centros' },
  { aba: 'Categorias', titulo: 'Categorias', form: 'categorias' },
  { aba: 'Fixos', titulo: 'Fixos e dívidas', form: 'fixos' },
  { aba: 'Compras_Futuras', titulo: 'Compras futuras', form: 'compras' },
  { aba: 'Carteira', titulo: 'Investimentos', form: 'carteira' },
  { aba: 'Metas_Investimento', titulo: 'Metas', form: 'metas' },
  { aba: 'Aporte_Reserva', titulo: 'Aportes', form: 'aporte', extras: ['Para reserva', 'Reserva depois', 'Para metas'] },
  { aba: 'Configuracoes', titulo: 'Configurações', form: 'configuracoes' }
];
let planAtual = 'Lancamentos';
let planMes = MES;
let planMsg = null;

function camposPlan(p, nova) {
  const campos = FORMULARIOS[p.form].campos;
  // parcelas só na linha nova de lançamento: uma compra parcelada vira várias linhas
  return p.aba === 'Lancamentos' && !nova ? campos.filter(c => c.nome !== 'Parcelas') : campos;
}

function valorCelula(c, v) {
  if (v === null || v === undefined) return '';
  if (c.tipo === 'data') { const d = parseData(v); return d ? diaChave(d) : ''; }
  if (c.tipo === 'mes') return mesDe(v);
  if ((c.tipo === 'moeda' || c.tipo === 'moeda_sinal') && typeof v === 'number') return String(v).replace('.', ',');
  return String(v);
}

function celula(c, v, linha, op, registro) {
  const a = `data-col="${esc(c.nome)}" data-lin="${linha}" title="${esc(c.rotulo || c.nome)}"`;
  if (c.tipo === 'simnao') return `<input type="checkbox" ${a} ${ehSim(v) || v === true ? 'checked' : ''}>`;
  if (c.tipo === 'lista') {
    const lista = c.dependeDe ? (op.subcategoriasPor[registro ? registro[c.dependeDe] : ''] || []) : (c.opcoes || op[c.fonte] || []);
    const extra = v && lista.indexOf(v) < 0 ? [v] : [];
    return `<select ${a}><option value="">—</option>${lista.concat(extra).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  const tipo = { email: 'email', data: 'date', mes: 'month', inteiro: 'number', dia: 'number' }[c.tipo] || 'text';
  const largo = c.tipo === 'texto' || c.tipo === 'email' ? ' class="largo"' : '';
  return `<input type="${tipo}" ${a}${largo} value="${esc(valorCelula(c, v))}"${c.tipo === 'moeda' || c.tipo === 'moeda_sinal' ? ' inputmode="decimal" placeholder="0,00"' : ''}>`;
}

function linhasPlan(p) {
  const regs = db[p.aba].map((r, i) => ({ r, i }));
  if (p.aba !== 'Lancamentos') return regs;
  return regs.filter(x => planMes === 'todos' || mesDe(x.r['Data']) === planMes)
    .sort((a, b) => (a.r['Data'] < b.r['Data'] ? 1 : a.r['Data'] > b.r['Data'] ? -1 : b.i - a.i));
}

function telaPlanilha() {
  const p = PLANILHAS.find(x => x.aba === planAtual);
  const op = opcoes();
  const topo = subabasCadastro();
  const acoes = '';
  const msg = planMsg ? `<div class="msg ${planMsg.ok ? 'ok' : 'erro'}">${planMsg.texto.map(esc).join('<br>')}</div>` : '';
  planMsg = null;
  if (p.aba === 'Configuracoes') {
    const def = FORMULARIOS.configuracoes;
    return `<div class="card">${topo}${acoes}${msg}<div class="tabela"><table class="grade-plan"><tr><th>Configuração</th><th>Valor</th></tr>
      ${def.campos.map(c => `<tr data-linha="cfg"><td>${esc(c.rotulo || c.nome)}</td><td>${celula(c, db.cfg[c.nome], 'cfg', op, db.cfg)}</td></tr>`).join('')}
    </table></div><p class="nota">As alterações são salvas assim que você sai do campo.</p></div>`;
  }
  const campos = camposPlan(p, false);
  const camposNova = camposPlan(p, true);
  const extras = p.extras || [];
  const filtro = p.aba === 'Lancamentos' ? (() => {
    const meses = [...new Set(db.Lancamentos.map(l => mesDe(l['Data'])).filter(Boolean).concat([MES]))].sort().reverse();
    return `<div style="max-width:220px;margin-bottom:8px"><label>Mês</label><select id="plan-mes"><option value="todos" ${planMes === 'todos' ? 'selected' : ''}>Todos</option>${meses.map(m => `<option value="${m}" ${m === planMes ? 'selected' : ''}>${rotuloMes(m)}</option>`).join('')}</select></div>`;
  })() : '';
  const nova = {};
  camposNova.forEach(c => { if (c.padrao !== undefined) nova[c.nome] = c.padrao; if (c.tipo === 'data') nova[c.nome] = diaChave(HOJE); if (c.tipo === 'mes' && p.aba === 'Aporte_Reserva') nova[c.nome] = MES; });
  const linhas = linhasPlan(p);
  const ajuda = FORMULARIOS[p.form].ajuda ? `<div class="ajuda">${esc(FORMULARIOS[p.form].ajuda)}</div>` : '';
  return `<div class="card">${topo}${acoes}${msg}${ajuda}${filtro}
    <div class="tabela"><table class="grade-plan">
      <tr><th></th>${camposNova.map(c => `<th>${esc(c.nome)}${c.obrigatorio ? ' *' : ''}</th>`).join('')}${extras.map(x => `<th>${esc(x)}</th>`).join('')}</tr>
      <tr class="nova" data-linha="nova"><td><button class="btn" data-add="1" title="Adicionar linha">+</button></td>${camposNova.map(c => `<td>${celula(c, nova[c.nome], 'nova', op, nova)}</td>`).join('')}${extras.map(() => '<td></td>').join('')}</tr>
      ${linhas.map(({ r, i }) => `<tr data-linha="${i}"><td><button class="btn sec" data-del="${i}" title="Excluir linha">×</button>${btnAnexo(p.aba, i, r)}</td>${camposNova.map(c => `<td>${campos.indexOf(c) >= 0 ? celula(c, r[c.nome], i, op, r) : ''}</td>`).join('')}${extras.map(x => `<td class="calc">${/Para|Reserva/.test(x) ? brl(r[x]) : (x === 'Mês fatura' && r[x] ? rotuloMes(mesDe(r[x])) : esc(r[x]))}</td>`).join('')}</tr>`).join('')}
    </table></div>
    <p class="nota">${linhas.length} linha(s). Preencha a primeira linha e clique em + para adicionar. Nas outras, a alteração é salva quando você sai do campo; se algo estiver errado, o campo fica vermelho e nada é gravado.</p>
  </div>`;
}

function lerLinha(tr, campos) {
  const dados = {};
  campos.forEach(c => {
    const i = tr.querySelector(`[data-col="${CSS.escape(c.nome)}"]`);
    if (i) dados[c.nome] = c.tipo === 'simnao' ? i.checked : i.value;
  });
  return dados;
}

function normalizarDatas(v) {
  Object.keys(v).forEach(k => { if (v[k] && typeof v[k] === 'object' && typeof v[k].getFullYear === 'function') v[k] = diaChave(v[k]); });
  return v;
}

/** Aplica a edição de uma linha existente, com as mesmas regras dos formulários. */
function editarLinha(p, idx, dados) {
  const def = FORMULARIOS[p.form];
  const campos = camposPlan(p, false);
  const v = validarCampos(campos, dados, opcoes());
  if (!v.ok) return { ok: false, erros: v.erros };
  const reg = db[p.aba][idx];
  if (def.modo === 'upsert') {
    const r = salvarUpsert(def, v.valores, reg[def.chave]);
    return r;
  }
  if (p.aba === 'Lancamentos') {
    const val = normalizarDatas(v.valores);
    const e = erroRegraFatura(val['Descrição'], val['Tipo']);
    if (e) return { ok: false, erros: [e] };
    if (val['Tipo'] !== 'Transferência' && !val['Categoria']) return { ok: false, erros: ['Categoria é obrigatória para Entrada e Saída.'] };
    const cartao = db.Cartoes.find(c => c['Cartão'] === val['Conta/Cartão']);
    if (cartao && val['Tipo'] !== 'Saída') return { ok: false, erros: ['No cartão só entram compras (Saída).'] };
    Object.assign(reg, val);
    if (!reg['Parcela']) reg['Mês fatura'] = cartao ? mesFaturaCartao(parseData(reg['Data']), cartao) : '';
    else if (!cartao) reg['Mês fatura'] = '';
    verificarAlertas();
    return { ok: true, mensagem: 'Lançamento atualizado.' };
  }
  if (p.aba === 'Aporte_Reserva') {
    if (db.Aporte_Reserva.some((l, j) => j !== idx && mesDe(l['Mês']) === v.valores['Mês'])) return { ok: false, erros: ['Já existe aporte em ' + rotuloMes(v.valores['Mês']) + '.'] };
    const d = distribuirAporte(v.valores['Aporte'], v.valores['Reserva antes'], Number(db.cfg.meta_reserva), Number(db.cfg.pct_reserva), db.Metas_Investimento);
    Object.assign(reg, v.valores, { 'Para reserva': d.paraReserva, 'Reserva depois': d.reservaDepois, 'Para metas': d.paraMetas });
    return { ok: true, mensagem: 'Aporte atualizado (o acumulado das metas não muda ao editar).' };
  }
  return { ok: false, erros: ['Não editável.'] };
}

function adicionarLinha(p, dados) {
  const def = FORMULARIOS[p.form];
  const v = validarCampos(camposPlan(p, true), dados, opcoes());
  if (!v.ok) return { ok: false, erros: v.erros };
  if (def.modo === 'upsert') return salvarUpsert(def, v.valores, '');
  if (p.aba === 'Lancamentos') return salvarLancamento(v.valores);
  if (p.aba === 'Aporte_Reserva') return salvarAporte(v.valores);
  return { ok: false, erros: ['Não suportado.'] };
}

function baixar(nome, conteudo, tipo) {
  if (window.claude) { window.claude.use('downloads').then(d => d ? d.save({ filename: nome, data: new Blob([conteudo], { type: tipo }) }) : avisoRapido('Baixar arquivos não está disponível aqui.')).catch(() => {}); return; }
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

function csvAba(p) {
  const q = v => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  if (p.aba === 'Configuracoes') return ['Chave;Valor'].concat(Object.keys(db.cfg).map(k => q(k) + ';' + q(db.cfg[k]))).join('\n');
  const cab = ABAS[p.aba].cabecalho;
  return [cab.map(q).join(';')].concat(db[p.aba].map(r => cab.map(c => q(typeof r[c] === 'number' ? String(r[c]).replace('.', ',') : r[c])).join(';'))).join('\n');
}

/** Começa uma base só com o que é seu: categorias, fixos, dívidas e lista de compras, sem os dados de exemplo. */
function meusDados() {
  db = {
    cfg: { email: '', nome: '', teto_parcelas: 1500, max_parcelas: 10, meta_reserva: 10000, pct_reserva: 50, aporte_mensal: 0, alerta_pct1: 80, alerta_pct2: 100 },
    Cartoes: [], Contas: [], Centros_Custo: CENTROS_PADRAO.map(c => ({ 'Centro de custo': c[0], 'Descrição': c[1], 'Ativo': 'Sim' })),
    Categorias: CATEGORIAS_PADRAO.map(c => ({ 'Categoria': c[0], 'Tipo': c[1], 'Subcategorias': c[2], 'Meta mensal': '', 'Centro de custo': '', 'Ativa': 'Sim' })),
    Lancamentos: [],
    Fixos: FIXOS_PADRAO.map(f => ({ 'Descrição': f[0], 'Tipo': f[1], 'Valor': f[2], 'Categoria': f[3], 'Subcategoria': f[4], 'Centro de custo': '', 'Conta/Cartão': '', 'Dia': 10, 'Início': MES, 'Fim': f[5] ? somarMeses(MES, f[5] - 1) : '', 'Ativo': 'Sim' })),
    Compras_Futuras: COMPRAS_PADRAO.map(c => ({ 'Item': c[0], 'Valor estimado': c[1], 'Prioridade': c[2], 'Frequência': c[3], 'Mês desejado': '', 'Parcelas máx': '', 'Categoria': c[4], 'Subcategoria': c[5], 'Onde comprar': '', 'Status': 'Planejada', 'Observação': '' })),
    Aporte_Reserva: [], Metas_Investimento: [], Import_Staging: [], Alertas: [], Emails: [], Carteira: []
  };
  guardar();
}

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || abaAtual !== 'cadastro') return;
  const p = PLANILHAS.find(x => x.aba === planAtual);
  if (t.dataset.plan) { planAtual = t.dataset.plan; render(); }
  else if (t.dataset.add) {
    const r = adicionarLinha(p, lerLinha(t.closest('tr'), camposPlan(p, true)));
    if (r.ok) { guardar(); planMsg = { ok: true, texto: [r.mensagem] }; render(); }
    else { const m = document.createElement('div'); m.className = 'msg erro'; m.innerHTML = r.erros.map(esc).join('<br>'); document.querySelector('.grade-plan').before(m); setTimeout(() => m.remove(), 6000); }
  }
  else if (t.dataset.del) {
    const i = Number(t.dataset.del);
    const reg = db[p.aba][i];
    const nome = reg['Descrição'] || reg['Ativo'] || reg['Item'] || reg['Cartão'] || reg['Conta'] || reg['Categoria'] || reg['Meta'] || reg['Centro de custo'] || reg['Mês'] || 'linha';
    if (!confirmar('Excluir "' + nome + '"?')) return;
    db[p.aba].splice(i, 1);
    guardar(); planMsg = { ok: true, texto: ['"' + nome + '" excluído.'] }; render();
  }
  else if (t.id === 'exp-json') baixar('assessor-financeiro-backup-' + diaChave(HOJE) + '.json', JSON.stringify(db, null, 1), 'application/json');
  else if (t.id === 'exp-csv') baixar(planAtual.toLowerCase() + '.csv', '﻿' + csvAba(p), 'text/csv;charset=utf-8');
  else if (t.id === 'meus-dados') {
    if (!confirmar('Apagar os dados de exemplo e começar só com as suas categorias, fixos, dívidas e lista de compras? Baixe um backup antes se quiser guardar algo.')) return;
    meusDados(); planAtual = 'Cartoes'; planMsg = { ok: true, texto: ['Pronto: base limpa. Comece cadastrando cartões e contas.'] }; render();
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (abaAtual !== 'cadastro') return;
  if (t.id === 'plan-mes') { planMes = t.value; render(); return; }
  if (t.id === 'imp-json') {
    const arq = t.files[0];
    if (!arq) return;
    arq.text().then(txt => {
      try {
        const novo = JSON.parse(txt);
        if (!novo || !Array.isArray(novo.Lancamentos) || !novo.cfg) throw new Error('arquivo não é um backup do Assessor');
        db = novo; guardar(); planMsg = { ok: true, texto: ['Backup restaurado.'] };
      } catch (x) { planMsg = { ok: false, texto: ['Não deu para restaurar: ' + x.message] }; }
      render();
    });
    return;
  }
  const tr = t.closest('tr[data-linha]');
  if (!tr || !t.dataset.col) return;
  const p = PLANILHAS.find(x => x.aba === planAtual);
  const op = opcoes();
  // subcategoria acompanha a categoria
  if (t.dataset.col === 'Categoria') {
    const sub = tr.querySelector('[data-col="Subcategoria"]');
    if (sub) sub.innerHTML = '<option value="">—</option>' + (op.subcategoriasPor[t.value] || []).map(o => `<option>${esc(o)}</option>`).join('');
  }
  if (tr.dataset.linha === 'nova') return;
  let r;
  if (tr.dataset.linha === 'cfg') {
    const c = FORMULARIOS.configuracoes.campos.find(x => x.nome === t.dataset.col);
    const v = validarCampos([c], { [c.nome]: c.tipo === 'simnao' ? t.checked : t.value }, op);
    r = v.ok ? (db.cfg[c.nome] = v.valores[c.nome], { ok: true }) : { ok: false, erros: v.erros };
  } else {
    r = editarLinha(p, Number(tr.dataset.linha), lerLinha(tr, camposPlan(p, false)));
  }
  tr.querySelectorAll('.invalido').forEach(x => x.classList.remove('invalido'));
  if (!r.ok) {
    t.classList.add('invalido');
    t.title = r.erros.join(' ');
    let m = tr.nextElementSibling && tr.nextElementSibling.classList.contains('erro-linha') ? tr.nextElementSibling : null;
    if (!m) { m = document.createElement('tr'); m.className = 'erro-linha'; tr.after(m); }
    m.innerHTML = `<td colspan="40"><div class="msg erro">${r.erros.map(esc).join('<br>')}</div></td>`;
    return;
  }
  guardar();
  if (tr.nextElementSibling && tr.nextElementSibling.classList.contains('erro-linha')) tr.nextElementSibling.remove();
  t.classList.add('salvo');
  setTimeout(() => t.classList.remove('salvo'), 900);
  // atualiza só as colunas calculadas desta linha, sem perder o foco
  if (p && p.extras && tr.dataset.linha !== 'cfg') {
    const reg = db[p.aba][Number(tr.dataset.linha)];
    const tds = tr.querySelectorAll('td.calc');
    p.extras.forEach((x, k) => { if (tds[k]) tds[k].textContent = /Para|Reserva/.test(x) ? brl(reg[x]) : (x === 'Mês fatura' && reg[x] ? rotuloMes(mesDe(reg[x])) : (reg[x] || '')); });
  }
});


// ------------------------------------------------------------ eventos
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.aba) { abaAtual = t.dataset.aba; if (abaAtual === 'importacao') { marcarDuplicados(); guardar(); } render(); window.scrollTo(0, 0); }
  else if (t.dataset.form) { formAtual = t.dataset.form; render(); }
  else if (t.dataset.salvar) { e.preventDefault(); salvar(t.dataset.salvar, t.closest('#form-lanc, #form-aporte, #form-cad')); }
  else if (t.id === 'processar') processarImportacao();
  else if (t.id === 'resetar') { if (!confirmar('Apagar tudo e voltar aos dados de exemplo? Baixe um backup antes.')) return; try { localStorage.removeItem(CHAVE_LS); } catch (x) {} semear(); render(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-ano') { filtroAno = Number(t.value); render(); }
  else if (t.id === 'f-centro') { filtroCentro = t.value; render(); }
  else if (t.name === 'Categoria' && t.closest('#form-lanc, #form-aporte, #form-cad')) {
    const sub = t.closest('#form-lanc, #form-aporte, #form-cad').querySelector('[name="Subcategoria"]');
    if (sub) sub.innerHTML = '<option value="">—</option>' + (opcoes().subcategoriasPor[t.value] || []).map(o => `<option>${esc(o)}</option>`).join('');
  }
  else if (t.classList.contains('cat') && t.closest('#tab-imp')) {
    const sub = t.closest('tr').querySelector('.sub');
    sub.innerHTML = '<option value="">—</option>' + (opcoes().subcategoriasPor[t.value] || []).map(o => `<option>${esc(o)}</option>`).join('');
  }
  else if (t.dataset.reg) {
    const def = FORMULARIOS[t.dataset.reg];
    montarForm(t.dataset.reg, t.closest('#form-cad'), t.value === '' ? null : db[def.aba][Number(t.value)]);
  }
});

