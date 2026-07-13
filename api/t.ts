import type { VercelRequest, VercelResponse } from '@vercel/node'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES = new Set([
  'pageview', 'click', 'whatsapp_click', 'call_click', 'link_click', 'scroll',
  'form_start', 'form_field', 'form_submit',
  'video_start', 'video_25', 'video_50', 'video_75', 'video_complete', 'ping',
])

function detectDevice(ua: string): string {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}
function detectBrowser(ua: string): string | null {
  if (/instagram/i.test(ua)) return 'instagram'
  if (/fban|fbav|fb_iab/i.test(ua)) return 'facebook'
  if (/edg\//i.test(ua)) return 'edge'
  if (/opr\/|opera/i.test(ua)) return 'opera'
  if (/samsungbrowser/i.test(ua)) return 'samsung'
  if (/firefox\/|fxios/i.test(ua)) return 'firefox'
  if (/chrome\/|crios/i.test(ua)) return 'chrome'
  if (/safari\//i.test(ua)) return 'safari'
  return null
}
function detectOs(ua: string): string | null {
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/windows/i.test(ua)) return 'windows'
  if (/mac os x|macintosh/i.test(ua)) return 'macos'
  if (/linux/i.test(ua)) return 'linux'
  return null
}
function decodeHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  try { return decodeURIComponent(raw) } catch { return raw }
}
function clean(value: unknown, max: number): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // sendBeacon envia credenciais → ACAO não pode ser '*': ecoa o Origin.
  res.setHeader('Access-Control-Allow-Origin', (req.headers.origin as string) || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'método' })

  let body = req.body as Record<string, unknown>
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'json' }) }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'payload' })

  const site = String(body.site ?? '')
  const visitorId = String(body.visitor ?? '')
  const sessionId = String(body.session ?? '')
  if (!UUID_RE.test(site) || !UUID_RE.test(visitorId) || !UUID_RE.test(sessionId))
    return res.status(400).json({ error: 'ids' })

  const rawEvents = Array.isArray(body.events) ? (body.events as Record<string, unknown>[]).slice(0, 50) : []
  const meta = (body.meta ?? {}) as Record<string, unknown>

  const { data: siteRow } = await supabase
    .from('sites')
    .select('id, workspace_id')
    .eq('id', site)
    .maybeSingle()
  if (!siteRow) return res.status(404).json({ error: 'site' })

  const ua = String(req.headers['user-agent'] ?? '')
  const params =
    meta.params && typeof meta.params === 'object' && Object.keys(meta.params as object).length > 0
      ? (meta.params as Record<string, string>)
      : null

  const work = (async () => {
    // Visitante: grava a 1ª visita (origem fica vinculada p/ sempre)
    await supabase.from('visitors').upsert(
      {
        id: visitorId,
        site_id: siteRow.id,
        workspace_id: siteRow.workspace_id,
        first_landing: clean(meta.landing, 500),
        first_referrer: clean(meta.referrer, 500),
        first_params: params,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

    // Sessão: cria (c/ UA + geo) ou atualiza atividade
    const { data: existing } = await supabase
      .from('sessions').select('id').eq('id', sessionId).maybeSingle()

    const hasLead = rawEvents.some((e) => e.type === 'form_submit')
    if (!existing) {
      await supabase.from('sessions').insert({
        id: sessionId,
        visitor_id: visitorId,
        site_id: siteRow.id,
        workspace_id: siteRow.workspace_id,
        landing_page: clean(meta.landing, 500),
        referrer: clean(meta.referrer, 500),
        params,
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        os: detectOs(ua),
        country: (req.headers['x-vercel-ip-country'] as string) || null,
        region: decodeHeader(req.headers['x-vercel-ip-country-region']),
        city: decodeHeader(req.headers['x-vercel-ip-city']),
        has_lead: hasLead,
      })
    } else {
      const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
      if (hasLead) update.has_lead = true
      await supabase.from('sessions').update(update).eq('id', sessionId)
    }

    // Eventos (ping só atualiza atividade, não vira linha)
    const rows = rawEvents
      .filter((e) => EVENT_TYPES.has(String(e.type)) && e.type !== 'ping')
      .map((e) => {
        const ts = Number(e.ts)
        const when = Number.isFinite(ts) && Math.abs(Date.now() - ts) < 24 * 60 * 60 * 1000
          ? new Date(ts).toISOString()
          : new Date().toISOString()
        return {
          session_id: sessionId,
          visitor_id: visitorId,
          site_id: siteRow.id,
          workspace_id: siteRow.workspace_id,
          ts: when,
          type: String(e.type),
          page: clean(e.page, 300),
          data: e.data && typeof e.data === 'object' ? e.data : null,
        }
      })
    if (rows.length > 0) {
      const { error } = await supabase.from('events').insert(rows)
      if (error) console.error('Falha ao inserir eventos:', error.message)
    }
  })()

  waitUntil(work)
  return res.status(202).json({ ok: true })
}
