import type { ReactNode } from 'react'
import { Globe } from '@/components/ui/globe'

/** Split de autenticação: formulário à esquerda, globo de cliques à direita. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#0b1220] lg:block">
        <div className="relative z-10 px-12 pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#60a5fa]">
            UtmZ
          </p>
          <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Cada clique do seu tráfego, no mapa.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            Links curtos com UTMs, cliques enriquecidos e leads rastreados do
            anúncio até a conversão — em tempo real.
          </p>
        </div>
        <Globe className="-bottom-48 top-auto w-[85%] max-w-[620px] opacity-95" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b1220] to-transparent"
          aria-hidden
        />
      </div>
    </div>
  )
}
