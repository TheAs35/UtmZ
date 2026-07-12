import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { shortLinkUrl, formatDate } from '../lib/format'
import type { Client, Link, Click } from '../lib/types'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [clicks, setClicks] = useState<Click[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      const [clientRes, linksRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('links').select('*').eq('client_id', id).order('created_at'),
      ])
      const clientData = clientRes.data as Client | null
      const linkData = (linksRes.data as Link[]) ?? []
      setClient(clientData)
      setLinks(linkData)
      if (linkData.length > 0) {
        const { data: clickData } = await supabase
          .from('clicks')
          .select('link_id, clicked_at, country, device, referrer')
          .in('link_id', linkData.map((l) => l.id))
          .order('clicked_at', { ascending: false })
          .limit(10000)
        setClicks((clickData as Click[]) ?? [])
      } else {
        setClicks([])
      }
      setLoading(false)
    }
    load()
  }, [id])

  const clicksByLink = useMemo(() => {
    const map = new Map<string, Click[]>()
    for (const click of clicks) {
      const list = map.get(click.link_id) ?? []
      list.push(click)
      map.set(click.link_id, list)
    }
    return map
  }, [clicks])

  function copyLink(code: string) {
    navigator.clipboard.writeText(shortLinkUrl(code))
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  if (loading) return <p className="muted">Carregando…</p>
  if (!client) return <p className="error">Cliente não encontrado.</p>

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

      <p className="muted">
        Total: <strong>{clicks.length}</strong> cliques em <strong>{links.length}</strong> links
      </p>

      {links.length === 0 ? (
        <p className="muted">Nenhum link ainda.</p>
      ) : (
        <div className="link-list">
          {links.map((link) => {
            const linkClicks = clicksByLink.get(link.id) ?? []
            const isOpen = expanded === link.id
            return (
              <div key={link.id} className="card link-card">
                <div className="link-head">
                  <div>
                    <h3>{link.label || link.short_code}</h3>
                    <code className="short-url">{shortLinkUrl(link.short_code)}</code>
                  </div>
                  <div className="link-actions">
                    <span className="click-badge"><strong>{linkClicks.length}</strong> cliques</span>
                    <button className="btn btn-ghost" onClick={() => copyLink(link.short_code)}>
                      {copied === link.short_code ? 'Copiado ✔' : 'Copiar'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setExpanded(isOpen ? null : link.id)}
                    >
                      {isOpen ? 'Fechar' : 'Detalhes'}
                    </button>
                  </div>
                </div>
                {isOpen && <LinkStats link={link} clicks={linkClicks} />}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function countBy(clicks: Click[], key: (c: Click) => string): [string, number][] {
  const map = new Map<string, number>()
  for (const click of clicks) {
    const k = key(click)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

function LinkStats({ link, clicks }: { link: Link; clicks: Click[] }) {
  const byDay = countBy(clicks, (c) => formatDate(c.clicked_at)).slice(0, 14)
  const byCountry = countBy(clicks, (c) => c.country || '—')
  const byDevice = countBy(clicks, (c) => c.device || '—')

  const utms = [
    ['source', link.utm_source],
    ['medium', link.utm_medium],
    ['campaign', link.utm_campaign],
    ['content', link.utm_content],
    ['term', link.utm_term],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="link-stats">
      <p className="muted">
        Destino: <code>{link.destination_url}</code>
        {utms.length > 0 && (
          <> · UTMs: {utms.map(([k, v]) => `${k}=${v}`).join(', ')}</>
        )}
      </p>
      {clicks.length === 0 ? (
        <p className="muted">Nenhum clique registrado ainda.</p>
      ) : (
        <div className="stats-grid">
          <StatTable title="Por dia" rows={byDay} />
          <StatTable title="Por país" rows={byCountry} />
          <StatTable title="Por dispositivo" rows={byDevice} />
        </div>
      )}
    </div>
  )
}

function StatTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <h4>{title}</h4>
      <table>
        <tbody>
          {rows.map(([label, count]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
