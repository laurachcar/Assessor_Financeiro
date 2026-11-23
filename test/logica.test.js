// Testes das regras de negócio (04_Logica.gs) fora do Google.
// Rodar: node test/logica.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '04_Logica.gs'), 'utf8'), ctx);
const L = (nome) => vm.runInContext(nome, ctx);

let ok = 0;
function caso(nome, fn) {
  try { fn(); ok++; console.log('ok  ' + nome); }
  catch (e) { console.log('FALHOU  ' + nome + '\n   ' + e.message); process.exitCode = 1; }
}

const horizonte = (inicio, sobra, parcelas) => Array.from({ length: 12 }, (_, k) => ({
  mes: L('addMeses_')(inicio, k), sobra: typeof sobra === 'function' ? sobra(k) : sobra, parcelas: parcelas
}));
const OPTS = { teto: 600, mesesSazonais: [3, 7, 11, 12], janelaSazonal: 3 };

caso('addMeses_ vira o ano', () => {
  assert.strictEqual(L('addMeses_')('2026-11', 2), '2027-01');
  assert.strictEqual(L('addMeses_')('2026-01', -1), '2025-12');
});

caso('Eval 4: parcelas atuais R$450 + compra R$1.200 → no mínimo 8x', () => {
  const r = L('calendarioCompras_')(
    [{ produto: 'Notebook', preco: 1200, maxParcelas: 10, prioridade: 'Alta' }],
    horizonte('2026-12', 1000, 450), OPTS)[0];
  assert.strictEqual(r.parcelas, 8);
  assert.strictEqual(r.valorParcela, 150);
  assert.strictEqual(r.mes, '2026-12');
});

caso('Teto é a SOMA das parcelas: duas compras dividem os R$600', () => {
  const r = L('calendarioCompras_')([
    { produto: 'A', preco: 2400, maxParcelas: 12, prioridade: 'Alta' },  // 6x400 cabe (0+400 <= 600)
    { produto: 'B', preco: 1200, maxParcelas: 12, prioridade: 'Alta' }   // precisa caber nos 200 restantes
  ], horizonte('2026-12', 1000, 0), OPTS); // sobra 1000: nenhuma das duas cabe à vista
  assert.strictEqual(r[0].parcelas, 4); // 2400/4 = 600 → menor n que cabe no teto
  // A ocupa os R$600 do teto de dez a mar; B não pode somar parcelas nesses meses
  assert.ok(r[1].mes >= '2027-04', JSON.stringify(r[1]));
  assert.ok(r[1].valorParcela <= 600);
});

caso('À vista não conta no teto, mas precisa caber na sobra', () => {
  const r = L('calendarioCompras_')([{ produto: 'Fone', preco: 500, maxParcelas: 1, prioridade: 'Alta' }],
    horizonte('2026-12', 600, 700), OPTS)[0];
  assert.strictEqual(r.parcelas, 1);
});

caso('Eval 5: compra que só caberia usando a reserva → Fora do orçamento', () => {
  const r = L('calendarioCompras_')([{ produto: 'Sofá', preco: 8000, maxParcelas: 10, prioridade: 'Alta' }],
    horizonte('2026-12', 300, 0), OPTS)[0];
  assert.strictEqual(r.status, 'Fora do orçamento');
});

caso('Eval 6: prioridade baixa em outubro espera a Black Friday (novembro)', () => {
  const r = L('calendarioCompras_')([{ produto: 'Tênis', preco: 400, maxParcelas: 2, prioridade: 'Baixa' }],
    horizonte('2026-10', 2000, 0), OPTS)[0];
  assert.strictEqual(r.mes, '2026-11');
});

caso('Prioridade baixa com preço-alvo atingido compra já', () => {
  const r = L('calendarioCompras_')([{ produto: 'Tênis', preco: 300, precoAlvo: 320, maxParcelas: 2, prioridade: 'Baixa' }],
    horizonte('2026-10', 2000, 0), OPTS)[0];
  assert.strictEqual(r.mes, '2026-10');
});

