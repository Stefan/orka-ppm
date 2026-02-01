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

    const body = await request.json()

    // Temporary mock data until backend is properly connected
    console.log('🔄 Returning mock anomaly detection data')

    const mockAnomalies = [
      {
        id: "anomaly-1",
        event_id: "550e8400-e29b-41d4-a716-446655440000",
        anomaly_type: "unusual_login_time",
        confidence_score: 0.92,
        description: "Login at unusual hour for this user",
        detection_timestamp: new Date().toISOString(),
        is_false_positive: false,
        feedback_provided: false,
        related_events: ["550e8400-e29b-41d4-a716-446655440000"],
        ai_analysis: {
          pattern: "deviation_from_normal_behavior",
          risk_level: "medium",
          recommended_action: "monitor_user_activity"
        },
        audit_event: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          event_type: "user_login",
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          entity_type: "user",
          entity_id: "550e8400-e29b-41d4-a716-446655440001",
          action_details: { action: "login", method: "web" },
          severity: "info",
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0...",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          category: "Security Change",
          risk_level: "Low",
          tags: { demo: true },
          ai_insights: { confidence: 0.95, pattern: "normal_login" },
          tenant_id: "default"
        }
      },
      {
        id: "anomaly-2",
        event_id: "550e8400-e29b-41d4-a716-446655440003",
        anomaly_type: "large_budget_change",
        confidence_score: 0.87,
        description: "Unusually large budget modification",
        detection_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        is_false_positive: false,
        feedback_provided: false,
        related_events: ["550e8400-e29b-41d4-a716-446655440003"],
        ai_analysis: {
          pattern: "statistical_outlier",
          risk_level: "high",
          recommended_action: "require_additional_approval"
        },
        audit_event: {
          id: "550e8400-e29b-41d4-a716-446655440003",
          event_type: "project_update",
          user_id: "550e8400-e29b-41d4-a716-446655440001",
          entity_type: "project",
          entity_id: "550e8400-e29b-41d4-a716-446655440002",
          action_details: { action: "update", field: "budget" },
          severity: "info",
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0...",
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          category: "Financial Impact",
          risk_level: "Medium",
          tags: { demo: true },
          ai_insights: { confidence: 0.87, pattern: "budget_change" },
          tenant_id: "default"
        }
      }
    ]

    return NextResponse.json({
      anomalies: mockAnomalies,
      total_anomalies: mockAnomalies.length,
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