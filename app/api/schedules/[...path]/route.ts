/**
 * Schedules API – proxy all other routes to backend (e.g. /api/schedules/:id, /api/schedules/:id/tasks).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

async function proxy(
  request: NextRequest,
  pathSegments: string[]
) {
  const path = pathSegments.join('/')
  const backendUrl = `${BACKEND_URL}/schedules/${path}`
  const { searchParams } = new URL(request.url)
  const queryString = searchParams.toString()
  const url = queryString ? `${backendUrl}?${queryString}` : backendUrl
  const authHeader = request.headers.get('authorization')

  let body: string | undefined
  try {
    body = await request.text()
  } catch {
    body = undefined
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      ...(body && body.length > 0 && { body }),
    })
  } catch (e) {
    console.warn('Schedules proxy: backend unreachable', (e as Error)?.message ?? e)
    return NextResponse.json(
      request.method === 'GET' ? { schedules: [], total: 0 } : { error: 'Backend unreachable' },
      { status: request.method === 'GET' ? 200 : 503 }
    )
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  }
  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': contentType || 'text/plain',
      ...(response.headers.get('content-disposition') && {
        'Content-Disposition': response.headers.get('content-disposition')!,
      }),
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}
