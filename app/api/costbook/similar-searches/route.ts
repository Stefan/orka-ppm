import { NextRequest, NextResponse } from 'next/server'
import { getSimilarSearches } from '@/lib/nl-query-parser'

/**
 * GET /api/costbook/similar-searches?q=...&limit=3
 * Returns 2–3 similar search phrases for the given query (Costbook AI Enhancement – Similar Searches).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''
    const limit = Math.min(5, Math.max(1, parseInt(searchParams.get('limit') ?? '3', 10) || 3))
    const items = getSimilarSearches(q, limit)
    return NextResponse.json({ similarSearches: items })
  } catch (e) {
    console.error('Similar searches error:', e)
    return NextResponse.json({ similarSearches: [] })
  }
}
