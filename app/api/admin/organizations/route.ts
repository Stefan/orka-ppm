/**
 * Admin Organizations API – proxy to backend (super_admin only).
 * GET: list organizations, POST: create organization.
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations`, {
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
    console.error('Organizations GET proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/api/admin/organizations`, {
      method: 'POST',
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
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('Organizations POST proxy error:', e)
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
