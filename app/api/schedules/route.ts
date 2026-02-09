/**
 * Schedules API – list and create (proxy to backend).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const backendUrl = `${BACKEND_URL}/schedules${queryString ? `?${queryString}` : ''}`

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend schedules API error:', response.status, errorText)
      // If backend returns 401, client may have stale/expired token; return empty list so page still loads
      if (response.status === 401) {
        return NextResponse.json(
          { schedules: [], total: 0, page: 1, page_size: 50 },
          { status: 200, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
  } catch (error) {
    console.error('Schedules API error:', error)
    // Backend unreachable (e.g. not running): return empty list so page still loads
    return NextResponse.json(
      { schedules: [], total: 0, page: 1, page_size: 50 },
      { status: 200, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const body = await request.text()
    const queryString = searchParams.toString()
    const backendUrl = `${BACKEND_URL}/schedules${queryString ? `?${queryString}` : ''}`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: body || undefined,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend schedules create error:', response.status, errorText)
      let body: { error?: string; detail?: unknown } = {}
      try {
        const parsed = JSON.parse(errorText)
        if (parsed.detail != null) body.detail = parsed.detail
        if (parsed.error != null) body.error = parsed.error
      } catch {
        if (errorText) body.detail = errorText
      }
      if (!body.error && body.detail == null) body.error = 'Failed to create schedule'
      return NextResponse.json(body, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Schedules create API error:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}
