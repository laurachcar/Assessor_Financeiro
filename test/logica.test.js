/** Regras de negócio puras (02_Logica.gs). Rode com: node test/logica.test.js */
const assert = require('assert');
const { criarAmbiente, suite } = require('./ambiente');

const amb = criarAmbiente();
const f = (nome) => amb.rodar(nome);
const D = (a, m, d) => amb.data(a, m, d);
const s = suite('Regras de negócio');
// arrays criados dentro do contexto do Apps Script têm outro protótipo: compara pelo conteúdo
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
const cartaoNubank = { 'Cartão': 'Nubank', 'Dia fechamento': 3, 'Dia vencimento': 10 };
const cartaoAmex = { 'Cartão': 'Amex', 'Dia fechamento': 25, 'Dia vencimento': 5 };

s.teste('meses: somar, diferença e leitura tolerante', () => {
  assert.strictEqual(f('somarMeses')('2026-11', 3), '2027-02');
  assert.strictEqual(f('somarMeses')('2026-01', -1), '2025-12');
  assert.strictEqual(f('difMeses')('2026-11', '2027-02'), 3);
  assert.strictEqual(f('mesDe')("'2026-03"), '2026-03');
  assert.strictEqual(f('mesDe')(D(2026, 3, 15)), '2026-03');
  assert.strictEqual(f('mesDe')('03/2026'), '2026-03');
});

s.teste('recusa sequência de 12 dígitos ou mais, mesmo com separadores', () => {
  const sens = f('contemNumeroSensivel');
  assert.ok(sens('cartão 5555 6666 7777 8888'));
  assert.ok(sens('conta 123.456.789-012'));
  assert.ok(!sens('Mercado 2026-11-23'));
  assert.ok(!sens('Nota 12345678901'));
});

s.teste('valores em formato brasileiro', () => {
  const p = f('parseValorBR');
  assert.strictEqual(p('1.234,56'), 1234.56);
  assert.strictEqual(p('R$ 99,9'), 99.9);
  assert.strictEqual(p('1500'), 1500);
  assert.ok(isNaN(p('abc')));
});

s.teste('datas: aceita AAAA-MM-DD e DD/MM/AAAA, recusa data inexistente', () => {
  const p = f('parseData');
  assert.strictEqual(f('diaChave')(p('2026-02-28')), '2026-02-28');
  assert.strictEqual(f('diaChave')(p('05/03/2026')), '2026-03-05');
  assert.strictEqual(p('2026-02-30'), null);
});

s.teste('validação de formulário: obrigatórios, listas e tipos', () => {
  const campos = amb.rodar('FORMULARIOS.lancamento.campos');
  const r = f('validarCampos')(campos, { 'Data': '2026-11-10', 'Descrição': '', 'Valor': '-5', 'Tipo': 'Gasto', 'Conta/Cartão': 'Itaú' },
    { categorias: ['Mercado'], centros: [], contasECartoes: ['Itaú'] });
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros.some(e => e.indexOf('Descrição é obrigatório') >= 0));
  assert.ok(r.erros.some(e => e.indexOf('Valor') === 0));
  assert.ok(r.erros.some(e => e.indexOf('Tipo') === 0));
  const ok = f('validarCampos')(campos, { 'Data': '2026-11-10', 'Descrição': 'Feira', 'Valor': '87,30', 'Tipo': 'Saída', 'Categoria': 'Mercado', 'Conta/Cartão': 'Itaú' },
    { categorias: ['Mercado'], centros: [], contasECartoes: ['Itaú'] });
  assert.ok(ok.ok, ok.erros.join());
  assert.strictEqual(ok.valores['Valor'], 87.3);
  assert.strictEqual(ok.valores['Parcelas'], 1);
});

s.teste('pagamento de fatura como Saída é recusado', () => {
  const e = f('erroRegraFatura');
  assert.ok(e('Pagamento fatura Nubank', 'Saída'));
  assert.ok(e('Pagamento do cartão C6', 'Saída'));
  assert.strictEqual(e('Pagamento fatura Nubank', 'Transferência'), '');
  assert.strictEqual(e('Mercado', 'Saída'), '');
});

s.teste('mês da fatura respeita fechamento e vencimento', () => {
  const m = f('mesFaturaCartao');
  assert.strictEqual(m(D(2026, 11, 2), cartaoNubank), '2026-11'); // antes do fechamento: vence dia 10 do mesmo mês
  assert.strictEqual(m(D(2026, 11, 3), cartaoNubank), '2026-12'); // no fechamento: próxima fatura
  assert.strictEqual(m(D(2026, 11, 20), cartaoAmex), '2026-12');  // fecha 25/11, vence 05/12
  assert.strictEqual(m(D(2026, 11, 26), cartaoAmex), '2027-01');
});

