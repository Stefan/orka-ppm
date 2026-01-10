/**
 * Configuration for comprehensive integration tests
 * Supports real data scenarios and cross-device testing
 */

export interface TestConfig {
  baseUrl: string
  timeout: number
  retries: number
  devices: DeviceConfig[]
  testData: TestDataConfig
  accessibility: AccessibilityConfig
  performance: PerformanceConfig
}

export interface DeviceConfig {
  name: string
  userAgent: string
  viewport: {
    width: number
    height: number
  }
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
}

export interface TestDataConfig {
  users: TestUser[]
  projects: TestProject[]
  resources: TestResource[]
  risks: TestRisk[]
}

export interface TestUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'project_manager' | 'team_member' | 'viewer'
  preferences: UserPreferences
}

export interface TestProject {
  id: string
  name: string
  description: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  startDate: string
  endDate: string
  budget: number
  resources: string[]
  risks: string[]
}

export interface TestResource {
  id: string
  name: string
  type: 'human' | 'equipment' | 'material' | 'budget'
  availability: number
  cost: number
  skills: string[]
  projects: string[]
}

export interface TestRisk {
  id: string
  title: string
  description: string
  probability: number
  impact: number
  category: 'technical' | 'financial' | 'operational' | 'external'
  status: 'identified' | 'assessed' | 'mitigated' | 'closed'
  mitigation: string[]
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  dashboardLayout: {
    widgets: string[]
    layout: 'grid' | 'masonry' | 'list'
  }
  navigationPreferences: {
    collapsedSections: string[]
    pinnedItems: string[]
    recentItems: string[]
  }
  accessibilitySettings: {
    highContrast: boolean
    reducedMotion: boolean
    fontSize: 'small' | 'medium' | 'large'
    screenReader: boolean
  }
  aiSettings: {
    enableSuggestions: boolean
    enablePredictiveText: boolean
    enableAutoOptimization: boolean
  }
}

export interface AccessibilityConfig {
  wcagLevel: 'A' | 'AA' | 'AAA'
  rules: {
    colorContrast: boolean
    keyboardNavigation: boolean
    focusManagement: boolean
    ariaLabels: boolean
    headingStructure: boolean
    landmarkRoles: boolean
  }
  testScreenReaders: boolean
  testHighContrast: boolean
  testReducedMotion: boolean
}

export interface PerformanceConfig {
  coreWebVitals: {
    lcp: number // Largest Contentful Paint threshold (ms)
    fid: number // First Input Delay threshold (ms)
    cls: number // Cumulative Layout Shift threshold
  }
  networkConditions: {
    slow3G: boolean
    fast3G: boolean
    offline: boolean
  }
  budgets: {
    javascript: number // KB
    css: number // KB
    images: number // KB
    total: number // KB
  }
}

