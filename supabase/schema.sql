-- UtmZ — schema do Supabase (estado atual, pós multi-tenant)
-- Aplicado via migrations MCP: initial_schema, multi_tenant_workspaces.

create schema if not exists private;

-- 0. Workspaces (multi-tenant) e vínculos de usuário
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'owner',  -- 'owner' | 'member' (convites: fase 2)
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- 1. Clientes (de cada workspace)
create table clients (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  created_at   timestamptz default now()
);

-- 2. Links rastreáveis (cada cliente tem vários)
create table links (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  short_code      text not null unique,        -- único GLOBAL (domínio compartilhado)
  label           text,                        -- ex: "Google Meu Negócio"
  destination_url text not null,               -- URL final (sem as UTMs)
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  created_at      timestamptz default now()
);

-- 3. Cliques registrados (gravados pelo redirect com service_role)
create table clicks (
  id           bigint generated always as identity primary key,
  link_id      uuid not null references links(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clicked_at   timestamptz default now(),
  country      text,
  region       text,
  city         text,
  device       text,             -- mobile / desktop / tablet
  browser      text,             -- chrome / instagram / whatsapp / ...
  os           text,             -- android / ios / windows / macos / linux
  is_bot       boolean default false,
  language     text,             -- ex: pt-BR
  referrer     text,
  user_agent   text,
  query_params jsonb             -- fbclid, gclid, ttclid... vindos do anúncio
);

create index idx_links_short_code  on links (short_code);
create index idx_links_client      on links (client_id);
create index idx_links_workspace   on links (workspace_id);
create index idx_clients_workspace on clients (workspace_id);
create index idx_clicks_link       on clicks (link_id);
create index idx_clicks_time       on clicks (clicked_at);
create index idx_clicks_workspace  on clicks (workspace_id);

-- Segurança: RLS com isolamento por workspace.
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table clients           enable row level security;
alter table links             enable row level security;
alter table clicks            enable row level security;

-- Tabelas novas não são auto-expostas à Data API: grants explícitos.
grant usage on schema public to authenticated;
grant select on workspaces, workspace_members to authenticated;
grant update on workspaces to authenticated;
grant select, insert, update, delete on clients to authenticated;
grant select, insert, update, delete on links   to authenticated;
grant select on clicks to authenticated;

create policy "membro ve seus vinculos" on workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "membro ve workspace" on workspaces
  for select to authenticated
  using (id in (select workspace_id from workspace_members where user_id = (select auth.uid())));

create policy "membro renomeia workspace" on workspaces
  for update to authenticated
  using (id in (select workspace_id from workspace_members where user_id = (select auth.uid())))
  with check (id in (select workspace_id from workspace_members where user_id = (select auth.uid())));

create policy "membro gerencia clients" on clients
  for all to authenticated
  using (workspace_id in (select workspace_id from workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = (select auth.uid())));

create policy "membro gerencia links" on links
  for all to authenticated
  using (workspace_id in (select workspace_id from workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = (select auth.uid())));

create policy "membro le clicks" on clicks
  for select to authenticated
  using (workspace_id in (select workspace_id from workspace_members where user_id = (select auth.uid())));

-- Onboarding: todo usuário novo ganha um workspace automaticamente.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  insert into public.workspaces (name)
  values (coalesce(new.raw_user_meta_data->>'name', 'Meu workspace'))
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
