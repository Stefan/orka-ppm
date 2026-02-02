/**
 * Phase 3 – AI, Analytics & Reliability: EVM Metrics
 * Enterprise Readiness: CPI, SPI, TCPI, VAC, CV, SV
 */

import { useState, useEffect, useCallback } from 'react'
import { enterpriseFetch } from '@/lib/enterprise/api-client'
import type { EvmMetrics } from '@/types/enterprise'

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''

export interface UseEvmMetricsOptions {
  projectId: string
  accessToken?: string
  enabled?: boolean
}

export function useEvmMetrics({ projectId, accessToken, enabled = true }: UseEvmMetricsOptions) {
  const [metrics, setMetrics] = useState<EvmMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!enabled || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const path = `${API_BASE}/api/v1/projects/${projectId}/evm`
      const headers: Record<string, string> = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await enterpriseFetch(path, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as EvmMetrics
      setMetrics(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [projectId, accessToken, enabled])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refetch: fetchMetrics }
}
