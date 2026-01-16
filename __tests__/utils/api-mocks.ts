/**
 * API Mocking Utilities
 * 
 * Provides mock implementations for API calls used in tests.
 */

import { mockData } from '../fixtures/mockData'

/**
 * Mock fetch responses for different API endpoints
 */
export const mockFetchResponses: Record<string, any> = {
  // Dashboard endpoints
  '/api/dashboards/quick-stats': {
    quick_stats: mockData.dashboardStats,
    kpis: {
      project_success_rate: 85,
      budget_performance: 92,
      timeline_performance: 78,
      average_health_score: 2.1,
      resource_efficiency: 88,
      active_projects_ratio: 70,
    },
  },
  
  // Projects endpoints
  '/api/projects': {
    projects: mockData.projects,
    total: mockData.projects.length,
  },
  
  '/api/projects/project-1': mockData.project,
  
  // PMR endpoints
  '/api/pmr/reports': {
    reports: mockData.pmrReports,
    total: mockData.pmrReports.length,
  },
  
  '/api/pmr/reports/report-1': mockData.pmrReport,
  
  // Portfolio endpoints
  '/api/portfolios': {
    portfolios: mockData.portfolios,
    total: mockData.portfolios.length,
  },
  
  '/api/portfolios/portfolio-1': mockData.portfolio,
  
  // Change requests endpoints
  '/api/changes': {
    changes: mockData.changeRequests,
    total: mockData.changeRequests.length,
  },
  
  '/api/changes/change-1': mockData.changeRequest,
  
  // Resources endpoints
  '/api/resources': {
    resources: mockData.resources,
    total: mockData.resources.length,
  },
  
  '/api/resources/resource-1': mockData.resource,
  
  // Risks endpoints
  '/api/risks': {
    risks: mockData.risks,
    total: mockData.risks.length,
  },
  
  '/api/risks/risk-1': mockData.risk,
  
  // Help chat endpoints
  '/api/help-chat/query': {
    response: 'This is a helpful response from the AI assistant.',
    sessionId: 'test-session-123',
    confidence: 0.95,
    sources: [
      {
        title: 'User Guide',
        url: '/docs/user-guide',
        relevance: 0.9,
      },
    ],
    suggestedActions: [],
    proactiveTips: [],
  },
  
  '/api/help-chat/proactive-tips': {
    tips: [mockData.proactiveTip],
  },
  
  // Scenarios endpoints
  '/api/scenarios': {
    scenarios: [mockData.scenario],
    total: 1,
  },
  
  '/api/scenarios/scenario-1': mockData.scenario,
  
  // Simulations endpoints
  '/api/simulations': {
    simulations: [mockData.simulation],
    total: 1,
  },
  
  '/api/simulations/simulation-1': mockData.simulation,
  
  // Audit endpoints
  '/api/audit/events': {
    events: mockData.auditEvents,
    total: mockData.auditEvents.length,
  },
  
  '/api/audit/events/audit-1': mockData.auditEvent,
}

/**
 * Setup global fetch mock with predefined responses
 */
export function setupFetchMock() {
  global.fetch = jest.fn((url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url.toString()
    
    // Extract path from URL
    const path = urlString.replace(/^https?:\/\/[^/]+/, '')
    
    // Find matching mock response
    let response = mockFetchResponses[path]
    
    // If no exact match, try pattern matching
    if (!response) {
      for (const [pattern, data] of Object.entries(mockFetchResponses)) {
        if (path.includes(pattern)) {
          response = data
          break
        }
      }
    }
    
    // Default response if no match found
    if (!response) {
      response = { success: true, data: null }
    }
    
    // Handle different HTTP methods
    const method = options?.method || 'GET'
    
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      // For mutations, return the request body or a success response
      try {
        const body = options?.body ? JSON.parse(options.body as string) : {}
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
    } as Response)
  }) as jest.Mock
}

/**
 * Reset fetch mock
 */
export function resetFetchMock() {
  if (global.fetch && typeof global.fetch === 'function' && 'mockClear' in global.fetch) {
    (global.fetch as jest.Mock).mockClear()
  }
}

/**
 * Mock API error response
 */
export function mockApiError(statusCode: number = 500, message: string = 'Internal Server Error') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: statusCode,
      statusText: message,
      json: () => Promise.resolve({
        error: message,
        code: statusCode,
      }),
      text: () => Promise.resolve(JSON.stringify({
        error: message,
        code: statusCode,
      })),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    } as Response)
  ) as jest.Mock
}

/**
 * Mock API loading state (delayed response)
 */
export function mockApiLoading(delay: number = 1000) {
  global.fetch = jest.fn(() =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ success: true, data: null }),
          text: () => Promise.resolve(JSON.stringify({ success: true, data: null })),
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        } as Response)
      }, delay)
    })
  ) as jest.Mock
}

/**
 * Create a custom mock response for a specific endpoint
 */
export function mockEndpoint(path: string, response: any, options?: {
  status?: number
  delay?: number
  error?: boolean
}) {
  const { status = 200, delay = 0, error = false } = options || {}
  
  mockFetchResponses[path] = response
  
  if (error) {
    mockApiError(status, response.message || 'Error')
  } else if (delay > 0) {
    mockApiLoading(delay)
  } else {
    setupFetchMock()
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Flush all pending promises
 */
export async function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve))
}
