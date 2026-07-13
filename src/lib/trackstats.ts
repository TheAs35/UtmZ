import type { Session, TrackEvent } from './types'
import type { Period } from './stats'

export interface SiteOverview {
  visitors: number
  sessions: number
  leads: number
  conversion: number
  avgSeconds: number
  bounceRate: number
}

export function inPeriod(sessions: Session[], period: Period): Session[] {
  const since = Date.now() - period * 24 * 60 * 60 * 1000
  return sessions.filter((s) => new Date(s.started_at).getTime() >= since)
}

export function eventsInPeriod(events: TrackEvent[], period: Period): TrackEvent[] {
  const since = Date.now() - period * 24 * 60 * 60 * 1000
  return events.filter((e) => new Date(e.ts).getTime() >= since)
}

function sessionSeconds(s: Session): number {
  return Math.max(0, (new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()) / 1000)
}

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

/** Sessões c/ no máximo 1 evento (só o pageview de entrada) = rejeição. */
export function overview(sessions: Session[], events: TrackEvent[]): SiteOverview {
  const perSession = countPerSession(events)
  const visitors = new Set(sessions.map((s) => s.visitor_id)).size
  const leads = sessions.filter((s) => s.has_lead).length
  const bounced = sessions.filter((s) => (perSession.get(s.id) ?? 0) <= 1).length
  const totalSeconds = sessions.reduce((sum, s) => sum + sessionSeconds(s), 0)
  return {
    visitors,
    sessions: sessions.length,
    leads,
    conversion: visitors > 0 ? leads / visitors : 0,
    avgSeconds: sessions.length > 0 ? totalSeconds / sessions.length : 0,
    bounceRate: sessions.length > 0 ? bounced / sessions.length : 0,
  }
}

function countPerSession(events: TrackEvent[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of events) map.set(e.session_id, (map.get(e.session_id) ?? 0) + 1)
  return map
}

export interface CampaignRow {
  campaign: string
  source: string
  sessions: number
  visitors: number
  leads: number
  conversion: number
  avgSeconds: number
  bounceRate: number
}

export function byCampaign(sessions: Session[], events: TrackEvent[]): CampaignRow[] {
  const perSession = countPerSession(events)
  const groups = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = `${s.params?.utm_campaign ?? '(sem campanha)'}|${s.params?.utm_source ?? '(direto)'}`
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const [campaign, source] = key.split('|')
      const visitors = new Set(list.map((s) => s.visitor_id)).size
      const leads = list.filter((s) => s.has_lead).length
      const bounced = list.filter((s) => (perSession.get(s.id) ?? 0) <= 1).length
      return {
        campaign,
        source,
        sessions: list.length,
        visitors,
        leads,
        conversion: visitors > 0 ? leads / visitors : 0,
        avgSeconds: list.reduce((sum, s) => sum + sessionSeconds(s), 0) / list.length,
        bounceRate: bounced / list.length,
      }
    })
    .sort((a, b) => b.sessions - a.sessions)
}

/** Grade dia-da-semana (0=dom) × hora → contagem de sessões iniciadas. */
export function hourGrid(sessions: Session[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const s of sessions) {
    const d = new Date(s.started_at)
    grid[d.getDay()][d.getHours()]++
  }
  return grid
}

export interface LandingRow {
  page: string
  visitors: number
  sessions: number
  avgSeconds: number
  avgScroll: number
  conversion: number
  bounceRate: number
}

export function byLanding(sessions: Session[], events: TrackEvent[]): LandingRow[] {
  const perSession = countPerSession(events)
  const maxScroll = new Map<string, number>()
  for (const e of events) {
    if (e.type !== 'scroll') continue
    const pct = Number(e.data?.pct ?? 0)
    maxScroll.set(e.session_id, Math.max(maxScroll.get(e.session_id) ?? 0, pct))
  }
  const groups = new Map<string, Session[]>()
  for (const s of sessions) {
    let page = '(desconhecida)'
    try {
      page = s.landing_page ? new URL(s.landing_page).pathname : '(desconhecida)'
    } catch {
      page = s.landing_page ?? '(desconhecida)'
    }
    const list = groups.get(page) ?? []
    list.push(s)
    groups.set(page, list)
  }
  return [...groups.entries()]
    .map(([page, list]) => {
      const visitors = new Set(list.map((s) => s.visitor_id)).size
      const leads = list.filter((s) => s.has_lead).length
      const bounced = list.filter((s) => (perSession.get(s.id) ?? 0) <= 1).length
      return {
        page,
        visitors,
        sessions: list.length,
        avgSeconds: list.reduce((sum, s) => sum + sessionSeconds(s), 0) / list.length,
        avgScroll: list.reduce((sum, s) => sum + (maxScroll.get(s.id) ?? 0), 0) / list.length,
        conversion: visitors > 0 ? leads / visitors : 0,
        bounceRate: bounced / list.length,
      }
    })
    .sort((a, b) => b.sessions - a.sessions)
}

