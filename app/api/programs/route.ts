/**
 * Programs API – proxy to backend GET /programs and POST /programs
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const TIMEOUT_MS = 5000

async function proxy(
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
      { error: 'Backend not available', detail: 'The programs service could not be reached. Check NEXT_PUBLIC_BACKEND_URL.' },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const portfolioId = searchParams.get('portfolio_id')
    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolio_id is required' }, { status: 400 })
    }
    const authHeader = request.headers.get('authorization')
    const url = `${BACKEND_URL}/programs/?portfolio_id=${encodeURIComponent(portfolioId)}`
    const response = await proxy(url, 'GET', authHeader)
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend programs API error', { status: response.status, errorText }, 'api/programs')
      return NextResponse.json(
        { error: 'Failed to fetch programs from backend' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Programs API error', { error }, 'api/programs')
    return connectionErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const response = await proxy(`${BACKEND_URL}/programs/`, 'POST', authHeader, body)
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend programs POST error', { status: response.status, detail }, 'api/programs')
      return NextResponse.json(
        { error: detail ?? 'Failed to create program' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Programs POST API error', { error }, 'api/programs')
    return connectionErrorResponse(error)
  }
}
