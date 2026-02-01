import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
import { crawlProjectDocs } from '@/lib/features/crawl-docs'
import type { DocItem } from '@/types/features'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ENRICHMENTS_PATH = path.join(process.cwd(), 'public', 'feature-docs-enrichments.json')

// Load env for Grok API
config({ path: path.join(process.cwd(), '.env') })
config({ path: path.join(process.cwd(), 'backend', '.env') })

interface FeatureOverviewCuration {
  excludeRouteIds: string[]
  nameOverrides: Record<string, string>
  descriptions: Record<string, string>
}

/** Spec folder names that are not PPM features—engineering/infra, fixes, testing, etc. Always excluded from the Overview. */
const NON_PPM_SPEC_IDS = new Set([
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

function loadEnrichments(): EnrichmentsMap | null {
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
async function curateRoutesWithGrok(routes: DocItem[]): Promise<FeatureOverviewCuration> {
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
3. descriptions: object mapping route id to a SHORT (1–2 sentences) PPM-focused description for end users. Describe what the page is for in plain language (e.g. "Create and manage projects, track status, budgets, and timelines."). Include a description for EVERY route id in the list (except those in excludeRouteIds). Keep each under 200 characters.

Rules:
- Exclude routes that are param placeholders (e.g. :id), internal/admin-only pages that don't document PPM features, or the Features overview page.
- Use nameOverrides to make names user-friendly.
- descriptions must be user-facing and PPM-relevant. Return ONLY valid JSON: {"excludeRouteIds": string[], "nameOverrides": {"route:/path": "Display Name"}, "descriptions": {"route:/path": "Short description."}}`

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
        max_tokens: 4000,
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

/** Exclude specs that are not PPM features (blocklist + AI enrichments). Use AI name/description when present. */
function applyEnrichments(specs: DocItem[], enrichments: EnrichmentsMap | null): DocItem[] {
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

/** Apply Grok curation to routes: filter excluded, apply overrides and descriptions */
function applyCuration(routes: DocItem[], curation: FeatureOverviewCuration): DocItem[] {
  const exclude = new Set(curation.excludeRouteIds)
  const overrides = curation.nameOverrides
  const descriptions = curation.descriptions

  return routes
    .filter((r) => !exclude.has(r.id))
    .map((r) => ({
      ...r,
      name: overrides[r.id] ?? r.name,
      description: descriptions[r.id] ?? r.description
    }))
}

/**
 * GET /api/features/docs
 * Crawls the project (.kiro/specs, docs/) and returns documentation items.
 * Uses Grok to curate routes: exclude irrelevant ones, apply name overrides, and generate descriptions.
 * If public/feature-docs-enrichments.json exists (from npm run enrich-feature-docs),
 * specs are filtered to user-facing features only and use AI-generated names/descriptions.
 */
export async function GET() {
  try {
    const rootDir = process.cwd()
    const result = crawlProjectDocs(rootDir)

    // Curate routes with Grok
    const curation = await curateRoutesWithGrok(result.routes)
    const curatedRoutes = applyCuration(result.routes, curation)

    // #region agent log
    const hasApiKey = Boolean(process.env.OPENAI_API_KEY)
    const descCount = Object.keys(curation.descriptions || {}).length
    const firstCurated = curatedRoutes[0]
    fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/features/docs/route.ts:GET',
        message: 'Docs API after curation',
        data: {
          hasApiKey,
          descCount,
          firstRouteId: firstCurated?.id,
          firstRouteDescLen: firstCurated?.description?.length ?? 0,
          responseHasFeatureDescriptions: false,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H1,H2,H4',
      }),
    }).catch(() => {})
    // #endregion

    // Process specs with enrichments
    const enrichments = loadEnrichments()
    const specs = applyEnrichments(result.specs, enrichments)

    const all: DocItem[] = [...result.sections, ...curatedRoutes, ...specs, ...result.docs]
    return NextResponse.json({
      sections: result.sections,
      routes: curatedRoutes,
      specs,
      docs: result.docs,
      all,
    })
  } catch (e) {
    console.error('[features/docs] Crawl error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Crawl failed' },
      { status: 500 }
    )
  }
}
