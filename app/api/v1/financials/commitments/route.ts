/**
 * Phase 1 – Security & Scalability: Paginated commitments list
 * Enterprise Readiness: Cursor-based pagination for large datasets
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const organizationId = searchParams.get('organization_id') || undefined

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error', data: [], next_cursor: null, has_more: false },
        { status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    let query = supabase
      .from('commitments')
      .select('*', { count: 'exact', head: false })
      .order('id', { ascending: true })
      .limit(limit + 1)

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }
    if (cursor) {
      query = query.gt('id', cursor)
    }

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message, data: [], next_cursor: null, has_more: false },
        { status: 400 }
      )
    }

    const hasMore = (rows?.length ?? 0) > limit
    const data = hasMore ? rows!.slice(0, limit) : rows ?? []
    const nextCursor = hasMore && data.length > 0 ? (data[data.length - 1] as { id: string }).id : null

    return NextResponse.json({
      data,
      next_cursor: nextCursor,
      prev_cursor: cursor ?? null,
      has_more: hasMore,
    })
  } catch (e) {
    return NextResponse.json(
      { error: String(e), data: [], next_cursor: null, has_more: false },
      { status: 500 }
    )
  }
}
