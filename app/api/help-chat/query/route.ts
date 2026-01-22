import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { query, context, language = 'en', include_proactive_tips = false } = await request.json()
    
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }
    
    // Supabase Client mit User Auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') || ''
          }
        }
      }
    )

    // User Session holen
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Backend API Call (mit Supabase Caching)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/ai/help/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({ 
        query,
        context: context || {},
        language,
        include_proactive_tips
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || 'Backend request failed')
    }

    const data = await response.json()
    
    return NextResponse.json(data, {
      headers: {
        // Cache-Header für CDN (optional)
        // Cached responses können länger gecacht werden
        'Cache-Control': data.is_cached 
          ? 'public, s-maxage=300, stale-while-revalidate=600' 
          : 'no-cache, no-store, must-revalidate',
        'X-Cache-Status': data.is_cached ? 'HIT' : 'MISS'
      }
    })
  } catch (error) {
    console.error('Help chat error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
