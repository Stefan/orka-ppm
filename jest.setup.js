import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// Ensure Request/Response/Headers exist for Next.js API route tests (workers may not inherit from jest.env.js)
if (typeof global.Request === 'undefined') {
  try {
    const { Request, Response, Headers } = require('undici')
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
  } catch {
    if (typeof globalThis.Request !== 'undefined') {
      global.Request = globalThis.Request
      global.Response = globalThis.Response
      global.Headers = globalThis.Headers
    }
  }
}

// Import custom testing utilities
import { toMeetTouchTargetRequirements, toHaveResponsiveLayout } from './__tests__/utils/responsive-testing'

// Extend Jest matchers
expect.extend({
  toMeetTouchTargetRequirements,
  toHaveResponsiveLayout
})

// Add polyfills for Node.js environment (Next.js route handlers need Request/Response)
try {
  const { Request, Response, Headers } = require('undici')
  if (typeof global.Request === 'undefined') global.Request = Request
  if (typeof global.Response === 'undefined') global.Response = Response
  if (typeof global.Headers === 'undefined') global.Headers = Headers
} catch {
  // Node 18+ has these globally; no-op if already defined
}

if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder
}

if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = require('stream/web').ReadableStream
}

// Mock IndexedDB for testing environment
if (typeof indexedDB === 'undefined') {
  global.indexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn(),
  }
}

// Mock PerformanceObserver and performance APIs for diagnostic tests
if (typeof PerformanceObserver === 'undefined') {
  global.PerformanceObserver = class MockPerformanceObserver {
    constructor(callback) {
      this.callback = callback
      this.entryTypes = []
    }
    
    observe(options) {
      this.entryTypes = options.entryTypes || []
      // Simulate some entries being observed
      if (this.callback) {
        const mockEntries = this.entryTypes.map(type => ({
          entryType: type,
          name: `mock-${type}`,
          startTime: Date.now(),
          duration: 0
        }))
        
        if (mockEntries.length > 0) {
          setTimeout(() => {
            this.callback({
              getEntries: () => mockEntries,
              getEntriesByType: (type) => mockEntries.filter(e => e.entryType === type),
              getEntriesByName: (name) => mockEntries.filter(e => e.name === name)
            }, this)
          }, 0)
        }
      }
    }
    
    disconnect() {
      this.entryTypes = []
    }
    
    takeRecords() {
      return []
    }
  }
  
  global.PerformanceObserver.supportedEntryTypes = [
    'mark',
    'measure',
    'navigation',
    'resource',
    'longtask',
    'paint',
    'layout-shift',
    'largest-contentful-paint',
    'first-input'
  ]
}

if (typeof performance === 'undefined' || !performance.getEntriesByType) {
  const performanceEntries = []
  const marks = new Map()
  const measures = new Map()
  
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn((name) => {
      const entry = {
        name,
        entryType: 'mark',
        startTime: Date.now(),
        duration: 0
      }
      marks.set(name, entry)
      performanceEntries.push(entry)
      return entry
    }),
    measure: jest.fn((name, startMark, endMark) => {
      const start = marks.get(startMark)
      const end = marks.get(endMark)
      const entry = {
        name,
        entryType: 'measure',
        startTime: start?.startTime || Date.now(),
        duration: end ? end.startTime - (start?.startTime || 0) : 0
      }
      measures.set(name, entry)
      performanceEntries.push(entry)
      return entry
    }),
    getEntriesByName: jest.fn((name) => {
      return performanceEntries.filter(e => e.name === name)
    }),
    getEntriesByType: jest.fn((type) => {
      return performanceEntries.filter(e => e.entryType === type)
    }),
    getEntries: jest.fn(() => performanceEntries),
    clearMarks: jest.fn((name) => {
      if (name) {
        marks.delete(name)
      } else {
        marks.clear()
      }
    }),
    clearMeasures: jest.fn((name) => {
      if (name) {
        measures.delete(name)
      } else {
        measures.clear()
      }
    }),
    clearResourceTimings: jest.fn(),
    setResourceTimingBufferSize: jest.fn(),
    toJSON: jest.fn(() => ({})),
    timeOrigin: Date.now(),
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now() + 1000,
      domContentLoadedEventEnd: Date.now() + 500,
      fetchStart: Date.now(),
      connectStart: Date.now() + 10,
      connectEnd: Date.now() + 50,
      requestStart: Date.now() + 60,
      responseStart: Date.now() + 100,
      responseEnd: Date.now() + 200,
      domInteractive: Date.now() + 300,
      domComplete: Date.now() + 800,
    },
    navigation: {
      type: 0,
      redirectCount: 0
    },
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  }
}

