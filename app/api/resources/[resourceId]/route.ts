/**
 * Resources API Proxy – single resource (GET, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params
    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID required' }, { status: 400 })
    }
    const authHeader = request.headers.get('Authorization')
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/resources/${resourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorBody = JSON.parse(errorText)
        return NextResponse.json(errorBody, { status: response.status })
      } catch {
        return NextResponse.json(
          { detail: errorText || `Backend error: ${response.status}` },
          { status: response.status }
        )
      }
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Resources PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const { resourceId } = await params
    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID required' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization')
    const response = await fetch(`${BACKEND_URL}/resources/${resourceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorBody = JSON.parse(errorText)
        return NextResponse.json(errorBody, { status: response.status })
      } catch {
        return NextResponse.json(
          { detail: errorText || `Backend error: ${response.status}` },
          { status: response.status }
        )
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Resources DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    )
  }
}
