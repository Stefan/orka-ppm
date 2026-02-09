/**
 * Project by ID API – proxy to backend GET / PATCH /projects/{project_id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const TIMEOUT_MS = 5000

async function proxy(
  url: string,
  method: string,
  authHeader: string | null,
  body?: unknown
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    const response = await proxy(`${BACKEND_URL}/projects/${encodeURIComponent(projectId)}`, 'GET', authHeader)
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend project by ID API error', { status: response.status, projectId, errorText }, 'api/projects/[id]')
      let detail: string | undefined
      try {
        const o = JSON.parse(errorText) as { detail?: string }
        detail = o?.detail
      } catch {
        detail = undefined
      }
      return NextResponse.json(
        { error: detail ?? 'Failed to fetch project from backend' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Project by ID API error', { error }, 'api/projects/[id]')
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const response = await proxy(`${BACKEND_URL}/projects/${encodeURIComponent(projectId)}`, 'PATCH', authHeader, body)
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend project PATCH error', { status: response.status, projectId, detail }, 'api/projects/[id]')
      return NextResponse.json(
        { error: detail ?? 'Failed to update project' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Project PATCH API error', { error }, 'api/projects/[id]')
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}
