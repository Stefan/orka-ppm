/**
 * Phase 2 – Dynamic Column Customizer: Save/Load column views
 * Enterprise Readiness: Admin-UI Save as View
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ColumnView } from '@/types/enterprise'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const userId = request.headers.get('x-user-id') || ''

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json([])
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    let query = supabase.from('column_views').select('*').order('order', { ascending: true })
    if (entity) query = query.eq('entity', entity)
    if (userId) query = query.eq('user_id', userId)

    const { data, error } = await query

    if (error) {
      return NextResponse.json([])
    }
    return NextResponse.json((data || []) as ColumnView[])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { name: string; entity: string; columns: string[]; is_default?: boolean }
    const { name, entity, columns, is_default } = body

    if (!name || !entity || !Array.isArray(columns)) {
      return NextResponse.json({ error: 'name, entity, columns required' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ id: 'local', name, entity, columns, order: 0, created_at: new Date().toISOString() })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const userId = request.headers.get('x-user-id') || ''
    const row = {
      name,
      entity,
      columns,
      order: 0,
      is_default: !!is_default,
      user_id: userId || null,
    }

    const { data, error } = await supabase.from('column_views').insert(row).select('id, name, entity, columns, order, is_default, created_at').single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data as ColumnView)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
