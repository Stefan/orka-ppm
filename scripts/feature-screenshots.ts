/**
 * Playwright script: capture screenshots for feature overview (routes + feature_catalog).
 * Logs in first if FEATURE_SCREENSHOT_EMAIL/PASSWORD are set, so screenshots show app content, not login.
 * Reads routes from public/feature-overview-tree.json; optionally fetches feature_catalog from Supabase
 * and captures feature links (second tree level) and updates feature_catalog.screenshot_url.
 *
 * Run: npm run feature-screenshots
 * App must be running (e.g. npm run dev).
 *
 * Env:
 *   FEATURE_SCREENSHOT_BASE_URL - frontend app origin (default http://localhost:3000). Use this so backend/.env BASE_URL does not override.
 *   FEATURE_SCREENSHOTS_DIR - output dir (default public/feature-screenshots)
 *   FEATURE_SCREENSHOT_EMAIL, FEATURE_SCREENSHOT_PASSWORD - login before capture (recommended so screenshots are not login screen)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) - to capture feature_catalog links and update screenshot_url
 */
import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import { config } from 'dotenv'

const ROOT = process.cwd()
config({ path: path.join(ROOT, '.env'), quiet: true })
config({ path: path.join(ROOT, 'backend', '.env'), quiet: true })

const DEFAULT_BASE_URL = 'http://localhost:3000'
const OUT_DIR = process.env.FEATURE_SCREENSHOTS_DIR ?? path.join(process.cwd(), 'public', 'feature-screenshots')
const TREE_JSON_PATH = path.join(process.cwd(), 'public', 'feature-overview-tree.json')
const SCREENSHOTS_BASE = '/feature-screenshots'
const LOGIN_EMAIL = process.env.FEATURE_SCREENSHOT_EMAIL ?? ''
const LOGIN_PASSWORD = process.env.FEATURE_SCREENSHOT_PASSWORD ?? ''

interface RouteConfig {
  path: string
  slug: string
  name?: string
}

/** Slug from route link: /financials -> financials, /financials?tab=costbook -> financials-tab-costbook */
function linkToSlug(link: string | null): string {
  if (!link) return 'index'
  const [p, q] = link.replace(/^\//, '').split('?')
  const pathSlug = p.replace(/\//g, '-') || 'index'
  const querySlug = q ? '-' + q.replace(/[&=]/g, '-').replace(/%/g, '') : ''
  return (pathSlug + querySlug).slice(0, 80) || 'index'
}

/** Load ALL routes from feature-overview-tree.json (flat array with parentId references) */
function loadRoutesFromTree(): RouteConfig[] {
  if (!fs.existsSync(TREE_JSON_PATH)) return []
  try {
    const raw = fs.readFileSync(TREE_JSON_PATH, 'utf-8')
    const data = JSON.parse(raw) as {
      routes?: Array<{ link?: string | null; name?: string; id?: string; parentId?: string }>
    }

    const routes: RouteConfig[] = []
    const seen = new Set<string>()

    // All routes are in a flat array - parentId is just for hierarchy, we capture all
    if (data.routes) {
      for (const route of data.routes) {
        if (route.link && route.link.startsWith('/') && !seen.has(route.link)) {
          seen.add(route.link)
          routes.push({
            path: route.link,
            slug: linkToSlug(route.link),
            name: route.name ?? route.link,
          })
        }
      }
    }

    console.log(`Loaded ${routes.length} routes from tree JSON`)
    return routes
  } catch (err) {
    console.error('Error loading routes from tree:', err)
    return []
  }
}

const FALLBACK_ROUTES: RouteConfig[] = [
  { path: '/financials', slug: 'financials', name: 'Financials' },
  { path: '/import', slug: 'import', name: 'Import' },
  { path: '/dashboards', slug: 'dashboards', name: 'Dashboards' },
]

/** Check if the app is reachable; exit with clear message if not */
async function ensureAppRunning(baseUrl: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(baseUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return // server answered
  } catch (e) {
    clearTimeout(timeout)
    console.error(`\nApp is not running at ${baseUrl}`)
    console.error('Start the app first, then run this script again:')
    console.error('  npm run dev\n')
    process.exit(1)
  }
}

/** Log in so subsequent navigations are authenticated (no login screen in screenshots). */
async function loginIfConfigured(
  baseUrl: string,
  context: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>
): Promise<void> {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.log('No FEATURE_SCREENSHOT_EMAIL/PASSWORD set; skipping login (screenshots may show login screen).')
    return
  }
  console.log(`Logging in as ${LOGIN_EMAIL} …`)
  const page = await context.newPage()
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Login page shows loading spinner first; wait for the form to be visible
    await page.waitForSelector('input#email', { state: 'visible', timeout: 15000 })
    await page.waitForSelector('input#password', { state: 'visible', timeout: 5000 })
    await page.fill('input#email', LOGIN_EMAIL)
    await page.fill('input#password', LOGIN_PASSWORD)
    await page.click('button[type="submit"]')
    // App redirects after ~1.5s via window.location.href
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(2000)
    const url = page.url()
    if (url.includes('/login')) {
      console.warn('Login may have failed (still on /login). Screenshots may show login screen.')
    } else {
      console.log('Logged in; capturing authenticated pages.')
    }
  } finally {
    await page.close()
  }
}

