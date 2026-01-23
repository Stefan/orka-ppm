/**
 * Financial Tracking Comprehensive Report API Endpoint
 * Proxies requests to backend
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    
    const queryString = searchParams.toString()
    const url = `${BACKEND_URL}/financial-tracking/comprehensive-report${queryString ? `?${queryString}` : ''}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (authHeader) {
      headers['Authorization'] = authHeader
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend comprehensive-report error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying comprehensive-report request:', error)
    return NextResponse.json(
      { error: 'Failed to get comprehensive report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