export interface FunnelStep {
  label: string
  sessions: number
  /** % em relação à etapa anterior */
  rate: number
}

export function funnel(sessions: Session[], events: TrackEvent[]): FunnelStep[] {
  const byType = new Map<string, Set<string>>()
  for (const e of events) {
    const set = byType.get(e.type) ?? new Set<string>()
    set.add(e.session_id)
    byType.set(e.type, set)
  }
  const scroll50 = new Set<string>()
  for (const e of events) {
    if (e.type === 'scroll' && Number(e.data?.pct ?? 0) >= 50) scroll50.add(e.session_id)
  }
  const clicked = new Set<string>()
  for (const t of ['click', 'whatsapp_click', 'call_click', 'link_click']) {
    for (const id of byType.get(t) ?? []) clicked.add(id)
  }
  const steps = [
    { label: 'Sessões', count: sessions.length },
    { label: 'Scroll 50%', count: scroll50.size },
    { label: 'Clique', count: clicked.size },
    { label: 'Formulário iniciado', count: (byType.get('form_start') ?? new Set()).size },
    { label: 'Lead enviado', count: (byType.get('form_submit') ?? new Set()).size },
  ]
  return steps.map((step, i) => ({
    label: step.label,
    sessions: step.count,
    rate: i === 0 ? 1 : steps[i - 1].count > 0 ? step.count / steps[i - 1].count : 0,
  }))
}

export interface EventRow {
  type: string
  count: number
  uniques: number
  leadRate: number
}

const EVENT_LABEL: Record<string, string> = {
  pageview: 'Page View',
  scroll: 'Scroll',
  click: 'Button Click',
  whatsapp_click: 'WhatsApp Click',
  call_click: 'Ligação Click',
  link_click: 'Link Click',
  form_start: 'Form Start',
  form_field: 'Form Field',
  form_submit: 'Form Submit',
  video_start: 'Video Start',
  video_25: 'Video 25%',
  video_50: 'Video 50%',
  video_75: 'Video 75%',
  video_complete: 'Video Complete',
}

export function eventTable(sessions: Session[], events: TrackEvent[]): EventRow[] {
  const leadSessions = new Set(sessions.filter((s) => s.has_lead).map((s) => s.id))
  const groups = new Map<string, TrackEvent[]>()
  for (const e of events) {
    // scroll vira "Scroll 25%"… p/ bater com a lista de eventos do spec
    const key = e.type === 'scroll' ? `Scroll ${e.data?.pct ?? '?'}%` : EVENT_LABEL[e.type] ?? e.type
    const list = groups.get(key) ?? []
    list.push(e)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([type, list]) => {
      const uniques = new Set(list.map((e) => e.visitor_id)).size
      const inLead = new Set(list.filter((e) => leadSessions.has(e.session_id)).map((e) => e.session_id)).size
      const totalSessions = new Set(list.map((e) => e.session_id)).size
      return { type, count: list.length, uniques, leadRate: totalSessions > 0 ? inLead / totalSessions : 0 }
    })
    .sort((a, b) => b.count - a.count)
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1).replace('.', ',')}%`
}

/** Agrupa sessões por dimensão (topo N + "outros"), no formato dos cards. */
export function sessionBreakdown(
  sessions: Session[],
  key: (s: Session) => string | null | undefined,
  topN = 7,
): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    const k = key(s)?.trim() || '(não informado)'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, topN).map(([label, count]) => ({ label, count }))
  const tail = sorted.slice(topN)
  if (tail.length > 0) head.push({ label: 'outros', count: tail.reduce((sum, [, n]) => sum + n, 0) })
  return head
}
