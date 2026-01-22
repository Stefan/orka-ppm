/**
 * Project Scenarios API Endpoint
 * Proxies requests to backend for what-if scenario analysis
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    
    // Forward request to backend - scenarios router has prefix /simulations/what-if
    const url = `${BACKEND_URL}/simulations/what-if/projects/${projectId}/scenarios`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend scenarios error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying scenarios request:', error)
    return NextResponse.json(
      { error: 'Failed to get scenarios', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    const body = await request.json()
    
    // Forward request to backend
    const url = `${BACKEND_URL}/simulations/what-if/projects/${projectId}/scenarios`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend scenarios POST error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error proxying scenarios POST request:', error)
    return NextResponse.json(
      { error: 'Failed to create scenario', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
