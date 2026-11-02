/**
 * Utilidades de búsqueda para la galería (spec 003, FR-1).
 * Comparación insensible a mayúsculas y acentos vía normalización NFKD
 * (decisión resuelta del 2026-10-26).
 */

/** Normaliza un texto: NFKD + eliminación de diacríticos + minúsculas. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Indica si `name` contiene el término de búsqueda `term` ya normalizado. */
export function matchesSearch(name: string, term: string): boolean {
  return normalizeSearch(name).includes(normalizeSearch(term))
}
