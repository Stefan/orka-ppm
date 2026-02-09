/**
 * Program by ID API – proxy to backend GET / PATCH / DELETE /programs/{program_id}
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
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    const authHeader = request.headers.get('authorization')
    const response = await proxy(`${BACKEND_URL}/programs/${encodeURIComponent(programId)}`, 'GET', authHeader)
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Backend program by ID API error', { status: response.status, programId, errorText }, 'api/programs/[id]')
      let detail: string | undefined
      try {
        const o = JSON.parse(errorText) as { detail?: string }
        detail = o?.detail
      } catch {
        detail = undefined
      }
      return NextResponse.json(
        { error: detail ?? 'Failed to fetch program from backend' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Program by ID API error', { error }, 'api/programs/[id]')
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const response = await proxy(`${BACKEND_URL}/programs/${encodeURIComponent(programId)}`, 'PATCH', authHeader, body)
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend program PATCH error', { status: response.status, programId, detail }, 'api/programs/[id]')
      return NextResponse.json(
        { error: detail ?? 'Failed to update program' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Program PATCH API error', { error }, 'api/programs/[id]')
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    const authHeader = request.headers.get('authorization')
    const response = await proxy(`${BACKEND_URL}/programs/${encodeURIComponent(programId)}`, 'DELETE', authHeader)
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 })
    }
    if (!response.ok) {
      const text = await response.text()
      let detail: string | undefined
      try {
        const parsed = JSON.parse(text) as { detail?: string }
        detail = parsed?.detail
      } catch {
        detail = text || undefined
      }
      logger.error('Backend program DELETE error', { status: response.status, programId, detail }, 'api/programs/[id]')
      return NextResponse.json(
        { error: detail ?? 'Failed to delete program' },
        { status: response.status }
      )
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    logger.error('Program DELETE API error', { error }, 'api/programs/[id]')
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 })
  }
}
