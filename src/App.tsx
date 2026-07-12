import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { WorkspaceContext } from './lib/workspace'
import type { Workspace } from './lib/types'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ClientDetail from './pages/ClientDetail'
import NewLink from './pages/NewLink'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // undefined = ainda carregando; null = conta sem workspace
  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) {
      setWorkspace(undefined)
      return
    }
    setWorkspace(undefined)
    supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.workspaces as unknown
        const ws = (Array.isArray(raw) ? raw[0] : raw) as { name?: string } | null | undefined
        setWorkspace(data ? { id: data.workspace_id, name: ws?.name ?? 'Workspace' } : null)
      })
  }, [userId])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div className="center-screen">Carregando…</div>

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (workspace === undefined) {
    return <div className="center-screen">Carregando…</div>
  }

  if (workspace === null) {
    return (
      <div className="center-screen">
        <div className="card login-card">
          <h1 className="brand">UtmZ</h1>
          <p className="error">Sua conta está sem workspace. Entre em contato com o suporte.</p>
          <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="app">
        <header className="topbar">
          <Link to="/" className="brand">UtmZ</Link>
          <nav>
            <span className="muted">{workspace.name}</span>
            <Link to="/novo-link" className="btn btn-primary">+ Novo link</Link>
            <button onClick={handleLogout} className="btn btn-ghost">Sair</button>
          </nav>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cliente/:id" element={<ClientDetail />} />
            <Route path="/novo-link" element={<NewLink />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/cadastro" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </WorkspaceContext.Provider>
  )
}
