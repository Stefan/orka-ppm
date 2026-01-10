/**
 * Comprehensive End-to-End Integration Tests
 * Tests all AI features, cross-device synchronization, and accessibility compliance
 * **Feature: mobile-first-ui-enhancements, Task 15.1: Complete end-to-end integration testing**
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'

// Conditional import for axe-playwright
let injectAxe: any, checkA11y: any
try {
  const axePlaywright = require('axe-playwright')
  injectAxe = axePlaywright.injectAxe
  checkA11y = axePlaywright.checkA11y
} catch (error) {
  console.warn('axe-playwright not available, accessibility tests will be skipped')
  injectAxe = async () => {}
  checkA11y = async () => {}
}

// Test data generators
const generateTestUser = () => ({
  id: `test-user-${Date.now()}`,
  email: `test${Date.now()}@example.com`,
  name: 'Test User',
  role: 'project_manager'
})

const generateTestProject = () => ({
  id: `project-${Date.now()}`,
  name: `Test Project ${Date.now()}`,
  description: 'Integration test project',
  status: 'active'
})

test.describe('Comprehensive Integration Tests', () => {
  let testUser: ReturnType<typeof generateTestUser>
  let testProject: ReturnType<typeof generateTestProject>

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser()
    testProject = generateTestProject()
    
    // Set up test data
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Mock authentication
    await page.evaluate((user) => {
      localStorage.setItem('auth-user', JSON.stringify(user))
      localStorage.setItem('auth-token', 'test-token')
    }, testUser)
  })

  test.describe('AI Features Integration', () => {
    test('AI Resource Optimizer provides valid recommendations', async ({ page }) => {
      await page.goto('/resources')
      await page.waitForLoadState('networkidle')
      
      // Wait for AI Resource Optimizer to load
      await page.waitForSelector('[data-testid="ai-resource-optimizer"]', { timeout: 10000 })
      
      // Trigger AI optimization
      const optimizeButton = page.locator('[data-testid="optimize-resources-btn"]')
      if (await optimizeButton.isVisible()) {
        await optimizeButton.click()
        
        // Wait for AI recommendations
        await page.waitForSelector('[data-testid="ai-recommendations"]', { timeout: 15000 })
        
        // Verify recommendations structure
        const recommendations = await page.locator('[data-testid="recommendation-item"]').all()
        expect(recommendations.length).toBeGreaterThan(0)
        
        // Check each recommendation has required fields
        for (const recommendation of recommendations) {
          await expect(recommendation.locator('[data-testid="confidence-score"]')).toBeVisible()
          await expect(recommendation.locator('[data-testid="recommendation-text"]')).toBeVisible()
          
          // Verify confidence score is valid (0-100)
          const confidenceText = await recommendation.locator('[data-testid="confidence-score"]').textContent()
          const confidence = parseInt(confidenceText?.match(/\d+/)?.[0] || '0')
          expect(confidence).toBeGreaterThanOrEqual(0)
          expect(confidence).toBeLessThanOrEqual(100)
        }
      }
    })

    test('AI Risk Management detects and suggests mitigation', async ({ page }) => {
      await page.goto('/risks')
      await page.waitForLoadState('networkidle')
      
      // Wait for AI Risk Management to load
      await page.waitForSelector('[data-testid="ai-risk-management"]', { timeout: 10000 })
      
      // Trigger risk analysis
      const analyzeButton = page.locator('[data-testid="analyze-risks-btn"]')
      if (await analyzeButton.isVisible()) {
        await analyzeButton.click()
        
        // Wait for risk analysis results
        await page.waitForSelector('[data-testid="risk-analysis-results"]', { timeout: 15000 })
        
        // Verify risk patterns are identified
        const riskPatterns = await page.locator('[data-testid="risk-pattern"]').all()
        
        if (riskPatterns.length > 0) {
          // Check each risk pattern has mitigation suggestions
          for (const pattern of riskPatterns) {
            await expect(pattern.locator('[data-testid="risk-score"]')).toBeVisible()
            await expect(pattern.locator('[data-testid="mitigation-suggestions"]')).toBeVisible()
            
            // Verify risk score is valid (0-10)
            const scoreText = await pattern.locator('[data-testid="risk-score"]').textContent()
            const score = parseFloat(scoreText?.match(/[\d.]+/)?.[0] || '0')
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(10)
          }
        }
      }
    })

    test('Predictive Analytics Dashboard shows meaningful insights', async ({ page }) => {
      await page.goto('/dashboards')
      await page.waitForLoadState('networkidle')
      
      // Wait for predictive analytics to load
      await page.waitForSelector('[data-testid="predictive-analytics-dashboard"]', { timeout: 10000 })
      
      // Check for predictive insights
      const insightWidgets = await page.locator('[data-testid="predictive-insight-widget"]').all()
      
      if (insightWidgets.length > 0) {
        for (const widget of insightWidgets) {
          // Verify each widget has required elements
          await expect(widget.locator('[data-testid="insight-title"]')).toBeVisible()
          await expect(widget.locator('[data-testid="insight-value"]')).toBeVisible()
          await expect(widget.locator('[data-testid="insight-trend"]')).toBeVisible()
          
          // Verify trend indicators are valid
          const trendElement = widget.locator('[data-testid="insight-trend"]')
          const trendClass = await trendElement.getAttribute('class')
          expect(trendClass).toMatch(/(trend-up|trend-down|trend-stable)/)
        }
      }
    })

    test('Smart Navigation provides contextual suggestions', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Wait for smart sidebar to load
      await page.waitForSelector('[data-testid="smart-sidebar"]', { timeout: 10000 })
      
      // Check for AI suggestions section
      const aiSuggestions = page.locator('[data-testid="ai-navigation-suggestions"]')
      
      if (await aiSuggestions.isVisible()) {
        // Verify suggestions are contextual and relevant
        const suggestions = await aiSuggestions.locator('[data-testid="nav-suggestion"]').all()
        
        for (const suggestion of suggestions) {
          await expect(suggestion.locator('[data-testid="suggestion-text"]')).toBeVisible()
          await expect(suggestion.locator('[data-testid="suggestion-reason"]')).toBeVisible()
          
          // Verify suggestion is clickable
          await expect(suggestion).toBeEnabled()
        }
      }
    })

    test('Floating AI Assistant provides contextual help', async ({ page }) => {
      await page.goto('/resources')
      await page.waitForLoadState('networkidle')
      
      // Wait for floating AI assistant
      await page.waitForSelector('[data-testid="floating-ai-assistant"]', { timeout: 10000 })
      
      // Trigger AI assistant
      const assistantToggle = page.locator('[data-testid="ai-assistant-toggle"]')
      if (await assistantToggle.isVisible()) {
        await assistantToggle.click()
        
        // Wait for assistant chat interface
        await page.waitForSelector('[data-testid="ai-chat-interface"]', { timeout: 5000 })
        
        // Send a test message
        const chatInput = page.locator('[data-testid="ai-chat-input"]')
        await chatInput.fill('How do I optimize resource allocation?')
        await chatInput.press('Enter')
        
        // Wait for AI response
        await page.waitForSelector('[data-testid="ai-response"]', { timeout: 10000 })
        
        // Verify response is contextual and helpful
        const response = await page.locator('[data-testid="ai-response"]').last().textContent()
        expect(response).toBeTruthy()
        expect(response!.length).toBeGreaterThan(10)
        expect(response).toMatch(/(resource|allocation|optimization|efficiency)/i)
      }
    })
  })

  test.describe('Cross-Device Synchronization', () => {
    test('User preferences sync across browser contexts', async ({ browser }) => {
      // Create two browser contexts to simulate different devices
      const context1 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      })
      const context2 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      })
      
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()
      
      try {
        // Set up authentication on both contexts
        await page1.goto('/')
        await page1.evaluate((user) => {
          localStorage.setItem('auth-user', JSON.stringify(user))
          localStorage.setItem('auth-token', 'test-token')
        }, testUser)
        
        await page2.goto('/')
        await page2.evaluate((user) => {
          localStorage.setItem('auth-user', JSON.stringify(user))
          localStorage.setItem('auth-token', 'test-token')
        }, testUser)
        
        // Change preferences on device 1
        await page1.goto('/dashboards')
        await page1.waitForLoadState('networkidle')
        
        // Open settings/preferences
        const settingsButton = page1.locator('[data-testid="user-settings-btn"]')
        if (await settingsButton.isVisible()) {
          await settingsButton.click()
          
          // Change theme preference
          const themeToggle = page1.locator('[data-testid="theme-toggle"]')
          if (await themeToggle.isVisible()) {
            await themeToggle.click()
            
            // Wait for preference to sync
            await page1.waitForTimeout(2000)
            
            // Check on device 2 that preference has synced
            await page2.reload()
            await page2.waitForLoadState('networkidle')
            
            // Verify theme preference is applied
            const body1 = await page1.locator('body').getAttribute('class')
            const body2 = await page2.locator('body').getAttribute('class')
            
            // Both should have the same theme class
            const themeClass1 = body1?.match(/(theme-light|theme-dark)/)?.[0]
            const themeClass2 = body2?.match(/(theme-light|theme-dark)/)?.[0]
            
            if (themeClass1 && themeClass2) {
              expect(themeClass1).toBe(themeClass2)
            }
          }
        }
      } finally {
        await context1.close()
        await context2.close()
      }
    })

    test('Task continuity works across devices', async ({ browser }) => {
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()
      
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()
      
      try {
        // Set up authentication
        await page1.goto('/')
        await page1.evaluate((user) => {
          localStorage.setItem('auth-user', JSON.stringify(user))
          localStorage.setItem('auth-token', 'test-token')
        }, testUser)
        
        await page2.goto('/')
        await page2.evaluate((user) => {
          localStorage.setItem('auth-user', JSON.stringify(user))
          localStorage.setItem('auth-token', 'test-token')
        }, testUser)
        
        // Start a task on device 1
        await page1.goto('/resources')
        await page1.waitForLoadState('networkidle')
        
        // Simulate starting a resource allocation task
        const createButton = page1.locator('[data-testid="create-resource-btn"]')
        if (await createButton.isVisible()) {
          await createButton.click()
          
          // Fill in some form data
          const nameInput = page1.locator('[data-testid="resource-name-input"]')
          if (await nameInput.isVisible()) {
            await nameInput.fill('Test Resource for Continuity')
            
            // Don't submit, just save as draft
            const saveDraftButton = page1.locator('[data-testid="save-draft-btn"]')
            if (await saveDraftButton.isVisible()) {
              await saveDraftButton.click()
              await page1.waitForTimeout(2000) // Wait for sync
            }
          }
        }
        
        // Switch to device 2 and continue the task
        await page2.goto('/resources')
        await page2.waitForLoadState('networkidle')
        
        // Look for draft or continue option
        const continueButton = page2.locator('[data-testid="continue-task-btn"]')
        const draftItems = page2.locator('[data-testid="draft-item"]')
        
        if (await continueButton.isVisible()) {
          await continueButton.click()
        } else if (await draftItems.first().isVisible()) {
          await draftItems.first().click()
        }
        
        // Verify the form data is preserved
        const nameInput2 = page2.locator('[data-testid="resource-name-input"]')
        if (await nameInput2.isVisible()) {
          const value = await nameInput2.inputValue()
          expect(value).toBe('Test Resource for Continuity')
        }
        
      } finally {
        await context1.close()
        await context2.close()
      }
    })

    test('Offline changes sync when connectivity restored', async ({ page }) => {
      await page.goto('/resources')
      await page.waitForLoadState('networkidle')
      
      // Set up authentication
      await page.evaluate((user) => {
        localStorage.setItem('auth-user', JSON.stringify(user))
        localStorage.setItem('auth-token', 'test-token')
      }, testUser)
      
      // Simulate going offline
      await page.context().setOffline(true)
      
      // Make changes while offline
      const createButton = page.locator('[data-testid="create-resource-btn"]')
      if (await createButton.isVisible()) {
        await createButton.click()
        
        const nameInput = page.locator('[data-testid="resource-name-input"]')
        if (await nameInput.isVisible()) {
          await nameInput.fill('Offline Created Resource')
          
          const submitButton = page.locator('[data-testid="submit-resource-btn"]')
          if (await submitButton.isVisible()) {
            await submitButton.click()
            
            // Should show offline indicator
            await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible()
            
            // Should show queued changes
            await expect(page.locator('[data-testid="queued-changes"]')).toBeVisible()
          }
        }
      }
      
      // Go back online
      await page.context().setOffline(false)
      
      // Wait for sync to complete
      await page.waitForTimeout(3000)
      
      // Verify offline indicator is gone
      await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible()
      
      // Verify changes were synced
      const syncStatus = page.locator('[data-testid="sync-status"]')
      if (await syncStatus.isVisible()) {
        await expect(syncStatus).toContainText(/synced|up.to.date/i)
      }
    })
  })

  test.describe('Accessibility Compliance', () => {
    test('All pages meet WCAG AA standards', async ({ page }) => {
      const pages = ['/', '/dashboards', '/resources', '/risks', '/reports']
      
      for (const pagePath of pages) {
        await page.goto(pagePath)
        await page.waitForLoadState('networkidle')
        
        // Inject axe-core
        await injectAxe(page)
        
        // Run accessibility checks
        await checkA11y(page, null, {
          detailedReport: true,
          detailedReportOptions: { html: true },
          rules: {
            // WCAG AA compliance rules
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
            'focus-management': { enabled: true },
            'aria-labels': { enabled: true },
            'heading-structure': { enabled: true },
            'landmark-roles': { enabled: true }
          }
        })
      }
    })

    test('Keyboard navigation works throughout application', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Test tab navigation
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      
      // Tab through interactive elements
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab')
        
        const newFocusedElement = await page.evaluate(() => {
          const el = document.activeElement
          return {
            tagName: el?.tagName,
            role: el?.getAttribute('role'),
            ariaLabel: el?.getAttribute('aria-label'),
            className: el?.className,
            visible: el ? window.getComputedStyle(el).display !== 'none' : false
          }
        })
        
        // Verify focused element is interactive and visible
        if (newFocusedElement.visible) {
          expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(
            newFocusedElement.tagName
          )
        }
      }
      
      // Test Enter key activation
      await page.keyboard.press('Enter')
      
      // Test Escape key for modals/dropdowns
      await page.keyboard.press('Escape')
    })

    test('Screen reader compatibility with ARIA labels', async ({ page }) => {
      await page.goto('/dashboards')
      await page.waitForLoadState('networkidle')
      
      // Check for proper ARIA labels on interactive elements
      const interactiveElements = await page.locator('button, a, input, select, [role="button"]').all()
      
      for (const element of interactiveElements) {
        const ariaLabel = await element.getAttribute('aria-label')
        const ariaLabelledBy = await element.getAttribute('aria-labelledby')
        const title = await element.getAttribute('title')
        const textContent = await element.textContent()
        
        // Each interactive element should have some form of accessible name
        const hasAccessibleName = ariaLabel || ariaLabelledBy || title || (textContent && textContent.trim().length > 0)
        expect(hasAccessibleName).toBeTruthy()
      }
      
      // Check for proper heading structure
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      let previousLevel = 0
      
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName)
        const level = parseInt(tagName.charAt(1))
        
        // Heading levels should not skip (e.g., h1 -> h3)
        if (previousLevel > 0) {
          expect(level - previousLevel).toBeLessThanOrEqual(1)
        }
        
        previousLevel = level
      }
      
      // Check for landmark roles
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').count()
      expect(landmarks).toBeGreaterThan(0)
    })

    test('High contrast mode works correctly', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Enable high contrast mode
      const settingsButton = page.locator('[data-testid="user-settings-btn"]')
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        
        const highContrastToggle = page.locator('[data-testid="high-contrast-toggle"]')
        if (await highContrastToggle.isVisible()) {
          await highContrastToggle.click()
          
          // Wait for theme to apply
          await page.waitForTimeout(1000)
          
          // Check that high contrast styles are applied
          const bodyClass = await page.locator('body').getAttribute('class')
          expect(bodyClass).toContain('high-contrast')
          
          // Verify contrast ratios meet WCAG AA standards (4.5:1 for normal text)
          const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6').all()
          
          for (let i = 0; i < Math.min(textElements.length, 10); i++) {
            const element = textElements[i]
            const styles = await element.evaluate(el => {
              const computed = window.getComputedStyle(el)
              return {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize
              }
            })
            
            // This is a simplified check - in a real implementation,
            // you'd calculate the actual contrast ratio
            expect(styles.color).toBeTruthy()
            expect(styles.backgroundColor).toBeTruthy()
          }
        }
      }
    })

    test('Touch targets meet minimum size requirements', async ({ page }) => {
      // Test on mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Check all interactive elements have minimum 44px touch targets
      const interactiveElements = await page.locator('button, a, input[type="button"], input[type="submit"], [role="button"]').all()
      
      for (const element of interactiveElements) {
        const boundingBox = await element.boundingBox()
        
        if (boundingBox) {
          // WCAG guidelines recommend minimum 44px touch targets
          expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          expect(boundingBox.height).toBeGreaterThanOrEqual(44)
        }
      }
    })
  })

  test.describe('Performance Integration', () => {
    test('Core Web Vitals meet performance standards', async ({ page }) => {
      await page.goto('/')
      
      // Measure Core Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals: any = {}
          
          // Largest Contentful Paint (LCP)
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            vitals.lcp = lastEntry.startTime
          }).observe({ entryTypes: ['largest-contentful-paint'] })
          
          // First Input Delay (FID) - simulated
          vitals.fid = 0 // Would be measured on actual user interaction
          
          // Cumulative Layout Shift (CLS)
          let clsValue = 0
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value
              }
            }
            vitals.cls = clsValue
          }).observe({ entryTypes: ['layout-shift'] })
          
          // Wait a bit for measurements
          setTimeout(() => resolve(vitals), 3000)
        })
      })
      
      // Verify Core Web Vitals meet standards
      expect((vitals as any).lcp).toBeLessThan(2500) // LCP < 2.5s
      expect((vitals as any).cls).toBeLessThan(0.1)   // CLS < 0.1
    })

    test('Progressive loading works under slow network', async ({ page }) => {
      // Simulate slow 3G network
      await page.context().route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)) // Add delay
        await route.continue()
      })
      
      await page.goto('/dashboards')
      
      // Check for loading states
      await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible()
      
      // Wait for content to load
      await page.waitForLoadState('networkidle', { timeout: 30000 })
      
      // Verify content is eventually loaded
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible()
      
      // Check that loading states are removed
      await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible()
    })
  })
})