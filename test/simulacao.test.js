/** Fluxo completo com planilha simulada. Rode com: node test/simulacao.test.js */
const assert = require('assert');
const { criarAmbiente, suite } = require('./ambiente');

const s = suite('Simulação do sistema');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);

/** Planilha nova, instalada, com "hoje" = 23/11/2026. */
function novo(opcoes) {
  const a = criarAmbiente(opcoes);
  a.fixarHoje(2026, 11, 23);
  const r = a.chamar('instalarSistema');
  assert.ok(r.ok, r.mensagem);
  return a;
}

function salvar(a, form, dados) { return a.chamar('salvarFormulario', form, dados); }
function ok(r) { assert.ok(r.ok, (r.erros || []).join(' | ') || r.mensagem); return r; }

/** Cadastro mínimo: conta, cartões, categoria com meta. */
function cadastroBasico(a) {
  ok(salvar(a, 'contas', { 'Conta': 'Itaú', 'Tipo': 'Corrente', 'Saldo atual': '5.000,00', 'Ativa': true }));
  ok(salvar(a, 'cartoes', { 'Cartão': 'Nubank', 'Dia fechamento': '3', 'Dia vencimento': '10', 'Ativo': true }));
  ok(salvar(a, 'cartoes', { 'Cartão': 'Amex', 'Dia fechamento': '25', 'Dia vencimento': '5', 'Ativo': true }));
  ok(salvar(a, 'categorias', { _original: 'Mercado', 'Categoria': 'Mercado', 'Tipo': 'Saída', 'Meta mensal': '1000', 'Ativa': true }));
}

function lancar(a, desc, valor, extra) {
  return salvar(a, 'lancamento', Object.assign({
    'Data': '2026-11-10', 'Descrição': desc, 'Valor': String(valor), 'Tipo': 'Saída',
    'Categoria': 'Mercado', 'Centro de custo': 'Pessoal', 'Conta/Cartão': 'Itaú', 'Parcelas': ''
  }, extra || {}));
}

s.teste('instalação cria 17 abas visíveis, 2 ocultas, cadastros padrão e 3 gatilhos', () => {
  const a = novo();
  const nomes = Object.keys(a.abas);
  assert.strictEqual(nomes.length, 19);
  assert.strictEqual(nomes.filter(n => !a.abas[n].oculta).length, 17);
  eq(nomes.filter(n => a.abas[n].oculta).sort(), ['Log', 'Relatorios']);
  assert.strictEqual(a.abas.Lancamentos.dados[0][0], 'ID');
  assert.ok(a.tabela('Categorias').length >= 20);
  assert.strictEqual(a.tabela('Configuracoes').filter(c => c['Chave'] === 'email')[0]['Valor'], 'dono@exemplo.com');
  eq(a.gatilhos.map(g => g.getHandlerFunction()).sort(), ['carteiro', 'lembreteMensal', 'rotinaDiaria']);
});

s.teste('instalar de novo repara sem duplicar nada', () => {
  const a = novo();
  const cats = a.tabela('Categorias').length;
  const cfg = a.tabela('Configuracoes').length;
  a.abas.Lancamentos.dados[0] = ['errado'];
  ok(a.chamar('instalarSistema'));
  assert.strictEqual(a.tabela('Categorias').length, cats);
  assert.strictEqual(a.tabela('Configuracoes').length, cfg);
  assert.strictEqual(a.gatilhos.length, 3);
  assert.strictEqual(a.abas.Lancamentos.dados[0][0], 'ID');
});

s.teste('planilha antiga com aba "Investimentos" não é instalada', () => {
  const a = criarAmbiente();
  a.rodar('SpreadsheetApp.getActiveSpreadsheet()').insertSheet('Investimentos');
  const r = a.chamar('instalarSistema');
  assert.strictEqual(r.ok, false);
  assert.ok(a.alertas[0].indexOf('planilha nova') >= 0);
  assert.strictEqual(Object.keys(a.abas).length, 1);
});

