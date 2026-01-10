/**
 * Cross-Device Testing Utilities
 * Provides utilities for testing across different devices and screen sizes
 */

import { Page, BrowserContext, expect } from '@playwright/test'

export interface DeviceTestConfig {
  name: string
  viewport: { width: number; height: number }
  userAgent?: string
  deviceScaleFactor?: number
  isMobile?: boolean
  hasTouch?: boolean
}

export interface TouchTestConfig {
  element: string
  gesture: 'tap' | 'swipe' | 'pinch' | 'longpress'
  direction?: 'left' | 'right' | 'up' | 'down'
  distance?: number
  duration?: number
}

export interface VisualTestConfig {
  name: string
  selector?: string
  fullPage?: boolean
  threshold?: number
  animations?: 'disabled' | 'allow'
}

/**
 * Device-specific test utilities
 */
export class DeviceTestUtils {
  constructor(private page: Page, private context: BrowserContext) {}

  /**
   * Simulates device orientation change
   */
  async changeOrientation(orientation: 'portrait' | 'landscape') {
    const viewport = this.page.viewportSize()
    if (!viewport) return

    const newViewport = orientation === 'landscape' 
      ? { width: Math.max(viewport.width, viewport.height), height: Math.min(viewport.width, viewport.height) }
      : { width: Math.min(viewport.width, viewport.height), height: Math.max(viewport.width, viewport.height) }

    await this.page.setViewportSize(newViewport)
    
    // Trigger orientation change event
    await this.page.evaluate((orientation) => {
      const event = new Event('orientationchange')
      Object.defineProperty(screen, 'orientation', {
        value: { angle: orientation === 'landscape' ? 90 : 0 },
        writable: true
      })
      window.dispatchEvent(event)
    }, orientation)

    // Wait for layout to stabilize
    await this.page.waitForTimeout(500)
  }

  /**
   * Tests responsive breakpoints
   */
  async testResponsiveBreakpoints(breakpoints: Array<{ name: string; width: number; height: number }>) {
    const results = []

    for (const breakpoint of breakpoints) {
      await this.page.setViewportSize({ width: breakpoint.width, height: breakpoint.height })
      await this.page.waitForTimeout(300) // Allow layout to settle

      // Check for layout issues
      const layoutIssues = await this.checkLayoutIntegrity()
      
      results.push({
        breakpoint: breakpoint.name,
        viewport: { width: breakpoint.width, height: breakpoint.height },
        layoutIssues
      })
    }

    return results
  }

  /**
   * Checks for common layout issues
   */
  async checkLayoutIntegrity() {
    return await this.page.evaluate(() => {
      const issues = []

      // Check for horizontal overflow
      const body = document.body
      const html = document.documentElement
      const bodyScrollWidth = body.scrollWidth
      const htmlScrollWidth = html.scrollWidth
      const windowWidth = window.innerWidth

      if (bodyScrollWidth > windowWidth || htmlScrollWidth > windowWidth) {
        issues.push('horizontal_overflow')
      }

      // Check for elements extending beyond viewport
      const elements = document.querySelectorAll('*')
      for (const element of elements) {
        const rect = element.getBoundingClientRect()
        if (rect.right > windowWidth + 10) { // 10px tolerance
          issues.push(`element_overflow: ${element.tagName.toLowerCase()}${element.className ? '.' + element.className.split(' ')[0] : ''}`)
        }
      }

      // Check for overlapping elements
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea')
      const overlaps = []
      
      for (let i = 0; i < interactiveElements.length; i++) {
        for (let j = i + 1; j < interactiveElements.length; j++) {
          const rect1 = interactiveElements[i].getBoundingClientRect()
          const rect2 = interactiveElements[j].getBoundingClientRect()
          
          if (!(rect1.right <= rect2.left || rect2.right <= rect1.left || 
                rect1.bottom <= rect2.top || rect2.bottom <= rect1.top)) {
            overlaps.push(`overlap: ${interactiveElements[i].tagName} and ${interactiveElements[j].tagName}`)
          }
        }
      }
      
      issues.push(...overlaps)

      return issues
    })
  }

  /**
   * Tests touch interactions
   */
  async testTouchInteraction(config: TouchTestConfig) {
    const element = this.page.locator(config.element)
    await expect(element).toBeVisible()

    switch (config.gesture) {
      case 'tap':
        await element.tap()
        break
        
      case 'swipe':
        await this.performSwipe(element, config.direction || 'right', config.distance || 100)
        break
        
      case 'pinch':
        await this.performPinch(element, config.distance || 50)
        break
        
      case 'longpress':
        await element.tap({ timeout: config.duration || 1000 })
        break
    }

    // Wait for any animations or state changes
    await this.page.waitForTimeout(300)
  }

  /**
   * Performs swipe gesture
   */
  private async performSwipe(element: any, direction: string, distance: number) {
    const box = await element.boundingBox()
    if (!box) return

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    
    let endX = startX
    let endY = startY

    switch (direction) {
      case 'left':
        endX = startX - distance
        break
      case 'right':
        endX = startX + distance
        break
      case 'up':
        endY = startY - distance
        break
      case 'down':
        endY = startY + distance
        break
    }

    // Perform swipe using touch events
    await this.page.touchscreen.tap(startX, startY)
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(endX, endY)
    await this.page.mouse.up()
  }

