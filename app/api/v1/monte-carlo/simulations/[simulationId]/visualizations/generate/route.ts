/**
 * Monte Carlo Visualization Generation API Endpoint
 * Proxies requests to backend for generating simulation charts
 */

import { NextRequest, NextResponse } from 'next/server'

function getBackendUrl(): string {
  // In development, prefer local backend so the proxy hits the correct server
  if (process.env.NODE_ENV === 'development') {
    return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  }
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ simulationId: string }> }
) {
  try {
    const { simulationId } = await params
    const authHeader = request.headers.get('authorization')
    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // Optional body
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const backendUrl = getBackendUrl()
    const url = `${backendUrl}/api/v1/monte-carlo/simulations/${simulationId}/visualizations/generate`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(body)
      })
    } catch (fetchError) {
      console.error('Monte Carlo visualization: backend unreachable', fetchError)
      return NextResponse.json(
        {
          detail: 'Visualization service unavailable. Start the backend (e.g. port 8000) or check BACKEND_URL.',
          backend_url: backendUrl
        },
        { status: 503 }
      )
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend Monte Carlo visualization error:', response.status, errorText)

      let errorJson: Record<string, unknown>
      try {
        errorJson = errorText ? JSON.parse(errorText) : {}
      } catch {
        errorJson = { detail: errorText || response.statusText || 'Not Found' }
      }
      // Ensure 404 has a message the frontend can show
      if (response.status === 404 && !errorJson.detail) {
        errorJson.detail = 'Simulation results not found. Run a simulation first to generate charts.'
      }
      return NextResponse.json(errorJson, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying Monte Carlo visualization request:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to generate visualization' },
      { status: 500 }
    )
  }
}
