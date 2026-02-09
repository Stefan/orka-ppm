/**
 * PATCH /api/features/[id] – update a single feature in feature_catalog (inline edit).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing feature id' }, { status: 400 })
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof body.name === 'string') updates.name = body.name
  if (typeof body.description === 'string' || body.description === null) updates.description = body.description
  if (typeof body.link === 'string' || body.link === null) updates.link = body.link
  if (typeof body.icon === 'string' || body.icon === null) updates.icon = body.icon
  if (typeof body.screenshot_url === 'string' || body.screenshot_url === null) updates.screenshot_url = body.screenshot_url

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase
    .from('feature_catalog')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
