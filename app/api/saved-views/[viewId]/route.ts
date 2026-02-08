/**
 * Saved View by ID – proxy to backend /saved-views/{view_id}.
 * GET, PATCH, DELETE.
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_BASE =
  (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
    .replace(/\/$/, '')
    .replace(/\/api$/i, '')

function backendUrl(viewId: string): string {
  return `${BACKEND_BASE}/saved-views/${viewId}`
}

async function proxy(
  viewId: string,
  request: NextRequest,
  method: 'GET' | 'PATCH' | 'DELETE',
  body?: string
) {
  const authHeader = request.headers.get('authorization')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authHeader) headers['Authorization'] = authHeader

  const res = await fetch(backendUrl(viewId), {
    method,
    headers,
    body: body || undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: res.statusText, detail: text },
      { status: res.status }
    )
  }

  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json()
  return NextResponse.json(data)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const { viewId } = await params
  if (!viewId) return NextResponse.json({ error: 'Missing viewId' }, { status: 400 })
  try {
    return proxy(viewId, request, 'GET')
  } catch (error) {
    console.error('Saved view GET proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved view', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const { viewId } = await params
  if (!viewId) return NextResponse.json({ error: 'Missing viewId' }, { status: 400 })
  try {
    const body = await request.text()
    return proxy(viewId, request, 'PATCH', body || undefined)
  } catch (error) {
    console.error('Saved view PATCH proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to update saved view', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  const { viewId } = await params
  if (!viewId) return NextResponse.json({ error: 'Missing viewId' }, { status: 400 })
  try {
    return proxy(viewId, request, 'DELETE')
  } catch (error) {
    console.error('Saved view DELETE proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to delete saved view', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
