/**
 * Portfolios API – proxy to backend GET /portfolios and POST /portfolios
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const TIMEOUT_MS = 5000

async function proxyPortfolios(
  url: string,
  method: string,
  authHeader: string | null,
  body?: unknown
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function connectionErrorResponse(err: unknown): NextResponse {
  const e = err as NodeJS.ErrnoException & { cause?: { code?: string }; name?: string }
  const isConnectionError =
    e?.code === 'ECONNREFUSED' ||
    e?.cause?.code === 'ECONNREFUSED' ||
    e?.name === 'AbortError' ||
    (typeof e?.message === 'string' &&
      (e.message.includes('fetch failed') || e.message.includes('ECONNREFUSED') || e.message.includes('aborted')))
  if (isConnectionError) {
    return NextResponse.json(
      {
        error: 'Backend not available',
        detail: e?.name === 'AbortError' ? 'The backend did not respond in time.' : 'The portfolios service could not be reached. Check NEXT_PUBLIC_BACKEND_URL.',
      },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const response = await proxyPortfolios(`${BACKEND_URL}/portfolios/`, 'GET', authHeader)
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend portfolios API error', { status: response.status, errorText }, 'api/portfolios')
      return NextResponse.json({ error: 'Failed to fetch portfolios from backend' }, { status: response.status })
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Portfolios API error', { error }, 'api/portfolios')
    return connectionErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const response = await proxyPortfolios(`${BACKEND_URL}/portfolios/`, 'POST', authHeader, body)
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend portfolios POST error', { status: response.status, detail }, 'api/portfolios')
      return NextResponse.json(
        { error: detail ?? 'Failed to create portfolio' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Portfolios POST API error', { error }, 'api/portfolios')
    return connectionErrorResponse(error)
  }
}
