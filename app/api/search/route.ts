/**
 * Topbar Unified Search – proxy to FastAPI /api/v1/search
 * GET /api/search?q=...&limit=10
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''
    const limit = searchParams.get('limit') ?? '10'

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = new URL('/api/v1/search', backendUrl)
    url.searchParams.set('q', q)
    url.searchParams.set('limit', limit)

    const auth = request.headers.get('Authorization') || ''
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.detail || 'Search failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Search proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
