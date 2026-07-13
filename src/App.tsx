import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, Globe as GlobeIcon, PlusCircle, LogOut, Sun, Moon } from 'lucide-react'
import { supabase } from './lib/supabase'
import { WorkspaceContext } from './lib/workspace'
import { useTheme } from './lib/theme'
import { cn } from './lib/utils'
import type { Workspace } from './lib/types'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ClientDetail from './pages/ClientDetail'
import NewLink from './pages/NewLink'
import Sites from './pages/Sites'
import SiteDashboard from './pages/SiteDashboard'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/sites', label: 'Sites', icon: GlobeIcon, end: false },
  { to: '/novo-link', label: 'Novo link', icon: PlusCircle, end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // undefined = ainda carregando; null = conta sem workspace
  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(undefined)
  const [theme, toggleTheme] = useTheme()
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

  if (loading) return <div className="center-screen text-muted-foreground">Carregando…</div>

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
    return <div className="center-screen text-muted-foreground">Carregando…</div>
  }

  if (workspace === null) {
    return (
      <div className="center-screen">
        <div className="card login-card">
          <h2>UtmZ</h2>
          <p className="error">Sua conta está sem workspace. Entre em contato com o suporte.</p>
          <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </div>
    )
  }

  const themeButton = (
    <button
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="md:inline">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  )

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div className="px-5 pb-4 pt-6">
            <Link to="/" className="text-xl font-extrabold tracking-tight text-sidebar-foreground">
              Utm<span className="text-sidebar-primary">Z</span>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex flex-col gap-1 border-t border-sidebar-border p-3">
            <div className="px-3 py-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{workspace.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{session.user.email}</p>
            </div>
            {themeButton}
            <button
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        {/* Topbar (mobile) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 py-2 md:hidden">
            <Link to="/" className="mr-auto text-lg font-extrabold tracking-tight text-sidebar-foreground">
              Utm<span className="text-sidebar-primary">Z</span>
            </Link>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md p-2 transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground',
                  )
                }
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </NavLink>
            ))}
            <button className="rounded-md p-2 text-sidebar-foreground/70" onClick={toggleTheme} title="Tema">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button className="rounded-md p-2 text-sidebar-foreground/70" onClick={handleLogout} title="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cliente/:id" element={<ClientDetail />} />
                <Route path="/novo-link" element={<NewLink />} />
                <Route path="/sites" element={<Sites />} />
                <Route path="/site/:id" element={<SiteDashboard />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/cadastro" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  )
}
