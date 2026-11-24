/** Configuração pública do navegador (a chave "anon" do Supabase é pública por natureza; a segurança vem do RLS). */
export default function handler(req, res) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) { res.status(500).json({ erro: 'Servidor sem SUPABASE_URL / SUPABASE_ANON_KEY.' }); return; }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: anon });
}