// Default test configuration
export const defaultTestConfig: TestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 2,
  devices: [
    {
      name: 'iPhone 12',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    },
    {
      name: 'iPad Pro',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 1024, height: 1366 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: true
    },
    {
      name: 'Desktop Chrome',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    },
    {
      name: 'Desktop Firefox',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    }
  ],
  testData: {
    users: [
      {
        id: 'test-admin-001',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
          dashboardLayout: {
            widgets: ['projects', 'resources', 'risks', 'performance'],
            layout: 'grid'
          },
          navigationPreferences: {
            collapsedSections: [],
            pinnedItems: ['dashboards', 'projects'],
            recentItems: ['resources', 'risks']
          },
          accessibilitySettings: {
            highContrast: false,
            reducedMotion: false,
            fontSize: 'medium',
            screenReader: false
          },
          aiSettings: {
            enableSuggestions: true,
            enablePredictiveText: true,
            enableAutoOptimization: true
          }
        }
      },
      {
        id: 'test-pm-001',
        email: 'pm@test.com',
        name: 'Test Project Manager',
        role: 'project_manager',
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'America/New_York',
          dashboardLayout: {
            widgets: ['projects', 'resources', 'timeline'],
            layout: 'masonry'
          },
          navigationPreferences: {
            collapsedSections: ['admin'],
            pinnedItems: ['projects', 'resources'],
            recentItems: ['dashboards', 'reports']
          },
          accessibilitySettings: {
            highContrast: true,
            reducedMotion: false,
            fontSize: 'large',
            screenReader: false
          },
          aiSettings: {
            enableSuggestions: true,
            enablePredictiveText: false,
            enableAutoOptimization: true
          }
        }
      }
    ],
    projects: [
      {
        id: 'test-project-001',
        name: 'Mobile App Development',
        description: 'Development of mobile application with AI features',
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        budget: 500000,
        resources: ['test-resource-001', 'test-resource-002'],
        risks: ['test-risk-001', 'test-risk-002']
      },
      {
        id: 'test-project-002',
        name: 'Infrastructure Upgrade',
        description: 'Upgrading server infrastructure for better performance',
        status: 'active',
        startDate: '2024-03-01',
        endDate: '2024-09-30',
        budget: 200000,
        resources: ['test-resource-003'],
        risks: ['test-risk-003']
      }
    ],
    resources: [
      {
        id: 'test-resource-001',
        name: 'Senior Developer',
        type: 'human',
        availability: 0.8,
        cost: 120000,
        skills: ['React', 'TypeScript', 'Node.js', 'AI/ML'],
        projects: ['test-project-001']
      },
      {
        id: 'test-resource-002',
        name: 'UX Designer',
        type: 'human',
        availability: 1.0,
        cost: 90000,
        skills: ['UI/UX', 'Figma', 'User Research'],
        projects: ['test-project-001']
      },
      {
        id: 'test-resource-003',
        name: 'Cloud Infrastructure',
        type: 'equipment',
        availability: 1.0,
        cost: 50000,
        skills: ['AWS', 'Docker', 'Kubernetes'],
        projects: ['test-project-002']
      }
    ],
    risks: [
      {
        id: 'test-risk-001',
        title: 'Technical Complexity',
        description: 'AI features may be more complex than anticipated',
        probability: 0.6,
        impact: 0.8,
        category: 'technical',
        status: 'identified',
        mitigation: ['Prototype early', 'Consult AI experts', 'Plan buffer time']
      },
      {
        id: 'test-risk-002',
        title: 'Resource Availability',
        description: 'Key team members may not be available',
        probability: 0.3,
        impact: 0.9,
        category: 'operational',
        status: 'assessed',
        mitigation: ['Cross-train team members', 'Identify backup resources']
      },
      {
        id: 'test-risk-003',
        title: 'Budget Overrun',
        description: 'Infrastructure costs may exceed budget',
        probability: 0.4,
        impact: 0.7,
        category: 'financial',
        status: 'mitigated',
        mitigation: ['Regular cost monitoring', 'Negotiate better rates', 'Optimize usage']
      }
    ]
  },
  accessibility: {
    wcagLevel: 'AA',
    rules: {
      colorContrast: true,
      keyboardNavigation: true,
      focusManagement: true,
      ariaLabels: true,
      headingStructure: true,
      landmarkRoles: true
    },
    testScreenReaders: true,
    testHighContrast: true,
    testReducedMotion: true
  },
  performance: {
    coreWebVitals: {
      lcp: 2500, // 2.5 seconds
      fid: 100,  // 100 milliseconds
      cls: 0.1   // 0.1
    },
    networkConditions: {
      slow3G: true,
      fast3G: true,
      offline: true
    },
    budgets: {
      javascript: 500, // 500KB
      css: 100,        // 100KB
      images: 1000,    // 1MB
      total: 2000      // 2MB
    }
  }
}

// Utility functions for test data generation
export const generateTestUser = (overrides: Partial<TestUser> = {}): TestUser => {
  const timestamp = Date.now()
  return {
    id: `test-user-${timestamp}`,
    email: `test${timestamp}@example.com`,
    name: `Test User ${timestamp}`,
    role: 'project_manager',
    preferences: defaultTestConfig.testData.users[0].preferences,
    ...overrides
  }
}

export const generateTestProject = (overrides: Partial<TestProject> = {}): TestProject => {
  const timestamp = Date.now()
  return {
    id: `test-project-${timestamp}`,
    name: `Test Project ${timestamp}`,
    description: 'Generated test project',
    status: 'active',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    budget: 100000,
    resources: [],
    risks: [],
    ...overrides
  }
}

export const generateTestResource = (overrides: Partial<TestResource> = {}): TestResource => {
  const timestamp = Date.now()
  return {
    id: `test-resource-${timestamp}`,
    name: `Test Resource ${timestamp}`,
    type: 'human',
    availability: 1.0,
    cost: 80000,
    skills: ['JavaScript', 'React'],
    projects: [],
    ...overrides
  }
}

export const generateTestRisk = (overrides: Partial<TestRisk> = {}): TestRisk => {
  const timestamp = Date.now()
  return {
    id: `test-risk-${timestamp}`,
    title: `Test Risk ${timestamp}`,
    description: 'Generated test risk',
    probability: 0.5,
    impact: 0.5,
    category: 'technical',
    status: 'identified',
    mitigation: ['Monitor closely', 'Prepare contingency plan'],
    ...overrides
  }
}

// Test data seeding utilities
export const seedTestData = async (config: TestConfig) => {
  // This would typically make API calls to seed the database
  // For now, we'll just return the test data
  return config.testData
}

export const cleanupTestData = async (testData: TestDataConfig) => {
  // This would typically make API calls to clean up test data
  // For now, we'll just log the cleanup
  console.log('Cleaning up test data:', {
    users: testData.users.length,
    projects: testData.projects.length,
    resources: testData.resources.length,
    risks: testData.risks.length
  })
}