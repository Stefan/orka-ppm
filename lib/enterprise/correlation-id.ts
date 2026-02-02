/**
 * Phase 1 – Security & Scalability: Correlation ID for request tracing
 * Enterprise Readiness: Winston-style correlation ID per request/session
 */

const STORAGE_KEY = 'ppm-correlation-id'
const HEADER_NAME = 'X-Correlation-ID'

/**
 * Generate a new correlation ID (UUID v4–like).
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get or create correlation ID for the current request/session.
 * In browser: uses sessionStorage so it persists for the tab.
 * In Node: creates new per request (caller should pass request context).
 */
export function getOrCreateCorrelationId(): string {
  if (typeof window === 'undefined') {
    return generateCorrelationId()
  }
  try {
    let id = sessionStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = generateCorrelationId()
      sessionStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return generateCorrelationId()
  }
}

/**
 * Set correlation ID (e.g. from incoming request header).
 */
export function setCorrelationId(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore
    }
  }
}

/**
 * Headers to attach to API requests (correlation ID).
 */
export function correlationHeaders(): Record<string, string> {
  return {
    [HEADER_NAME]: getOrCreateCorrelationId(),
  }
}

export { HEADER_NAME }
