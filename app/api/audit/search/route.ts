import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔍 Audit search API called')

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    console.log('❌ No authorization header')
    return NextResponse.json(
      { error: 'Authorization header missing' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { query } = body

  console.log('🔄 Returning mock audit search results for query:', query)

  const mockResults = [
    {
      event: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        event_type: "user_login",
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        entity_type: "user",
        entity_id: "550e8400-e29b-41d4-a716-446655440001",
        action_details: { action: "login", method: "web" },
        severity: "info",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      relevance_score: 0.95,
      matched_terms: ["login", "user"],
      context: "User authentication event with web login method"
    }
  ]

  const response = {
    results: mockResults,
    total_results: mockResults.length,
    search_query: query,
    search_time_ms: 45,
    ai_processing_used: true
  }

  console.log('✅ Returning search response:', response)
  return NextResponse.json(response)
}