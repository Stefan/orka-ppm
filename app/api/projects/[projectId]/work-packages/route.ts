/**
 * Work packages API – proxy to backend GET/POST /projects/{projectId}/work-packages
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'
const BASE = BACKEND_URL.replace(/\/$/, '')

async function proxy(
  request: NextRequest,
  projectId: string,
  pathSuffix: string = ''
) {
  const url = `${BASE}/projects/${encodeURIComponent(projectId)}/work-packages${pathSuffix}`
  const authHeader = request.headers.get('authorization')
  let body: string | undefined
  try {
    body = await request.text()
  } catch {
    body = undefined
  }
  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()
  const fullUrl = query ? `${url}?${query}` : url

  const res = await fetch(fullUrl, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader && { Authorization: authHeader }),
    },
    ...(body && body.length > 0 && { body }),
  })

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 })
  }
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  }
  const text = await res.text()
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': contentType || 'text/plain' } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  return proxy(request, projectId)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  return proxy(request, projectId)
}
