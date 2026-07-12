# Briefing: Rastreador de Links / UTMs multi-cliente

Documento para entregar ao **Claude Code**. Contém o objetivo, a arquitetura, o
banco de dados, os passos de publicação e os prompts prontos pra colar.

---

## 1. Objetivo

Ferramenta interna de agência para **criar links rastreáveis (com UTMs) e medir os
cliques de cada link, organizados por cliente**.

Cada cliente (ex: "Adriane Siqueira") tem vários links: Meta, Google, link da bio,
e-mail, etc. Cada link tem um código curto próprio (ex: `adriane-gmb`) e junta as
estatísticas de clique (quantidade, data/hora, país, dispositivo, origem).

Painel com login, onde eu:
- cadastro clientes;
- crio links (URL de destino + UTMs) e recebo o link curto pronto;
- vejo os números de cliques por cliente e por link.

---

## 2. Stack definida

| Camada | Ferramenta |
|---|---|
| Banco de dados + Auth | **Supabase** (Postgres, Supabase Auth, Row Level Security) |
| Hospedagem + redirecionamento | **Cloudflare** (Pages + Pages Functions, ou Worker com static assets) |
| Frontend do painel | React + Vite (ou o que o Claude Code sugerir) |

> Observação: como o núcleo do app é uma função de servidor (o redirect que registra
> o clique), tanto **Cloudflare Pages + Functions** quanto **Worker com static assets**
> funcionam. Pages é mais simples pra começar (git push e pronto). Se preferir o
> caminho recomendado da Cloudflare pra projetos full-stack novos, use Worker com
> static assets. Comece pela opção mais confortável.

---

## 3. Como o rastreamento funciona (o ponto central)

A UTM sozinha só é lida pelo Google Analytics **depois** que a pessoa chega no site.
Pra contar o clique no **nosso próprio painel**, o link divulgado não é o do site
direto — é um **link curto nosso** que passa pelo nosso sistema primeiro:

```
Pessoa clica em  ->  seudominio.com/l/adriane-gmb
                     |
                     |  (Cloudflare Function / Worker)
                     |  1. busca o código "adriane-gmb" no Supabase
                     |  2. registra o clique (data, país, dispositivo, referrer)
                     |  3. redireciona (302) para a URL de destino já com as UTMs
                     v
Pessoa chega em  ->  https://cliente.com.br/?utm_source=google&utm_medium=gmb&...
```

Dois detalhes que a Cloudflare facilita:
- **País e dispositivo de graça**: usar `request.cf.country` e o cabeçalho
  `CF-IPCountry`; o dispositivo (mobile/desktop) sai do `User-Agent`.
- **Não atrasar o usuário**: registrar o clique em segundo plano com
  `context.waitUntil(...)` e retornar o redirect imediatamente.

---

## 4. Modelo de dados (rodar no SQL Editor do Supabase)

```sql
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
  label           text,                          -- ex: "Google Meu Negócio"
  destination_url text not null,                 -- URL final (sem as UTMs)
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

create policy "logados leem clients" on clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logados leem links" on links
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logados leem clicks" on clicks
  for select using (auth.role() = 'authenticated');
```

> Se no futuro cada cliente for logar e ver só os próprios dados, dá pra evoluir o RLS
> pra filtrar por `client_id`. Por enquanto, o modelo acima é "só a agência acessa".

---

## 5. Segurança das chaves (importante)

- **`service_role` key**: usada SÓ no servidor (na Function/Worker do redirect e nas
  operações de escrita do painel). Nunca vai pro navegador. Guardar como secret/env
  var na Cloudflare.
- **`anon` key**: pode ir pro frontend; combinada com o RLS + login do Supabase Auth.
- O painel exige **login** (Supabase Auth, e-mail/senha). Sem login, não lê nada.

---

## 6. Rotas do app

