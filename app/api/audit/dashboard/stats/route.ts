import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      )
    }

    // Temporary mock data until backend is properly connected
    console.log('🔄 Returning mock audit dashboard stats')

    const mockStats = {
      total_events_24h: 42,
      total_anomalies_24h: 3,
      critical_events_24h: 2,
      event_volume_chart: [
        { hour: "00", count: 5 },
        { hour: "01", count: 3 },
        { hour: "02", count: 7 },
        { hour: "03", count: 2 },
        { hour: "04", count: 1 },
        { hour: "05", count: 4 },
        { hour: "06", count: 8 },
        { hour: "07", count: 12 }
      ],
      top_users: [
        { user_id: "user-1", count: 15 },
        { user_id: "user-2", count: 12 },
        { user_id: "user-3", count: 8 }
      ],
      top_event_types: [
        { event_type: "user_login", count: 18 },
        { event_type: "project_update", count: 12 },
        { event_type: "resource_allocation", count: 9 }
      ],
      category_breakdown: {
        "Security Change": 18,
        "Financial Impact": 12,
        "Resource Allocation": 9,
        "Compliance Action": 3
      },
      system_health: {
        status: "healthy",
        uptime: "2d 4h 32m",
        memory_usage: "67%"
      }
    }

    return NextResponse.json(mockStats)

  } catch (error) {
    console.error('Audit dashboard stats API error:', error)

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