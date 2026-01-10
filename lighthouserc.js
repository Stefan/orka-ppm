/**
 * Lighthouse CI Configuration
 * Performance testing and Core Web Vitals monitoring
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboards',
        'http://localhost:3000/resources',
        'http://localhost:3000/risks',
        'http://localhost:3000/scenarios'
      ],
      
      // Collection settings
      numberOfRuns: 3,
      startServerCommand: 'npm run build && npm run start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 30000,
      
      // Chrome settings for consistent testing
      settings: {
        chromeFlags: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--headless'
        ],
        
        // Emulate mobile device for mobile-first testing
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4
        },
        
        // Skip certain audits that aren't relevant for our testing
        skipAudits: [
          'canonical',
          'robots-txt',
          'tap-targets' // We test this separately with our custom tests
        ]
      }
    },
    
    assert: {
      // Performance budgets and thresholds
      assertions: {
        // Core Web Vitals thresholds
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Specific metrics
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Resource budgets
        'resource-summary:document:size': ['error', { maxNumericValue: 50000 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 500000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 100000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 1000000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 2000000 }],
        
        // Network requests
        'resource-summary:total:count': ['error', { maxNumericValue: 50 }],
        
        // Accessibility
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error',
        'button-name': 'error',
        
        // Mobile-specific
        'viewport': 'error',
        'font-size': 'error',
        'touch-targets': 'warn' // Warn instead of error since we have custom tests
      }
    },
    
    upload: {
      // Configure where to store results
      target: 'temporary-public-storage',
      
      // GitHub integration (if running in CI)
      githubAppToken: process.env.LHCI_GITHUB_APP_TOKEN,
      githubToken: process.env.GITHUB_TOKEN
    },
    
    server: {
      // Local server configuration for storing results
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lhci.db'
      }
    }
  }
}