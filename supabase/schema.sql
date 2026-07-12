-- UtmZ — schema do Supabase
-- Rodar no SQL Editor do projeto Supabase.

-- 1. Clientes da agência
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- 2. Links rastreáveis (cada cliente tem vários)
create table links (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  short_code      text not null unique,        -- ex: "adriane-gmb"
  label           text,                        -- ex: "Google Meu Negócio"
  destination_url text not null,               -- URL final (sem as UTMs)
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  created_at      timestamptz default now()
);

-- 3. Cliques registrados
create table clicks (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references links(id) on delete cascade,
  clicked_at  timestamptz default now(),
  country     text,
  device      text,          -- mobile / desktop / tablet
  referrer    text,
  user_agent  text
);

create index idx_links_short_code on links (short_code);
create index idx_links_client     on links (client_id);
create index idx_clicks_link      on clicks (link_id);
create index idx_clicks_time      on clicks (clicked_at);

-- Segurança: liga o RLS. O painel (usuário logado) lê tudo;
-- a função de redirect usa a service_role key, que ignora o RLS.
alter table clients enable row level security;
alter table links   enable row level security;
alter table clicks  enable row level security;

-- Tabelas novas não são mais auto-expostas à Data API:
-- é preciso conceder acesso explícito aos roles do painel.
grant usage on schema public to authenticated;
grant select, insert, update, delete on clients to authenticated;
grant select, insert, update, delete on links   to authenticated;
grant select on clicks to authenticated;

-- Modelo de acesso: app interno da agência — qualquer usuário logado
-- (criado manualmente pela agência) gerencia tudo.
create policy "logados gerenciam clients" on clients
  for all to authenticated using (true) with check (true);
create policy "logados gerenciam links" on links
  for all to authenticated using (true) with check (true);
create policy "logados leem clicks" on clicks
  for select to authenticated using (true);
