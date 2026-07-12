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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code ?? '').trim()
  if (!code) return res.status(404).send('Link não encontrado')

  const { data: link, error } = await supabase
    .from('links')
    .select('id, destination_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
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
  for (const key of UTM_KEYS) {
    const value = link[key]
    if (value) destination.searchParams.set(key, value)
  }

  const userAgent = String(req.headers['user-agent'] ?? '')
  const country = (req.headers['x-vercel-ip-country'] as string) || null
  const referrer = (req.headers.referer as string) || null

  // Registra o clique em segundo plano — não atrasa o redirect.
  waitUntil(
    Promise.resolve(
      supabase.from('clicks').insert({
        link_id: link.id,
        country,
        device: detectDevice(userAgent),
        referrer,
        user_agent: userAgent.slice(0, 500),
      }),
    ).then(({ error: insertError }) => {
      if (insertError) console.error('Falha ao registrar clique:', insertError.message)
    }),
  )

  res.redirect(302, destination.toString())
}