s.teste('compra parcelada vira uma linha por parcela, centavos na primeira', () => {
  const linhas = f('gerarLancamentos')({ 'Data': D(2026, 11, 5), 'Descrição': 'Geladeira', 'Valor': 1000, 'Tipo': 'Saída',
    'Categoria': 'Casa e manutenção', 'Conta/Cartão': 'Nubank', 'Parcelas': 3 }, cartaoNubank, 'L1');
  assert.strictEqual(linhas.length, 3);
  eq(linhas.map(l => l['Valor']), [333.34, 333.33, 333.33]);
  eq(linhas.map(l => l['Mês fatura']), ['2026-12', '2027-01', '2027-02']);
  assert.strictEqual(linhas[2]['Parcela'], '3 de 3');
});

s.teste('parcela em mês mais curto cai no último dia', () => {
  const linhas = f('gerarLancamentos')({ 'Data': D(2026, 1, 31), 'Descrição': 'X', 'Valor': 200, 'Tipo': 'Saída',
    'Conta/Cartão': 'Nubank', 'Parcelas': 2 }, cartaoNubank, 'L2');
  assert.strictEqual(f('diaChave')(linhas[1]['Data']), '2026-02-28');
});

s.teste('melhor cartão é o que dá mais dias até pagar', () => {
  const r = f('melhorCartao')([cartaoNubank, cartaoAmex], '2026-12');
  // Nubank: compra 04/12, vence 10/01 (37 dias). Amex: compra 26/12, vence 05/02 (41 dias).
  assert.strictEqual(r.cartao, 'Amex');
  assert.strictEqual(r.dia, 26);
  assert.strictEqual(r.dias, 41);
});

s.teste('reserva recebe 50% do aporte até a meta', () => {
  const metas = [{ 'Meta': 'Casa', '% do aporte': 60, 'Ativa': 'Sim' }, { 'Meta': 'Consórcio', '% do aporte': 40, 'Ativa': 'Sim' }];
  const r = f('distribuirAporte')(3000, 2000, 10000, 50, metas);
  assert.strictEqual(r.paraReserva, 1500);
  assert.strictEqual(r.paraMetas, 1500);
  eq(r.porMeta.map(m => m.valor), [900, 600]);
});

s.teste('reserva completa só até a meta e depois congela', () => {
  const metas = [{ 'Meta': 'Casa', '% do aporte': 100, 'Ativa': 'Sim' }];
  const quase = f('distribuirAporte')(3000, 9500, 10000, 50, metas);
  assert.strictEqual(quase.paraReserva, 500);
  assert.strictEqual(quase.paraMetas, 2500);
  const cheia = f('distribuirAporte')(3000, 10000, 10000, 50, metas);
  assert.strictEqual(cheia.paraReserva, 0);
  assert.strictEqual(cheia.congelada, true);
  assert.strictEqual(cheia.porMeta[0].valor, 3000);
});

s.teste('orçado x realizado com filtro de centro de custo e ano anterior', () => {
  const lanc = [
    { 'Data': D(2026, 1, 10), 'Valor': 500, 'Tipo': 'Saída', 'Categoria': 'Mercado', 'Centro de custo': 'Pessoal' },
    { 'Data': D(2026, 2, 10), 'Valor': 700, 'Tipo': 'Saída', 'Categoria': 'Mercado', 'Centro de custo': 'Pessoal' },
    { 'Data': D(2026, 2, 11), 'Valor': 300, 'Tipo': 'Saída', 'Categoria': 'Mercado', 'Centro de custo': 'Empresa' },
    { 'Data': D(2026, 2, 12), 'Valor': 999, 'Tipo': 'Transferência', 'Categoria': '', 'Centro de custo': 'Pessoal' },
    { 'Data': D(2025, 5, 1), 'Valor': 1000, 'Tipo': 'Saída', 'Categoria': 'Mercado', 'Centro de custo': 'Pessoal' }
  ];
  const cats = [{ 'Categoria': 'Mercado', 'Tipo': 'Saída', 'Meta mensal': 600, 'Ativa': 'Sim' }];
  const [l] = f('montarOrcadoRealizado')(cats, lanc, 2026, 'Pessoal', 2);
  assert.strictEqual(l.total, 1200);
  assert.strictEqual(l.metaAcumulada, 1200);
  assert.strictEqual(l.pctMeta, 1);
  assert.strictEqual(l.anoAnterior, 1000);
  assert.ok(Math.abs(l.variacao - 0.2) < 1e-9);
  const [todos] = f('montarOrcadoRealizado')(cats, lanc, 2026, 'Todos', 2);
  assert.strictEqual(todos.total, 1500);
});

