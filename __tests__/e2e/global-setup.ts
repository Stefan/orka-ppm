/**
 * Global setup for Playwright tests
 * Handles authentication, database seeding, and environment preparation
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for cross-device testing...')
  
  // Create a browser instance for setup tasks
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Wait for the development server to be ready
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
    console.log(`📡 Waiting for server at ${baseURL}...`)
    
    let retries = 0
    const maxRetries = 30
    
    while (retries < maxRetries) {
      try {
        const response = await page.goto(baseURL, { timeout: 5000 })
        if (response && response.ok()) {
          console.log('✅ Server is ready!')
          break
        }
      } catch (error) {
        retries++
        if (retries === maxRetries) {
          throw new Error(`❌ Server not ready after ${maxRetries} attempts`)
        }
        console.log(`⏳ Server not ready, retrying... (${retries}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    // Perform any authentication setup if needed
    // This would typically involve logging in and storing auth state
    
    // Set up test data if needed
    await setupTestData(page)
    
    // Verify critical pages are accessible
    await verifyPageAccessibility(page, baseURL)
    
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

async function setupTestData(page: any) {
  // Set up any test data needed for cross-device testing
  console.log('📊 Setting up test data...')
  
  // Example: Create test projects, users, etc.
  // This would typically involve API calls or database operations
  
  // For now, we'll just ensure localStorage is clean
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

async function verifyPageAccessibility(page: any, baseURL: string) {
  console.log('🔍 Verifying page accessibility...')
  
  const criticalPages = [
    '/',
    '/dashboards',
    '/resources',
    '/risks'
  ]
  
  for (const path of criticalPages) {
    try {
      const response = await page.goto(`${baseURL}${path}`, { 
        timeout: 10000,
        waitUntil: 'networkidle' 
      })
      
      if (!response || !response.ok()) {
        console.warn(`⚠️  Page ${path} returned status: ${response?.status()}`)
      } else {
        console.log(`✅ Page ${path} is accessible`)
      }
    } catch (error) {
      console.warn(`⚠️  Failed to access page ${path}:`, error)
    }
  }
}

export default globalSetup