  /**
   * Performs pinch gesture
   */
  private async performPinch(element: any, distance: number) {
    const box = await element.boundingBox()
    if (!box) return

    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    // Simulate pinch zoom
    await this.page.evaluate(({ centerX, centerY, distance }) => {
      const element = document.elementFromPoint(centerX, centerY)
      if (element) {
        const event = new WheelEvent('wheel', {
          deltaY: -distance,
          ctrlKey: true,
          clientX: centerX,
          clientY: centerY,
          bubbles: true
        })
        element.dispatchEvent(event)
      }
    }, { centerX, centerY, distance })
  }

  /**
   * Tests touch target sizes
   */
  async validateTouchTargets(minSize: number = 44) {
    return await this.page.evaluate((minSize) => {
      const interactiveElements = document.querySelectorAll(
        'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'
      )
      
      const violations = []
      
      for (const element of interactiveElements) {
        const rect = element.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(element)
        
        // Check actual size or minimum size from CSS
        const width = Math.max(rect.width, parseFloat(computedStyle.minWidth) || 0)
        const height = Math.max(rect.height, parseFloat(computedStyle.minHeight) || 0)
        
        if (width < minSize || height < minSize) {
          violations.push({
            element: element.tagName.toLowerCase() + (element.className ? '.' + element.className.split(' ')[0] : ''),
            size: { width: Math.round(width), height: Math.round(height) },
            required: minSize
          })
        }
      }
      
      return violations
    }, minSize)
  }

  /**
   * Captures visual regression test
   */
  async captureVisualRegression(config: VisualTestConfig) {
    // Disable animations if specified
    if (config.animations === 'disabled') {
      await this.page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `
      })
    }

    // Wait for fonts and images to load
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(500)

    const screenshotOptions: any = {
      threshold: config.threshold || 0.2,
      animations: config.animations || 'disabled'
    }

    if (config.fullPage) {
      screenshotOptions.fullPage = true
    }

    if (config.selector) {
      const element = this.page.locator(config.selector)
      await expect(element).toHaveScreenshot(`${config.name}.png`, screenshotOptions)
    } else {
      await expect(this.page).toHaveScreenshot(`${config.name}.png`, screenshotOptions)
    }
  }

  /**
   * Tests network conditions impact
   */
  async testNetworkConditions(conditions: 'slow-2g' | '2g' | '3g' | '4g' | 'offline') {
    const networkProfiles = {
      'slow-2g': { downloadThroughput: 56 * 1024 / 8, uploadThroughput: 56 * 1024 / 8, latency: 2000 },
      '2g': { downloadThroughput: 256 * 1024 / 8, uploadThroughput: 256 * 1024 / 8, latency: 1400 },
      '3g': { downloadThroughput: 1600 * 1024 / 8, uploadThroughput: 768 * 1024 / 8, latency: 400 },
      '4g': { downloadThroughput: 10000 * 1024 / 8, uploadThroughput: 10000 * 1024 / 8, latency: 100 },
      'offline': { offline: true }
    }

    const profile = networkProfiles[conditions]
    await this.context.route('**/*', route => {
      if (profile.offline) {
        route.abort()
      } else {
        route.continue()
      }
    })

    if (!profile.offline) {
      // Simulate network throttling
      await this.page.evaluate((profile) => {
        // Mock slow network responses
        const originalFetch = window.fetch
        window.fetch = async (...args) => {
          const start = Date.now()
          const response = await originalFetch(...args)
          const elapsed = Date.now() - start
          const minDelay = profile.latency - elapsed
          if (minDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, minDelay))
          }
          return response
        }
      }, profile)
    }
  }

  /**
   * Measures performance metrics
   */
  async measurePerformance() {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      
      return {
        // Core Web Vitals approximation
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        
        // Network timing
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseEnd - navigation.requestStart,
        
        // Resource counts
        resourceCount: performance.getEntriesByType('resource').length,
        
        // Memory usage (if available)
        memoryUsage: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null
      }
    })
  }
}

/**
 * Utility functions for cross-device testing
 */
export const deviceTestUtils = {
  /**
   * Common device configurations for testing
   */
  devices: {
    mobile: [
      { name: 'iPhone SE', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
      { name: 'iPhone 12', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      { name: 'Pixel 5', viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true },
      { name: 'Galaxy S21', viewport: { width: 384, height: 854 }, isMobile: true, hasTouch: true }
    ],
    tablet: [
      { name: 'iPad', viewport: { width: 820, height: 1180 }, isMobile: false, hasTouch: true },
      { name: 'iPad Pro', viewport: { width: 1024, height: 1366 }, isMobile: false, hasTouch: true },
      { name: 'Surface Pro', viewport: { width: 912, height: 1368 }, isMobile: false, hasTouch: true }
    ],
    desktop: [
      { name: 'Laptop', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false },
      { name: 'Desktop', viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false },
      { name: 'Ultrawide', viewport: { width: 3440, height: 1440 }, isMobile: false, hasTouch: false }
    ]
  },

  /**
   * Common responsive breakpoints
   */
  breakpoints: [
    { name: 'mobile-small', width: 320, height: 568 },
    { name: 'mobile-medium', width: 375, height: 667 },
    { name: 'mobile-large', width: 414, height: 896 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'desktop-small', width: 1280, height: 720 },
    { name: 'desktop-medium', width: 1440, height: 900 },
    { name: 'desktop-large', width: 1920, height: 1080 }
  ],

  /**
   * Creates a device test utility instance
   */
  create: (page: Page, context: BrowserContext) => new DeviceTestUtils(page, context)
}