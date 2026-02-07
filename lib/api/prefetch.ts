/**
 * Prefetch API data on navigation hover to speed up page load.
 * Uses same URLs as the actual pages so responses can be served from cache.
 */

export async function prefetchFinancials(accessToken: string | undefined): Promise<void> {
  if (!accessToken) return
  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    await Promise.all([
      fetch('/api/projects', { headers }),
      fetch('/api/financial-tracking/budget-alerts?threshold_percentage=80', { headers }),
    ])
  } catch {
    // Ignore prefetch errors (e.g. network, 401)
  }
}
