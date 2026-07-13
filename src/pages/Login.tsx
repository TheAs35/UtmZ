import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthLayout from '@/components/AuthLayout'

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
    <AuthLayout>
      <div className="mb-8">
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          Utm<span className="text-primary">Z</span>
        </span>
        <h1 className="mt-6 text-xl font-bold text-foreground">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse seu painel de links e rastreamento.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Não tem conta? <Link to="/cadastro">Criar conta grátis</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
