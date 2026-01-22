/**
 * CSV Import Variances API Endpoint
 * Proxies requests to backend for financial variance data
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Build query string from all search params
    const queryString = searchParams.toString()
    const url = `${BACKEND_URL}/csv-import/variances${queryString ? `?${queryString}` : ''}`
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    
    // Forward request to backend
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend variances error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying variances request:', error)
    return NextResponse.json(
      { error: 'Failed to get variances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
