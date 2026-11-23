// Simulação ponta a ponta com uma planilha falsa em memória.
// Rodar: node test/simulacao.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

/* ---------------- Mock mínimo do Google Sheets ---------------- */
function colToNum(s) { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function a1(s) { const m = s.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/); const r = +m[2], c = colToNum(m[1]);
  return m[3] ? [r, c, +m[4] - r + 1, colToNum(m[3]) - c + 1] : [r, c, 1, 1]; }

class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  cell(i, j) { const row = this.sh.data[this.r - 1 + i] || []; const v = row[this.c - 1 + j]; return v === undefined ? '' : v; }
  getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.cell(i, j))); }
  getValue() { return this.cell(0, 0); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
  setValue(x) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, x); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, ''); return this; }
}
['setNumberFormat', 'setFontWeight', 'setBackground', 'setNote', 'clearNote', 'setDataValidation', 'insertCheckboxes', 'setFontColor']
  .forEach(m => { Range.prototype[m] = function () { return this; }; });

class Sheet {
  constructor(name) { this.name = name; this.data = []; this.hidden = false; this.prot = []; }
  put(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getName() { return this.name; }
  getLastRow() { for (let i = this.data.length; i > 0; i--) if (this.data[i - 1].some(x => x !== '')) return i; return 0; }
  getLastColumn() { return Math.max(0, ...this.data.map(r => { for (let j = r.length; j > 0; j--) if (r[j - 1] !== '') return j; return 0; })); }
  getMaxRows() { return 1000; } getMaxColumns() { return 30; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(a, b, c, d) { return typeof a === 'string' ? new Range(this, ...a1(a)) : new Range(this, a, b, c || 1, d || 1); }
  appendRow(v) { this.data.splice(this.getLastRow(), 0, v.slice()); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  clear() { this.data = []; }
  setFrozenRows() {} setFrozenColumns() {} clearConditionalFormatRules() {} setConditionalFormatRules() {} autoResizeColumn() {}
  hideSheet() { this.hidden = true; }
  getProtections() { return this.prot; }
  protect() { const p = { setDescription() { return p; }, setWarningOnly() { return p; } }; this.prot.push(p); return p; }
}

const sheets = [new Sheet('Página1')];
const emails = [];
const SS = {
  getSheetByName: n => sheets.find(s => s.name === n) || null,
  insertSheet: (n) => { const s = new Sheet(n); sheets.push(s); return s; },
  getSheets: () => sheets, deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
  getUrl: () => 'https://docs.google.com/spreadsheets/d/TESTE', toast() {}, setSpreadsheetTimeZone() {}
};
const chain = () => new Proxy({}, { get: (t, k) => (k === 'build' ? () => ({}) : () => chain()) });
const HOJE = new Date(2026, 10, 23); // 23/11/2026

const ctx = {
  console, Math, JSON, Date: class extends Date { constructor(...a) { a.length ? super(...a) : super(HOJE.getTime()); } },
  SpreadsheetApp: { getActiveSpreadsheet: () => SS, getUi: () => ({ alert: m => { ctx.__alert = m; } }),
    newDataValidation: chain, newConditionalFormatRule: chain, ProtectionType: { SHEET: 'SHEET' } },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => chain() },
  MailApp: { sendEmail: o => emails.push(o) },
  Utilities: {
    formatDate: (d, tz, f) => { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      return { 'yyyy-MM': `${y}-${m}`, 'yyyy-MM-dd': `${y}-${m}-${dd}`, 'yyyy': String(y), 'd': String(d.getDate()) }[f]; },
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }
  }
};
vm.createContext(ctx);
const src = path.join(__dirname, '..', 'src');
fs.readdirSync(src).filter(f => f.endsWith('.gs')).sort().forEach(f => vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f }));
const run = code => vm.runInContext(code, ctx);
const tabela = n => run(`lerTabela_('${n}')`);

let ok = 0;
function caso(nome, fn) {
  try { fn(); ok++; console.log('ok  ' + nome); }
  catch (e) { console.log('FALHOU  ' + nome + '\n   ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n   ')); process.exitCode = 1; }
}
const salvar = (id, dados) => { ctx.__d = dados; return run(`salvarFormulario('${id}', __d)`); };
const falha = (id, dados, trecho) => { assert.throws(() => salvar(id, dados), e => e.message.includes(trecho), 'esperava erro: ' + trecho); };

