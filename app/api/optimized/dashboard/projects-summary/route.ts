import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://orka-ppm.onrender.com' : 'http://localhost:8001')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const limit = searchParams.get('limit') || '10'
    const offset = searchParams.get('offset') || '0'
    const portfolioId = searchParams.get('portfolio_id')

    const params = new URLSearchParams({ limit, offset })
    if (portfolioId) params.set('portfolio_id', portfolioId)
    const backendUrl = `${BACKEND_URL}/projects?${params.toString()}`

    // Forward request to backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    })
    
    if (!response.ok) {
      console.error('Backend projects summary API error:', response.status)
      return NextResponse.json([], {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Data-Source': 'fallback-mock'
        },
      })
    }
    
    const data = await response.json()
    
    // Handle both array and object responses (backend may return { items, total, limit, offset })
    const projects = Array.isArray(data) ? data : data?.items ?? data?.projects ?? []
    
    return NextResponse.json(projects, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=60', // Cache for 30 seconds
        'X-Data-Source': 'backend-real'
      },
    })
  } catch (error) {
    console.warn('Projects summary: backend unreachable', error instanceof Error ? error.message : error)
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Source': 'fallback-mock'
      }
    })
  }
}