| Rota | O que faz |
|---|---|
| `GET /l/:code` | Redirect que registra o clique (a Function/Worker). Público. |
| `/login` | Tela de login (Supabase Auth). |
| `/` (painel) | Lista de clientes + resumo de cliques. Exige login. |
| `/cliente/:id` | Links do cliente + estatísticas por link. Exige login. |
| `/novo-link` | Formulário: escolhe cliente, URL, UTMs → gera o `short_code` e o link curto. |

---

## 7. Passo a passo de publicação

1. **Supabase**: criar projeto → SQL Editor → rodar o script da seção 4. Anotar
   `Project URL`, `anon key` e `service_role key` (em Settings → API).
2. **Repositório**: criar repo no GitHub com o projeto (o Claude Code monta).
3. **Cloudflare**: conectar o repo (Pages → "Connect to Git", ou `wrangler deploy`
   pra Worker). Definir as env vars/secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_KEY`.
4. **Domínio**: apontar um subdomínio curto pros links, ex: `link.suaagencia.com`,
   pro projeto da Cloudflare.
5. **Testar**: criar um link no painel, abrir o link curto, confirmar que o clique
   aparece no painel e que o redirect leva ao destino com as UTMs.

---

## 8. Prompts prontos pra colar no Claude Code

Cole um de cada vez, na ordem. Ajuste nomes conforme quiser.

**Prompt 1 — estrutura e banco**
```
Quero criar um app de rastreamento de links/UTMs multi-cliente para uma agência.
Stack: frontend em React + Vite, banco no Supabase (Postgres + Auth + RLS),
hospedagem na Cloudflare (Pages com Functions, ou Worker com static assets — me
recomende o melhor). Comece criando a estrutura do projeto e o arquivo de schema
SQL do Supabase com as tabelas clients, links e clicks (vou colar o schema que já
tenho). Configure as variáveis de ambiente para SUPABASE_URL, SUPABASE_ANON_KEY e
SUPABASE_SERVICE_KEY. [colar aqui o SQL da seção 4]
```

**Prompt 2 — o redirect que registra o clique**
```
Agora crie a rota GET /l/:code na Cloudflare. Ela deve: buscar o short_code na
tabela links (usando a service_role key, no servidor), montar a URL de destino
concatenando as UTMs, registrar o clique na tabela clicks em segundo plano com
context.waitUntil (capturando país via request.cf.country / CF-IPCountry,
dispositivo a partir do User-Agent, e o referrer), e retornar um redirect 302 para
a URL final. Se o código não existir, retornar 404.
```

**Prompt 3 — o painel**
```
Crie o painel com login via Supabase Auth (e-mail/senha). Depois de logado:
tela inicial listando os clientes com o total de cliques de cada um; tela do cliente
com seus links e as estatísticas por link (total de cliques, cliques por dia, por
país e por dispositivo); e um formulário para criar um novo link (escolher cliente,
digitar URL de destino e as UTMs, gerar automaticamente o short_code e mostrar o
link curto pronto pra copiar). Aplique as UTMs sempre em minúsculo, trocando espaços
por underline.
```

**Prompt 4 — publicação**
```
Me guie no deploy: conectar o repositório na Cloudflare, configurar os secrets/
variáveis de ambiente, apontar o subdomínio dos links, e testar o fluxo completo
criando um link e confirmando que o clique é registrado.
```

---

## 9. Decisões pra confirmar antes/durante

- **Domínio dos links curtos**: qual subdomínio usar? (ex: `link.suaagencia.com`)
- **Quem loga**: só você/a equipe da agência, ou os clientes também vão ter acesso
  aos próprios números? (muda o RLS)
- **Formato do short_code**: automático aleatório (`x7Ka9`) ou legível
  (`cliente-canal`, ex: `adriane-gmb`)? O legível é mais fácil de organizar.
- **GA4**: manter também? Dá pra usar os dois juntos — seu painel conta o clique,
  e o GA4 continua vendo quem chega no site.
```