// Mock localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
}

// Mock screen object
if (typeof screen === 'undefined') {
  global.screen = {
    width: 1920,
    height: 1080,
    colorDepth: 24
  }
}

// Mock Intl for timezone
if (typeof Intl === 'undefined') {
  global.Intl = {
    DateTimeFormat: jest.fn(() => ({
      resolvedOptions: () => ({ timeZone: 'UTC' })
    }))
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Supabase Auth
jest.mock('./app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'project_manager',
    },
    session: {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
      },
      access_token: 'mock-access-token',
    },
    loading: false,
    error: null,
    clearSession: jest.fn(),
  }),
  SupabaseAuthProvider: ({ children }) => children,
}))

// Mock HelpChat Provider
jest.mock('./app/providers/HelpChatProvider', () => ({
  useHelpChat: () => ({
    state: {
      isOpen: false,
      messages: [],
      isLoading: false,
      currentContext: {
        route: '/',
        pageTitle: 'Dashboard',
        userRole: 'user',
      },
      userPreferences: {
        language: 'en',
        proactiveTips: true,
        chatPosition: 'right',
        soundEnabled: false,
        tipFrequency: 'medium',
        theme: 'auto',
      },
      sessionId: 'test-session-123',
      proactiveTipsEnabled: true,
      language: 'en',
      isTyping: false,
      error: null,
    },
    toggleChat: jest.fn(),
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    updateContext: jest.fn(),
    updatePreferences: jest.fn(),
    dismissTip: jest.fn(),
    submitFeedback: jest.fn(),
    isContextRelevant: jest.fn(() => true),
    getProactiveTips: jest.fn(() => Promise.resolve([])),
    exportChatHistory: jest.fn(() => '[]'),
    translateMessage: jest.fn((content) => Promise.resolve(content)),
    detectMessageLanguage: jest.fn(() => Promise.resolve(null)),
    formatMessageDate: jest.fn((date) => date.toLocaleDateString()),
    formatMessageNumber: jest.fn((num) => num.toLocaleString()),
    getLanguageName: jest.fn((code) => code),
    currentLanguage: 'en',
  }),
  HelpChatProvider: ({ children }) => children,
}))

// Mock Language Hook
jest.mock('./hooks/useLanguage', () => ({
  useLanguage: () => ({
    currentLanguage: 'en',
    supportedLanguages: [
      { code: 'en', name: 'English', native_name: 'English', formal_tone: false },
      { code: 'de', name: 'German', native_name: 'Deutsch', formal_tone: true },
      { code: 'fr', name: 'French', native_name: 'Français', formal_tone: true },
    ],
    isLoading: false,
    error: null,
    setLanguage: jest.fn(() => Promise.resolve(true)),
    getUserLanguagePreference: jest.fn(() => Promise.resolve('en')),
    getSupportedLanguages: jest.fn(() => Promise.resolve([])),
    detectLanguage: jest.fn(() => Promise.resolve(null)),
    translateContent: jest.fn((content) => Promise.resolve({
      original_content: content,
      translated_content: content,
      source_language: 'en',
      target_language: 'en',
      quality_score: 1.0,
      translation_time_ms: 0,
      cached: false,
      confidence: 1.0,
    })),
    clearTranslationCache: jest.fn(() => Promise.resolve(true)),
    getLanguageName: jest.fn((code) => code),
    isRTL: jest.fn(() => false),
    formatDate: jest.fn((date) => date.toLocaleDateString()),
    formatNumber: jest.fn((num) => num.toLocaleString()),
  }),
}))

