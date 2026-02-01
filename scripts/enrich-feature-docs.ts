#!/usr/bin/env tsx
/**
 * Enrich .kiro/specs with AI-generated feature names and descriptions from a PPM point of view.
 * Only specs that describe Orka PPM user-facing features (what the app provides to PPM users) are included.
 * Excludes: cross-browser compatibility, build optimization, CI/CD, testing, design system, fixes, cleanup, etc.
 * Writes public/feature-docs-enrichments.json for GET /api/features/docs to use.
 *
 * Run: OPENAI_API_KEY=xxx npx tsx scripts/enrich-feature-docs.ts
 * Or: npm run enrich-feature-docs (after setting OPENAI_API_KEY in .env)
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = process.cwd()
const SPECS_DIR = path.join(ROOT, '.kiro', 'specs')
const OUT_FILE = path.join(ROOT, 'public', 'feature-docs-enrichments.json')

const MAX_CONTENT_LEN = 4000

export interface SpecEnrichment {
  is_feature: boolean
  feature_name: string | null
  feature_description: string | null
}

export type EnrichmentsMap = Record<string, SpecEnrichment>

function readSpecContent(specDir: string): string {
  const parts: string[] = []
  for (const file of ['design.md', 'requirements.md']) {
    const p = path.join(specDir, file)
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8')
      parts.push(`## ${file}\n${content}`)
    }
  }
  const combined = parts.join('\n\n')
  return combined.length > MAX_CONTENT_LEN ? combined.slice(0, MAX_CONTENT_LEN) + '\n...[truncated]' : combined
}

async function enrichWithAI(specId: string, content: string): Promise<SpecEnrichment> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { is_feature: true, feature_name: null, feature_description: null }
  }

  const systemPrompt = `You analyze specification documents for Orka PPM, a Project Portfolio Management (PPM) application.

Your task: decide if the spec describes a PPM FEATURE that the app provides to its users (portfolio managers, project managers, team members). The Feature Overview must be written from a PPM point of view—only capabilities that PPM users use belong here.

INCLUDE (is_feature: true): User-facing PPM capabilities such as: portfolio dashboards, project management, resource planning, financial tracking, costbook, risk/issue registers, Monte Carlo simulation, reporting, change management, audit trail, collaboration, PMR, import/export, workflows, shareable URLs, user sync, AI help, etc. Write feature_name and feature_description for end users in PPM terms.

EXCLUDE (is_feature: false): Anything that is NOT a PPM user capability:
- Cross-browser compatibility, build optimization, CI/CD, testing infrastructure, design system implementation, i18n setup
- Bug fixes, layout fixes, refactors, cleanup, pre-startup testing, UI structure tests, react rendering fixes
- Dashboard layout fix, enterprise test strategy, property-based testing, resources page structure fix
- Anything that is engineering/infra or developer tooling—irrelevant in the PPM context

If is_feature is false, set feature_name and feature_description to null.
Reply with ONLY a single JSON object, no markdown: {"is_feature": boolean, "feature_name": string|null, "feature_description": string|null}`

  const userPrompt = `Spec folder / id: ${specId}\n\nContent:\n${content}`

  try {
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn(`[enrich] API error for ${specId}: ${res.status} ${err}`)
      return { is_feature: true, feature_name: null, feature_description: null }
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return { is_feature: true, feature_name: null, feature_description: null }
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim()) as SpecEnrichment
    return {
      is_feature: Boolean(parsed.is_feature),
      feature_name: parsed.feature_name ?? null,
      feature_description: parsed.feature_description ?? null,
    }
  } catch (e) {
    console.warn(`[enrich] Failed for ${specId}:`, e)
    return { is_feature: true, feature_name: null, feature_description: null }
  }
}

async function main() {
  if (!fs.existsSync(SPECS_DIR)) {
    console.log('No .kiro/specs directory found. Exiting.')
    process.exit(0)
  }

  const dirs = fs.readdirSync(SPECS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())
  const enrichments: EnrichmentsMap = {}

  console.log(`Enriching ${dirs.length} specs with AI...`)
  for (const d of dirs) {
    const specId = d.name
    const content = readSpecContent(path.join(SPECS_DIR, d.name))
    if (!content.trim()) {
      enrichments[specId] = { is_feature: true, feature_name: null, feature_description: null }
      continue
    }
    const result = await enrichWithAI(specId, content)
    enrichments[specId] = result
    console.log(`  ${specId}: is_feature=${result.is_feature}${result.feature_name ? ` name="${result.feature_name}"` : ''}`)
  }

  const outDir = path.dirname(OUT_FILE)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(enrichments, null, 2), 'utf-8')
  console.log(`Wrote ${OUT_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
