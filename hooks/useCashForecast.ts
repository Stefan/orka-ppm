/**
 * Phase 3 – Cash Out Forecast hook
 * Enterprise Readiness: Distribution Rules Engine + Gantt
 */

import { useState, useEffect, useCallback } from 'react'
import { enterpriseFetch } from '@/lib/enterprise/api-client'
import type { CashForecastPeriod } from '@/types/enterprise'

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''

export interface UseCashForecastOptions {
  projectId: string
  accessToken?: string
  enabled?: boolean
}

export function useCashForecast({ projectId, accessToken, enabled = true }: UseCashForecastOptions) {
  const [periods, setPeriods] = useState<CashForecastPeriod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchForecast = useCallback(async () => {
    if (!enabled || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const path = `${API_BASE}/api/v1/projects/${projectId}/cash-forecast`
      const headers: Record<string, string> = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await enterpriseFetch(path, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CashForecastPeriod[]
      setPeriods(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [projectId, accessToken, enabled])

  useEffect(() => {
    fetchForecast()
  }, [fetchForecast])

  return { periods, loading, error, refetch: fetchForecast }
}
