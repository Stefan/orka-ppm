/**
 * GET /api/integrations/config – list connectors (proxy to backend)
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const res = await fetch(`${BACKEND_URL}/api/integrations/config`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: res.statusText, details: text }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Integrations config GET:', e)
    return NextResponse.json({ error: 'Failed to fetch integrations config' }, { status: 500 })
  }
}
