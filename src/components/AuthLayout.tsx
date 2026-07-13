import type { ReactNode } from 'react'
import { Globe } from '@/components/ui/globe'

/** Autenticação: formulário à esquerda, globo de cliques solto à direita
    (mesmo fundo da página, sem painel). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen overflow-hidden bg-background lg:grid-cols-2">
      <div className="z-10 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="relative hidden lg:block">
        <div className="relative z-10 px-12 pt-20 xl:px-16">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-foreground">
            Cada clique do seu tráfego, <span className="text-primary">no mapa</span>.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Links curtos com UTMs, cliques enriquecidos e leads rastreados do
            anúncio até a conversão — em tempo real.
          </p>
        </div>
        <Globe className="-bottom-56 top-auto w-full max-w-[820px]" />
      </div>
    </div>
  )
}
