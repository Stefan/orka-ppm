/**
 * Notifications API: mark one as read or mark all as read
 * PUT /api/notifications/[notificationId]/read -> single
 * PUT /api/notifications/mark-all-read -> all (notificationId === 'mark-all-read')
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const { notificationId } = await params

    if (notificationId === 'mark-all-read') {
      const url = `${BACKEND_URL}/feedback/notifications/mark-all-read`
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      })
      if (!response.ok) {
        const err = await response.text()
        return NextResponse.json(
          { error: response.statusText, details: err },
          { status: response.status }
        )
      }
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(data)
    }

    const url = `${BACKEND_URL}/feedback/notifications/${notificationId}/read`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    })
    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json(
        { error: response.statusText, details: err },
        { status: response.status }
      )
    }
    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying notification update:', error)
    return NextResponse.json(
      {
        error: 'Failed to update notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
