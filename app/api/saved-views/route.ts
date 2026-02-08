/**
 * Saved Views API – proxy to backend /saved-views.
 * GET: list saved views (optional ?scope=).
 * POST: create saved view.
 */

import { NextRequest, NextResponse } from 'next/server'

// Backend base URL: strip trailing slash and /api so we always request /saved-views (backend has no /api prefix)
const BACKEND_BASE =
  (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
    .replace(/\/$/, '')
    .replace(/\/api$/i, '')

function backendUrl(path: string, search?: string): string {
  const query = search ? `?${search}` : ''
  return `${BACKEND_BASE}/saved-views${path}${query}`
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const url = backendUrl('', queryString)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authHeader) headers['Authorization'] = authHeader

    const response = await fetch(url, { method: 'GET', headers })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: response.statusText, detail: text },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Saved views GET proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved views', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const url = backendUrl('')
    const body = await request.text()

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authHeader) headers['Authorization'] = authHeader

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body || undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: response.statusText, detail: text },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Saved views POST proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to create saved view', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
