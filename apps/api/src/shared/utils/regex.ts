/**
 * Escape de metacaracteres de regex: una búsqueda del usuario nunca debe
 * interpretarse como patrón (protección contra inyección de regex).
 * Utilidad compartida por todos los repositories con `search`.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
