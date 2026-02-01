import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * AI suggestion for feature description from name/link.
 * Optional: call OpenAI or internal API to generate or improve description.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = (body as { name?: string }).name ?? ''
    const link = (body as { link?: string }).link ?? ''

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    // Placeholder: return a short description from name/link
    const description = link
      ? `${name} – feature available at ${link}.`
      : `${name} – PPM feature.`

    return NextResponse.json({ description })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Suggestion failed' },
      { status: 500 }
    )
  }
}
