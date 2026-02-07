import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'

/**
 * GET /api/audit/dashboard/stats
 * Proxies to backend for real audit dashboard statistics (no mock data).
 * Requires Authorization: Bearer <token> (Supabase session access_token).
 */
export async function GET(request: NextRequest) {
  try {
    // Prefer header; also accept lowercase 'authorization' (some proxies normalize)
    const authHeader =
      request.headers.get('authorization') ?? request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization header missing', code: 'MISSING_AUTH' },
        { status: 401 }
      )
    }

    const backendUrl = `${BACKEND_URL}/api/audit/dashboard/stats`
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Audit dashboard stats backend error:', response.status, errorText)
      if (response.status === 401) {
        let detail = 'Unauthorized'
        try {
          const errJson = JSON.parse(errorText)
          detail = errJson.detail ?? errJson.error ?? detail
        } catch {
          if (errorText) detail = errorText.slice(0, 200)
        }
        return NextResponse.json(
          { error: detail, code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }
      if (response.status === 503 || response.status === 502) {
        return NextResponse.json(
          { error: 'Backend not reachable. Ensure the backend is running.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch dashboard stats' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    console.error('Audit dashboard stats API error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Backend server not reachable. Please ensure the backend is running.',
      },
      { status: 503 }
    )
  }
}
