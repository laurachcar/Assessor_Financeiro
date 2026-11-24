/** Acesso ao Supabase com a chave de serviço (só no servidor) e checagem do usuário logado. */
import { createClient } from '@supabase/supabase-js';
import { inicioDoMes } from './agentes.js';

let admin = null;
export function supabaseAdmin() {
  if (!admin) {
    const url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados');
    admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/** Lê o token "Authorization: Bearer ..." e devolve o usuário, ou null. */
export async function usuarioDoPedido(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(m[1]);
  return error ? null : data.user;
}

/** Quantas perguntas a pessoa já fez no mês e quantas o plano dela permite. */
export async function usoDoMes(userId) {
  const sb = supabaseAdmin();
  const { data: perfil, error: e1 } = await sb.from('perfis').select('plano, planos(limite_ia_mes)').eq('id', userId).single();
  if (e1) throw e1;
  const { count, error: e2 } = await sb.from('uso_ia').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('criado_em', inicioDoMes());
  if (e2) throw e2;
  return { plano: perfil.plano, limite: perfil.planos?.limite_ia_mes ?? 0, usados: count ?? 0 };
}

export async function registrarUso(userId, agente) {
  const { data, error } = await supabaseAdmin().from('uso_ia').insert({ user_id: userId, agente }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function fecharUso(id, uso, modelo) {
  await supabaseAdmin().from('uso_ia').update({
    tokens_entrada: uso?.input_tokens ?? null, tokens_saida: uso?.output_tokens ?? null, modelo
  }).eq('id', id);
}
