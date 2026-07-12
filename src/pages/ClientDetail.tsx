import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { shortLinkUrl } from '../lib/format'
import {
  breakdown,
  clicksByDay,
  effectiveUtm,
  filterClicks,
  type Period,
} from '../lib/stats'
import { StatTile, TimelineChart, BreakdownCard } from '../components/Charts'
import { CLICK_FIELDS, type Client, type Link, type Click } from '../lib/types'

const DEVICE_LABEL: Record<string, string> = {
  mobile: 'celular',
  desktop: 'computador',
  tablet: 'tablet',
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [clicks, setClicks] = useState<Click[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(30)
  const [includeBots, setIncludeBots] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const [clientRes, linksRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('links').select('*').eq('client_id', id).order('created_at'),
      ])
      const linkData = (linksRes.data as Link[]) ?? []
      setClient(clientRes.data as Client | null)
      setLinks(linkData)
      if (linkData.length > 0) {
        const { data: clickData } = await supabase
          .from('clicks')
          .select(CLICK_FIELDS)
          .in('link_id', linkData.map((l) => l.id))
          .gte('clicked_at', since)
          .order('clicked_at', { ascending: false })
          .limit(10000)
        setClicks((clickData as unknown as Click[]) ?? [])
      } else {
        setClicks([])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const linksById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links])

  const visible = useMemo(
    () => filterClicks(clicks, period, includeBots),
    [clicks, period, includeBots],
  )

  const byLink = useMemo(() => {
    const map = new Map<string, number>()
    for (const click of visible) map.set(click.link_id, (map.get(click.link_id) ?? 0) + 1)
    return map
  }, [visible])

  function copyLink(code: string) {
    navigator.clipboard.writeText(shortLinkUrl(code))
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  if (loading) return <p className="muted">Carregando…</p>
  if (!client) return <p className="error">Cliente não encontrado.</p>

  const botCount = filterClicks(clicks, period, true).length - filterClicks(clicks, period, false).length

  return (
    <>
      <div className="page-head">
        <div>
          <RouterLink to="/" className="muted back-link">← Clientes</RouterLink>
          <h1>{client.name}</h1>
        </div>
        <RouterLink to={`/novo-link?cliente=${client.id}`} className="btn btn-primary">
          + Novo link
        </RouterLink>
      </div>

      <div className="filter-row">
        {([7, 30, 90] as Period[]).map((p) => (
          <button
            key={p}
            className={`chip ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p} dias
          </button>
        ))}
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeBots}
            onChange={(e) => setIncludeBots(e.target.checked)}
          />
          incluir bots/previews ({botCount})
        </label>
      </div>

      <div className="kpi-row">
        <StatTile label={`cliques em ${period} dias`} value={visible.length} />
        <StatTile label="links" value={links.length} />
        <StatTile
          label="origem principal"
          value={breakdown(visible, (c) => effectiveUtm(c, linksById, 'utm_source'), 1)[0]?.label ?? '—'}
        />
        <StatTile
          label="campanha principal"
          value={breakdown(visible, (c) => effectiveUtm(c, linksById, 'utm_campaign'), 1)[0]?.label ?? '—'}
        />
      </div>

      <div className="card chart-card">
        <h4>Cliques por dia</h4>
        <TimelineChart data={clicksByDay(visible, period)} />
      </div>

      <div className="breakdown-grid">
        <BreakdownCard title="Origem (utm_source)" rows={breakdown(visible, (c) => effectiveUtm(c, linksById, 'utm_source'))} />
        <BreakdownCard title="Campanha" rows={breakdown(visible, (c) => effectiveUtm(c, linksById, 'utm_campaign'))} />
        <BreakdownCard title="País" rows={breakdown(visible, (c) => c.country)} />
        <BreakdownCard title="Cidade" rows={breakdown(visible, (c) => c.city)} />
        <BreakdownCard title="Dispositivo" rows={breakdown(visible, (c) => (c.device ? DEVICE_LABEL[c.device] ?? c.device : null))} />
        <BreakdownCard title="Navegador" rows={breakdown(visible, (c) => c.browser)} />
      </div>

      <h2>Links</h2>
      {links.length === 0 ? (
        <p className="muted">Nenhum link ainda.</p>
      ) : (
        <div className="link-list">
          {links.map((link) => (
            <div key={link.id} className="card link-card">
              <div className="link-head">
                <div>
                  <h3>{link.label || link.short_code}</h3>
                  <code className="short-url">{shortLinkUrl(link.short_code)}</code>
                </div>
                <div className="link-actions">
                  <span className="click-badge">
                    <strong>{byLink.get(link.id) ?? 0}</strong> cliques em {period} dias
                  </span>
                  <button className="btn btn-ghost" onClick={() => copyLink(link.short_code)}>
                    {copied === link.short_code ? 'Copiado ✔' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
