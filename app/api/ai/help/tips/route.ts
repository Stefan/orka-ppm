import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    // Get all query parameters from the request
    const searchParams = request.nextUrl.searchParams
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    
    // Forward all query parameters to backend
    const backendUrl = `${BACKEND_URL}/api/ai/help/tips?${searchParams.toString()}`
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying help tips:', error)
    return NextResponse.json(
      { error: 'Failed to get proactive tips', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
