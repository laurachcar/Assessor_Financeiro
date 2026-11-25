-- Assessor Financeiro: banco inicial (multiusuário, com RLS).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar de novo sem estragar nada.

-- ---------------------------------------------------------------- planos e perfis
create table if not exists public.planos (
  id text primary key,
  nome text not null,
  limite_ia_mes integer not null default 0   -- perguntas aos agentes por mês
);
insert into public.planos (id, nome, limite_ia_mes) values
  ('gratis', 'Grátis', 20),
  ('pro', 'Pro', 300)
on conflict (id) do nothing;

create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  plano text not null default 'gratis' references public.planos (id),
  aceitou_termos_em timestamptz,
  criado_em timestamptz not null default now()
);

-- cria o perfil quando alguém se cadastra
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, aceitou_termos_em)
  values (new.id, new.raw_user_meta_data ->> 'nome', nullif(new.raw_user_meta_data ->> 'aceitou_termos_em', '')::timestamptz)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------- estado do app (uma linha por pessoa)
-- O app guarda todas as abas num único JSON, como na versão em arquivo.
create table if not exists public.estados (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now()
);

-- backup automático: guarda uma cópia por hora das últimas 72 versões
create table if not exists public.estados_historico (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  dados jsonb not null,
  versao integer not null,
  salvo_em timestamptz not null default now()
);
create index if not exists estados_historico_user on public.estados_historico (user_id, salvo_em desc);

create or replace function public.guardar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.estados_historico h
                 where h.user_id = old.user_id and h.salvo_em > now() - interval '1 hour') then
    insert into public.estados_historico (user_id, dados, versao) values (old.user_id, old.dados, old.versao);
    delete from public.estados_historico h
     where h.user_id = old.user_id
       and h.id not in (select id from public.estados_historico
                         where user_id = old.user_id order by salvo_em desc limit 72);
  end if;
  return new;
end $$;
drop trigger if exists ao_salvar_estado on public.estados;
create trigger ao_salvar_estado before update on public.estados
  for each row execute function public.guardar_historico();

-- grava o estado só se ninguém gravou antes (outro aparelho/aba). Devolve a nova versão.
create or replace function public.salvar_estado(p_dados jsonb, p_versao integer) returns integer
language plpgsql security invoker set search_path = public as $$
declare v integer;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if octet_length(p_dados::text) > 8 * 1024 * 1024 then raise exception 'dados grandes demais (limite de 8 MB)'; end if;
  insert into public.estados as e (user_id, dados, versao)
  values (auth.uid(), p_dados, 1)
  on conflict (user_id) do update
    set dados = excluded.dados, versao = e.versao + 1, atualizado_em = now()
    where e.versao = p_versao
  returning versao into v;
  if v is null then raise exception 'conflito: os dados mudaram em outro aparelho'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------- uso dos agentes de IA
create table if not exists public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  agente text not null,
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  criado_em timestamptz not null default now()
);
create index if not exists uso_ia_user_mes on public.uso_ia (user_id, criado_em);

-- ---------------------------------------------------------------- segurança (RLS): cada pessoa só vê o que é dela
alter table public.planos enable row level security;
alter table public.perfis enable row level security;
alter table public.estados enable row level security;
alter table public.estados_historico enable row level security;
alter table public.uso_ia enable row level security;

drop policy if exists "planos: todos leem" on public.planos;
create policy "planos: todos leem" on public.planos for select to authenticated using (true);

drop policy if exists "perfis: dono le" on public.perfis;
create policy "perfis: dono le" on public.perfis for select to authenticated using (id = auth.uid());
drop policy if exists "perfis: dono muda nome" on public.perfis;
create policy "perfis: dono muda nome" on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- o plano só muda pelo servidor (pagamento); a pessoa só pode mudar o nome
revoke update on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;

drop policy if exists "estados: dono" on public.estados;
create policy "estados: dono" on public.estados for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "historico: dono le" on public.estados_historico;
create policy "historico: dono le" on public.estados_historico for select to authenticated using (user_id = auth.uid());

drop policy if exists "uso_ia: dono le" on public.uso_ia;
create policy "uso_ia: dono le" on public.uso_ia for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- anexos (Storage): pasta = id da pessoa
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 15728640,
        array['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "anexos: dono" on storage.objects;
create policy "anexos: dono" on storage.objects for all to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
