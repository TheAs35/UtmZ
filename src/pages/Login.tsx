import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError('E-mail ou senha inválidos.')
      return
    }
    navigate('/')
  }

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1 className="brand">UtmZ</h1>
        <p className="muted">Rastreador de links da agência</p>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          Não tem conta? <Link to="/cadastro">Criar conta grátis</Link>
        </p>
      </form>
    </div>
  )
}