/* ---------------- Cenário ---------------- */
caso('Instalação cria 19 abas, semeia e apaga a aba vazia', () => {
  run('instalarSistema()');
  assert.strictEqual(sheets.length, 19);
  assert.ok(!SS.getSheetByName('Página1'));
  assert.ok(SS.getSheetByName('Log').hidden && SS.getSheetByName('Relatorios').hidden);
  assert.strictEqual(tabela('Lojas').length, 6);
  assert.strictEqual(run(`cfg_('email_destino')`), 'laura@axmarketing.com.br');
  assert.ok(tabela('Metas').some(m => m['Meta'] === 'Reserva de emergência'));
});

caso('Reinstalar não duplica nada', () => {
  run('instalarSistema()');
  assert.strictEqual(sheets.length, 19);
  assert.strictEqual(tabela('Lojas').length, 6);
  assert.strictEqual(tabela('Metas').length, 1);
});

caso('Formulário de cartão grava e recusa número de cartão', () => {
  salvar('cartoes', { 'Apelido': 'C6 Black', 'Dia de fechamento': '25', 'Dia de vencimento': '5', 'Retorno (%)': '1,5', 'Tipo de retorno': 'Pontos', 'Anuidade (R$/ano)': '0', 'Ativo': true });
  salvar('cartoes', { 'Apelido': 'Nubank', 'Dia de fechamento': '3', 'Dia de vencimento': '10', 'Retorno (%)': '1', 'Tipo de retorno': 'Cashback', 'Anuidade (R$/ano)': '', 'Ativo': true });
  falha('cartoes', { 'Apelido': 'Visa 4111 1111 1111 1111', 'Dia de fechamento': '1', 'Dia de vencimento': '8', 'Ativo': true }, 'número de cartão');
  falha('cartoes', { 'Apelido': 'X', 'Dia de fechamento': '40', 'Dia de vencimento': '8', 'Ativo': true }, 'no máximo 31');
  const c6 = tabela('Cartoes').find(c => c['Apelido'] === 'C6 Black');
  assert.strictEqual(c6['Retorno (%)'], 0.015);
});

caso('Aporte e reserva: 50% para a reserva, metas dividem o resto', () => {
  salvar('reserva', { aporte_mensal: '2000', reserva_saldo: '3000', reserva_meta: '10000', reserva_pct: '50' });
  salvar('metas', { 'Meta': 'Casa própria', 'Horizonte': 'Longo', 'Valor-alvo (R$)': '200000', '% do aporte': '70', 'Status': 'Ativa', 'Instrumento': 'Consórcio' });
  salvar('metas', { 'Meta': 'Viagem', 'Horizonte': 'Curto', 'Valor-alvo (R$)': '15000', '% do aporte': '30', 'Status': 'Ativa' });
  falha('metas', { 'Meta': 'Carro', 'Horizonte': 'Médio', 'Valor-alvo (R$)': '50000', '% do aporte': '10', 'Status': 'Ativa' }, '110%');
  falha('metas', { 'Meta': 'Reserva de emergência', 'Horizonte': 'Curto', 'Valor-alvo (R$)': '10000', '% do aporte': '20', 'Status': 'Ativa' }, 'Deixe % do aporte vazio');
  const m = tabela('Metas');
  assert.strictEqual(m.find(x => x['Meta'] === 'Reserva de emergência')['Aporte mensal (R$)'], 1000);
  assert.strictEqual(m.find(x => x['Meta'] === 'Casa própria')['Aporte mensal (R$)'], 700);
  assert.strictEqual(m.find(x => x['Meta'] === 'Viagem')['Aporte mensal (R$)'], 300);
});

