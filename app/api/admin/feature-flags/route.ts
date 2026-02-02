import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/feature-flags - List all feature flags
export async function GET() {
  try {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch feature flags:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Feature flags error:', err)
    return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 })
  }
}

// POST /api/admin/feature-flags - Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await request.json()

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        name: body.name,
        description: body.description,
        status: body.status || 'disabled',
        rollout_strategy: body.rollout_strategy || 'all_users',
        rollout_percentage: body.rollout_percentage,
        allowed_user_ids: body.allowed_user_ids,
        allowed_roles: body.allowed_roles,
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create feature flag:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Feature flag creation error:', err)
    return NextResponse.json({ error: 'Failed to create feature flag' }, { status: 500 })
  }
}
