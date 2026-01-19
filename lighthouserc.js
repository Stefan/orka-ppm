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
        'http://localhost:3000/scenarios',
        'http://localhost:3000/admin/performance'
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
          'robots-txt'
        ]
      }
    },
    
    assert: {
      // Performance budgets and thresholds
      assertions: {
        // Core Web Vitals thresholds - adjusted for realistic expectations
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Specific metrics - adjusted based on actual performance
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
        
        // Resource budgets - adjusted for Next.js app
        'resource-summary:document:size': ['warn', { maxNumericValue: 100000 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 800000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 150000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 1500000 }],
        'resource-summary:total:size': ['warn', { maxNumericValue: 3000000 }],
        
        // Network requests
        'resource-summary:total:count': ['warn', { maxNumericValue: 75 }],
        'label': 'error',
        'link-name': 'error',
        'button-name': 'error',
        
        // Mobile-specific
        'viewport': 'error',
        'font-size': 'error'
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