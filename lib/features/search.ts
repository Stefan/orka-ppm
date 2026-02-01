/**
 * Feature search: Fuse.js fuzzy search over name, description, link
 * Optional: use simple string match if Fuse not available
 */
import type { Feature, FeatureSearchResult } from '@/types/features'

let FuseClass: typeof import('fuse.js').default | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  FuseClass = require('fuse.js').default
} catch {
  FuseClass = null
}

const DEFAULT_OPTIONS = {
  keys: ['name', 'description', 'link'] as const,
  threshold: 0.4,
  includeScore: true,
}

export function searchFeatures(
  features: Feature[],
  query: string
): FeatureSearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return features.map((f) => ({ feature: f }))

  if (FuseClass) {
    const fuse = new FuseClass(features, DEFAULT_OPTIONS)
    const results = fuse.search(q)
    return results.map((r) => ({
      feature: r.item,
      score: r.score,
      matches: r.matches?.map((m) => m.value).filter(Boolean) as string[] | undefined,
    }))
  }

  // Fallback: simple substring match
  return features
    .filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.link && f.link.toLowerCase().includes(q))
    )
    .map((f) => ({ feature: f }))
}

export function getFeatureIdsFromSearchResults(
  results: FeatureSearchResult[]
): string[] {
  return results.map((r) => r.feature.id)
}
