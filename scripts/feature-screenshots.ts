/**
 * Playwright script: capture screenshots for feature routes and optionally update features.screenshot_url.
 * Run: npx tsx scripts/feature-screenshots.ts
 * Or from webhook: spawn this script with baseUrl (e.g. http://localhost:3000).
 */
import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const DEFAULT_BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = process.env.FEATURE_SCREENSHOTS_DIR ?? path.join(process.cwd(), 'public', 'feature-screenshots')

interface RouteConfig {
  path: string
  featureId?: string
  name?: string
}

const DEFAULT_ROUTES: RouteConfig[] = [
  { path: '/financials', name: 'Financials', featureId: 'a0000000-0000-0000-0000-000000000001' },
  { path: '/import', name: 'Import Builder', featureId: 'b0000000-0000-0000-0000-000000000003' },
]

async function main() {
  const baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL
  fs.mkdirSync(OUT_DIR, { recursive: true })

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
