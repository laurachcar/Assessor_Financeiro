/**
 * POST /api/agente — conversa com os agentes Investidor e Buyer.
 * A chave do Claude fica só aqui. Exige login e respeita o limite mensal do plano.
 * Resposta: texto em streaming. Se der erro no meio, a última linha começa com "\u0000ERRO:".
 */
import Anthropic from '@anthropic-ai/sdk';
import { montarPedido, ErroPedido } from './_lib/agentes.js';
import { usuarioDoPedido, usoDoMes, registrarUso, fecharUso } from './_lib/servidor.js';

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const ESFORCO = process.env.ANTHROPIC_EFFORT || 'low';   // conversa curta: "low" custa menos e responde mais rápido
let cliente = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ erro: 'Use POST.' }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ erro: 'Agente de IA ainda não configurado no servidor.' }); return; }

  let user, pedido, uso;
  try {
    user = await usuarioDoPedido(req);
    if (!user) { res.status(401).json({ erro: 'Entre na sua conta de novo.' }); return; }
    pedido = montarPedido(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
    uso = await usoDoMes(user.id);
  } catch (e) {
    const status = e instanceof ErroPedido ? e.status : e instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error('agente: preparação', e);
    res.status(status).json({ erro: status === 500 ? 'Erro no servidor.' : e.message });
    return;
  }
  if (uso.usados >= uso.limite) {
    res.status(429).json({ erro: `Você usou as ${uso.limite} perguntas do seu plano neste mês.`, usados: uso.usados, limite: uso.limite, plano: uso.plano });
    return;
  }

  const usoId = await registrarUso(user.id, pedido.agente);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-IA-Usados', String(uso.usados + 1));
  res.setHeader('X-IA-Limite', String(uso.limite));
  res.status(200);

  cliente ??= new Anthropic();
  try {
    const stream = cliente.beta.messages.stream({
      model: MODELO,
      max_tokens: 4000,
      system: [{ type: 'text', text: pedido.system, cache_control: { type: 'ephemeral' } }],
      messages: pedido.messages,
      output_config: { effort: ESFORCO },
      // se o modelo principal recusar, a própria API tenta um modelo reserva
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    });
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') res.write(ev.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') res.write('\n\nNão consigo ajudar com esse pedido. Tente perguntar de outro jeito.');
    await fecharUso(usoId, final.usage, final.model);
  } catch (e) {
    console.error('agente: Claude', e);
    const msg = e instanceof Anthropic.RateLimitError ? 'o agente está muito ocupado, tente em um minuto'
      : e instanceof Anthropic.APIError ? 'o agente não respondeu (' + (e.status || 'erro') + ')' : 'falha de conexão com o agente';
    res.write('\n\u0000ERRO:' + msg);
  }
  res.end();
}
