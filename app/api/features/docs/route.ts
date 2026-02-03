import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
import { crawlProjectDocs } from '@/lib/features/crawl-docs'
import {
  curateRoutesWithGrok,
  applyCuration,
  loadEnrichments,
  applyEnrichments,
} from '@/lib/features/curate-and-enrich'
import type { DocItem } from '@/types/features'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TREE_JSON_PATH = path.join(process.cwd(), 'public', 'feature-overview-tree.json')

// Load env for Grok API (fallback path only)
config({ path: path.join(process.cwd(), '.env') })
config({ path: path.join(process.cwd(), 'backend', '.env') })

/**
 * GET /api/features/docs
 * Serves precomputed tree from public/feature-overview-tree.json when present (fast path).
 * Otherwise crawls + Grok (slow path). Run npm run build-feature-overview to generate the JSON.
 */
export async function GET() {
  try {
    // Fast path: serve precomputed tree when present
    if (fs.existsSync(TREE_JSON_PATH)) {
      const raw = fs.readFileSync(TREE_JSON_PATH, 'utf-8')
      const data = JSON.parse(raw) as {
        sections: DocItem[]
        routes: DocItem[]
        specs: DocItem[]
        docs: DocItem[]
        all?: DocItem[]
      }
      // Ensure no duplicates in the response
      const sections = data.sections ?? []
      let routes = data.routes ?? []
      const specs = data.specs ?? []
      const docs = data.docs ?? []

      // Remove duplicates from routes array
      const routeIds = new Set<string>()
      routes = routes.filter((route) => {
        if (routeIds.has(route.id)) return false
        routeIds.add(route.id)
        return true
      })

      const allItems = data.all ?? [...sections, ...routes, ...specs, ...docs]

      // Remove duplicates by ID
      const seenIds = new Set<string>()
      const cleanAll = allItems.filter((item) => {
        if (seenIds.has(item.id)) return false
        seenIds.add(item.id)
        return true
      })

      return NextResponse.json(
        {
          sections,
          routes,
          specs,
          docs,
          all: cleanAll,
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      )
    }

    // Fallback: crawl + Grok (same as before)
    const rootDir = process.cwd()
    const result = crawlProjectDocs(rootDir)
    const curation = await curateRoutesWithGrok(result.routes)
    const curatedRoutes = applyCuration(result.routes, curation)
    const enrichments = loadEnrichments()
    const specs = applyEnrichments(result.specs, enrichments)
    const all: DocItem[] = [...result.sections, ...curatedRoutes, ...specs, ...result.docs]
    return NextResponse.json(
      {
        sections: result.sections,
        routes: curatedRoutes,
        specs,
        docs: result.docs,
        all,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (e) {
    console.error('[features/docs] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
