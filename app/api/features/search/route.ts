/**
 * Feature search: keyword match + optional RAG (backend unified search) for contextual suggestions.
 * GET /api/features/search?q=...&rag=1
 * Returns { ids: string[], suggestions?: { id: string, name: string, snippet: string }[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export const dynamic = 'force-dynamic'

interface FeatureRow {
  id: string
  name: string | null
  description: string | null
  link: string | null
}

function keywordMatch(features: FeatureRow[], q: string): string[] {
  const qLower = q.toLowerCase()
  return features
    .filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(qLower)) ||
        (f.description && f.description.toLowerCase().includes(qLower)) ||
        (f.link && f.link.toLowerCase().includes(qLower))
    )
    .map((f) => f.id)
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const useRag = request.nextUrl.searchParams.get('rag') === '1'

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

  const catalog = (features ?? []) as FeatureRow[]
  const featureByLink = new Map<string | null, FeatureRow>()
  catalog.forEach((f) => {
    if (f.link) featureByLink.set(f.link, f)
    featureByLink.set(f.id, f)
  })

  let ids: string[] = keywordMatch(catalog, q)
  let suggestions: { id: string; name: string; snippet: string }[] | undefined

  if (useRag) {
    try {
      const auth = request.headers.get('Authorization') ?? ''
      const res = await fetch(
        `${backendUrl}/api/v1/search?q=${encodeURIComponent(q)}&limit=15`,
        {
          method: 'GET',
          headers: {
            Authorization: auth,
            'Content-Type': 'application/json',
          },
        }
      )
      if (res.ok) {
        const data = (await res.json()) as {
          fulltext?: Array<{ href?: string; title?: string; snippet?: string }>
          semantic?: Array<{ href?: string; title?: string; snippet?: string }>
        }
        const hrefs = new Set<string>()
        ;[(data.fulltext ?? []), (data.semantic ?? [])].flat().forEach((item) => {
          const href = item?.href
          if (href) hrefs.add(href)
        })
        const ragIds: string[] = []
        const ragSuggestions: { id: string; name: string; snippet: string }[] = []
        catalog.forEach((f) => {
          if (!f.link) return
          const normalized = f.link.split('?')[0]
          const match = [...hrefs].some(
            (h) => h === f.link || h === normalized || (h.startsWith(normalized + '?') || h.startsWith(normalized + '/'))
          )
          if (match) {
            ragIds.push(f.id)
            ragSuggestions.push({
              id: f.id,
              name: f.name ?? '',
              snippet: ((f.description ?? '').slice(0, 120) || (f.link ?? '')),
            })
          }
        })
        if (ragIds.length > 0) {
          ids = ragIds
          suggestions = ragSuggestions
        }
      }
    } catch {
      // keep keyword ids
    }
  }

  return NextResponse.json(
    suggestions ? { ids, suggestions } : { ids },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}
