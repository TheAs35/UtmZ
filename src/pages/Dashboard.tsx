import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ClientRow {
  id: string
  name: string
  links: { id: string; clicks: { count: number }[] }[]
}

export default function Dashboard() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error: qError } = await supabase
      .from('clients')
      .select('id, name, links(id, clicks(count))')
      .order('name')
    if (qError) setError(qError.message)
    setClients((data as ClientRow[]) ?? [])
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
    const { error: insError } = await supabase.from('clients').insert({ name })
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
