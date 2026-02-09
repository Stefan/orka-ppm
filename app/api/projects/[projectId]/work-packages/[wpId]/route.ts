/**
 * Work package by ID API – proxy to backend GET/PATCH/DELETE /projects/{projectId}/work-packages/{wpId}
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'
const BASE = BACKEND_URL.replace(/\/$/, '')

async function proxy(request: NextRequest, projectId: string, wpId: string) {
  const url = `${BASE}/projects/${encodeURIComponent(projectId)}/work-packages/${encodeURIComponent(wpId)}`
  const authHeader = request.headers.get('authorization')
  let body: string | undefined
  try {
    body = await request.text()
  } catch {
    body = undefined
  }

  const res = await fetch(url, {
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
  { params }: { params: Promise<{ projectId: string; wpId: string }> }
) {
  const { projectId, wpId } = await params
  return proxy(request, projectId, wpId)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; wpId: string }> }
) {
  const { projectId, wpId } = await params
  return proxy(request, projectId, wpId)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; wpId: string }> }
) {
  const { projectId, wpId } = await params
  return proxy(request, projectId, wpId)
}
