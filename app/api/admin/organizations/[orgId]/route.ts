/**
 * Admin Organization by ID – proxy to backend (super_admin only).
 * GET: one organization, PATCH: update organization.
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const { orgId } = await params
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations/${orgId}`, {
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
    console.error('Organization GET proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const { orgId } = await params
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations/${orgId}`, {
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
    console.error('Organization PATCH proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    )
  }
}
