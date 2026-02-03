#!/usr/bin/env tsx
/**
 * Build the feature overview tree once: crawl → Grok curation → write .md descriptions
 * and public/feature-overview-tree.json. Run when features change; the app then loads
 * from the JSON (no Grok on request).
 *
 * Uses OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL from .env or backend/.env.
 * Run: npm run build-feature-overview
 */

import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
import { crawlProjectDocs } from '../lib/features/crawl-docs'
import {
  curateRoutesWithGrok,
  applyCuration,
  loadEnrichments,
  applyEnrichments,
} from '../lib/features/curate-and-enrich'
import type { DocItem } from '../types/features'

const ROOT = process.cwd()
config({ path: path.join(ROOT, '.env'), quiet: true })
config({ path: path.join(ROOT, 'backend', '.env'), quiet: true })

const DOCS_FEATURES_DIR = path.join(ROOT, 'docs', 'features')
const TREE_JSON_PATH = path.join(ROOT, 'public', 'feature-overview-tree.json')
const SCREENSHOTS_DIR = path.join(ROOT, 'public', 'feature-screenshots')
const SCREENSHOTS_BASE = '/feature-screenshots'

/** Route link to slug for filenames and screenshot URLs (e.g. /reports/pmr -> reports-pmr) */
function routeLinkToSlug(link: string | null): string {
  if (!link) return 'index'
  return link.replace(/^\//, '').replace(/\//g, '-') || 'index'
}

/** Read description from docs/features/{slug}.md if it exists (first non-empty line or content before ---) */
function readDescriptionFromMd(slug: string): string | null {
  const mdPath = path.join(DOCS_FEATURES_DIR, `${slug}.md`)
  if (!fs.existsSync(mdPath)) return null
  try {
    const raw = fs.readFileSync(mdPath, 'utf-8')
    const withoutFrontmatter = raw.replace(/^\s*---[\s\S]*?---\s*/m, '').trim()
    const firstLine = withoutFrontmatter.split(/\r?\n/)[0]?.trim()
    return firstLine || null
  } catch {
    return null
  }
}

/** Write description to docs/features/{slug}.md (only if file does not exist, to preserve edits) */
function writeDescriptionMd(slug: string, description: string): void {
  fs.mkdirSync(DOCS_FEATURES_DIR, { recursive: true })
  const mdPath = path.join(DOCS_FEATURES_DIR, `${slug}.md`)
  if (fs.existsSync(mdPath)) return
  fs.writeFileSync(mdPath, `${description}\n`, 'utf-8')
  console.log('[build-feature-overview] Wrote', path.relative(ROOT, mdPath))
}

async function main() {
  console.log('[build-feature-overview] Crawling project...')
  const result = crawlProjectDocs(ROOT)

  console.log('[build-feature-overview] Calling Grok for curation...')
  const curation = await curateRoutesWithGrok(result.routes)
  const curatedRoutes = applyCuration(result.routes, curation)

  // Merge descriptions: prefer existing .md, else Grok; write .md for new routes. Set screenshot_url only when file exists (avoids 404s).
  const routesWithScreenshots = curatedRoutes.map((r) => {
    const slug = routeLinkToSlug(r.link)
    const mdDesc = readDescriptionFromMd(slug)
    const grokDesc = r.description
    const description = mdDesc ?? grokDesc ?? null
    if (!mdDesc && grokDesc) writeDescriptionMd(slug, grokDesc)
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${slug}.png`)
    const screenshot_url = fs.existsSync(screenshotPath) ? `${SCREENSHOTS_BASE}/${slug}.png` : null
    return {
      ...r,
      description,
      screenshot_url,
    }
  })

  const enrichments = loadEnrichments()
  const specs = applyEnrichments(result.specs, enrichments)
  const allItems: DocItem[] = [...result.sections, ...routesWithScreenshots, ...specs, ...result.docs]
  // Remove duplicates by ID to ensure clean data
  console.log(`[build-feature-overview] allItems before deduplication: ${allItems.length}`)
  const seenIds = new Set<string>()
  const all: DocItem[] = allItems.filter((item) => {
    if (seenIds.has(item.id)) {
      console.warn(`[build-feature-overview] Removing duplicate item: ${item.id}`)
      return false
    }
    seenIds.add(item.id)
    return true
  })
  console.log(`[build-feature-overview] allItems after deduplication: ${all.length}`)

  const output = {
    sections: result.sections,
    routes: routesWithScreenshots,
    specs,
    docs: result.docs,
    all,
  }

  const withScreenshot = routesWithScreenshots.filter((r) => r.screenshot_url).length
  fs.mkdirSync(path.dirname(TREE_JSON_PATH), { recursive: true })
  fs.writeFileSync(TREE_JSON_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log('[build-feature-overview] Wrote', path.relative(ROOT, TREE_JSON_PATH))
  console.log('[build-feature-overview] Routes:', routesWithScreenshots.length, '| With screenshot:', withScreenshot, '| Specs:', specs.length)
  if (withScreenshot < routesWithScreenshots.length) {
    console.log('[build-feature-overview] Run npm run feature-screenshots (with app running), then re-run this script to add screenshot_url for new PNGs.')
  }
}

main().catch((e) => {
  console.error('[build-feature-overview] Error:', e)
  process.exit(1)
})
