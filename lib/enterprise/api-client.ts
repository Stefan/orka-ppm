/**
 * Phase 1 – Security & Scalability: API client with Correlation ID + throttling
 * Enterprise Readiness: X-Correlation-ID on every request, optional client-side throttle
 */

import { correlationHeaders } from './correlation-id'
import { getOrCreateCorrelationId } from './correlation-id'
import type { EnterpriseApiError, RateLimitHeaders } from '@/types/enterprise'

const DEFAULT_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || ''

/** Simple in-memory throttle: max N calls per window (ms) per key */
const throttleMap = new Map<string, number[]>()
const THROTTLE_WINDOW_MS = 1000
const THROTTLE_MAX_PER_WINDOW = 20

function throttleAllowed(key: string): boolean {
  const now = Date.now()
  const cut = now - THROTTLE_WINDOW_MS
  let list = throttleMap.get(key) || []
  list = list.filter((t) => t > cut)
  if (list.length >= THROTTLE_MAX_PER_WINDOW) {
    return false
  }
  list.push(now)
  throttleMap.set(key, list)
  return true
}

export interface EnterpriseFetchOptions extends RequestInit {
  baseUrl?: string
  /** If true, skip client-side throttle (e.g. for single critical requests) */
  skipThrottle?: boolean
}

/**
 * Fetch with X-Correlation-ID and optional client-side throttling.
 * On 429, parses Retry-After and throws with correlation_id.
 */
export async function enterpriseFetch(
  path: string,
  options: EnterpriseFetchOptions = {}
): Promise<Response> {
  const { baseUrl = DEFAULT_BASE, skipThrottle = false, ...init } = options
  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  if (!skipThrottle && typeof window !== 'undefined') {
    const key = url
    if (!throttleAllowed(key)) {
      const err: EnterpriseApiError = {
        message: 'Too many requests (client throttle)',
        code: 'THROTTLE',
        correlation_id: getOrCreateCorrelationId(),
        status: 429,
      }
      throw new Error(JSON.stringify(err)) as Error & { retryAfter?: number }
    }
  }

  const headers = new Headers(init.headers)
  Object.entries(correlationHeaders()).forEach(([k, v]) => headers.set(k, v))

  const response = await fetch(url, { ...init, headers })

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const err: EnterpriseApiError = {
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT',
      correlation_id: response.headers.get('X-Correlation-ID') || getOrCreateCorrelationId(),
      status: 429,
    }
    const e = new Error(JSON.stringify(err)) as Error & { retryAfter?: number }
    if (retryAfter) e.retryAfter = parseInt(retryAfter, 10)
    throw e
  }

  return response
}

/**
 * Parse rate limit headers from response (for UI display).
 */
export function parseRateLimitHeaders(response: Response): Partial<RateLimitHeaders> {
  return {
    'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit')
      ? Number(response.headers.get('X-RateLimit-Limit'))
      : undefined,
    'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining')
      ? Number(response.headers.get('X-RateLimit-Remaining'))
      : undefined,
    'X-RateLimit-Reset': response.headers.get('X-RateLimit-Reset')
      ? Number(response.headers.get('X-RateLimit-Reset'))
      : undefined,
    'Retry-After': response.headers.get('Retry-After')
      ? Number(response.headers.get('Retry-After'))
      : undefined,
  }
}
