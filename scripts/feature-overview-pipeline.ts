#!/usr/bin/env tsx
/**
 * Single script that builds the full feature overview: tree JSON, descriptions, screenshots.
 * Ensures the app is running (starts it if needed), then runs:
 *   1. build-feature-overview (crawl, Grok, .md, tree JSON)
 *   2. feature-screenshots (capture PNGs for all routes)
 *   3. build-feature-overview again (add screenshot_url to tree for new PNGs)
 *
 * Run: npm run feature-overview
 *
 * Env (passed to feature-screenshots):
 *   BASE_URL - app origin (default http://localhost:3000)
 *   FEATURE_SCREENSHOT_EMAIL, FEATURE_SCREENSHOT_PASSWORD - login before capture (so screenshots are not login screen)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - to capture feature_catalog links (second tree level) and update screenshot_url
 *   SKIP_START_DEV - if set, do not start the dev server; fail if app is not running
 */

import * as path from 'path'
import { config } from 'dotenv'
import { spawn, spawnSync } from 'child_process'

const ROOT = process.cwd()
config({ path: path.join(ROOT, '.env'), quiet: true })
config({ path: path.join(ROOT, 'backend', '.env'), quiet: true })

const BASE_URL = (process.env.FEATURE_SCREENSHOT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const SKIP_START_DEV = process.env.SKIP_START_DEV === '1' || process.env.SKIP_START_DEV === 'true'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 90000

function log(msg: string): void {
  console.log(`[feature-overview] ${msg}`)
}

function run(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })
  return r.status === 0
}

async function isAppReachable(): Promise<boolean> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(BASE_URL, { signal: controller.signal })
    clearTimeout(t)
    return true
  } catch {
    clearTimeout(t)
    return false
  }
}

async function waitForApp(): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    if (await isAppReachable()) return true
    log(`Waiting for app at ${BASE_URL}...`)
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

async function ensureApp(): Promise<void> {
  if (await isAppReachable()) {
    log(`App already running at ${BASE_URL}`)
    return
  }
  if (SKIP_START_DEV) {
    console.error(`\nApp is not running at ${BASE_URL}. Start it with: npm run dev\n`)
    process.exit(1)
  }
  log(`Starting dev server (npm run dev)...`)
  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    shell: true,
  })
  child.unref()
  if (!(await waitForApp())) {
    console.error(`\nApp did not become ready at ${BASE_URL} within ${POLL_TIMEOUT_MS / 1000}s.\n`)
    process.exit(1)
  }
  log('App is ready.')
}

async function main(): Promise<void> {
  log('Step 0: Ensure app is running')
  await ensureApp()

  log('Step 1: Build feature overview (crawl, Grok, .md, tree JSON)')
  if (!run('npm', ['run', 'build-feature-overview'])) {
    console.error('\n[feature-overview] build-feature-overview failed.\n')
    process.exit(1)
  }

  log('Step 2: Capture screenshots for all routes')
  if (!process.env.FEATURE_SCREENSHOT_EMAIL || !process.env.FEATURE_SCREENSHOT_PASSWORD) {
    log('Tip: set FEATURE_SCREENSHOT_EMAIL and FEATURE_SCREENSHOT_PASSWORD in .env so screenshots show the app instead of the login screen.')
  }
  if (!run('npm', ['run', 'feature-screenshots'])) {
    console.error('\n[feature-overview] feature-screenshots failed (some routes may have failed). Continuing.\n')
  }

  log('Step 3: Rebuild feature overview (add screenshot_url for new PNGs)')
  if (!run('npm', ['run', 'build-feature-overview'])) {
    console.error('\n[feature-overview] build-feature-overview (second run) failed.\n')
    process.exit(1)
  }

  log('Done. Tree: public/feature-overview-tree.json | Screenshots: public/feature-screenshots/')
  if (!SKIP_START_DEV) {
    log('Dev server may still be running in the background. Stop it with Ctrl+C if you started it via this script.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
