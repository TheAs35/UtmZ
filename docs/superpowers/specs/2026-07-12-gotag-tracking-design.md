# UtmZ — GoTag: tracking de landing pages (fase 3)

Data: 2026-07-12 · Status: aprovado (usuário delegou decisões; spec do produto fornecido por ele)

## Objetivo

Script leve instalado no site do cliente que rastreia sessões, origem
(UTMs/fbclid/gclid), cliques, scroll, formulários e vídeo — alimentando
dashboards por site: visão geral, campanhas, temporal, geográfico,
dispositivos, landing pages, funil e lista de eventos.

**Fora desta fase (própria fase futura):** Session Replay e heatmaps de
clique/movimento (rrweb + storage pesado; free tier não comporta), mapa
geográfico interativo (por ora tabelas país/estado/cidade), CAPI.
Heatmap de scroll aproximado via marcos de profundidade por página.

## Modelo de dados (todas c/ workspace_id + RLS de membro p/ select)

- `sites` — id (usado como chave pública do script), workspace_id, name,
  domain, created_at. CRUD por membros.
- `visitors` — id (uuid gerado no navegador), site_id, workspace_id,
  first_seen, first_landing, first_referrer, first_params jsonb
  (utms+fbclid+gclid+uzclid da 1ª visita — item 3 do spec: fica vinculado
  ao visitante p/ sempre).
- `sessions` — id (uuid do navegador), visitor_id, site_id, workspace_id,
  started_at, last_seen_at (tempo de permanência = last_seen - started),
  landing_page, referrer, params jsonb, device, browser, os, country,
  region, city, pageviews int, events int, has_lead bool.
- `events` — id bigint, session_id, visitor_id, site_id, workspace_id,
  ts, type, page, data jsonb. Tipos: pageview, click, whatsapp_click,
  link_click, scroll (data.pct), form_start, form_field (data.field),
  form_submit, video_start/25/50/75/complete, heartbeat não é evento
  (só atualiza last_seen).
- `clicks.track_id uuid default gen_random_uuid()` — o redirect passa a
  anexar `uzclid=<track_id>` na URL de destino; o GoTag captura e grava
  em params → funil anúncio → link curto → sessão → lead.

Escritas SÓ pelo servidor (service_role). Cliente do painel: select.

## Ingestão — `POST /api/t`

- CORS aberto (script roda no domínio do cliente); aceita sendBeacon.
- Payload: `{ site, visitor, session, events: [{type, page, data, ts}],
  meta: { landing, referrer, params, start } }`.
- Servidor: valida site existe → resolve geo (headers Vercel) e UA →
  upsert visitor (só 1ª vez grava first_*) → upsert session (cria ou
  atualiza last_seen/contadores; marca has_lead em form_submit) →
  insere eventos. Nunca confia em workspace_id vindo do cliente — deriva
  do site.
- Anti-abuso mínimo: payload ≤ 50 eventos, strings truncadas.

## Script — `public/t.js` (servido em https://utmz.vercel.app/t.js)

Instalação (mostrada na tela do site):
`<script async src="https://utmz.vercel.app/t.js" data-site="SITE_ID"></script>`

- Vanilla, ~4 kB, zero dependências, async, try/catch em volta de tudo.
- visitor_id: localStorage `_uz_vid` (uuid). session: sessionStorage
  `_uz_sid` c/ janela deslizante de 30 min.
- 1ª visita: salva utm_*, fbclid, gclid, uzclid, landing, referrer.
- Eventos automáticos: pageview (inclui SPA via pushState hook);
  cliques em `a`/`button`/`[role=button]`/`input[type=submit]` c/
  classificação (whatsapp_click p/ wa.me/api.whatsapp, link_click
  externo, click demais) + texto do elemento (60 chars) + posição
  aproximada (% x/y); scroll 25/50/75/90/100 (1x por página);
  form_start (1º input), form_field (blur c/ valor preenchido — só o
  NOME do campo, nunca o valor), form_submit; vídeo HTML5
  start/25/50/75/complete.
- Tempo de permanência: heartbeat a cada 15s (só atualiza last_seen) +
  flush em visibilitychange/beforeunload via sendBeacon.
- Integrações MVP: cada evento também é empurrado p/
  `window.dataLayer` (GTM/GA4) e `fbq('trackCustom', ...)` se existirem.
- Fila em memória, flush a cada 5s ou 10 eventos.

## Painel

- Nav ganha "Sites". Página Sites: criar (nome+domínio), listar,
  copiar snippet.
- Página do site (`/site/:id`), filtro período 7/30/90 no topo, seções:
  1. Visão geral: visitantes, sessões, leads, conversão (leads/visitantes),
     tempo médio de sessão, bounce (sessões c/ 1 pageview e sem clique).
  2. Campanhas: tabela campanha × origem × sessões × visitantes × leads ×
     conversão × tempo médio × rejeição.
  3. Temporal: grade dia-da-semana × hora (heatmap sequencial azul,
     ramp validada).
  4. Geográfico: barras país / estado / cidade c/ visitantes e leads.
  5. Dispositivos: device / OS / navegador.
  6. Landing pages: tabela página × visitantes × sessões × tempo ×
     scroll médio × conversão × rejeição.
  7. Funil: visitante → pageview → scroll 50 → clique → form_start →
     form_submit c/ taxas entre etapas.
  8. Eventos: tabela tipo × quantidade × usuários únicos.
- Agregação client-side (fetch sessions+events do período, limite 20k
  linhas) — trocar por RPCs agregadas quando o volume crescer.

## Testes antes da entrega

Página HTML real c/ o script apontando p/ produção, aberta no navegador:
gera visitante/sessão/eventos de verdade (pageview, cliques, scroll,
form, vídeo) → conferir ingestão no banco, dashboards c/ números certos,
uzclid ligando clique do link curto à sessão. Limpar dados de teste.
