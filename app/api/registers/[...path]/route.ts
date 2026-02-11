/**
 * Registers API – proxy to backend /api/registers/{type} and /api/registers/{type}/{id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { debugIngest } from '@/lib/debug-ingest'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'
// Avoid double /api when BACKEND_URL already ends with /api
const BACKEND_BASE = BACKEND_URL.replace(/\/$/, '').replace(/\/api$/, '')

async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/')
  const backendUrl = `${BACKEND_BASE}/api/registers/${path}`
  // #region agent log
  debugIngest({ location: 'registers/route.ts:proxy', message: 'proxy to backend', data: { pathSegments, path, backendUrl, method: request.method }, hypothesisId: 'A' })
  // #endregion
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
    console.warn('Registers proxy: backend unreachable', (e as Error)?.message ?? e)
    return NextResponse.json(
      request.method === 'GET' ? { items: [], total: 0 } : { error: 'Backend unreachable' },
      { status: request.method === 'GET' ? 200 : 503 }
    )
  }

  // #region agent log
  debugIngest({ location: 'registers/route.ts:proxy', message: 'backend response', data: { backendStatus: response.status, requestUrl: url }, hypothesisId: 'B' })
  // #endregion

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 })
  }
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await response.json().catch(() => ({}))
    // In dev, add requestedUrl to 4xx/5xx so we can see what the proxy called
    const body = response.status >= 400 && process.env.NODE_ENV !== 'production'
      ? { ...data, _debug_requestedUrl: url }
      : data
    return NextResponse.json(body, { status: response.status })
  }
  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': contentType || 'text/plain' },
  })
}

function normalizePathSegments(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string')
  if (typeof raw === 'string' && raw) return [raw]
  return []
}

async function handle(
  request: NextRequest,
  params: Promise<{ path?: string[] | string }>
) {
  const resolved = await params
  const pathSegments = normalizePathSegments(resolved?.path)
  // #region agent log
  debugIngest({ location: 'registers/route.ts:handle', message: 'handle', data: { pathSegments, hasLength: !!pathSegments.length }, hypothesisId: 'H2' })
  // #endregion
  if (!pathSegments.length) {
    return NextResponse.json({ error: 'Register type required' }, { status: 404 })
  }
  return proxy(request, pathSegments)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  return handle(request, ctx.params)
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  return handle(request, ctx.params)
}
export async function PUT(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  return handle(request, ctx.params)
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  return handle(request, ctx.params)
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path?: string[] | string }> }) {
  return handle(request, ctx.params)
}