s.teste('cartões: cadastra, edita, recusa duplicado e número de cartão', () => {
  const a = novo();
  ok(salvar(a, 'cartoes', { 'Cartão': 'C6', 'Dia fechamento': '5', 'Dia vencimento': '12', 'Ativo': true }));
  ok(salvar(a, 'cartoes', { _original: 'C6', 'Cartão': 'C6 Black', 'Dia fechamento': '6', 'Dia vencimento': '13', 'Ativo': true }));
  const c = a.tabela('Cartoes');
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0]['Cartão'], 'C6 Black');
  assert.strictEqual(c[0]['Dia fechamento'], 6);
  assert.strictEqual(salvar(a, 'cartoes', { 'Cartão': 'c6 black', 'Dia fechamento': '1', 'Dia vencimento': '8' }).ok, false);
  const r = salvar(a, 'cartoes', { 'Cartão': 'Nubank 5555 6666 7777 8888', 'Dia fechamento': '1', 'Dia vencimento': '8' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros[0].indexOf('12 dígitos') >= 0);
  assert.strictEqual(salvar(a, 'cartoes', { 'Cartão': 'Igual', 'Dia fechamento': '8', 'Dia vencimento': '8' }).ok, false);
});

s.teste('lançamento à vista grava e aparece no orçado x realizado', () => {
  const a = novo();
  cadastroBasico(a);
  ok(lancar(a, 'Feira', '87,30'));
  const l = a.tabela('Lancamentos');
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0]['Valor'], 87.3);
  assert.strictEqual(l[0]['Origem'], 'Manual');
  const orc = a.abas.Orcado_Realizado.dados;
  const mercado = orc.filter(r => r && r[0] === 'Mercado')[0];
  assert.strictEqual(mercado[1], 1000);      // meta mensal
  assert.strictEqual(mercado[2 + 10], 87.3);  // novembro
});

s.teste('compra parcelada no cartão gera uma linha por parcela; conta não parcela', () => {
  const a = novo();
  cadastroBasico(a);
  ok(lancar(a, 'Geladeira', 3000, { 'Conta/Cartão': 'Nubank', 'Parcelas': '3', 'Data': '2026-11-05' }));
  const l = a.tabela('Lancamentos');
  eq(l.map(x => [x['Parcela'], x['Mês fatura'], x['Valor']]),
    [['1 de 3', '2026-12', 1000], ['2 de 3', '2027-01', 1000], ['3 de 3', '2027-02', 1000]]);
  assert.strictEqual(lancar(a, 'TV', 3000, { 'Parcelas': '3' }).ok, false);
});

