/**
 * Playwright script: capture screenshots for feature routes and optionally update feature_catalog.screenshot_url.
 *
 * Run: npx tsx scripts/feature-screenshots.ts
 * Or: BASE_URL=https://app.example.com npm run feature-screenshots
 *
 * Env:
 *   BASE_URL - app origin (default http://localhost:3000)
 *   FEATURE_SCREENSHOTS_DIR - output dir (default public/feature-screenshots)
 *   UPDATE_SUPABASE=1 - if set, update feature_catalog.screenshot_url (requires Supabase env)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - for DB update (optional)
 */
import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const DEFAULT_BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = process.env.FEATURE_SCREENSHOTS_DIR ?? path.join(process.cwd(), 'public', 'feature-screenshots')
const UPDATE_SUPABASE = process.env.UPDATE_SUPABASE === '1' || process.env.UPDATE_SUPABASE === 'true'

interface RouteConfig {
  path: string
  featureId?: string
  name?: string
}

const DEFAULT_ROUTES: RouteConfig[] = [
  { path: '/financials', name: 'Financials', featureId: 'a0000000-0000-0000-0000-000000000001' },
  { path: '/import', name: 'Import Builder', featureId: 'b0000000-0000-0000-0000-000000000003' },
]

/** Public URL for a screenshot in public/feature-screenshots (relative path for same-origin). */
function screenshotPublicUrl(baseUrl: string, slug: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/feature-screenshots/${slug}.png`
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let supabase: Awaited<ReturnType<typeof import('@supabase/supabase-js')['createClient']>> | null = null
  if (UPDATE_SUPABASE) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(supabaseUrl, supabaseKey)
    } else {
      console.warn('UPDATE_SUPABASE is set but NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) not set; skipping DB updates.')
    }
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  })

  for (const route of DEFAULT_ROUTES) {
    const url = `${baseUrl}${route.path}`
    const slug = route.path.replace(/\//g, '-').replace(/^-/, '') || 'home'
    const filePath = path.join(OUT_DIR, `${slug}.png`)

    try {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
      await page.screenshot({ path: filePath, fullPage: false })
      await page.close()
      console.log(`Screenshot saved: ${filePath}`)

      if (supabase && route.featureId) {
        const screenshotUrl = screenshotPublicUrl(baseUrl, slug)
        const { error } = await supabase
          .from('feature_catalog')
          .update({ screenshot_url: screenshotUrl, updated_at: new Date().toISOString() })
          .eq('id', route.featureId)
        if (error) {
          console.error(`Failed to update screenshot_url for ${route.featureId}:`, error)
        } else {
          console.log(`Updated feature_catalog.screenshot_url for ${route.featureId}`)
        }
      }
    } catch (e) {
      console.error(`Failed ${url}:`, e)
    }
  }

  await context.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
