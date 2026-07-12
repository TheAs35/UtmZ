import { createContext, useContext } from 'react'
import type { Workspace } from './types'

export const WorkspaceContext = createContext<Workspace | null>(null)

/** Workspace do usuário logado. Só usar dentro de rotas autenticadas. */
export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('useWorkspace usado fora de rota autenticada')
  return workspace
}
