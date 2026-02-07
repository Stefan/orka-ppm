/**
 * Admin My Organization – proxy to backend (org_admin or super_admin).
 * GET: current user's org, PATCH: update own org (name, logo).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    })
    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: response.statusText, details: text },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Organization me GET proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: response.statusText, details: text },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Organization me PATCH proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    )
  }
}