caso('Reserva cheia congela e redistribui', () => {
  salvar('reserva', { aporte_mensal: '2000', reserva_saldo: '10000', reserva_meta: '10000', reserva_pct: '50' });
  const m = tabela('Metas');
  const r = m.find(x => x['Meta'] === 'Reserva de emergência');
  assert.strictEqual(r['Status'], 'Congelada');
  assert.strictEqual(r['Aporte mensal (R$)'], 0);
  assert.strictEqual(m.find(x => x['Meta'] === 'Casa própria')['Aporte mensal (R$)'], 1400);
  salvar('reserva', { aporte_mensal: '2000', reserva_saldo: '3000', reserva_meta: '10000', reserva_pct: '50' });
});

caso('Fixos, categorias com meta e lançamentos', () => {
  salvar('fixos', { 'Descrição': 'Salário', 'Tipo': 'Entrada', 'Valor': '11000', 'Dia': '5', 'Categoria': 'Salário', 'Centro de custo': 'Pessoal' });
  salvar('fixos', { 'Descrição': 'Aluguel', 'Tipo': 'Saída', 'Valor': '3800', 'Dia': '5', 'Categoria': 'Casa', 'Centro de custo': 'Pessoal' });
  salvar('categorias', { 'Categoria': 'Transporte', 'Grupo': 'Transporte', 'Centro de custo': 'Pessoal', 'Tipo': 'Saída', 'Meta mensal (R$)': '500' });
  salvar('lancamento', { 'Data': '2026-11-10', 'Descrição': 'Uber', 'Valor': '410', 'Tipo': 'Saída', 'Categoria': 'Transporte', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'Nubank', 'Parcela': '', 'Titular': 'Laura' });
  falha('lancamento', { 'Data': '2026-11-10', 'Descrição': 'uber', 'Valor': '410', 'Tipo': 'Saída', 'Categoria': 'Transporte', 'Centro de custo': 'Pessoal' }, 'Já existe');
  falha('lancamento', { 'Data': '2026-11-10', 'Descrição': 'X', 'Valor': '10', 'Tipo': 'Saída', 'Categoria': 'Inventada', 'Centro de custo': 'Pessoal' }, 'opção inválida');
  salvar('lancamento', { 'Data': '2026-11-12', 'Descrição': 'Fatura Nubank', 'Valor': '5000', 'Tipo': 'Transferência', 'Categoria': 'Pagamento de fatura', 'Centro de custo': 'Pessoal' });
  salvar('lancamento', { 'Data': '2026-11-15', 'Descrição': 'Geladeira', 'Valor': '200', 'Tipo': 'Saída', 'Categoria': 'Casa', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'C6 Black', 'Parcela': '1/5' });
  const l = tabela('Lancamentos');
  assert.strictEqual(l.length, 3);
  assert.strictEqual(l[0]['Competência'], '2026-11');
});

caso('Parcelas: 1/5 em nov gera 4 parcelas futuras de R$200', () => {
  const p = tabela('Parcelas_Cartao');
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0]['Competência da última'], '2027-03');
  const proj = tabela('Projecao_Caixa');
  assert.strictEqual(proj.length, 12);
  assert.strictEqual(proj[0]['Mês'], 'Nov/2026');
  assert.strictEqual(proj[1]['Parcelas já assumidas'], 200);
  assert.strictEqual(proj[5]['Parcelas já assumidas'], 0);
});

caso('Orçamento ignora Transferência (fatura não conta em dobro)', () => {
  const sh = SS.getSheetByName('Orcamento_Anual');
  const linhas = sh.data.slice(3);
  const casa = linhas.find(r => r[0] === 'Casa');
  assert.strictEqual(casa[4 + 10], 200);           // Nov = coluna 15
  assert.ok(!linhas.some(r => r[0] === 'Pagamento de fatura'));
  const totalSaida = linhas.find(r => r[0] === 'TOTAL SAÍDA');
  assert.strictEqual(totalSaida[4 + 10], 610);      // 410 Uber + 200 geladeira
});

