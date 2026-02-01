import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { crawlProjectDocs } from '@/lib/features/crawl-docs'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const WEBHOOK_SECRET = process.env.FEATURES_WEBHOOK_SECRET ?? ''

/**
 * POST /api/features/sync
 * Crawls .kiro/specs and inserts feature_catalog with new specs (textual descriptions; screenshots can be added later).
 * Does not sync app routes — Feature Overview focuses on feature descriptions and screenshots, not route listing.
 * Auth: x-webhook-secret or Authorization: Bearer <FEATURES_WEBHOOK_SECRET>
 * Body: { dry_run?: boolean } - if true, only return what would be inserted.
 * Idempotent: only inserts specs that don't exist (by name).
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('x-webhook-secret') ?? request.headers.get('authorization')?.replace('Bearer ', '')
  if (WEBHOOK_SECRET && auth !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Missing Supabase configuration' },
      { status: 500 }
    )
  }

  let dryRun = false
  try {
    const body = await request.json().catch(() => ({}))
    dryRun = (body as { dry_run?: boolean }).dry_run === true
  } catch {
    // ignore
  }

  try {
    const rootDir = process.cwd()
    const { specs } = crawlProjectDocs(rootDir)

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: existing } = await supabase
      .from('feature_catalog')
      .select('id, name')

    const existingNames = new Set((existing ?? []).map((r) => r.name))

    const toInsert: { name: string; parent_id: null; description: string | null; screenshot_url: null; link: string | null; icon: string | null }[] = []

    for (const s of specs) {
      if (!existingNames.has(s.name)) {
        toInsert.push({
          name: s.name,
          parent_id: null,
          description: s.description,
          screenshot_url: null,
          link: s.link,
          icon: s.icon,
        })
      }
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        would_insert: toInsert.length,
        specs: specs.length,
        items: toInsert.map((i) => ({ name: i.name, description: i.description ? `${i.description.slice(0, 60)}…` : null })),
      })
    }

    let inserted = 0
    const now = new Date().toISOString()
    for (const row of toInsert) {
      const { error } = await supabase.from('feature_catalog').insert({
        ...row,
        created_at: now,
        updated_at: now,
      })
      if (!error) inserted++
    }

    return NextResponse.json({
      ok: true,
      inserted,
      total_candidates: toInsert.length,
      specs: specs.length,
    })
  } catch (e) {
    console.error('[features/sync] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
