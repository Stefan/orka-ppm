/**
 * Feature overview curation (Grok) and spec enrichments.
 * Shared by app/api/features/docs/route.ts and scripts/build-feature-overview.ts.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { DocItem } from '@/types/features'

const ENRICHMENTS_PATH = path.join(process.cwd(), 'public', 'feature-docs-enrichments.json')

export interface FeatureOverviewCuration {
  excludeRouteIds: string[]
  nameOverrides: Record<string, string>
  descriptions: Record<string, string>
}

/** Spec folder names that are not PPM features—engineering/infra, fixes, testing, etc. */
export const NON_PPM_SPEC_IDS = new Set([
  'admin-performance-optimization',
  'build-optimization',
  'cross-browser-compatibility',
  'dashboard-layout-fix',
  'design-system-consistency',
  'enterprise-test-strategy',
  'github-actions-cicd',
  'performance-optimization',
  'pre-startup-testing',
  'project-cleanup',
  'property-based-testing',
  'react-rendering-error-fixes',
  'resources-page-structure-fix',
  'ui-structure-tests',
  'portfolio-language-selector-fix',
])

interface SpecEnrichment {
  is_feature: boolean
  feature_name: string | null
  feature_description: string | null
}

type EnrichmentsMap = Record<string, SpecEnrichment>

export function loadEnrichments(): EnrichmentsMap | null {
  try {
    if (fs.existsSync(ENRICHMENTS_PATH)) {
      const raw = fs.readFileSync(ENRICHMENTS_PATH, 'utf-8')
      return JSON.parse(raw) as EnrichmentsMap
    }
  } catch {
    // ignore
  }
  return null
}

/** Use Grok to curate routes: exclude irrelevant ones, suggest names, generate descriptions */
export async function curateRoutesWithGrok(routes: DocItem[]): Promise<FeatureOverviewCuration> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[curate-grok] OPENAI_API_KEY not set, skipping curation')
    return { excludeRouteIds: [], nameOverrides: {}, descriptions: {} }
  }

  const routeList = routes.map((r) => `${r.id} | name: "${r.name}" | link: ${r.link ?? ''}`).join('\n')

  const systemPrompt = `You curate the Feature Overview for Orka PPM, a Project Portfolio Management app.

Given a list of app routes (id, name, link), return a JSON object with:
1. excludeRouteIds: array of route ids to HIDE from the tree (e.g. technical pages, meta pages like the overview page itself, or anything that is not a real user-facing PPM page).
2. nameOverrides: object mapping route id to a better display name (e.g. "Users" -> "User management"). Only include overrides that improve clarity for PPM users.
3. descriptions: object mapping route id to a clear, helpful PPM-focused description for end users. Write 4–8 sentences per route: what the page is for, what users can do there, what key features it offers, when to use it, and how it helps PPM workflows. Use plain language with concrete examples. Include a description for EVERY route id in the list (except those in excludeRouteIds). Aim for 400–800 characters per description to provide comprehensive value for users.

Rules:
- Exclude routes that are param placeholders (e.g. :id), internal/admin-only pages that don't document PPM features, or the Features overview page.
- Use nameOverrides to make names user-friendly.
- descriptions must be user-facing, PPM-relevant, and detailed with practical examples. Return ONLY valid JSON: {"excludeRouteIds": string[], "nameOverrides": {"route:/path": "Display Name"}, "descriptions": {"route:/path": "Detailed description text with examples and use cases."}}`

  const userPrompt = `Routes:\n${routeList}\n\nReturn JSON only.`

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
        max_tokens: 12000,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn('[curate-grok] API error:', res.status, err)
      return { excludeRouteIds: [], nameOverrides: {}, descriptions: {} }
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return { excludeRouteIds: [], nameOverrides: {}, descriptions: {} }

    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim()) as FeatureOverviewCuration
    return {
      excludeRouteIds: Array.isArray(parsed.excludeRouteIds) ? parsed.excludeRouteIds : [],
      nameOverrides: parsed.nameOverrides && typeof parsed.nameOverrides === 'object' ? parsed.nameOverrides : {},
      descriptions: parsed.descriptions && typeof parsed.descriptions === 'object' ? parsed.descriptions : {},
    }
  } catch (e) {
    console.warn('[curate-grok] Failed:', e)
    return { excludeRouteIds: [], nameOverrides: {}, descriptions: {} }
  }
}

/** Apply Grok curation to routes: filter excluded, apply overrides and descriptions */
export function applyCuration(routes: DocItem[], curation: FeatureOverviewCuration): DocItem[] {
  const exclude = new Set(curation.excludeRouteIds)
  const overrides = curation.nameOverrides
  const descriptions = curation.descriptions

  return routes
    .filter((r) => !exclude.has(r.id))
    .map((r) => ({
      ...r,
      name: overrides[r.id] ?? r.name,
      description: descriptions[r.id] ?? r.description,
    }))
}

/** Exclude specs that are not PPM features (blocklist + AI enrichments). Use AI name/description when present. */
export function applyEnrichments(specs: DocItem[], enrichments: EnrichmentsMap | null): DocItem[] {
  return specs
    .filter((spec) => {
      const specId = spec.id.replace(/^spec:/, '')
      if (NON_PPM_SPEC_IDS.has(specId)) return false
      if (enrichments) {
        const e = enrichments[specId]
        if (e && e.is_feature === false) return false
      }
      return true
    })
    .map((spec) => {
      const specId = spec.id.replace(/^spec:/, '')
      const e = enrichments?.[specId]
      if (!e?.feature_name && !e?.feature_description) return spec
      return {
        ...spec,
        name: e.feature_name ?? spec.name,
        description: e.feature_description ?? spec.description,
      }
    })
}
