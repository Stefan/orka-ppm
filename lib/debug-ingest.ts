/**
 * Debug ingest for local hypothesis/agent logging.
 * Only runs when NEXT_PUBLIC_AGENT_INGEST_URL is set (e.g. in .env.local for dev).
 * In production (Vercel) this is never set, so no requests to localhost → no CORS/CSP violations.
 */

export function getDebugIngestUrl(): string | undefined {
  if (typeof process === 'undefined') return undefined
  return process.env.NEXT_PUBLIC_AGENT_INGEST_URL || undefined
}

export function debugIngest(payload: Record<string, unknown>): void {
  const url = getDebugIngestUrl()
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {})
}
