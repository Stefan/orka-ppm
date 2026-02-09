/**
 * Project Controls API client
 * ETC, EAC, forecasts, earned value, performance analytics.
 */

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''

async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const { supabase } = await import('@/lib/api/supabase-minimal')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const url = `${API_BASE}/api${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }
  const token = await getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { ...init, credentials: 'include', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = Array.isArray(err.detail) ? err.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ') : err.detail
    throw new Error(detail || res.statusText || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const projectControlsApi = {
  getETC: (projectId: string, method?: string) =>
    fetchWithAuth(`/project-controls/etc/${projectId}${method ? `?method=${method}` : ''}`),
  getEAC: (projectId: string, method?: string) =>
    fetchWithAuth(`/project-controls/eac/${projectId}${method ? `?method=${method}` : ''}`),
  getMonthlyForecast: (projectId: string, params?: { start_date?: string; end_date?: string; scenario?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return fetchWithAuth(`/forecasts/monthly/${projectId}${q ? `?${q}` : ''}`)
  },
  getScenarioForecasts: (projectId: string, params?: { start_date?: string; end_date?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return fetchWithAuth(`/forecasts/scenarios/${projectId}${q ? `?${q}` : ''}`)
  },
  getEarnedValueMetrics: (projectId: string) =>
    fetchWithAuth(`/earned-value/metrics/${projectId}`),
  getPerformanceTrends: (projectId: string, periods?: number) =>
    fetchWithAuth(`/earned-value/trends/${projectId}${periods ? `?periods=${periods}` : ''}`),
  getWorkPackageSummary: (projectId: string) =>
    fetchWithAuth(`/earned-value/work-packages/${projectId}`),
  listWorkPackages: (projectId: string, activeOnly: boolean = true) =>
    fetchWithAuth(`/projects/${projectId}/work-packages${activeOnly ? '?active_only=true' : '?active_only=false'}`),
  createWorkPackage: (projectId: string, body: { project_id: string; name: string; description?: string | null; budget: number; start_date: string; end_date: string; responsible_manager: string; parent_package_id?: string | null }) =>
    fetchWithAuth(`/projects/${projectId}/work-packages`, { method: 'POST', body: JSON.stringify({ ...body, project_id: projectId }) }),
  updateWorkPackage: (projectId: string, wpId: string, body: Record<string, unknown>) =>
    fetchWithAuth(`/projects/${projectId}/work-packages/${wpId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkPackage: (projectId: string, wpId: string) =>
    fetchWithAuth(`/projects/${projectId}/work-packages/${wpId}`, { method: 'DELETE' }),
  getPerformanceDashboard: (projectId: string) =>
    fetchWithAuth(`/performance-analytics/dashboard/${projectId}`),
  getVarianceAnalysis: (projectId: string) =>
    fetchWithAuth(`/performance-analytics/variance/${projectId}`),
  getCompletionPrediction: (projectId: string) =>
    fetchWithAuth(`/performance-analytics/prediction/${projectId}`),
  getResourceForecast: (projectId: string) =>
    fetchWithAuth(`/project-controls/resource-forecast/${projectId}`),
}
