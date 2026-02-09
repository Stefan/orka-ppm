/**
 * Portfolio by ID API – proxy to backend GET / PATCH / DELETE /portfolios/{portfolio_id}
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
      { error: 'Backend not available', detail: 'The portfolios service could not be reached. Check NEXT_PUBLIC_BACKEND_URL.' },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const { portfolioId } = await params
    const authHeader = request.headers.get('authorization')
    const response = await proxy(`${BACKEND_URL}/portfolios/${encodeURIComponent(portfolioId)}`, 'GET', authHeader)
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend portfolio by ID API error', { status: response.status, portfolioId, errorText }, 'api/portfolios/[id]')
      let detail: string | undefined
      try {
        const o = JSON.parse(errorText) as { detail?: string }
        detail = o?.detail
      } catch {
        detail = undefined
      }
      return NextResponse.json(
        { error: detail ?? 'Failed to fetch portfolio from backend' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Portfolio by ID API error', { error }, 'api/portfolios/[id]')
    return connectionErrorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const { portfolioId } = await params
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const response = await proxy(`${BACKEND_URL}/portfolios/${encodeURIComponent(portfolioId)}`, 'PATCH', authHeader, body)
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend portfolio PATCH error', { status: response.status, portfolioId, detail }, 'api/portfolios/[id]')
      return NextResponse.json(
        { error: detail ?? 'Failed to update portfolio' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Portfolio PATCH API error', { error }, 'api/portfolios/[id]')
    return connectionErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const { portfolioId } = await params
    const authHeader = request.headers.get('authorization')
    const response = await proxy(`${BACKEND_URL}/portfolios/${encodeURIComponent(portfolioId)}`, 'DELETE', authHeader)
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend portfolio DELETE error', { status: response.status, portfolioId, detail }, 'api/portfolios/[id]')
      return NextResponse.json(
        { error: detail ?? 'Failed to delete portfolio' },
        { status: response.status }
      )
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logger.error('Portfolio DELETE API error', { error }, 'api/portfolios/[id]')
    return connectionErrorResponse(error)
  }
}