/** Fetch feature_catalog rows with link from Supabase (service role or anon). */
async function loadFeatureLinks(): Promise<{ id: string; link: string }[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase.from('feature_catalog').select('id, link').not('link', 'is', null)
    if (error) {
      console.warn('Could not load feature_catalog:', error.message)
      return []
    }
    return (data ?? []).filter((r) => r.link && r.link.startsWith('/')) as { id: string; link: string }[]
  } catch (e) {
    console.warn('Could not load feature_catalog:', e)
    return []
  }
}

/** Capture one URL and save to filePath. Returns true on success. */
async function captureUrl(
  context: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>,
  baseUrl: string,
  urlPath: string,
  filePath: string
): Promise<boolean> {
  const url = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    // Allow client-side auth redirect (e.g. from login to app) to complete
    await page.waitForTimeout(2500)
    await page.screenshot({ path: filePath, fullPage: false })
    await page.close()
    return true
  } catch (e) {
    console.error(`Failed ${url}:`, e)
    return false
  }
}

async function main() {
  const baseUrl = (process.env.FEATURE_SCREENSHOT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const routes = loadRoutesFromTree()
  const routeList = routes.length > 0 ? routes : FALLBACK_ROUTES
  if (routes.length > 0) {
    console.log(`Using ${routeList.length} routes from feature-overview-tree.json`)
  } else {
    console.log(`No tree JSON found; using ${routeList.length} fallback routes`)
  }

  await ensureAppRunning(baseUrl)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  })

  await loginIfConfigured(baseUrl, context)

  // Capture route-level (first tree level)
  for (const route of routeList) {
    const filePath = path.join(OUT_DIR, `${route.slug}.png`)
    if (await captureUrl(context, baseUrl, route.path, filePath)) {
      console.log(`Screenshot saved: ${path.relative(process.cwd(), filePath)}`)
    }
  }

  // Capture feature-level (second tree level) from feature_catalog
  const features = await loadFeatureLinks()
  const routePaths = new Set(routeList.map((r) => r.path))
  const uniqueFeatureLinks: { id: string; link: string }[] = Array.from(
    new Map(features.map((f) => [f.link, f])).values()
  ).filter((f) => !routePaths.has(f.link))
  if (uniqueFeatureLinks.length > 0) {
    console.log(`Capturing ${uniqueFeatureLinks.length} feature links from feature_catalog`)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    let supabase: Awaited<ReturnType<typeof import('@supabase/supabase-js')['createClient']>> | null = null
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(supabaseUrl, supabaseKey)
    }
    for (const feat of uniqueFeatureLinks) {
      const slug = linkToSlug(feat.link)
      const filePath = path.join(OUT_DIR, `${slug}.png`)
      if (await captureUrl(context, baseUrl, feat.link, filePath)) {
        console.log(`Screenshot saved: ${path.relative(process.cwd(), filePath)} (feature)`)
        const screenshotUrl = `${SCREENSHOTS_BASE}/${slug}.png`
        if (supabase) {
          const { error } = await supabase
            .from('feature_catalog')
            .update({ screenshot_url: screenshotUrl, updated_at: new Date().toISOString() })
            .eq('link', feat.link)
          if (error) console.warn(`Could not update feature_catalog for link ${feat.link}:`, error.message)
        }
      }
    }
  }

  await context.close()
  await browser.close()
  console.log(`Done. Routes: ${routeList.length}, Features: ${uniqueFeatureLinks.length}. Screenshots in ${path.relative(process.cwd(), OUT_DIR)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
