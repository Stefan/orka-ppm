import { NextRequest, NextResponse } from 'next/server'

/**
 * Derive audit search filters from natural language query.
 * - "today" / "heute" -> start_date/end_date = today
 * - "resource" / "Ressource" / "resource changes" -> event_types: resource_created, resource_updated, resource_deleted
 * - "user" / "Benutzer" / "angelegt" / "created" -> add user_management so user creation appears
 */
function filtersFromQuery(query: string): {
  start_date?: string
  end_date?: string
  event_types?: string[]
} {
  const q = query.toLowerCase().trim()
  const filters: { start_date?: string; end_date?: string; event_types?: string[] } = {}

  // Today / heute – full day (start 00:00, end 23:59:59) so all of today is included
  if (/\b(today|heute)\b/.test(q)) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    filters.start_date = start.toISOString()
    filters.end_date = end.toISOString()
  }

  // Yesterday / gestern
  if (/\b(yesterday|gestern)\b/.test(q)) {
    const start = new Date()
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    filters.start_date = start.toISOString()
    filters.end_date = end.toISOString()
  }

  // Resource / Ressource / resource changes
  if (/\b(resource|ressource|ressourcen|resources)\b/.test(q) || /\bresource\s+changes\b/.test(q)) {
    filters.event_types = [
      ...(filters.event_types || []),
      'resource_created',
      'resource_updated',
      'resource_deleted',
      'resource_assignment',
    ].filter((v, i, a) => a.indexOf(v) === i)
  }

  // User / Benutzer / user created / angelegt
  if (
    /\b(user|benutzer|users|benutzeranlage)\b/.test(q) ||
    /\b(angelegt|created|erstellt|invite|einladung)\b/.test(q) ||
    /\buser\s+created\b/.test(q)
  ) {
    filters.event_types = [...(filters.event_types || []), 'user_management'].filter(
      (v, i, a) => a.indexOf(v) === i
    )
  }

  return filters
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 })
  }

  let body: { query?: string; filters?: Record<string, unknown>; limit?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query } = body
  if (!query || typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const derivedFilters = filtersFromQuery(query.trim())
  const mergedFilters = {
    ...(body.filters as Record<string, unknown> | undefined),
    ...(derivedFilters.start_date && { start_date: derivedFilters.start_date }),
    ...(derivedFilters.end_date && { end_date: derivedFilters.end_date }),
    ...(derivedFilters.event_types?.length
      ? { event_types: derivedFilters.event_types }
      : {}),
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'
  const url = `${backendUrl.replace(/\/$/, '')}/api/audit/search`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        query: query.trim(),
        filters: Object.keys(mergedFilters).length ? mergedFilters : undefined,
        limit: typeof body.limit === 'number' ? Math.min(50, Math.max(1, body.limit)) : 10,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }))
      return NextResponse.json(
        { error: err.detail || `Backend returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('Audit search proxy error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search request failed' },
      { status: 502 }
    )
  }
}
