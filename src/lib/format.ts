/** Remove acentos, minúsculo, troca não-alfanumérico por hífen. Ex: "Adriane Siqueira" -> "adriane-siqueira" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Regra do briefing: UTMs sempre em minúsculo, espaços viram underline. */
export function formatUtm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

/** URL curta: usa o domínio próprio do cliente quando configurado. */
export function shortLinkUrl(code: string, domain?: string | null): string {
  const base = domain ? `https://${domain}` : window.location.origin
  return `${base}/l/${code}`
}

/** Normaliza input de domínio: tira protocolo, barra e espaços; valida hostname. */
export function normalizeDomain(value: string): string | null {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  if (!cleaned) return null
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) return null
  return cleaned
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}
