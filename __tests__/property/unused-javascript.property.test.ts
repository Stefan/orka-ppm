/**
 * Property-Based Test: Unused JavaScript Limit
 * 
 * Property 8: Unused JavaScript Under Size Limit
 * Validates: Requirements 4.5
 * 
 * For any production build, the amount of unused JavaScript (code not 
 * executed during page load) should be less than 500 KiB.
 * 
 * Note: This test requires Chrome DevTools Protocol to measure code coverage.
 * It uses Playwright to launch a browser and measure actual code execution.
 */

import { test, expect, chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.describe('Unused JavaScript Optimization - Property Tests', () => {
  const MAX_UNUSED_JS = 500 * 1024 // 500 KiB in bytes
  const TEST_URL = process.env.TEST_URL || 'http://localhost:3000/admin/performance'

  /**
   * Property 8: Unused JavaScript Under Size Limit
   * 
   * This property verifies that the amount of unused JavaScript code
   * remains under the specified limit to ensure efficient resource usage.
   */
  test('Property 8: Unused JavaScript should be under 500 KiB', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    // Enable JavaScript coverage
    await page.coverage.startJSCoverage()

    try {
      // Navigate to the admin performance page
      await page.goto(TEST_URL, { waitUntil: 'networkidle' })

      // Wait for lazy-loaded components to load
      await page.waitForTimeout(3000)

      // Interact with the page to trigger more code execution
      // This ensures we measure actual usage, not just initial load
      const refreshButton = page.locator('button:has-text("Refresh")')
      if (await refreshButton.isVisible()) {
        await refreshButton.click()
        await page.waitForTimeout(1000)
      }

      // Stop coverage and get results
      const coverage = await page.coverage.stopJSCoverage()

      let totalBytes = 0
      let usedBytes = 0
      let unusedBytes = 0

      const coverageDetails: Array<{
        url: string
        total: number
        used: number
        unused: number
        unusedPercent: number
      }> = []

      // Analyze coverage for each JavaScript file
      for (const entry of coverage) {
        // Only analyze our application code (exclude external scripts)
        if (entry.url.includes('/_next/') || entry.url.includes('/static/')) {
          let entryUsedBytes = 0

          // Calculate used bytes from ranges
          for (const range of entry.ranges) {
            entryUsedBytes += range.end - range.start
          }

          const entryTotalBytes = entry.text.length
          const entryUnusedBytes = entryTotalBytes - entryUsedBytes
          const unusedPercent = (entryUnusedBytes / entryTotalBytes) * 100

          totalBytes += entryTotalBytes
          usedBytes += entryUsedBytes
          unusedBytes += entryUnusedBytes

          // Only track files with significant unused code
          if (entryUnusedBytes > 10 * 1024) { // > 10 KB unused
            coverageDetails.push({
              url: entry.url.split('/').pop() || entry.url,
              total: entryTotalBytes,
              used: entryUsedBytes,
              unused: entryUnusedBytes,
              unusedPercent
            })
          }
        }
      }

      // Sort by unused bytes (descending)
      coverageDetails.sort((a, b) => b.unused - a.unused)

      // Log coverage summary
      console.log('\n=== JavaScript Coverage Summary ===')
      console.log(`Total JavaScript: ${(totalBytes / 1024).toFixed(2)} KB`)
      console.log(`Used JavaScript: ${(usedBytes / 1024).toFixed(2)} KB`)
      console.log(`Unused JavaScript: ${(unusedBytes / 1024).toFixed(2)} KB`)
      console.log(`Usage Rate: ${((usedBytes / totalBytes) * 100).toFixed(2)}%`)
      console.log(`\nLimit: ${(MAX_UNUSED_JS / 1024).toFixed(2)} KB`)
      console.log(`Remaining Budget: ${((MAX_UNUSED_JS - unusedBytes) / 1024).toFixed(2)} KB`)

      // Log top files with unused code
      if (coverageDetails.length > 0) {
        console.log('\n=== Top Files with Unused Code ===')
        coverageDetails.slice(0, 10).forEach((detail, index) => {
          console.log(`${index + 1}. ${detail.url}`)
          console.log(`   Total: ${(detail.total / 1024).toFixed(2)} KB`)
          console.log(`   Unused: ${(detail.unused / 1024).toFixed(2)} KB (${detail.unusedPercent.toFixed(1)}%)`)
        })
      }

      // Save detailed coverage report
      const reportPath = path.join(process.cwd(), 'coverage-report.json')
      fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        url: TEST_URL,
        summary: {
          totalBytes,
          usedBytes,
          unusedBytes,
          usageRate: (usedBytes / totalBytes) * 100
        },
        details: coverageDetails
      }, null, 2))
      console.log(`\nDetailed report saved to: ${reportPath}`)

      // Property assertion: Unused JavaScript must be under limit
      expect(unusedBytes).toBeLessThan(MAX_UNUSED_JS)

    } finally {
      await browser.close()
    }
  })

  /**
   * Property: Lazy Loading Effectiveness
   * 
   * This property verifies that lazy-loaded components are not included
   * in the initial bundle by checking that they load after page load.
   */
  test('Property: Lazy-loaded components should not be in initial bundle', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    // Track network requests
    const jsRequests: string[] = []
    page.on('request', request => {
      if (request.resourceType() === 'script') {
        jsRequests.push(request.url())
      }
    })

    await page.coverage.startJSCoverage()

    try {
      // Navigate and wait for initial load only
      await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' })
      
      // Get coverage immediately after initial load
      const initialCoverage = await page.coverage.stopJSCoverage()
      
      // Check that chart-related chunks are not in initial load
      const initialChunks = initialCoverage.map(entry => entry.url)
      const hasChartsInInitial = initialChunks.some(url => 
        url.includes('ChartSection') || url.includes('recharts')
      )

      console.log('\n=== Lazy Loading Check ===')
      console.log(`Initial JS Requests: ${jsRequests.length}`)
      console.log(`Charts in Initial Load: ${hasChartsInInitial ? '✗ (should be lazy)' : '✓'}`)

      // Charts should not be in initial bundle
      expect(hasChartsInInitial).toBe(false)

    } finally {
      await browser.close()
    }
  })

  /**
   * Property: Tree-Shaking Effectiveness
   * 
   * This property verifies that tree-shaking is working by checking
   * that unused exports from libraries are not included in the bundle.
   */
  test('Property: Tree-shaking should remove unused library exports', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.coverage.startJSCoverage()

    try {
      await page.goto(TEST_URL, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      const coverage = await page.coverage.stopJSCoverage()

      // Check Recharts bundle for unused components
      const rechartsEntry = coverage.find(entry => 
        entry.url.includes('recharts') || entry.url.includes('charts-vendor')
      )

      if (rechartsEntry) {
        let usedBytes = 0
        for (const range of rechartsEntry.ranges) {
          usedBytes += range.end - range.start
        }

        const totalBytes = rechartsEntry.text.length
        const unusedBytes = totalBytes - usedBytes
        const usageRate = (usedBytes / totalBytes) * 100

        console.log('\n=== Recharts Tree-Shaking Analysis ===')
        console.log(`Total Size: ${(totalBytes / 1024).toFixed(2)} KB`)
        console.log(`Used: ${(usedBytes / 1024).toFixed(2)} KB`)
        console.log(`Unused: ${(unusedBytes / 1024).toFixed(2)} KB`)
        console.log(`Usage Rate: ${usageRate.toFixed(2)}%`)

        // We expect at least 30% usage rate for Recharts
        // (Lower rate indicates poor tree-shaking)
        expect(usageRate).toBeGreaterThan(30)
      } else {
        console.log('\n=== Recharts Tree-Shaking Analysis ===')
        console.log('Recharts not found in coverage (may be lazy-loaded)')
      }

    } finally {
      await browser.close()
    }
  })
})
