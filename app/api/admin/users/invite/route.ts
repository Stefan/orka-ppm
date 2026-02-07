/**
 * Admin Users Invite API – proxies POST to backend /api/admin/users/invite
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/api/admin/users/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend invite error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error proxying invite request:', error)
    return NextResponse.json(
      {
        error: 'Failed to send invite',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