s.teste('fatura como Saída é recusada; como Transferência não entra no orçado', () => {
  const a = novo();
  cadastroBasico(a);
  const r = lancar(a, 'Pagamento fatura Nubank', 1500, { 'Categoria': '' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros[0].indexOf('Transferência') >= 0);
  ok(lancar(a, 'Pagamento fatura Nubank', 1500, { 'Tipo': 'Transferência', 'Categoria': '' }));
  const total = a.abas.Orcado_Realizado.dados.filter(x => x && x[0] === 'TOTAL')[0];
  assert.strictEqual(total[2 + 10], 0);
});

s.teste('alertas de orçamento em 80% e 100%, por e-mail, sem repetir', () => {
  const a = novo();
  cadastroBasico(a);
  a.fixarHoje(2026, 11, 23);
  ok(lancar(a, 'Compra grande', 500));
  assert.strictEqual(a.emails.length, 0);
  ok(lancar(a, 'Mais compras', 350));         // 85%
  assert.strictEqual(a.emails.length, 1);
  assert.ok(a.emails[0].subject.indexOf('Mercado') >= 0);
  ok(lancar(a, 'Pão', 10));                   // 86%: não repete
  assert.strictEqual(a.emails.length, 1);
  ok(lancar(a, 'Churrasco', 200));            // 106%
  assert.strictEqual(a.emails.length, 2);
  assert.ok(a.emails[1].htmlBody.indexOf('estourada') >= 0);
  a.chamar('verificarAlertasOrcamento');
  assert.strictEqual(a.emails.length, 2);
  eq(a.tabela('Alertas').map(x => x['Nível']), [80, 100]);
});

s.teste('filtros de ano e centro de custo do orçado recalculam ao editar', () => {
  const a = novo();
  cadastroBasico(a);
  ok(salvar(a, 'centros', { 'Centro de custo': 'Empresa', 'Ativo': true }));
  ok(lancar(a, 'Pessoal nov', 100));
  ok(lancar(a, 'Empresa nov', 40, { 'Centro de custo': 'Empresa' }));
  ok(lancar(a, 'Ano passado', 70, { 'Data': '2025-11-10' }));
  const sh = a.rodar("SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orcado_Realizado')");
  const ss = a.rodar('SpreadsheetApp.getActiveSpreadsheet()');
  const mercado = () => a.abas.Orcado_Realizado.dados.filter(r => r && r[0] === 'Mercado')[0];
  assert.strictEqual(mercado()[14], 140);   // total 2026, todos os centros
  assert.strictEqual(mercado()[17], 70);    // total 2025
  sh.getRange(1, 4).setValue('Empresa');
  a.chamar('onEdit', { range: sh.getRange(1, 4), source: ss });
  assert.strictEqual(mercado()[14], 40);
  sh.getRange(1, 2).setValue(2025);
  sh.getRange(1, 4).setValue('Todos');
  a.chamar('onEdit', { range: sh.getRange(1, 2), source: ss });
  assert.strictEqual(mercado()[14], 70);
  assert.strictEqual(a.abas.Orcado_Realizado.dados[2][14], 'Total 2025');
});

s.teste('metas e aporte: soma até 100%, reserva até R$ 10 mil e depois congela', () => {
  const a = novo();
  ok(salvar(a, 'metas', { 'Meta': 'Casa própria', 'Valor alvo': '300000', '% do aporte': '60', 'Ativa': true }));
  const r = salvar(a, 'metas', { 'Meta': 'Consórcio', 'Valor alvo': '200000', '% do aporte': '50', 'Ativa': true });
  assert.strictEqual(r.ok, false);
  ok(salvar(a, 'metas', { 'Meta': 'Consórcio', 'Valor alvo': '200000', '% do aporte': '40', 'Ativa': true }));
  ok(salvar(a, 'aporte', { 'Mês': '2026-11', 'Aporte': '4000', 'Reserva antes': '8500' }));
  eq(a.tabela('Aporte_Reserva').map(x => [x['Para reserva'], x['Reserva depois'], x['Para metas']]), [[1500, 10000, 2500]]);
  eq(a.tabela('Metas_Investimento').map(x => x['Acumulado']), [1500, 1000]);
  assert.strictEqual(salvar(a, 'aporte', { 'Mês': '2026-11', 'Aporte': '4000', 'Reserva antes': '10000' }).ok, false);
  const dez = ok(salvar(a, 'aporte', { 'Mês': '2026-12', 'Aporte': '4000', 'Reserva antes': '10000' }));
  assert.ok(dez.mensagem.indexOf('congelada') >= 0);
  eq(a.tabela('Metas_Investimento').map(x => x['Acumulado']), [3900, 2600]);
});

s.teste('projeção de 12 meses e calendário de compras gravados nas abas', () => {
  const a = novo();
  cadastroBasico(a);
  ok(salvar(a, 'configuracoes', { 'email': 'eu@exemplo.com', 'teto_parcelas': '800', 'max_parcelas': '10', 'meta_reserva': '10000', 'pct_reserva': '50', 'aporte_mensal': '1000' }));
  ok(salvar(a, 'fixos', { 'Descrição': 'Salário', 'Tipo': 'Entrada', 'Valor': '9000', 'Categoria': 'Salário', 'Dia': '5', 'Início': '2026-01', 'Ativo': true }));
  ok(salvar(a, 'fixos', { 'Descrição': 'Aluguel', 'Tipo': 'Saída', 'Valor': '3500', 'Categoria': 'Moradia', 'Conta/Cartão': 'Itaú', 'Dia': '10', 'Início': '2026-01', 'Ativo': true }));
  ok(salvar(a, 'compras', { 'Item': 'Notebook', 'Valor estimado': '6000', 'Prioridade': 'Alta', 'Mês desejado': '2027-01', 'Status': 'Planejada' }));
  const proj = a.abas.Projecao_Caixa.dados;
  const meses = proj.slice(3).filter(r => r && r[0]);
  assert.strictEqual(meses.length, 12);
  assert.strictEqual(meses[0][0], 'Nov/2026');
  assert.strictEqual(meses[0][1], 5000);                 // saldo inicial = conta Itaú
  assert.strictEqual(meses[0][7], 5000 + 9000 - 3500 - 1000);
  const cal = a.abas.Calendario_Compras.dados[3];
  assert.strictEqual(cal[0], 'Notebook');
  assert.strictEqual(cal[3], 'Jan/2027');
  assert.ok(cal[4] === 1 || cal[5] <= 800);              // à vista, ou parcela dentro do teto
  assert.strictEqual(cal[6], 'Amex');
  assert.strictEqual(meses[2][5], cal[5]);               // parcela aparece na projeção de jan
  const painel = a.abas.Painel.dados.map(r => r[0]);
  assert.ok(painel.indexOf('Próxima compra planejada') >= 0);
});

s.teste('lembrete do dia 1 envia resumo do mês anterior', () => {
  const a = novo();
  cadastroBasico(a);
  ok(lancar(a, 'Feira', 1200));
  a.emails.length = 0;
  a.fixarHoje(2026, 12, 1);
  a.chamar('lembreteMensal');
  assert.strictEqual(a.emails.length, 1);
  const e = a.emails[0];
  assert.strictEqual(e.to, 'dono@exemplo.com');
  assert.ok(e.subject.indexOf('Dez/2026') >= 0);
  assert.ok(e.htmlBody.indexOf('R$ 1.200,00') >= 0);
  assert.ok(e.htmlBody.indexOf('Mercado (120%)') >= 0);
  assert.ok(e.htmlBody.indexOf('Registre o aporte') >= 0);
});

s.teste('carteiro envia relatórios pendentes uma única vez', () => {
  const a = novo();
  a.chamar('registrarRelatorio', 'Resumo semanal', '<p>Tudo certo</p>');
  a.chamar('registrarRelatorio', 'Sem corpo', '');
  const r = a.chamar('carteiro');
  eq(r, { enviados: 1, erros: 1 });
  eq(a.tabela('Relatorios').map(x => x['Status']), ['Enviado', 'Erro']);
  assert.strictEqual(a.emails[0].subject, '[Assessor] Resumo semanal');
  eq(a.chamar('carteiro'), { enviados: 0, erros: 0 });
  assert.strictEqual(a.emails.length, 1);
});

s.teste('importação: descarta duplicados, aprova com categoria e respeita a regra da fatura', () => {
  const a = novo();
  cadastroBasico(a);
  ok(lancar(a, 'Padaria', 25));
  const staging = (id, desc, valor, extra) => Object.assign({ 'ID': id, 'Data': a.data(2026, 11, 10), 'Descrição': desc, 'Valor': valor,
    'Tipo': 'Saída', 'Categoria': '', 'Centro de custo': '', 'Conta/Cartão': 'Itaú', 'Origem': 'extrato.csv', 'Status': 'Pendente' }, extra || {});
  a.rodar('acrescentarLinhas_')('Import_Staging', [
    staging('1', 'PADARIA', 25),                     // já lançado à mão
    staging('2', 'Supermercado', 300),
    staging('3', 'Supermercado', 300),               // repetido no próprio arquivo
    staging('4', 'Cinema', 60),
    staging('5', 'Pagamento fatura Amex', 900)
  ]);
  const form = a.chamar('obterFormulario', 'importados');
  eq(form.pendentes.map(p => p.ID), ['2', '4', '5']);
  const r = a.chamar('processarImportados', [
    { ID: '2', acao: 'aprovar', Categoria: 'Mercado' },
    { ID: '4', acao: 'descartar' },
    { ID: '5', acao: 'aprovar', Categoria: 'Outros' }
  ]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros[0].indexOf('Transferência') >= 0);
  eq(a.tabela('Import_Staging').map(x => x['Status']), ['Duplicado', 'Aprovado', 'Duplicado', 'Descartado', 'Pendente']);
  const l = a.tabela('Lancamentos');
  assert.strictEqual(l.length, 2);
  assert.strictEqual(l[1]['Categoria'], 'Mercado');
  assert.ok(l[1]['Origem'].indexOf('extrato.csv') >= 0);
});

s.rodar();
