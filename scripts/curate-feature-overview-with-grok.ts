#!/usr/bin/env tsx
/**
 * Use Grok (xAI) to curate the Feature Overview: which routes are real user-facing pages
 * and what display names to use. Writes public/feature-overview-curation.json for the
 * docs API to apply.
 *
 * Uses OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL (same as backend) from .env or backend/.env.
 * Run: npm run curate-feature-overview-with-grok
 */

import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
import { crawlProjectDocs } from '../lib/features/crawl-docs'

const ROOT = process.cwd()
config({ path: path.join(ROOT, '.env') })
config({ path: path.join(ROOT, 'backend', '.env') })
const OUT_FILE = path.join(ROOT, 'public', 'feature-overview-curation.json')

export interface FeatureOverviewCuration {
  excludeRouteIds: string[]
  nameOverrides: Record<string, string>
}

async function curateWithGrok(
  routes: { id: string; name: string; link: string | null }[]
): Promise<FeatureOverviewCuration> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set. Writing empty curation.')
    return { excludeRouteIds: [], nameOverrides: {} }
  }

  const list = routes.map((r) => `${r.id} | name: "${r.name}" | link: ${r.link ?? ''}`).join('\n')

  const systemPrompt = `You curate the Feature Overview for Orka PPM, a Project Portfolio Management app.

Given a list of app routes (id, name, link), return a JSON object with:
1. excludeRouteIds: array of route ids to HIDE from the tree (e.g. technical pages, meta pages like the overview page itself, or anything that is not a real user-facing PPM page).
2. nameOverrides: object mapping route id to a better display name (e.g. "Users" -> "User management"). Only include overrides that improve clarity for PPM users.

Rules:
- Exclude routes that are param placeholders (e.g. :id), internal/admin-only pages that don't document PPM features, or the Features overview page.
- Use nameOverrides to make names user-friendly (e.g. "User management" not "Users").
- Return ONLY valid JSON: {"excludeRouteIds": string[], "nameOverrides": {"route:/path": "Display Name"}}`

  const userPrompt = `Routes:\n${list}\n\nReturn JSON only.`

  try {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn('[curate-grok] API error:', res.status, err)
      return { excludeRouteIds: [], nameOverrides: {} }
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return { excludeRouteIds: [], nameOverrides: {} }
    const parsed = JSON.parse(
      text.replace(/^```json\s*|\s*```$/g, '').trim()
    ) as FeatureOverviewCuration
    return {
      excludeRouteIds: Array.isArray(parsed.excludeRouteIds) ? parsed.excludeRouteIds : [],
      nameOverrides:
        parsed.nameOverrides && typeof parsed.nameOverrides === 'object'
          ? parsed.nameOverrides
          : {},
    }
  } catch (e) {
    console.warn('[curate-grok] Failed:', e)
    return { excludeRouteIds: [], nameOverrides: {} }
  }
}

async function main() {
  const result = crawlProjectDocs(ROOT)
  const routes = result.routes.filter((r) => r.source === 'route' && r.id.startsWith('route:'))

  if (routes.length === 0) {
    console.log('No routes to curate. Writing empty curation.')
    const empty: FeatureOverviewCuration = { excludeRouteIds: [], nameOverrides: {} }
    const outDir = path.dirname(OUT_FILE)
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(OUT_FILE, JSON.stringify(empty, null, 2), 'utf-8')
    process.exit(0)
  }

  console.log(`Curating ${routes.length} routes with Grok...`)
  const curation = await curateWithGrok(
    routes.map((r) => ({ id: r.id, name: r.name ?? '', link: r.link }))
  )

  console.log(`  Exclude: ${curation.excludeRouteIds.length} routes`)
  console.log(`  Name overrides: ${Object.keys(curation.nameOverrides).length}`)

  const outDir = path.dirname(OUT_FILE)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(curation, null, 2), 'utf-8')
  console.log(`Wrote ${OUT_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
