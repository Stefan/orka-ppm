import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      )
    }

    await request.json()

    // TODO: Call backend anomaly detection when available; until then return empty result
    return NextResponse.json({
      anomalies: [],
      total_anomalies: 0,
      detection_period_days: 30,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Audit detect anomalies API error:', error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'Backend server not reachable. Please ensure the backend is running on port 8001.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: `Request failed: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}