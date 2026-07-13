export interface Workspace {
  id: string
  name: string
}

export interface Client {
  id: string
  workspace_id: string
  name: string
  created_at: string
}

export interface Link {
  id: string
  workspace_id: string
  client_id: string
  short_code: string
  label: string | null
  destination_url: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  created_at: string
}

export interface Site {
  id: string
  workspace_id: string
  name: string
  domain: string | null
  created_at: string
}

export interface Session {
  id: string
  visitor_id: string
  started_at: string
  last_seen_at: string
  landing_page: string | null
  referrer: string | null
  params: Record<string, string> | null
  device: string | null
  browser: string | null
  os: string | null
  country: string | null
  region: string | null
  city: string | null
  has_lead: boolean
}

export const SESSION_FIELDS =
  'id, visitor_id, started_at, last_seen_at, landing_page, referrer, params, device, browser, os, country, region, city, has_lead'

export interface TrackEvent {
  session_id: string
  visitor_id: string
  ts: string
  type: string
  page: string | null
  data: Record<string, unknown> | null
}

export const EVENT_FIELDS = 'session_id, visitor_id, ts, type, page, data'

export interface Click {
  link_id: string
  clicked_at: string
  country: string | null
  region: string | null
  city: string | null
  device: string | null
  browser: string | null
  os: string | null
  is_bot: boolean | null
  referrer: string | null
  query_params: Record<string, string> | null
}

/** Campos de clique buscados pelo painel (mantém o payload enxuto). */
export const CLICK_FIELDS =
  'link_id, clicked_at, country, region, city, device, browser, os, is_bot, referrer, query_params'
