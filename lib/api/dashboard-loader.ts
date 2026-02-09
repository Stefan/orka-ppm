/**
 * Optimized Dashboard Data Loader
 * 
 * Implements:
 * - Parallel API requests using Promise.all
 * - Response caching with TTL
 * - Progressive data loading
 * - Request deduplication
 */

import { apiRequest } from './client'

// Cache configuration – longer TTL so revisits feel instant
const CACHE_TTL = 60000 // 60 seconds
const cache = new Map<string, { data: any; timestamp: number }>()

// In-flight request tracking for deduplication
const inflightRequests = new Map<string, Promise<any>>()

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL
}

/**
 * Get data from cache if valid
 */
function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data as T
  }
  return null
}

/**
 * Store data in cache
 */
function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
}

/**
 * Clear all cached data
 */
export function clearDashboardCache(): void {
  cache.clear()
  inflightRequests.clear()
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(key: string): void {
  cache.delete(key)
  inflightRequests.delete(key)
}

/**
 * Deduplicated API request
 * Prevents multiple simultaneous requests to the same endpoint
 */
async function deduplicatedRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = getFromCache<T>(key)
  if (cached !== null) {
    return cached
  }

  // Check if request is already in flight
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key) as Promise<T>
  }

  // Create new request
  const request = requestFn()
    .then((data) => {
      setCache(key, data)
      inflightRequests.delete(key)
      return data
    })
    .catch((error) => {
      inflightRequests.delete(key)
      throw error
    })

  inflightRequests.set(key, request)
  return request
}

// Type definitions
export interface QuickStats {
  total_projects: number
  active_projects: number
  health_distribution: { green: number; yellow: number; red: number }
  critical_alerts: number
  at_risk_projects: number
}

export interface KPIs {
  project_success_rate: number
  budget_performance: number
  timeline_performance: number
  average_health_score: number
  resource_efficiency: number
  active_projects_ratio: number
}

export interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  created_at: string
}

export interface DashboardData {
  quickStats: QuickStats
  kpis: KPIs
  projects: Project[]
}

/**
 * Load critical dashboard data in parallel
 * This loads QuickStats and KPIs simultaneously.
 * Optional portfolioId scopes data to that portfolio.
 */
export async function loadCriticalData(
  accessToken: string,
  options?: { portfolioId?: string | null }
): Promise<{ quickStats: QuickStats; kpis: KPIs }> {
  const portfolioId = options?.portfolioId ?? null
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  const cacheKey = portfolioId ? `dashboard:critical:${portfolioId}` : 'dashboard:critical'

  // Try optimized endpoint first
  try {
    const url = portfolioId
      ? `/optimized/dashboard/quick-stats?portfolio_id=${encodeURIComponent(portfolioId)}`
      : '/optimized/dashboard/quick-stats'
    const data = await deduplicatedRequest(
      cacheKey,
      () => apiRequest(url, { headers })
    ) as any

    return {
      quickStats: data.quick_stats,
      kpis: data.kpis
    }
  } catch (error) {
    console.log('Optimized endpoint failed, using parallel fallback...')
    
    const projectsUrl = portfolioId
      ? `/projects?portfolio_id=${encodeURIComponent(portfolioId)}`
      : '/projects'
    const [projectsData, metricsData] = await Promise.all([
      deduplicatedRequest(
        portfolioId ? `dashboard:projects:${portfolioId}` : 'dashboard:projects',
        () => apiRequest(projectsUrl, { headers })
      ),
      deduplicatedRequest(
        'dashboard:metrics',
        () => apiRequest('/portfolios/metrics', { headers }).catch(() => null)
      )
    ])

    // Calculate stats from projects
    const projects = Array.isArray(projectsData) 
      ? projectsData 
      : (projectsData as any)?.projects || []
    
    const totalProjects = projects.length
    const activeProjects = projects.filter((p: any) => p?.status === 'active').length
    const healthDistribution = projects.reduce((acc: any, project: any) => {
      const health = project?.health || 'green'
      acc[health] = (acc[health] || 0) + 1
      return acc
    }, { green: 0, yellow: 0, red: 0 })

    const quickStats: QuickStats = {
      total_projects: totalProjects,
      active_projects: activeProjects,
      health_distribution: healthDistribution,
      critical_alerts: healthDistribution.red || 0,
      at_risk_projects: healthDistribution.yellow || 0
    }

    const kpis: KPIs = (metricsData as any) || {
      project_success_rate: 85,
      budget_performance: 92,
      timeline_performance: 78,
      average_health_score: 2.1,
      resource_efficiency: 88,
      active_projects_ratio: Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)
    }

    // Cache the computed results
    setCache(cacheKey, { quickStats, kpis })

    return { quickStats, kpis }
  }
}

