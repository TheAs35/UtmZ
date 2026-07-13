import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify, formatUtm, shortLinkUrl } from '../lib/format'
import { useWorkspace } from '../lib/workspace'
import type { Client } from '../lib/types'

export default function NewLink() {
  const workspace = useWorkspace()
  const [clients, setClients] = useState<Client[]>([])
  const [searchParams] = useSearchParams()
  const [clientId, setClientId] = useState(searchParams.get('cliente') ?? '')
  const [label, setLabel] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [utmContent, setUtmContent] = useState('')
  const [utmTerm, setUtmTerm] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])

  const suggestedCode = useMemo(() => {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return ''
    const channel = utmMedium || utmSource || label
    return channel ? `${slugify(client.name)}-${slugify(channel)}` : slugify(client.name)
  }, [clients, clientId, utmMedium, utmSource, label])

  const effectiveCode = codeTouched ? shortCode : suggestedCode

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const code = slugify(effectiveCode)
    if (!code) {
      setError('Informe um código para o link.')
      return
    }
    let parsed: URL
    try {
      parsed = new URL(destinationUrl)
    } catch {
      setError('URL de destino inválida. Use o endereço completo, com https://')
      return
    }
    setSaving(true)
    const { error: insError } = await supabase.from('links').insert({
      workspace_id: workspace.id,
      client_id: clientId,
      short_code: code,
      label: label.trim() || null,
      destination_url: parsed.toString(),
      utm_source: utmSource ? formatUtm(utmSource) : null,
      utm_medium: utmMedium ? formatUtm(utmMedium) : null,
      utm_campaign: utmCampaign ? formatUtm(utmCampaign) : null,
      utm_content: utmContent ? formatUtm(utmContent) : null,
      utm_term: utmTerm ? formatUtm(utmTerm) : null,
    })
    setSaving(false)
    if (insError) {
      setError(
        insError.code === '23505'
          ? `O código "${code}" já existe. Escolha outro.`
          : insError.message,
      )
      return
    }
    setCreatedCode(code)
  }

  if (createdCode) {
    const url = shortLinkUrl(createdCode, clients.find((c) => c.id === clientId)?.domain)
    return (
      <div className="card success-card">
        <h1>Link criado ✔</h1>
        <p className="muted">Divulgue este endereço:</p>
        <div className="copy-row">
          <code className="short-url">{url}</code>
          <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(url)}>
            Copiar
          </button>
        </div>
        <div className="actions-row">
          <button className="btn btn-ghost" onClick={() => navigate(`/cliente/${clientId}`)}>
            Ver links do cliente
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setCreatedCode(null)
              setLabel('')
              setDestinationUrl('')
              setShortCode('')
              setCodeTouched(false)
            }}
          >
            Criar outro
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>Novo link</h1>
      </div>
      <form className="card form-card" onSubmit={handleSubmit}>
        <label>
          Cliente *
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Selecione…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Nome do link (interno)
          <input
            placeholder="ex: Google Meu Negócio"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label>
          URL de destino *
          <input
            type="url"
            placeholder="https://site-do-cliente.com.br/"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            required
          />
        </label>
        <div className="field-grid">
          <label>
            utm_source
            <input placeholder="google" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} />
          </label>
          <label>
            utm_medium
            <input placeholder="gmb" value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} />
          </label>
          <label>
            utm_campaign
            <input placeholder="lancamento_2026" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} />
          </label>
          <label>
            utm_content
            <input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} />
          </label>
          <label>
            utm_term
            <input value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} />
          </label>
        </div>
        <label>
          Código do link curto
          <input
            placeholder="cliente-canal"
            value={effectiveCode}
            onChange={(e) => {
              setCodeTouched(true)
              setShortCode(e.target.value)
            }}
          />
        </label>
        {effectiveCode && (
          <p className="muted">
            Link final:{' '}
            <code>{shortLinkUrl(slugify(effectiveCode), clients.find((c) => c.id === clientId)?.domain)}</code>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={saving || !clientId}>
          {saving ? 'Criando…' : 'Criar link'}
        </button>
      </form>
    </>
  )
}
