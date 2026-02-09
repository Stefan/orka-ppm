/**
 * Programs AI suggest – proxy to backend POST /programs/suggest
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/monitoring/logger'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const TIMEOUT_MS = 15000

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${BACKEND_URL}/programs/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { Authorization: authHeader }),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
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
      logger.error('Backend programs suggest error', { status: response.status, detail }, 'api/programs/suggest')
      return NextResponse.json(
        { error: detail ?? 'Failed to get suggestions' },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    logger.error('Programs suggest API error', { error }, 'api/programs/suggest')
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 })
  }
}
