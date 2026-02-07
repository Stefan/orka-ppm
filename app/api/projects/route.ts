import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    
    // Build query string for backend
    const queryString = searchParams.toString()
    const backendUrl = `${BACKEND_URL}/projects${queryString ? `?${queryString}` : ''}`
    
    const controller = new AbortController()
    const timeoutMs = 5000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader }),
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend projects API error', { status: response.status, errorText }, 'api/projects')
      return NextResponse.json(
        { error: 'Failed to fetch projects from backend' },
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
      (typeof err?.message === 'string' && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('aborted')))

    logger.error('Projects API error', { error }, 'api/projects')

    if (isConnectionError) {
      return NextResponse.json(
        {
          error: 'Backend not available',
          detail: err?.name === 'AbortError'
            ? 'The backend did not respond in time. Start the backend (e.g. on port 8000) or check NEXT_PUBLIC_BACKEND_URL.'
            : 'The projects service could not be reached. Start the backend (e.g. on port 8000) or check NEXT_PUBLIC_BACKEND_URL.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}