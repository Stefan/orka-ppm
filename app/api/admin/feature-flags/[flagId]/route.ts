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

// GET /api/admin/feature-flags/[flagId] - Get a specific feature flag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const { flagId } = await params
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('id', flagId)
      .single()

    if (error) {
      console.error('Failed to fetch feature flag:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Feature flag fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch feature flag' }, { status: 500 })
  }
}

// PUT /api/admin/feature-flags/[flagId] - Update a feature flag
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const { flagId } = await params
    const supabase = getSupabase()
    const body = await request.json()

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.rollout_strategy !== undefined) updateData.rollout_strategy = body.rollout_strategy
    if (body.rollout_percentage !== undefined) updateData.rollout_percentage = body.rollout_percentage
    if (body.allowed_user_ids !== undefined) updateData.allowed_user_ids = body.allowed_user_ids
    if (body.allowed_roles !== undefined) updateData.allowed_roles = body.allowed_roles
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    const { data, error } = await supabase
      .from('feature_flags')
      .update(updateData)
      .eq('id', flagId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update feature flag:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Feature flag update error:', err)
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
  }
}

// DELETE /api/admin/feature-flags/[flagId] - Delete a feature flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const { flagId } = await params
    const supabase = getSupabase()

    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', flagId)

    if (error) {
      console.error('Failed to delete feature flag:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('Feature flag delete error:', err)
    return NextResponse.json({ error: 'Failed to delete feature flag' }, { status: 500 })
  }
}
