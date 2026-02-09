/**
 * Portfolios API – proxy to backend GET /portfolios
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const url = `${BACKEND_URL}/portfolios/`

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
      logger.error('Backend portfolios API error', { status: response.status, errorText }, 'api/portfolios')
      return NextResponse.json(
        { error: 'Failed to fetch portfolios from backend' },
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

    logger.error('Portfolios API error', { error }, 'api/portfolios')

    if (isConnectionError) {
      return NextResponse.json(
        {
          error: 'Backend not available',
          detail:
            err?.name === 'AbortError'
              ? 'The backend did not respond in time.'
              : 'The portfolios service could not be reached. Check NEXT_PUBLIC_BACKEND_URL.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 })
  }
}
