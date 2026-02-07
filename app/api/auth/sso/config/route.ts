/**
 * Proxy to backend SSO config: GET list providers, PUT update enabled flags.
 * Requires Authorization: Bearer <token> (admin).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const res = await fetch(`${BACKEND_URL}/api/auth/sso/config`, {
      headers: { Authorization: auth },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: res.statusText, details: text },
        { status: res.status }
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('SSO config GET:', e)
    return NextResponse.json(
      { error: 'Failed to fetch SSO config' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization')
    if (!auth) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const body = await request.json()
    const res = await fetch(`${BACKEND_URL}/api/auth/sso/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: res.statusText, details: text },
        { status: res.status }
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('SSO config PUT:', e)
    return NextResponse.json(
      { error: 'Failed to update SSO config' },
      { status: 500 }
    )
  }
}
