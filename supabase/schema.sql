-- Arca: esquema de sincronizacao (Etapa 1)
-- Seguro para rodar mais de uma vez.

-- TABELAS

create table if not exists public.vaults (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  salt_do_cofre  text        not null,
  versao_chave   integer     not null default 1,
  versao_formato integer     not null default 1,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.entries (
  id            uuid primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  colecao       text        not null,
  conteudo      text        not null,
  iv            text        not null,
  versao_chave  integer     not null,
  atualizado_em timestamptz not null default now(),
  apagado       boolean     not null default false,
  apagado_em    timestamptz
);

create index if not exists entries_sync_idx
  on public.entries (user_id, atualizado_em);

-- RELOGIO DO SERVIDOR
-- O aparelho nao decide a hora: o servidor carimba ao receber.

create or replace function public.carimbar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();

  if new.apagado and (tg_op = 'INSERT' or not old.apagado) then
    new.apagado_em := now();
  end if;

  if not new.apagado then
    new.apagado_em := null;
  end if;

  return new;
end;
$$;

drop trigger if exists entries_carimbo on public.entries;
create trigger entries_carimbo
  before insert or update on public.entries
  for each row execute function public.carimbar_atualizado_em();

create or replace function public.carimbar_vault()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists vaults_carimbo on public.vaults;
create trigger vaults_carimbo
  before update on public.vaults
  for each row execute function public.carimbar_vault();

-- RLS

alter table public.vaults  enable row level security;
alter table public.entries enable row level security;

drop policy if exists vaults_select on public.vaults;
create policy vaults_select on public.vaults
  for select using (auth.uid() = user_id);

drop policy if exists vaults_insert on public.vaults;
create policy vaults_insert on public.vaults
  for insert with check (auth.uid() = user_id);

drop policy if exists vaults_update on public.vaults;
create policy vaults_update on public.vaults
  for update using (auth.uid() = user_id)
           with check (auth.uid() = user_id);

drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries
  for update using (auth.uid() = user_id)
           with check (auth.uid() = user_id);

-- Nenhuma policy de DELETE nas duas tabelas.
-- Exclusao e sempre por lapide (apagado = true).

-- EXPURGO DE LAPIDES (180 dias)

create or replace function public.expurgar_lapides()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.entries
   where apagado = true
     and apagado_em < now() - interval '180 days';
$$;

revoke execute on function public.expurgar_lapides() from public, anon, authenticated;

-- AGENDAMENTO DO EXPURGO
-- A funcao acima nao roda sozinha. Para agendar:
--   Painel -> Database -> Extensions -> ativar pg_cron
--   Painel -> Integrations -> Cron -> Create job
--     nome: expurgar-lapides
--     schedule: 0 4 * * 0        (domingo, 04:00 UTC)
--     comando: select public.expurgar_lapides();