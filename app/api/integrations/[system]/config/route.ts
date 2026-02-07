/**
 * GET/PUT /api/integrations/[system]/config – get or save config (proxy to backend)
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> }
) {
  const { system } = await params
  try {
    const auth = request.headers.get('authorization')
    if (!auth) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    const res = await fetch(`${BACKEND_URL}/api/integrations/${encodeURIComponent(system)}/config`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status })
    return NextResponse.json(await res.json())
  } catch (e) {
    console.error('Integrations config GET:', e)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> }
) {
  const { system } = await params
  try {
    const auth = request.headers.get('authorization')
    if (!auth) return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const res = await fetch(`${BACKEND_URL}/api/integrations/${encodeURIComponent(system)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json(data, { status: res.status })
    return NextResponse.json(data)
  } catch (e) {
    console.error('Integrations config PUT:', e)
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
