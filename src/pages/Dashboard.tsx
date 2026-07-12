import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { clicksByDay, countLastDays, filterClicks, type ClickTime } from '../lib/stats'
import { StatTile, TimelineChart } from '../components/Charts'

interface ClientRow {
  id: string
  name: string
  links: { id: string; clicks: { count: number }[] }[]
}

export default function Dashboard() {
  const workspace = useWorkspace()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [clicks, setClicks] = useState<ClickTime[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [clientsRes, clicksRes] = await Promise.all([
      supabase.from('clients').select('id, name, links(id, clicks(count))').order('name'),
      supabase
        .from('clicks')
        .select('clicked_at, is_bot')
        .gte('clicked_at', since)
        .limit(10000),
    ])
    if (clientsRes.error) setError(clientsRes.error.message)
    setClients((clientsRes.data as ClientRow[]) ?? [])
    setClicks((clicksRes.data as ClickTime[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const { error: insError } = await supabase
      .from('clients')
      .insert({ name, workspace_id: workspace.id })
    setSaving(false)
    if (insError) {
      setError(insError.message)
      return
    }
    setNewName('')
    load()
  }

  function totals(client: ClientRow) {
    const linkCount = client.links.length
    const clickCount = client.links.reduce((sum, l) => sum + (l.clicks[0]?.count ?? 0), 0)
    return { linkCount, clickCount }
  }

  return (
    <>
      <div className="page-head">
        <h1>Clientes</h1>
        <form className="inline-form" onSubmit={handleCreateClient}>
          <input
            placeholder="Nome do novo cliente"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar'}
          </button>
        </form>
      </div>

      {error && <p className="error">{error}</p>}
      {!loading && clients.length > 0 && (
        <>
          <div className="kpi-row">
            <StatTile label="cliques nos últimos 7 dias" value={countLastDays(clicks, 7)} />
            <StatTile label="cliques nos últimos 30 dias" value={countLastDays(clicks, 30)} />
            <StatTile label="links ativos" value={clients.reduce((sum, c) => sum + c.links.length, 0)} />
            <StatTile label="clientes" value={clients.length} />
          </div>
          <div className="card chart-card">
            <h4>Cliques por dia — últimos 30 dias</h4>
            <TimelineChart data={clicksByDay(filterClicks(clicks, 30, false), 30)} />
          </div>
        </>
      )}
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : clients.length === 0 ? (
        <p className="muted">Nenhum cliente ainda. Cadastre o primeiro acima.</p>
      ) : (
        <div className="card-grid">
          {clients.map((client) => {
            const { linkCount, clickCount } = totals(client)
            return (
              <Link key={client.id} to={`/cliente/${client.id}`} className="card client-card">
                <h2>{client.name}</h2>
                <div className="stats-row">
                  <span><strong>{clickCount}</strong> cliques</span>
                  <span><strong>{linkCount}</strong> links</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
