# UtmZ — Rastreador de Links / UTMs multi-cliente

Ferramenta interna de agência para criar links curtos rastreáveis (com UTMs) e medir
os cliques de cada link, organizados por cliente.

**Stack:** React 19 + Vite (painel) · Supabase (Postgres + Auth + RLS) · Vercel
(hospedagem + função de redirect).

## Como funciona

```
Pessoa clica em  ->  seu-projeto.vercel.app/l/adriane-gmb
                     |
                     |  (Vercel Function: api/l/[code].ts)
                     |  1. busca o código no Supabase (service_role key)
                     |  2. registra o clique em background (waitUntil)
                     |     - país: header x-vercel-ip-country
                     |     - dispositivo: User-Agent
                     |  3. redireciona (302) já com as UTMs
                     v
Pessoa chega em  ->  https://cliente.com.br/?utm_source=google&utm_medium=gmb&...
```

## Passo a passo de publicação

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** e rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → Users**, crie o usuário da agência (e-mail + senha).
4. Anote em **Settings → API**: `Project URL`, `anon key` e `service_role key`.

### 2. Rodar local

```bash
npm install
cp .env.example .env   # preencha com as chaves do Supabase
npm run dev
```

> O redirect `/l/:code` é uma Vercel Function e não roda no `npm run dev` do Vite.
> Para testar tudo local, use `npx vercel dev` (requer login na Vercel).

### 3. Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com): **Add New → Project** → importe o repo
   (framework: Vite, detectado automático).
3. Em **Settings → Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` — Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` — anon key
   - `SUPABASE_URL` — Project URL (de novo, para a função de redirect)
   - `SUPABASE_SERVICE_KEY` — service_role key (**secreta, só no servidor**)
4. Deploy. O painel fica em `https://seu-projeto.vercel.app` e os links curtos em
   `https://seu-projeto.vercel.app/l/CODIGO`.

### 4. Domínio próprio (opcional, depois)

Em **Settings → Domains** do projeto na Vercel, adicione ex. `link.suaagencia.com`
e aponte o CNAME no seu DNS. Os links curtos passam a ser
`https://link.suaagencia.com/l/adriane-gmb`.

### 5. Testar o fluxo completo

1. Faça login no painel, cadastre um cliente e crie um link.
2. Abra o link curto em aba anônima → deve redirecionar ao destino com as UTMs.
3. Volte ao painel → o clique aparece nas estatísticas do link (total, dia, país,
   dispositivo).

## Rotas

| Rota | O que faz |
|---|---|
| `GET /l/:code` | Redirect público que registra o clique (Vercel Function). |
| `/login` | Login (Supabase Auth, e-mail/senha). |
| `/` | Painel: clientes + total de cliques. Exige login. |
| `/cliente/:id` | Links do cliente + estatísticas (dia/país/dispositivo). |
| `/novo-link` | Cria link: cliente + URL + UTMs → gera short_code `cliente-canal`. |

## Regras de negócio

- UTMs são gravadas **em minúsculo, com espaços viram `_`**.
- `short_code` legível no formato `cliente-canal` (ex: `adriane-gmb`), editável
  antes de salvar, único no banco.
- Só a agência loga (RLS: qualquer usuário autenticado lê tudo). A função de
  redirect usa a `service_role` key, que ignora o RLS e nunca vai ao navegador.
