/**
 * Phase 1 – Security & Scalability: Pagination + Infinite Scrolling + Caching
 * Enterprise Readiness: Infinite list for commitments/actuals with cursor pagination
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { enterpriseFetch } from '@/lib/enterprise/api-client'
import type { PaginatedResponse } from '@/types/enterprise'

const PAGE_SIZE = 50
const CACHE_MS = 5 * 60 * 1000 // 5 min

type Entity = 'commitments' | 'actuals'

interface UseInfiniteFinancialsOptions {
  entity: Entity
  accessToken?: string
  organizationId?: string
  enabled?: boolean
}

interface CachedPage {
  data: unknown[]
  nextCursor: string | null
  fetchedAt: number
}

const cache = new Map<string, CachedPage>()

function cacheKey(entity: Entity, cursor: string | null): string {
  return `${entity}:${cursor ?? 'first'}`
}

export function useInfiniteFinancials<T = Record<string, unknown>>(options: UseInfiniteFinancialsOptions) {
  const { entity, accessToken, organizationId, enabled = true } = options
  const [items, setItems] = useState<T[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const loadingMore = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const key = cacheKey(entity, cursor)
      const cached = cache.get(key)
      if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
        return { data: cached.data as T[], nextCursor: cached.nextCursor }
      }

      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      if (cursor) params.set('cursor', cursor)
      if (organizationId) params.set('organization_id', organizationId)

      const base = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''
      const path = `${base}/api/v1/financials/${entity}?${params.toString()}`
      const headers: Record<string, string> = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const res = await enterpriseFetch(path, { headers })
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`)
        setError(err)
        throw err
      }
      const body = (await res.json()) as PaginatedResponse<T>
      const data = body.data || []
      const next = body.next_cursor ?? null
      cache.set(key, { data, nextCursor: next, fetchedAt: Date.now() })
      return { data, nextCursor: next }
    },
    [entity, accessToken, organizationId]
  )

  const loadMore = useCallback(async () => {
    if (loadingMore.current || !enabled) return
    loadingMore.current = true
    setLoading(true)
    setError(null)
    try {
      const { data, nextCursor: next } = await fetchPage(nextCursor)
      setItems((prev) => (nextCursor ? [...prev, ...data] : data))
      setNextCursor(next)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
      loadingMore.current = false
    }
  }, [enabled, fetchPage, nextCursor])

  useEffect(() => {
    if (!enabled) return
    setItems([])
    setNextCursor(null)
    fetchPage(null).then(
      ({ data, nextCursor: next }) => {
        setItems(data)
        setNextCursor(next)
      },
      (e) => setError(e instanceof Error ? e : new Error(String(e)))
    )
  }, [enabled, entity, organizationId])

  return {
    items,
    loading,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    refetch: () => {
      cache.clear()
      setItems([])
      setNextCursor(null)
      fetchPage(null).then(
        ({ data, nextCursor: next }) => {
          setItems(data)
          setNextCursor(next)
        },
        (e) => setError(e instanceof Error ? e : new Error(String(e)))
      )
    },
  }
}
