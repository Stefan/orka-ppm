/**
 * Portfolio by ID API – proxy to backend GET /portfolios/{portfolio_id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const { portfolioId } = await params
    const authHeader = request.headers.get('authorization')
    const url = `${BACKEND_URL}/portfolios/${encodeURIComponent(portfolioId)}`

    const controller = new AbortController()
    const timeoutMs = 5000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { Authorization: authHeader }),
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend portfolio by ID API error', { status: response.status, portfolioId, errorText }, 'api/portfolios/[id]')
      return NextResponse.json(
        { error: 'Failed to fetch portfolio from backend' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { cause?: { code?: string }; name?: string }
    const isConnectionError =
      err?.code === 'ECONNREFUSED' ||
      err?.cause?.code === 'ECONNREFUSED' ||
      err?.name === 'AbortError' ||
      (typeof err?.message === 'string' &&
        (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('aborted')))

    logger.error('Portfolio by ID API error', { error }, 'api/portfolios/[id]')

    if (isConnectionError) {
      return NextResponse.json(
        {
          error: 'Backend not available',
          detail: 'The portfolios service could not be reached. Check NEXT_PUBLIC_BACKEND_URL.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 })
  }
}
