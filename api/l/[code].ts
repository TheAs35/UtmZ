import type { VercelRequest, VercelResponse } from '@vercel/node'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

function detectDevice(ua: string): string {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectBrowser(ua: string): string | null {
  if (/instagram/i.test(ua)) return 'instagram'
  if (/fban|fbav|fb_iab/i.test(ua)) return 'facebook'
  if (/whatsapp/i.test(ua)) return 'whatsapp'
  if (/tiktok|musical_ly|bytedance/i.test(ua)) return 'tiktok'
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

function detectBot(ua: string): boolean {
  return /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp\/|telegram|slackbot|twitterbot|linkedinbot|pinterest|headless|curl\/|wget/i.test(ua)
}

function decodeHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code ?? '').trim()
  if (!code) return res.status(404).send('Link não encontrado')

  const { data: link, error } = await supabase
    .from('links')
    .select('id, workspace_id, destination_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
    .eq('short_code', code)
    .maybeSingle()

  if (error) return res.status(500).send('Erro interno')
  if (!link) return res.status(404).send('Link não encontrado')

  let destination: URL
  try {
    destination = new URL(link.destination_url)
  } catch {
    return res.status(500).send('URL de destino inválida')
  }

  // UTMs configuradas no link são a base…
  for (const key of UTM_KEYS) {
    const value = link[key]
    if (value) destination.searchParams.set(key, value)
  }

  // …e todo param que chegou no link curto (fbclid, gclid, ttclid, utm_*
  // do anúncio…) é repassado ao destino e vence em caso de conflito:
  // é o contexto real do clique. O pixel do site recebe tudo.
  const passthrough: Record<string, string> = {}
  for (const [key, raw] of Object.entries(req.query)) {
    if (key === 'code') continue
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value === 'string' && value !== '') {
      passthrough[key] = value
      destination.searchParams.set(key, value)
    }
  }

  const userAgent = String(req.headers['user-agent'] ?? '')
  const acceptLanguage = String(req.headers['accept-language'] ?? '')
  const language = acceptLanguage ? acceptLanguage.split(',')[0].split(';')[0].trim() || null : null

  // Registra o clique em segundo plano — não atrasa o redirect.
  waitUntil(
    Promise.resolve(
      supabase.from('clicks').insert({
        link_id: link.id,
        workspace_id: link.workspace_id,
        country: (req.headers['x-vercel-ip-country'] as string) || null,
        region: decodeHeader(req.headers['x-vercel-ip-country-region']),
        city: decodeHeader(req.headers['x-vercel-ip-city']),
        device: detectDevice(userAgent),
        browser: detectBrowser(userAgent),
        os: detectOs(userAgent),
        is_bot: detectBot(userAgent),
        language,
        referrer: (req.headers.referer as string) || null,
        user_agent: userAgent.slice(0, 500),
        query_params: Object.keys(passthrough).length > 0 ? passthrough : null,
      }),
    ).then(({ error: insertError }) => {
      if (insertError) console.error('Falha ao registrar clique:', insertError.message)
    }),
  )

  res.redirect(302, destination.toString())
}