// Mock service worker for PWA tests
Object.defineProperty(window, 'navigator', {
  value: {
    serviceWorker: {
      register: jest.fn(() => Promise.resolve()),
      ready: Promise.resolve({
        unregister: jest.fn(() => Promise.resolve()),
      }),
    },
    userAgent: 'Mozilla/5.0 (Test Browser) TestKit/1.0',
    platform: 'Test Platform',
    language: 'en-US',
    cookieEnabled: true,
    onLine: true
  },
  writable: true,
})

// Mock Enhanced AI Chat Hook
jest.mock('./hooks/useEnhancedAIChat', () => ({
  useEnhancedAIChat: jest.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    context: {
      reportId: 'test-report-123',
      projectId: 'test-project-123',
      userId: 'test-user-123',
    },
    sendMessage: jest.fn(() => Promise.resolve()),
    clearMessages: jest.fn(),
    updateContext: jest.fn(),
    quickActions: {
      generateInsights: jest.fn(() => Promise.resolve()),
      suggestActions: jest.fn(() => Promise.resolve()),
      analyzeRisks: jest.fn(() => Promise.resolve()),
    },
  })),
}))

// Mock web-vitals library
jest.mock('web-vitals', () => ({
  onCLS: jest.fn((callback) => {
    // Simulate CLS metric
    setTimeout(() => {
      callback({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'test-cls-id',
        entries: []
      })
    }, 0)
  }),
  onFID: jest.fn((callback) => {
    setTimeout(() => {
      callback({
        name: 'FID',
        value: 50,
        rating: 'good',
        delta: 50,
        id: 'test-fid-id',
        entries: []
      })
    }, 0)
  }),
  onLCP: jest.fn((callback) => {
    setTimeout(() => {
      callback({
        name: 'LCP',
        value: 1500,
        rating: 'good',
        delta: 1500,
        id: 'test-lcp-id',
        entries: []
      })
    }, 0)
  }),
  onINP: jest.fn((callback) => {
    setTimeout(() => {
      callback({
        name: 'INP',
        value: 100,
        rating: 'good',
        delta: 100,
        id: 'test-inp-id',
        entries: []
      })
    }, 0)
  }),
  onTTFB: jest.fn((callback) => {
    setTimeout(() => {
      callback({
        name: 'TTFB',
        value: 200,
        rating: 'good',
        delta: 200,
        id: 'test-ttfb-id',
        entries: []
      })
    }, 0)
  }),
  onFCP: jest.fn((callback) => {
    setTimeout(() => {
      callback({
        name: 'FCP',
        value: 1000,
        rating: 'good',
        delta: 1000,
        id: 'test-fcp-id',
        entries: []
      })
    }, 0)
  }),
}))

// Mock Mobile PMR Hook
jest.mock('./hooks/useMobilePMR', () => ({
  useMobilePMR: jest.fn(() => ({
    state: {
      isMobile: true,
      viewMode: 'compact',
      activePanel: 'editor',
      offlineMode: false,
      syncStatus: 'synced',
    },
    actions: {
      setViewMode: jest.fn(),
      togglePanel: jest.fn(),
      saveOffline: jest.fn(() => Promise.resolve()),
      syncOfflineChanges: jest.fn(() => Promise.resolve()),
      exportReport: jest.fn(() => Promise.resolve()),
    },
  })),
}))

// Mock Media Query Hooks
jest.mock('./hooks/useMediaQuery', () => ({
  useMediaQuery: jest.fn(() => false),
  useIsMobile: jest.fn(() => false),
  useIsTablet: jest.fn(() => false),
  useIsDesktop: jest.fn(() => true),
}))

