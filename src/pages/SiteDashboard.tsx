import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Period } from '../lib/stats'
import {
  byCampaign,
  byLanding,
  eventTable,
  eventsInPeriod,
  formatSeconds,
  funnel,
  hourGrid,
  inPeriod,
  overview,
  pct,
  sessionBreakdown,
} from '../lib/trackstats'
import { StatTile, BreakdownCard, HourHeatmap } from '../components/Charts'
import { SESSION_FIELDS, EVENT_FIELDS, type Site, type Session, type TrackEvent } from '../lib/types'

const DEVICE_LABEL: Record<string, string> = {
  mobile: 'celular',
  desktop: 'computador',
  tablet: 'tablet',
}

export default function SiteDashboard() {
  const { id } = useParams<{ id: string }>()
  const [site, setSite] = useState<Site | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<TrackEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>(30)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const [siteRes, sessRes, evRes] = await Promise.all([
        supabase.from('sites').select('*').eq('id', id).single(),
        supabase.from('sessions').select(SESSION_FIELDS).eq('site_id', id).gte('started_at', since).limit(20000),
        supabase.from('events').select(EVENT_FIELDS).eq('site_id', id).gte('ts', since).limit(20000),
      ])
      setSite(siteRes.data as Site | null)
      setSessions((sessRes.data as unknown as Session[]) ?? [])
      setEvents((evRes.data as unknown as TrackEvent[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  const visibleSessions = useMemo(() => inPeriod(sessions, period), [sessions, period])
  const visibleEvents = useMemo(() => eventsInPeriod(events, period), [events, period])
  const kpis = useMemo(() => overview(visibleSessions, visibleEvents), [visibleSessions, visibleEvents])
  const campaigns = useMemo(() => byCampaign(visibleSessions, visibleEvents), [visibleSessions, visibleEvents])
  const landings = useMemo(() => byLanding(visibleSessions, visibleEvents), [visibleSessions, visibleEvents])
  const steps = useMemo(() => funnel(visibleSessions, visibleEvents), [visibleSessions, visibleEvents])
  const eventRows = useMemo(() => eventTable(visibleSessions, visibleEvents), [visibleSessions, visibleEvents])
  const grid = useMemo(() => hourGrid(visibleSessions), [visibleSessions])

  if (loading) return <p className="muted">Carregando…</p>
  if (!site) return <p className="error">Site não encontrado.</p>

  const maxFunnel = steps[0]?.sessions ?? 0

  return (
    <>
      <div className="page-head">
        <div>
          <RouterLink to="/sites" className="muted back-link">← Sites</RouterLink>
          <h1>{site.name}</h1>
        </div>
      </div>

      <div className="filter-row">
        {([7, 30, 90] as Period[]).map((p) => (
          <button key={p} className={`chip ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
            {p} dias
          </button>
        ))}
      </div>

      {visibleSessions.length === 0 ? (
        <p className="muted">
          Nenhuma sessão no período. Confirme que o script está instalado na página
          (veja o snippet em <RouterLink to="/sites">Sites</RouterLink>).
        </p>
      ) : (
        <>
          <div className="kpi-row">
            <StatTile label="visitantes" value={kpis.visitors} />
            <StatTile label="sessões" value={kpis.sessions} />
            <StatTile label="leads" value={kpis.leads} />
            <StatTile label="conversão" value={pct(kpis.conversion)} />
            <StatTile label="tempo médio" value={formatSeconds(kpis.avgSeconds)} />
            <StatTile label="rejeição" value={pct(kpis.bounceRate)} />
          </div>

          <div className="card chart-card">
            <h4>Funil</h4>
            <div className="bar-list">
              {steps.map((step, i) => (
                <div className="bar-row funnel-row" key={step.label} title={`${step.label}: ${step.sessions}`}>
                  <span className="bar-label">{step.label}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${maxFunnel > 0 ? (step.sessions / maxFunnel) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="bar-count">
                    {step.sessions}{i > 0 && <span className="muted"> ({pct(step.rate)})</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card chart-card">
            <h4>Performance por campanha</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campanha</th><th>Origem</th><th>Sessões</th><th>Visitantes</th>
                    <th>Leads</th><th>Conversão</th><th>Tempo médio</th><th>Rejeição</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={`${c.campaign}|${c.source}`}>
                      <td>{c.campaign}</td>
                      <td>{c.source}</td>
                      <td className="num">{c.sessions}</td>
                      <td className="num">{c.visitors}</td>
                      <td className="num">{c.leads}</td>
                      <td className="num">{pct(c.conversion)}</td>
                      <td className="num">{formatSeconds(c.avgSeconds)}</td>
                      <td className="num">{pct(c.bounceRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card chart-card">
            <h4>Quando o público acessa (sessões por dia × hora)</h4>
            <HourHeatmap grid={grid} />
          </div>

          <div className="breakdown-grid">
            <BreakdownCard title="País" rows={sessionBreakdown(visibleSessions, (s) => s.country)} />
            <BreakdownCard title="Estado" rows={sessionBreakdown(visibleSessions, (s) => s.region)} />
            <BreakdownCard title="Cidade" rows={sessionBreakdown(visibleSessions, (s) => s.city)} />
            <BreakdownCard
              title="Dispositivo"
              rows={sessionBreakdown(visibleSessions, (s) => (s.device ? DEVICE_LABEL[s.device] ?? s.device : null))}
            />
            <BreakdownCard title="Sistema operacional" rows={sessionBreakdown(visibleSessions, (s) => s.os)} />
            <BreakdownCard title="Navegador" rows={sessionBreakdown(visibleSessions, (s) => s.browser)} />
          </div>

          <div className="card chart-card">
            <h4>Landing pages</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Página</th><th>Visitantes</th><th>Sessões</th><th>Tempo médio</th>
                    <th>Scroll médio</th><th>Conversão</th><th>Rejeição</th>
                  </tr>
                </thead>
                <tbody>
                  {landings.map((l) => (
                    <tr key={l.page}>
                      <td className="mono-cell">{l.page}</td>
                      <td className="num">{l.visitors}</td>
                      <td className="num">{l.sessions}</td>
                      <td className="num">{formatSeconds(l.avgSeconds)}</td>
                      <td className="num">{Math.round(l.avgScroll)}%</td>
                      <td className="num">{pct(l.conversion)}</td>
                      <td className="num">{pct(l.bounceRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card chart-card">
            <h4>Eventos</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Evento</th><th>Quantidade</th><th>Usuários únicos</th><th>Sessões que viraram lead</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((e) => (
                    <tr key={e.type}>
                      <td>{e.type}</td>
                      <td className="num">{e.count}</td>
                      <td className="num">{e.uniques}</td>
                      <td className="num">{pct(e.leadRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
