import { defineConfig, devices } from '@playwright/test'

/**
 * Cross-Device Testing Configuration for Mobile-First UI Enhancements
 * Tests responsive behavior, touch interactions, and visual regression across devices
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Global test timeout
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  // Configure projects for major browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Mobile devices - iOS
    {
      name: 'mobile-safari-iphone-12',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'mobile-safari-iphone-12-pro',
      use: { ...devices['iPhone 12 Pro'] },
    },
    {
      name: 'mobile-safari-iphone-se',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'mobile-safari-ipad',
      use: { ...devices['iPad Pro'] },
    },

    // Mobile devices - Android
    {
      name: 'mobile-chrome-pixel-5',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-chrome-galaxy-s21',
      use: { 
        ...devices['Galaxy S21'],
        viewport: { width: 384, height: 854 }
      },
    },

    // Tablets
    {
      name: 'tablet-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        isMobile: false,
        hasTouch: true
      },
    },
    {
      name: 'tablet-safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1024, height: 768 },
        isMobile: false,
        hasTouch: true
      },
    },

    // High DPI displays
    {
      name: 'high-dpi-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2
      },
    },

    // Accessibility testing with screen readers simulation
    {
      name: 'accessibility-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Simulate screen reader preferences
        reducedMotion: 'reduce',
        forcedColors: 'active'
      },
    },

    // Performance testing on slower devices
    {
      name: 'slow-device-simulation',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        // Simulate slower device
        launchOptions: {
          args: [
            '--enable-features=NetworkService',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--disable-dev-shm-usage'
          ]
        }
      },
    }
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./__tests__/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./__tests__/e2e/global-teardown.ts'),

  // Test timeout
  timeout: 30000,
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000,
    
    // Threshold for pixel difference in visual comparisons
    threshold: 0.2,
    
    // Animation handling for visual tests
    animations: 'disabled'
  },

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})