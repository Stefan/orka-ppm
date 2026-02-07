/**
 * POST /api/integrations/sync – trigger sync (proxy to backend)
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const res = await fetch(`${BACKEND_URL}/api/integrations/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data || { error: res.statusText }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('Integrations sync POST:', e)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
