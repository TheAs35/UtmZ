import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import type { Site } from '../lib/types'

function snippet(siteId: string): string {
  return `<script async src="${window.location.origin}/t.js" data-site="${siteId}"></script>`
}

export default function Sites() {
  const workspace = useWorkspace()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error: qError } = await supabase.from('sites').select('*').order('created_at')
    if (qError) setError(qError.message)
    setSites((data as Site[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error: insError } = await supabase.from('sites').insert({
      workspace_id: workspace.id,
      name: name.trim(),
      domain: domain.trim() || null,
    })
    setSaving(false)
    if (insError) {
      setError(insError.message)
      return
    }
    setName('')
    setDomain('')
    load()
  }

  function copySnippet(siteId: string) {
    navigator.clipboard.writeText(snippet(siteId))
    setCopied(siteId)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <>
      <div className="page-head">
        <h1>Sites rastreados</h1>
      </div>

      <form className="card form-card" onSubmit={handleCreate}>
        <div className="field-grid">
          <label>
            Nome do site *
            <input placeholder="ex: LP Black Friday" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Domínio (opcional)
            <input placeholder="ex: lp.cliente.com.br" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Criando…' : 'Adicionar site'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : sites.length === 0 ? (
        <p className="muted">Nenhum site ainda. Cadastre acima e instale o script na página.</p>
      ) : (
        <div className="link-list">
          {sites.map((site) => (
            <div key={site.id} className="card">
              <div className="link-head">
                <div>
                  <h3><Link to={`/site/${site.id}`}>{site.name}</Link></h3>
                  {site.domain && <span className="muted">{site.domain}</span>}
                </div>
                <div className="link-actions">
                  <Link to={`/site/${site.id}`} className="btn btn-primary">Ver dados</Link>
                  <button className="btn btn-ghost" onClick={() => copySnippet(site.id)}>
                    {copied === site.id ? 'Copiado ✔' : 'Copiar script'}
                  </button>
                </div>
              </div>
              <p className="muted" style={{ marginBottom: 0 }}>
                Cole antes do <code>&lt;/head&gt;</code> da página:
              </p>
              <code className="short-url" style={{ display: 'block', marginTop: '0.4rem' }}>
                {snippet(site.id)}
              </code>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
