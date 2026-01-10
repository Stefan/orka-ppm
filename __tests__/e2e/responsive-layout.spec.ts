/**
 * Cross-Device Responsive Layout Tests
 * Tests responsive behavior across different devices and screen sizes
 */

import { test, expect } from '@playwright/test'
import { DeviceTestUtils, deviceTestUtils } from './utils/device-testing'

test.describe('Responsive Layout Cross-Device Tests', () => {
  let deviceUtils: DeviceTestUtils

  test.beforeEach(async ({ page, context }) => {
    deviceUtils = deviceTestUtils.create(page, context)
    await page.goto('/')
  })

  test('should maintain layout integrity across all breakpoints', async ({ page }) => {
    const results = await deviceUtils.testResponsiveBreakpoints(deviceTestUtils.breakpoints)
    
    for (const result of results) {
      // Check for layout issues at each breakpoint
      expect(result.layoutIssues.filter(issue => issue.includes('horizontal_overflow')).length).toBe(0)
      expect(result.layoutIssues.filter(issue => issue.includes('element_overflow')).length).toBe(0)
      
      console.log(`✅ ${result.breakpoint} (${result.viewport.width}x${result.viewport.height}): ${result.layoutIssues.length} issues`)
    }
  })

  test('should handle orientation changes gracefully', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    
    // Capture initial state
    const initialLayout = await deviceUtils.checkLayoutIntegrity()
    
    // Change to landscape
    await deviceUtils.changeOrientation('landscape')
    const landscapeLayout = await deviceUtils.checkLayoutIntegrity()
    
    // Change back to portrait
    await deviceUtils.changeOrientation('portrait')
    const portraitLayout = await deviceUtils.checkLayoutIntegrity()
    
    // Verify no layout breaks occurred
    expect(landscapeLayout.filter(issue => issue.includes('overflow')).length).toBe(0)
    expect(portraitLayout.filter(issue => issue.includes('overflow')).length).toBe(0)
  })

  test('should maintain touch target sizes across devices', async ({ page }) => {
    const devices = [
      ...deviceTestUtils.devices.mobile,
      ...deviceTestUtils.devices.tablet
    ]

    for (const device of devices) {
      await page.setViewportSize(device.viewport)
      await page.goto('/')
      
      const violations = await deviceUtils.validateTouchTargets(44)
      
      expect(violations.length).toBe(0)
      console.log(`✅ ${device.name}: All touch targets meet 44px requirement`)
    }
  })

  test('should render consistently across different pixel densities', async ({ page }) => {
    const densities = [1, 1.5, 2, 2.5, 3]
    
    for (const density of densities) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      
      // Emulate device pixel ratio
      await page.evaluate((density) => {
        Object.defineProperty(window, 'devicePixelRatio', {
          value: density,
          writable: true
        })
      }, density)
      
      await page.goto('/')
      
      // Check that layout remains stable
      const layoutIssues = await deviceUtils.checkLayoutIntegrity()
      expect(layoutIssues.filter(issue => issue.includes('overflow')).length).toBe(0)
      
      console.log(`✅ Device pixel ratio ${density}: Layout stable`)
    }
  })

  test('should handle dynamic content resizing', async ({ page }) => {
    await page.goto('/dashboards')
    
    // Test across different viewport sizes
    const viewports = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1920, height: 1080 }  // Desktop
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      
      // Wait for layout to stabilize
      await page.waitForTimeout(500)
      
      // Simulate adding dynamic content
      await page.evaluate(() => {
        const container = document.querySelector('[data-testid="dashboard-container"]')
        if (container) {
          const newWidget = document.createElement('div')
          newWidget.className = 'dashboard-widget'
          newWidget.style.cssText = 'width: 300px; height: 200px; background: #f0f0f0; margin: 10px;'
          newWidget.textContent = 'Dynamic Widget'
          container.appendChild(newWidget)
        }
      })
      
      // Check layout integrity after dynamic content addition
      const layoutIssues = await deviceUtils.checkLayoutIntegrity()
      expect(layoutIssues.filter(issue => issue.includes('overflow')).length).toBe(0)
      
      console.log(`✅ ${viewport.width}x${viewport.height}: Dynamic content handled correctly`)
    }
  })
})

test.describe('Visual Regression Tests', () => {
  let deviceUtils: DeviceTestUtils

  test.beforeEach(async ({ page, context }) => {
    deviceUtils = deviceTestUtils.create(page, context)
  })

  test('should maintain visual consistency across devices', async ({ page }) => {
    const pages = ['/', '/dashboards', '/resources', '/risks']
    const devices = [
      { name: 'mobile', viewport: { width: 375, height: 667 } },
      { name: 'tablet', viewport: { width: 768, height: 1024 } },
      { name: 'desktop', viewport: { width: 1920, height: 1080 } }
    ]

    for (const pagePath of pages) {
      for (const device of devices) {
        await page.setViewportSize(device.viewport)
        await page.goto(pagePath)
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle')
        
        // Capture visual regression test
        await deviceUtils.captureVisualRegression({
          name: `${pagePath.replace('/', 'home')}-${device.name}`,
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        })
      }
    }
  })

  test('should handle theme changes consistently', async ({ page }) => {
    await page.goto('/')
    
    const themes = ['light', 'dark']
    const viewport = { width: 1280, height: 720 }
    
    await page.setViewportSize(viewport)
    
    for (const theme of themes) {
      // Set theme
      await page.evaluate((theme) => {
        localStorage.setItem('theme', theme)
        document.documentElement.setAttribute('data-theme', theme)
      }, theme)
      
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Capture theme-specific screenshot
      await deviceUtils.captureVisualRegression({
        name: `theme-${theme}`,
        fullPage: true,
        threshold: 0.1,
        animations: 'disabled'
      })
    }
  })
})

test.describe('Performance Across Devices', () => {
  let deviceUtils: DeviceTestUtils

  test.beforeEach(async ({ page, context }) => {
    deviceUtils = deviceTestUtils.create(page, context)
  })

  test('should meet performance thresholds on mobile devices', async ({ page }) => {
    // Simulate mobile device with slower CPU
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigate and measure performance
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    const metrics = await deviceUtils.measurePerformance()
    
    // Performance assertions
    expect(loadTime).toBeLessThan(5000) // 5 second max load time
    expect(metrics.firstContentfulPaint).toBeLessThan(3000) // 3 second FCP
    expect(metrics.resourceCount).toBeLessThan(100) // Reasonable resource count
    
    console.log('📊 Mobile Performance Metrics:', {
      loadTime,
      fcp: metrics.firstContentfulPaint,
      resources: metrics.resourceCount
    })
  })

  test('should handle slow network conditions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Test different network conditions
    const conditions = ['3g', '2g'] as const
    
    for (const condition of conditions) {
      await deviceUtils.testNetworkConditions(condition)
      
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 })
      const loadTime = Date.now() - startTime
      
      // Verify page is still functional under slow conditions
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
      
      // Performance should degrade gracefully
      if (condition === '3g') {
        expect(loadTime).toBeLessThan(10000) // 10 seconds for 3G
      } else if (condition === '2g') {
        expect(loadTime).toBeLessThan(20000) // 20 seconds for 2G
      }
      
      console.log(`📊 ${condition.toUpperCase()} Performance: ${loadTime}ms`)
    }
  })
})