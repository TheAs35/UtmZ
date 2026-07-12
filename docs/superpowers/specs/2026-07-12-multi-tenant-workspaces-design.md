# UtmZ — Multi-tenant (workspaces) + coleta antecipada de cliques

Data: 2026-07-12 · Status: aguardando revisão do usuário

## Objetivo

Transformar o UtmZ de ferramenta interna em plataforma multi-usuário: qualquer
pessoa cria conta e ganha um workspace isolado com seus próprios clientes,
links e estatísticas. O redirect passa a capturar dados ricos de clique
(click IDs de ads, geo fino, device detalhado) desde já, para alimentar os
dashboards da fase 2.

Fora de escopo (fases seguintes): convites de membros, gráficos/dashboards,
bio pages, integração de conversões com Meta/Google Ads, domínio por cliente.

## Decisões tomadas (com o usuário)

1. **Workspaces isolados** — cada conta enxerga só o próprio workspace.
2. **Auto-cadastro aberto** — tela de cadastro pública, acesso imediato.
3. **v1: 1 pessoa = 1 workspace** — banco já pronto p/ múltiplos membros;
   fluxo de convite fica p/ fase seguinte.
4. **Abordagem A + coleta antecipada** — multi-tenancy completo no banco +
   redirect já enriquecido.
5. Detalhes técnicos delegados ("faz o que achar melhor + seguro").

## Modelo de dados

### Tabelas novas

```sql
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'owner',  -- 'owner' | 'member' (fase 2)
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);
```

### Alterações

- `clients`  + `workspace_id uuid not null references workspaces(id) on delete cascade`
- `links`    + `workspace_id uuid not null` (idem; denormalizado p/ RLS direta)
- `clicks`   + `workspace_id uuid not null` (preenchido pelo redirect) e colunas ricas:
  - `city text`, `region text` (headers `x-vercel-ip-city` / `x-vercel-ip-country-region`, URL-decoded)
  - `browser text`, `os text` (parse leve de user-agent, sem lib externa)
  - `is_bot boolean default false`
  - `language text` (primeiro item do `accept-language`)
  - `query_params jsonb` (todos os params recebidos no link curto: fbclid, gclid, wbraid, ttclid, etc. — null se não houver)
- Índices novos: `clicks(workspace_id)`, `links(workspace_id)`, `clients(workspace_id)`.

### Regras

- `short_code` continua **único global** (domínio compartilhado). Colisão →
  erro amigável já existente ("código já existe").
- Migração: criar workspace p/ o usuário existente
  (santosdlucas21@gmail.com) e backfill de `workspace_id` em todos os
  registros atuais. Migration deve funcionar mesmo com tabelas vazias.

## Segurança (RLS + grants)

- `workspace_members`: select `to authenticated using (user_id = (select auth.uid()))`.
  Sem insert/update/delete pelo cliente no v1 (membership só via trigger).
- `workspaces`: select/update `to authenticated` usando
  `id in (select workspace_id from workspace_members where user_id = (select auth.uid()))`.
  Sem insert pelo cliente (criado via trigger) e sem delete no v1.
- `clients`, `links`: for all `to authenticated`, `using` e `with check`
  com a mesma subquery de membership sobre `workspace_id`.
- `clicks`: select `to authenticated` com a subquery de membership.
- Grants explícitos (tabelas novas não são auto-expostas à Data API):
  select em `workspaces`/`workspace_members`; update em `workspaces`;
  CRUD em `clients`/`links`; select em `clicks` — tudo só p/ `authenticated`.
- **Trigger de onboarding**: função `handle_new_user()` security definer com
  `set search_path`, criada em schema **não exposto** (`private`), disparada
  `after insert on auth.users`: cria workspace (nome vindo de
  `raw_user_meta_data->>'name'`, fallback "Meu workspace") + membership owner.
  Revogar EXECUTE de `public/anon/authenticated` (não é RPC).
- Redirect continua usando service_role (bypassa RLS), agora gravando
  `workspace_id` copiado do link.

## Fluxos

### Cadastro

- Nova rota `/cadastro`: nome (vira nome do workspace), e-mail, senha.
- `supabase.auth.signUp` com `options.data.name`.
- Confirmação de e-mail **desligada** (passo manual do usuário no dashboard
  Supabase: Auth → Sign In / Up → desmarcar "Confirm email"). Motivo: SMTP
  embutido limita ~2 e-mails/h; religar quando houver SMTP próprio (Resend).
- Login ganha link "Criar conta".

### Painel

- `App.tsx` carrega, junto da sessão, o workspace do usuário
  (`workspace_members` → `workspaces`) e expõe via contexto.
- Leituras não mudam (RLS filtra). Inserts de `clients`/`links` passam a
  incluir `workspace_id` do contexto.
- Nenhuma mudança visual além da tela de cadastro.

### Redirect (`api/l/[code].ts`)

1. Busca link por `short_code` (agora selecionando também `workspace_id`).
2. Monta URL de destino: UTMs do link como base; **todos os query params
   recebidos na request são repassados ao destino e, em conflito, vencem**
   (são o contexto real do anúncio). Ex.: anúncio Meta appenda `fbclid` ao
   link curto → destino recebe `fbclid` → pixel no site do cliente funciona
   como clique direto.
3. Registra clique em background (`waitUntil`) com: campos atuais + city,
   region, browser, os, is_bot, language, query_params, workspace_id.
4. 302. Código inexistente → 404 (inalterado).

Parse de UA: regex simples p/ browser (Chrome/Safari/Firefox/Edge/Instagram/
WhatsApp/etc.), OS (Android/iOS/Windows/macOS/Linux) e bot
(`bot|crawler|spider|facebookexternalhit|whatsapp`... — WhatsApp preview
conta como bot, não como clique humano nos dashboards futuros; o clique é
registrado mesmo assim, com `is_bot = true`).

## Erros e casos-limite

- Trigger de onboarding falhando não pode bloquear o signup? **Pode e deve**
  (sem workspace o app é inutilizável) — exceção propaga e o signup falha
  visivelmente, em vez de criar conta órfã.
- Usuário sem workspace (conta criada antes do trigger, se houver): painel
  mostra erro claro pedindo contato — não quebra silenciosamente.
- `query_params` vazio → coluna null (não `{}`), p/ facilitar filtros.
- Valores de headers geo vêm URL-encoded (ex. `S%C3%A3o%20Paulo`) → decodificar.

## Testes (antes da entrega)

1. Migration aplicada + advisors de segurança sem findings novos.
2. E2E navegador: cadastro do usuário A → cria cliente+link; cadastro do
   usuário B → **não vê** dados de A (e vice-versa); B cria os próprios.
3. Redirect produção: clique com `?fbclid=TESTE123` → 302 com fbclid no
   destino; linha em `clicks` com query_params, city/region, browser/os.
4. Dados do usuário real intactos (workspace migrado).
5. Limpeza dos usuários/dados de teste.

## Deploy

1. Migration via MCP (`apply_migration`).
2. Usuário desliga "Confirm email" no dashboard.
3. `npx vercel deploy --prod` (repo não conectado ao Git da Vercel).
4. Push do código no GitHub.
