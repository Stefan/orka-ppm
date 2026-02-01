/**
 * Feature search: simple string match (case-insensitive) across name, description, link.
 * No external dependency; fuzzy search (e.g. fuse.js) can be added later if needed.
 */
import type { Feature, FeatureSearchResult } from '@/types/features'

function searchFeaturesFallback(features: Feature[], q: string): FeatureSearchResult[] {
  return features
    .filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.link && f.link.toLowerCase().includes(q))
    )
    .map((f) => ({ feature: f }))
}

/** Sync search. */
export function searchFeaturesSync(
  features: Feature[],
  query: string
): FeatureSearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return features.map((f) => ({ feature: f }))
  return searchFeaturesFallback(features, q)
}

/**
 * Async search: uses string match. Does not depend on fuse.js at build time.
 * Use this when you can handle a Promise (e.g. in useEffect).
 */
export async function searchFeatures(
  features: Feature[],
  query: string
): Promise<FeatureSearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return features.map((f) => ({ feature: f }))
  return Promise.resolve(searchFeaturesFallback(features, q))
}

export function getFeatureIdsFromSearchResults(
  results: FeatureSearchResult[]
): string[] {
  return results.map((r) => r.feature.id)
}
