/**
 * Pure filter for feature flags by search query.
 * Property 16: Case-Insensitive Search Filtering
 */

export interface FlagWithName {
  name: string
  [key: string]: unknown
}

/**
 * Filter flags by name (case-insensitive). Empty query returns all.
 */
export function filterFlagsBySearch<T extends FlagWithName>(
  flags: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return flags
  return flags.filter((f) => f.name.toLowerCase().includes(q))
}
