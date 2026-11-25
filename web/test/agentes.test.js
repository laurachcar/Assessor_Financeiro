import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPedido, ErroPedido, inicioDoMes } from '../api/_lib/agentes.js';

test('monta pedido do investidor com dados isolados em <dados>', () => {
  const p = montarPedido({ agente: 'investidor', pergunta: 'Como atinjo a meta Casa?', contexto: { nome: 'Ana' }, calculo: 'linha 1\nlinha 2' });
  assert.equal(p.agente, 'investidor');
  assert.match(p.system, /Agente Investidor/);
  assert.equal(p.messages.length, 1);
  assert.equal(p.messages[0].role, 'user');
  assert.match(p.messages[0].content, /<dados>\n\{"nome":"Ana"\}\n<\/dados>/);
  assert.match(p.messages[0].content, /linha 1 linha 2/);
  assert.match(p.messages[0].content, /Pergunta: Como atinjo a meta Casa\?$/);
});

test('buyer tem pergunta padrão', () => {
  const p = montarPedido({ agente: 'buyer', contexto: {} });
  assert.match(p.messages[0].content, /Revise meu plano/);
});

test('histórico começa por user, alterna papéis e não termina em user', () => {
  const p = montarPedido({
    agente: 'investidor', pergunta: 'e agora?',
    historico: [{ role: 'assistant', content: 'oi' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }, { role: 'system', content: 'x' }, { role: 'user', content: 'd' }]
  });
  assert.deepEqual(p.messages.map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(p.messages[0].content, 'a\n\nb');
});

test('recusa agente desconhecido, pergunta vazia e dados grandes', () => {
  assert.throws(() => montarPedido({ agente: 'hacker', pergunta: 'x' }), ErroPedido);
  assert.throws(() => montarPedido({ agente: 'investidor', pergunta: '  ' }), /pergunta/);
  assert.throws(() => montarPedido({ agente: 'investidor', pergunta: 'x'.repeat(2001) }), /limite/);
  assert.throws(() => montarPedido({ agente: 'investidor', pergunta: 'x', contexto: { a: 'y'.repeat(70000) } }), e => e.status === 413);
});

test('início do mês no horário de Brasília', () => {
  assert.equal(inicioDoMes(new Date('2026-12-01T02:00:00Z')), '2026-11-01T03:00:00.000Z');   // ainda 30/11 em Brasília
  assert.equal(inicioDoMes(new Date('2026-12-01T04:00:00Z')), '2026-12-01T03:00:00.000Z');
});
