import type { Click, Link } from './types'

export type Period = 7 | 30 | 90

/** Shape mínimo p/ série temporal — o Dashboard busca só estes campos. */
export interface ClickTime {
  clicked_at: string
  is_bot: boolean | null
}

export interface DayPoint {
  /** rótulo curto dd/mm */
  label: string
  count: number
}

export interface BreakdownRow {
  label: string
  count: number
}

/** Filtra por período (dias) e, por padrão, remove bots/previews. */
export function filterClicks<T extends ClickTime>(clicks: T[], period: Period, includeBots: boolean): T[] {
  const since = Date.now() - period * 24 * 60 * 60 * 1000
  return clicks.filter((c) => {
    if (!includeBots && c.is_bot) return false
    return new Date(c.clicked_at).getTime() >= since
  })
}

/** Série diária com dias vazios preenchidos (zero), do mais antigo ao mais novo. */
export function clicksByDay(clicks: ClickTime[], period: Period): DayPoint[] {
  const counts = new Map<string, number>()
  for (const click of clicks) {
    const key = dayKey(new Date(click.clicked_at))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const points: DayPoint[] = []
  const day = new Date()
  day.setDate(day.getDate() - (period - 1))
  for (let i = 0; i < period; i++) {
    const key = dayKey(day)
    points.push({ label: key.slice(0, 5), count: counts.get(key) ?? 0 })
    day.setDate(day.getDate() + 1)
  }
  return points
}

function dayKey(d: Date): string {
  return d.toLocaleDateString('pt-BR') // dd/mm/aaaa
}

/** Agrupa por dimensão, ordena por contagem e dobra a cauda em "outros". */
export function breakdown(
  clicks: Click[],
  key: (c: Click) => string | null | undefined,
  topN = 7,
): BreakdownRow[] {
  const counts = new Map<string, number>()
  for (const click of clicks) {
    const k = key(click)?.trim() || '(não informado)'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, topN).map(([label, count]) => ({ label, count }))
  const tail = sorted.slice(topN)
  if (tail.length > 0) {
    head.push({ label: 'outros', count: tail.reduce((sum, [, n]) => sum + n, 0) })
  }
  return head
}

/**
 * Dimensão de origem/campanha "efetiva": o que veio na URL do anúncio
 * (query_params) vence o que foi configurado no link.
 */
export function effectiveUtm(
  click: Click,
  linksById: Map<string, Link>,
  utm: 'utm_source' | 'utm_medium' | 'utm_campaign',
): string | null {
  return click.query_params?.[utm] ?? linksById.get(click.link_id)?.[utm] ?? null
}

/** Total de cliques dos últimos N dias (sem bots). */
export function countLastDays(clicks: ClickTime[], days: Period): number {
  return filterClicks(clicks, days, false).length
}
