import createGlobe, { type COBEOptions } from 'cobe'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Marcadores = onde os cliques dos links acontecem; Brasil em destaque.
const MARKERS: COBEOptions['markers'] = [
  { location: [-23.5505, -46.6333], size: 0.12 }, // São Paulo
  { location: [-22.9068, -43.1729], size: 0.09 }, // Rio de Janeiro
  { location: [-15.7939, -47.8828], size: 0.06 }, // Brasília
  { location: [-8.0476, -34.877], size: 0.06 },   // Recife
  { location: [-30.0346, -51.2177], size: 0.05 }, // Porto Alegre
  { location: [40.7128, -74.006], size: 0.08 },   // Nova York
  { location: [38.7223, -9.1393], size: 0.06 },   // Lisboa
  { location: [19.4326, -99.1332], size: 0.06 },  // Cidade do México
  { location: [51.5074, -0.1278], size: 0.05 },   // Londres
  { location: [35.6762, 139.6503], size: 0.04 },  // Tóquio
]

const BASE: Omit<COBEOptions, 'dark' | 'baseColor' | 'markerColor' | 'glowColor'> = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  markers: MARKERS,
}

// Globo claro sobre fundo claro; navy sobre fundo escuro.
const LIGHT_CONFIG: COBEOptions = {
  ...BASE,
  dark: 0,
  baseColor: [1, 1, 1],
  markerColor: [59 / 255, 130 / 255, 246 / 255],
  glowColor: [0.92, 0.95, 1],
}

const DARK_CONFIG: COBEOptions = {
  ...BASE,
  dark: 1,
  baseColor: [0.23, 0.35, 0.6],
  markerColor: [96 / 255, 165 / 255, 250 / 255],
  glowColor: [0.12, 0.22, 0.5],
}

export function Globe({
  className,
  config,
}: {
  className?: string
  config?: COBEOptions
}) {
  const resolvedConfig =
    config ??
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? DARK_CONFIG
      : LIGHT_CONFIG)
  const phiRef = useRef(0)
  const widthRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)
  const [r, setR] = useState(0)

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab'
    }
  }

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current
      pointerInteractionMovement.current = delta
      setR(delta / 200)
    }
  }

  const onRender = useCallback(
    (state: Record<string, number>) => {
      if (pointerInteracting.current === null) phiRef.current += 0.005
      state.phi = phiRef.current + r
      state.width = widthRef.current * 2
      state.height = widthRef.current * 2
    },
    [r],
  )

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) widthRef.current = canvasRef.current.offsetWidth
    }
    window.addEventListener('resize', onResize)
    onResize()

    const globe = createGlobe(canvasRef.current!, {
      ...resolvedConfig,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    })

    setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = '1'
    })
    return () => {
      globe.destroy()
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn('absolute inset-0 mx-auto aspect-square w-full max-w-[600px]', className)}>
      <canvas
        className="size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        ref={canvasRef}
        onPointerDown={(e) => updatePointerInteraction(e.clientX - pointerInteractionMovement.current)}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => e.touches[0] && updateMovement(e.touches[0].clientX)}
      />
    </div>
  )
}