// Mock Offline Hook
jest.mock('./hooks/useOffline', () => ({
  useOffline: jest.fn(() => ({
    isOnline: true,
    queueRequest: jest.fn(),
    cacheData: jest.fn(),
    getCachedData: jest.fn(),
    performBackgroundSync: jest.fn(),
  })),
}))

// Mock Touch Gestures Hook
jest.mock('./hooks/useTouchGestures', () => ({
  useTouchGestures: jest.fn(() => ({
    elementRef: { current: null },
    gestureState: {
      isActive: false,
      scale: 1,
      rotation: 0,
      startPoints: [],
      currentPoints: [],
      velocity: { x: 0, y: 0 },
    },
    isGestureActive: false,
  })),
}))

// Mock PMR Context Hook
jest.mock('./hooks/usePMRContext', () => ({
  usePMRContext: jest.fn(() => ({
    state: {
      currentReport: null,
      isLoading: false,
      isSaving: false,
      pendingChanges: new Map(),
      error: null,
      exportJobs: [],
    },
    actions: {
      loadReport: jest.fn(() => Promise.resolve()),
      saveReport: jest.fn(() => Promise.resolve()),
      updateSection: jest.fn(() => Promise.resolve()),
      generateReport: jest.fn(() => Promise.resolve()),
      exportReport: jest.fn(() => Promise.resolve()),
    },
    hasUnsavedChanges: false,
  })),
}))

// Mock Realtime PMR Hook
jest.mock('./hooks/useRealtimePMR', () => ({
  useRealtimePMR: jest.fn(() => [
    {
      isConnected: true,
      activeUsers: [],
      pendingChanges: [],
      conflicts: [],
    },
    {
      updateCursor: jest.fn(),
      sendUpdate: jest.fn(),
      resolveConflict: jest.fn(),
    },
  ]),
}))

// Setup global fetch mock
if (typeof global.fetch === 'undefined') {
  // Import mock data for API responses
  const mockResponses = {
    '/api/dashboards/quick-stats': {
      quick_stats: {
        total_projects: 10,
        active_projects: 7,
        completed_projects: 2,
        at_risk_projects: 1,
        health_distribution: { green: 6, yellow: 3, red: 1 },
        budget_summary: {
          total_budget: 5000000,
          total_actual: 2500000,
          variance: -2500000,
          variance_percentage: -50,
        },
        schedule_summary: { on_track: 6, at_risk: 3, delayed: 1 },
      },
      kpis: {
        project_success_rate: 85,
        budget_performance: 92,
        timeline_performance: 78,
        average_health_score: 2.1,
        resource_efficiency: 88,
        active_projects_ratio: 70,
      },
    },
    '/api/pmr/reports': {
      reports: [],
      total: 0,
    },
    '/api/projects': {
      projects: [],
      total: 0,
    },
  }

  global.fetch = jest.fn((url, options) => {
    const urlString = typeof url === 'string' ? url : url.toString()
    const path = urlString.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    
    // Minimal translations for I18nProvider in tests (loadTranslations)
    if (path === '/locales/en.json' || path.match(/^\/locales\/[a-z]{2}(-[A-Z]{2})?\.json$/)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({
          nav: {},
          dashboard: {},
          topbar: {},
          common: {
            alerts: { one: '{count} alert', other: '{count} alerts' },
            showingTransactions: { one: 'Showing 1 transaction', other: 'Showing {count} transactions' },
            typesSelected: { one: '1 type selected', other: '{count} types selected' },
          },
        }),
        text: () => Promise.resolve('{}'),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      })
    }
    
    // Find matching mock response
    let response = mockResponses[path] || { success: true, data: null }
    
    // Handle different HTTP methods
    const method = options?.method || 'GET'
    
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        const body = options?.body ? JSON.parse(options.body) : {}
        response = { success: true, data: body }
      } catch {
        response = { success: true, data: response }
      }
    }
    
    if (method === 'DELETE') {
      response = { success: true, message: 'Deleted successfully' }
    }
    
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    })
  })
}