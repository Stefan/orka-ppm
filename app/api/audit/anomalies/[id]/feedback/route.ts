import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      )
    }

    const anomalyId = params.id
    const body = await request.json()

    // Temporary mock response until backend is properly connected
    console.log('🔄 Processing mock anomaly feedback for anomaly:', anomalyId)

    return NextResponse.json({
      success: true,
      anomaly_id: anomalyId,
      feedback_recorded: true,
      updated_at: new Date().toISOString(),
      message: "Feedback successfully recorded for anomaly analysis improvement"
    })

  } catch (error) {
    console.error('Audit anomaly feedback API error:', error)

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