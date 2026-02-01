import { NextRequest, NextResponse } from 'next/server'
import { config } from 'dotenv'
import * as path from 'path'

export const dynamic = 'force-dynamic'

// Load env for Grok API
config({ path: path.join(process.cwd(), '.env') })
config({ path: path.join(process.cwd(), 'backend', '.env') })

/**
 * Generate a short PPM-focused feature description using Grok (xAI).
 * Uses OPENAI_API_KEY and OPENAI_BASE_URL from env (same as backend).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = (body as { name?: string }).name ?? ''
    const link = (body as { link?: string }).link ?? ''

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { description: link ? `${name} – feature at ${link}.` : `${name} – PPM feature.` },
        { status: 200 }
      )
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'grok-4-fast-reasoning',
        messages: [
          {
            role: 'system',
            content:
              'You write short, user-facing descriptions for features in Orka PPM (Project Portfolio Management). One or two sentences, under 200 characters. Plain language for end users. Return ONLY the description text, no quotes or preamble.',
          },
          {
            role: 'user',
            content: `Write a short PPM feature description for: "${name}"${link ? ` (page/link: ${link})` : ''}.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn('[suggest-description] Grok error:', res.status, err)
      return NextResponse.json(
        { description: link ? `${name} – feature at ${link}.` : `${name} – PPM feature.` },
        { status: 200 }
      )
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const description = data.choices?.[0]?.message?.content?.trim()
    if (!description) {
      return NextResponse.json(
        { description: link ? `${name} – feature at ${link}.` : `${name} – PPM feature.` },
        { status: 200 }
      )
    }

    return NextResponse.json({ description })
  } catch (e) {
    console.warn('[suggest-description]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Suggestion failed' },
      { status: 500 }
    )
  }
}