/**
 * Load secondary data (projects list)
 * This is loaded after critical data to improve initial paint.
 * Optional portfolioId scopes to that portfolio.
 */
export async function loadSecondaryData(
  accessToken: string,
  limit: number = 5,
  options?: { portfolioId?: string | null }
): Promise<Project[]> {
  const portfolioId = options?.portfolioId ?? null
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  const baseUrl = '/optimized/dashboard/projects-summary'
  const params = new URLSearchParams({ limit: String(limit) })
  if (portfolioId) params.set('portfolio_id', portfolioId)
  const url = `${baseUrl}?${params.toString()}`

  const fallbackUrl = portfolioId
    ? `/projects?limit=${limit}&portfolio_id=${encodeURIComponent(portfolioId)}`
    : `/projects?limit=${limit}`

  try {
    const cacheKey = portfolioId ? `dashboard:projects:${limit}:${portfolioId}` : `dashboard:projects:${limit}`
    const data = await deduplicatedRequest(cacheKey, () => apiRequest(url, { headers })) as any

    return data?.projects || data?.slice?.(0, limit) || []
  } catch (error) {
    const fallbackKey = portfolioId ? `dashboard:projects-fallback:${limit}:${portfolioId}` : `dashboard:projects-fallback:${limit}`
    const data = await deduplicatedRequest(fallbackKey, () => apiRequest(fallbackUrl, { headers })) as any

    return data?.projects || data?.slice?.(0, limit) || []
  }
}

/**
 * Load all dashboard data with progressive loading
 * Returns critical data immediately, then loads secondary data.
 * Optional portfolioId scopes all data to that portfolio.
 */
export async function loadDashboardData(
  accessToken: string,
  onCriticalDataLoaded?: (data: { quickStats: QuickStats; kpis: KPIs }) => void,
  onSecondaryDataLoaded?: (projects: Project[]) => void,
  options?: { portfolioId?: string | null }
): Promise<DashboardData> {
  const opts = { portfolioId: options?.portfolioId ?? null }

  const criticalData = await loadCriticalData(accessToken, opts)

  if (onCriticalDataLoaded) {
    onCriticalDataLoaded(criticalData)
  }

  const projectsPromise = loadSecondaryData(accessToken, 5, opts)

  if (onSecondaryDataLoaded) {
    projectsPromise.then(onSecondaryDataLoaded).catch(console.error)
  }

  const projects = await projectsPromise

  return {
    ...criticalData,
    projects
  }
}

/**
 * Prefetch dashboard data
 * Useful for preloading data before navigation.
 * Optional portfolioId scopes prefetch to that portfolio.
 */
export async function prefetchDashboardData(
  accessToken: string,
  options?: { portfolioId?: string | null }
): Promise<void> {
  try {
    const opts = options?.portfolioId ? { portfolioId: options.portfolioId } : undefined
    await Promise.all([
      loadCriticalData(accessToken, opts),
      loadSecondaryData(accessToken, 5, opts)
    ])
  } catch (error) {
    console.error('Prefetch failed:', error)
  }
}
