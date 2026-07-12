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

export function shortLinkUrl(code: string): string {
  return `${window.location.origin}/l/${code}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}
