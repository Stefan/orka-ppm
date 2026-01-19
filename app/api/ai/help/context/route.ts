import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const pageRoute = searchParams.get('page_route')
    
    if (!pageRoute) {
      return NextResponse.json(
        { error: 'page_route parameter is required' },
        { status: 400 }
      )
    }
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    
    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/ai/help/context?page_route=${encodeURIComponent(pageRoute)}`, {
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
    console.error('Error proxying help context:', error)
    return NextResponse.json(
      { error: 'Failed to get help context', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
