/**
 * Schedules API – list and create (proxy to backend).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const queryString = searchParams.toString()
    const backendUrl = `${BACKEND_URL}/schedules${queryString ? `?${queryString}` : ''}`

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend schedules API error:', response.status, errorText)
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
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
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
      return NextResponse.json(
        { error: 'Failed to create schedule' },
        { status: response.status }
      )
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
