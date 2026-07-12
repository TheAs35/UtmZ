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

export interface Click {
  link_id: string
  clicked_at: string
  country: string | null
  device: string | null
  referrer: string | null
}
