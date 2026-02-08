/**
 * Registers API – proxy to backend /api/registers/{type} and /api/registers/{type}/{id}
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'

async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/')
  const backendUrl = `${BACKEND_URL}/api/registers/${path}`
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

  const response = await fetch(url, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader && { Authorization: authHeader }),
    },
    ...(body && body.length > 0 && { body }),
  })

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 })
  }
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  }
  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': contentType || 'text/plain' },
  })
}

async function handle(
  request: NextRequest,
  params: Promise<{ path: string[] }>
) {
  const { path: pathSegments } = await params
  if (!pathSegments?.length) {
    return NextResponse.json({ error: 'Register type required' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params)
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params)
}
export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params)
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params)
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params)
}