s.teste('alertas de 80% e 100% não se repetem', () => {
  const calc = f('calcularAlertas');
  const enviados = new (amb.rodar('Set'))();
  let r = calc({ Mercado: 850, Lazer: 100 }, { Mercado: 1000, Lazer: 500 }, enviados, '2026-11', [80, 100]);
  eq(r.map(a => a.categoria + a.nivel), ['Mercado80']);
  enviados.add('2026-11|Mercado|80');
  assert.strictEqual(calc({ Mercado: 900 }, { Mercado: 1000 }, enviados, '2026-11', [80, 100]).length, 0);
  r = calc({ Mercado: 1000 }, { Mercado: 1000 }, enviados, '2026-11', [80, 100]);
  eq(r.map(a => a.nivel), [100]);
});

s.teste('projeção de caixa: fixos com início e fim, cartão, compras e aporte', () => {
  const fixos = [
    { 'Descrição': 'Salário', 'Tipo': 'Entrada', 'Valor': 10000, 'Início': '2026-01', 'Fim': '', 'Ativo': 'Sim' },
    { 'Descrição': 'Aluguel', 'Tipo': 'Saída', 'Valor': 3000, 'Início': '2026-01', 'Fim': '2026-12', 'Ativo': 'Sim' },
    { 'Descrição': 'Streaming', 'Tipo': 'Saída', 'Valor': 50, 'Conta/Cartão': 'Nubank', 'Início': '2026-01', 'Ativo': 'Sim' },
    { 'Descrição': 'Velho', 'Tipo': 'Saída', 'Valor': 999, 'Início': '2026-01', 'Ativo': 'Não' }
  ];
  const p = f('projetarCaixa')({ saldoInicial: 1000, fixos, faturas: { '2026-11': 2000 }, nomesCartoes: ['Nubank'],
    compras: { '2026-12': 500 }, aporte: 1000, mesInicial: '2026-11', meses: 3 });
  eq(p.map(r => r.saldoFinal), [4950, 10400, 19350]);
  assert.strictEqual(p[0].faturas, 2050);
  assert.strictEqual(p[2].saidasFixas, 0); // aluguel terminou em dezembro
});

s.teste('calendário de compras respeita teto de parcelas e caixa', () => {
  const projecao = ['2026-11', '2026-12', '2027-01', '2027-02'].map((mes, i) => ({ mes, saldoFinal: 1000 * (i + 1) }));
  const compras = [
    { 'Item': 'Notebook', 'Valor estimado': 3000, 'Prioridade': 'Alta', 'Status': 'Planejada' },
    { 'Item': 'Sofá', 'Valor estimado': 900, 'Prioridade': 'Baixa', 'Mês desejado': '2026-12', 'Status': 'Planejada' },
    { 'Item': 'Iate', 'Valor estimado': 900000, 'Prioridade': 'Média', 'Status': 'Planejada' },
    { 'Item': 'Já comprado', 'Valor estimado': 10, 'Prioridade': 'Alta', 'Status': 'Comprada' }
  ];
  const r = f('planejarCompras')({ projecao, compras, cargaParcelas: { '2026-11': 300 }, teto: 1000, maxParcelas: 10,
    cartoes: [cartaoNubank, cartaoAmex] });
  const porItem = {};
  r.itens.forEach(i => { porItem[i.item] = i; });
  assert.strictEqual(r.itens.length, 3);
  // Notebook (Alta) em nov: à vista falta caixa; 2x a 4x estouram o teto (já há R$ 300 em parcelas); 5x de 600 cabe.
  eq([porItem.Notebook.mes, porItem.Notebook.parcelas, porItem.Notebook.valorParcela], ['2026-11', 5, 600]);
  assert.strictEqual(porItem.Notebook.cartao, 'Amex');
  // Sofá (Baixa) em dez: à vista deixaria o saldo negativo e 2x estoura o teto; 3x de 300 cabe.
  eq([porItem['Sofá'].mes, porItem['Sofá'].parcelas], ['2026-12', 3]);
  assert.strictEqual(porItem.Iate.mes, '');
  assert.ok(porItem.Iate.motivo.indexOf('Não cabe') === 0);
});

s.teste('duplicados: contra lançamentos e dentro da própria importação', () => {
  const existentes = [{ 'Data': D(2026, 11, 1), 'Valor': 50, 'Descrição': 'Padaria  São João', 'Conta/Cartão': 'Nubank' }];
  const pend = [
    { 'Data': '2026-11-01', 'Valor': '50', 'Descrição': 'padaria sao joao', 'Conta/Cartão': 'Nubank' },
    { 'Data': '2026-11-02', 'Valor': 20, 'Descrição': 'Uber', 'Conta/Cartão': 'Nubank' },
    { 'Data': '02/11/2026', 'Valor': 20, 'Descrição': 'UBER', 'Conta/Cartão': 'Nubank' }
  ];
  eq(Array.from(f('detectarDuplicados')(pend, existentes)), [true, false, true]);
});

s.rodar();
