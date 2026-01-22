/**
 * Monte Carlo Visualization Generation API Endpoint
 * Proxies requests to backend for generating simulation charts
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> }
) {
  try {
    const { simulationId } = await params
    const authHeader = request.headers.get('authorization')
    const body = await request.json()
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    // Forward request to backend
    const url = `${BACKEND_URL}/api/v1/monte-carlo/simulations/${simulationId}/visualizations/generate`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend Monte Carlo visualization error:', response.status, errorText)
      
      // Return the actual error from backend for debugging
      try {
        const errorJson = JSON.parse(errorText)
        return NextResponse.json(errorJson, { status: response.status })
      } catch {
        return NextResponse.json(
          { error: `Backend error: ${response.statusText}`, details: errorText },
          { status: response.status }
        )
      }
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying Monte Carlo visualization request:', error)
    return NextResponse.json(
      { error: 'Failed to generate visualization', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