caso('Prioridade média sem promoção na janela vai para o mês de maior sobra', () => {
  const sobra = k => (k === 5 ? 5000 : 1000);
  const r = L('calendarioCompras_')([{ produto: 'Cadeira', preco: 900, maxParcelas: 3, prioridade: 'Média' }],
    horizonte('2027-04', sobra, 0), { teto: 600, mesesSazonais: [11], janelaSazonal: 3 })[0];
  assert.strictEqual(r.mes, '2027-09');
});

caso('Prazo limite impede sugerir depois do prazo', () => {
  const sobra = k => (k < 3 ? 0 : 5000);
  const r = L('calendarioCompras_')([{ produto: 'Presente', preco: 300, maxParcelas: 1, prioridade: 'Alta', prazo: '2026-12' }],
    horizonte('2026-11', sobra, 0), OPTS)[0];
  assert.strictEqual(r.status, 'Fora do orçamento');
});

caso('Reserva abaixo da meta recebe 50% do aporte', () => {
  const a = L('alocarAporte_')(2000, { saldo: 3000, meta: 10000, pct: 0.5 }, [{ nome: 'Casa', pct: 0.6 }, { nome: 'Japão', pct: 0.4 }]);
  assert.strictEqual(a.reserva, 1000);
  assert.strictEqual(a.metas[0].valor, 600);
  assert.strictEqual(a.metas[1].valor, 400);
});

caso('Eval 11: reserva atinge R$10.000 → congela e os 50% vão para as metas', () => {
  const a = L('alocarAporte_')(2000, { saldo: 10000, meta: 10000, pct: 0.5 }, [{ nome: 'Casa', pct: 1 }]);
  assert.strictEqual(a.congelada, true);
  assert.strictEqual(a.reserva, 0);
  assert.strictEqual(a.metas[0].valor, 2000);
});

caso('Reserva perto da meta recebe só o que falta', () => {
  const a = L('alocarAporte_')(2000, { saldo: 9800, meta: 10000, pct: 0.5 }, [{ nome: 'Casa', pct: 1 }]);
  assert.strictEqual(a.reserva, 200);
  assert.strictEqual(a.metas[0].valor, 1800);
});

caso('Reserva usada volta a receber', () => {
  const a = L('alocarAporte_')(1000, { saldo: 7000, meta: 10000, pct: 0.5 }, []);
  assert.strictEqual(a.reserva, 500);
  assert.strictEqual(a.semDestino, 500);
});

caso('Cartão: maior retorno; empate → fecha primeiro', () => {
  const c = L('escolherCartao_')([
    { apelido: 'Nubank', fechamento: 3, retorno: 0.01 },
    { apelido: 'C6 Black', fechamento: 25, retorno: 0.015 },
    { apelido: 'Amex', fechamento: 10, retorno: 0.015 }
  ], 5);
  assert.strictEqual(c.apelido, 'Amex');
  assert.strictEqual(c.comprarApos, 11);
});

caso('Alertas 80% e 100%', () => {
  const f = L('nivelAlerta_');
  assert.strictEqual(f(790, 1000, 0.8, 1), '');
  assert.strictEqual(f(800, 1000, 0.8, 1), 'amarelo');
  assert.strictEqual(f(1000, 1000, 0.8, 1), 'vermelho');
  assert.strictEqual(f(500, 0, 0.8, 1), '');
});

caso('Parcelas futuras de 3/10 lançada em nov/2026', () => {
  const p = L('parcelasFuturas_')('2026-11', '3/10', 150);
  assert.strictEqual(p.length, 7);
  assert.strictEqual(p[0].mes, '2026-12');
  assert.strictEqual(p[6].mes, '2027-06');
});

caso('Projeto: ROI e payback', () => {
  const p = L('avaliarProjeto_')(200, 50, 150);
  assert.strictEqual(p.roiMensal, 0.5);
  assert.strictEqual(p.payback, 2);
  assert.strictEqual(L('avaliarProjeto_')(500, 100, 80).payback, null);
});

console.log('\n' + ok + ' testes passaram.');
