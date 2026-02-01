import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'

/**
 * AI-powered feature search: interpret natural language and return relevant feature IDs.
 * E.g. "Zeig Import Features" -> Import Builder and related IDs.
 * Fallback: return IDs for features matching query in name/description/link.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ ids: [] })
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ids: [] })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: features } = await supabase
    .from('feature_catalog')
    .select('id, name, description, link')
    .order('name')

  if (!features || features.length === 0) {
    return NextResponse.json({ ids: [] })
  }

  const qLower = q.toLowerCase()
  const matched = features.filter(
    (f) =>
      (f.name && f.name.toLowerCase().includes(qLower)) ||
      (f.description && f.description.toLowerCase().includes(qLower)) ||
      (f.link && f.link.toLowerCase().includes(qLower))
  )

  const ids = matched.map((f) => f.id)

  return NextResponse.json({ ids })
}