caso('Compra futura: melhor mês, cartão e loja fora da lista', () => {
  salvar('compras', { 'Produto': 'Air Fryer Mondial 5L preta', 'Link': 'https://www.amazon.com.br/dp/B0X', 'Preço de referência': '450', 'Máx. parcelas sem juros': '3', 'Prioridade': 'Baixa', 'Status': 'Ativo' });
  salvar('compras', { 'Produto': 'Cadeira escritório', 'Link': 'https://lojaqualquer.com/cadeira', 'Preço de referência': '900', 'Máx. parcelas sem juros': '6', 'Prioridade': 'Alta', 'Status': 'Ativo' });
  const c = tabela('Compras_Futuras');
  const air = c.find(x => x['Produto'].startsWith('Air'));
  const cad = c.find(x => x['Produto'].startsWith('Cadeira'));
  assert.strictEqual(air['Loja'], 'Amazon');
  assert.strictEqual(air['Mês sugerido'], 'Nov/2026'); // baixa → novembro já é mês de promoção (Black Friday)
  assert.ok(cad['Observação'].startsWith('Fora da lista'), cad['Observação']);
  assert.ok(cad['Cartão sugerido'].startsWith('C6 Black'), cad['Cartão sugerido']);
  assert.strictEqual(cad['Comprar após o dia'], 26);
});

caso('Alerta de orçamento: 82% da meta de Transporte manda 1 e-mail e não repete', () => {
  emails.length = 0;
  run('alertasOrcamento()');
  assert.strictEqual(emails.length, 1);
  assert.ok(emails[0].subject.includes('Transporte'));
  run('alertasOrcamento()');
  assert.strictEqual(emails.length, 1);
});

caso('Lembrete mensal e carteiro de relatórios', () => {
  emails.length = 0;
  run('lembreteMensal()');
  assert.strictEqual(emails.length, 1);
  assert.strictEqual(emails[0].to, 'laura@axmarketing.com.br');
  SS.getSheetByName('Relatorios').appendRow([new Date(), 'resumo_semanal', 'Resumo da semana', '<p>teste</p>', 'pronto', '']);
  run('enviarRelatoriosPendentes()');
  assert.strictEqual(emails.length, 2);
  assert.strictEqual(tabela('Relatorios')[0]['Status'], 'enviado');
});

caso('Importação: aprova, descarta duplicado e segura categoria inválida', () => {
  const st = SS.getSheetByName('Import_Staging');
  const linha = (desc, valor, cat, aprovar) => ['', new Date(2026, 10, 20), '2026-11', desc, valor, 'Saída', cat, 'Pessoal', 'Nubank', '', 'csv', '', '', 'alta', aprovar];
  st.appendRow(linha('Padaria', 18, 'Mercado', true));
  st.appendRow(linha('Uber', 410, 'Transporte', true)); // já existe? data diferente → não é duplicado
  st.appendRow(linha('Padaria', 18, 'Mercado', true));  // duplicado do primeiro
  st.appendRow(linha('Coisa', 50, 'NaoExiste', true));
  run('aprovarStaging()');
  assert.ok(ctx.__alert.includes('2 lançamento(s) aprovado(s)'), ctx.__alert);
  assert.ok(ctx.__alert.includes('1 duplicado'), ctx.__alert);
  assert.strictEqual(tabela('Import_Staging').length, 1);
});

caso('Projeto de renda: mínimo R$200 e cálculo de ROI', () => {
  falha('projetos', { 'Projeto': 'Ebook', 'Investimento inicial (R$)': '150', 'Receita base (R$/mês)': '100', 'Status': 'Ideia' }, 'no mínimo 200');
  salvar('projetos', { 'Projeto': 'Ebook', 'Investimento inicial (R$)': '200', 'Custo mensal (R$)': '20', 'Receita base (R$/mês)': '120', 'Status': 'Em teste' });
  const p = tabela('Projetos_Renda')[0];
  assert.strictEqual(p['ROI mensal (base)'], 0.5);
  assert.strictEqual(p['Payback base (meses)'], 2);
});

caso('Formulários abrem com opções e existentes', () => {
  const f = run(`getFormulario('lancamento')`);
  assert.ok(f.campos.find(c => c.nome === 'Categoria').opcoes.includes('Transporte'));
  assert.ok(f.campos.find(c => c.nome === 'Conta/Cartão').opcoes.includes('C6 Black'));
  const r = run(`getFormulario('reserva')`);
  assert.strictEqual(r.valores.reserva_pct, 50);
  const m = run(`getFormulario('metas')`);
  assert.strictEqual(m.existentes.length, 3);
});

console.log('\n' + ok + ' cenários passaram.');
