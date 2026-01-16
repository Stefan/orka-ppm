/**
 * Comprehensive Mock Data for Tests
 * 
 * Provides realistic mock data for all major entities in the application.
 * Use these mocks to ensure consistent test data across all test files.
 */

import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// User and Session Mocks
// ============================================================================

export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'project_manager',
  tenant_id: 'tenant-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockSession = {
  user: mockUser,
  access_token: 'mock-access-token-123',
  refresh_token: 'mock-refresh-token-123',
  expires_at: Date.now() + 3600000, // 1 hour from now
}

export const mockAdminUser = {
  ...mockUser,
  id: 'admin-123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
}

// ============================================================================
// PMR Report Mocks
// ============================================================================

export const mockPMRSection = {
  section_id: 'section-1',
  title: 'Executive Summary',
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is a sample executive summary for the monthly project report.',
          },
        ],
      },
    ],
  },
  ai_generated: true,
  confidence_score: 0.95,
  last_modified: new Date().toISOString(),
  modified_by: 'user-123',
}

export const mockPMRReport = {
  id: 'report-1',
  title: 'Monthly Project Report - January 2026',
  report_month: 'January',
  report_year: 2026,
  project_id: 'project-1',
  created_by: 'user-123',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
  status: 'draft',
  version: 1,
  sections: [
    mockPMRSection,
    {
      section_id: 'section-2',
      title: 'Budget Analysis',
      content: {
        type: 'doc',
        content: [],
      },
      ai_generated: false,
      last_modified: new Date().toISOString(),
      modified_by: 'user-123',
    },
    {
      section_id: 'section-3',
      title: 'Schedule Status',
      content: {
        type: 'doc',
        content: [],
      },
      ai_generated: false,
      last_modified: new Date().toISOString(),
      modified_by: 'user-123',
    },
  ],
  ai_insights: [],
  collaborators: ['user-123'],
  tenant_id: 'tenant-123',
}

export const mockPMRReports = [
  mockPMRReport,
  {
    ...mockPMRReport,
    id: 'report-2',
    title: 'Monthly Project Report - December 2025',
    report_month: 'December',
    report_year: 2025,
    status: 'published',
  },
  {
    ...mockPMRReport,
    id: 'report-3',
    title: 'Monthly Project Report - November 2025',
    report_month: 'November',
    report_year: 2025,
    status: 'published',
  },
]

// ============================================================================
// Project Mocks
// ============================================================================

export const mockProject = {
  id: 'project-1',
  name: 'Website Redesign',
  description: 'Complete redesign of company website',
  status: 'active',
  health: 'green',
  start_date: '2025-01-01',
  end_date: '2026-12-31',
  budget: 500000,
  actual_cost: 250000,
  progress: 50,
  portfolio_id: 'portfolio-1',
  project_manager_id: 'user-123',
  tenant_id: 'tenant-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
}

export const mockProjects = [
  mockProject,
  {
    ...mockProject,
    id: 'project-2',
    name: 'Mobile App Development',
    description: 'New mobile application',
    health: 'yellow',
    budget: 750000,
    actual_cost: 400000,
    progress: 60,
  },
  {
    ...mockProject,
    id: 'project-3',
    name: 'Infrastructure Upgrade',
    description: 'Server infrastructure modernization',
    health: 'red',
    status: 'at_risk',
    budget: 1000000,
    actual_cost: 800000,
    progress: 75,
  },
]

// ============================================================================
// Portfolio Mocks
// ============================================================================

export const mockPortfolio = {
  id: 'portfolio-1',
  name: 'Digital Transformation',
  description: 'Portfolio of digital transformation projects',
  status: 'active',
  total_budget: 2500000,
  total_actual: 1450000,
  project_count: 3,
  tenant_id: 'tenant-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
}

export const mockPortfolios = [
  mockPortfolio,
  {
    ...mockPortfolio,
    id: 'portfolio-2',
    name: 'Infrastructure',
    description: 'Infrastructure improvement projects',
    total_budget: 1500000,
    total_actual: 800000,
    project_count: 2,
  },
]

// ============================================================================
// Dashboard Data Mocks
// ============================================================================

export const mockDashboardStats = {
  total_projects: 10,
  active_projects: 7,
  completed_projects: 2,
  at_risk_projects: 1,
  health_distribution: {
    green: 6,
    yellow: 3,
    red: 1,
  },
  budget_summary: {
    total_budget: 5000000,
    total_actual: 2500000,
    variance: -2500000,
    variance_percentage: -50,
  },
  schedule_summary: {
    on_track: 6,
    at_risk: 3,
    delayed: 1,
  },
}

export const mockQuickStats = {
  quick_stats: mockDashboardStats,
}

// ============================================================================
// Change Request Mocks
// ============================================================================

export const mockChangeRequest = {
  id: 'change-1',
  title: 'Scope Change - Add Mobile Support',
  description: 'Add mobile responsive design to website',
  type: 'scope',
  status: 'pending',
  priority: 'high',
  impact: {
    cost: 50000,
    schedule: 30, // days
    scope: 'major',
  },
  requested_by: 'user-123',
  requested_date: '2026-01-10T00:00:00Z',
  project_id: 'project-1',
  tenant_id: 'tenant-123',
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
}

export const mockChangeRequests = [
  mockChangeRequest,
  {
    ...mockChangeRequest,
    id: 'change-2',
    title: 'Budget Increase Request',
    type: 'budget',
    status: 'approved',
    priority: 'medium',
  },
  {
    ...mockChangeRequest,
    id: 'change-3',
    title: 'Schedule Extension',
    type: 'schedule',
    status: 'rejected',
    priority: 'low',
  },
]

// ============================================================================
// Resource Mocks
// ============================================================================

export const mockResource = {
  id: 'resource-1',
  name: 'John Developer',
  email: 'john@example.com',
  role: 'developer',
  availability: 100,
  cost_per_hour: 100,
  skills: ['React', 'TypeScript', 'Node.js'],
  tenant_id: 'tenant-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
}

export const mockResources = [
  mockResource,
  {
    ...mockResource,
    id: 'resource-2',
    name: 'Jane Designer',
    email: 'jane@example.com',
    role: 'designer',
    skills: ['UI/UX', 'Figma', 'Adobe XD'],
  },
  {
    ...mockResource,
    id: 'resource-3',
    name: 'Bob Manager',
    email: 'bob@example.com',
    role: 'project_manager',
    cost_per_hour: 150,
    skills: ['Agile', 'Scrum', 'Leadership'],
  },
]

// ============================================================================
// Risk Mocks
// ============================================================================

export const mockRisk = {
  id: 'risk-1',
  title: 'Technical Debt Accumulation',
  description: 'Rapid development may lead to technical debt',
  category: 'technical',
  probability: 'medium',
  impact: 'high',
  severity: 'high',
  status: 'active',
  mitigation_plan: 'Regular code reviews and refactoring sprints',
  owner_id: 'user-123',
  project_id: 'project-1',
  tenant_id: 'tenant-123',
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
}

export const mockRisks = [
  mockRisk,
  {
    ...mockRisk,
    id: 'risk-2',
    title: 'Resource Availability',
    description: 'Key resources may not be available',
    category: 'resource',
    probability: 'low',
    impact: 'medium',
    severity: 'medium',
  },
]

// ============================================================================
// Help Chat Mocks
// ============================================================================

export const mockChatMessage = {
  id: 'msg-1',
  type: 'user' as const,
  content: 'How do I create a new project?',
  timestamp: new Date(),
  user_id: 'user-123',
}

export const mockChatResponse = {
  id: 'msg-2',
  type: 'assistant' as const,
  content: 'To create a new project, navigate to the Projects page and click the "New Project" button.',
  timestamp: new Date(),
  sources: [
    {
      title: 'Project Management Guide',
      url: '/docs/projects',
      relevance: 0.95,
    },
  ],
}

export const mockChatMessages = [mockChatMessage, mockChatResponse]

export const mockProactiveTip = {
  id: 'tip-1',
  type: 'tip' as const,
  content: '💡 **Quick Tip**\n\nYou can use keyboard shortcuts to navigate faster. Press `?` to see all shortcuts.',
  timestamp: new Date(),
  priority: 'medium',
  category: 'productivity',
  actions: [
    {
      label: 'View Shortcuts',
      action: 'show_shortcuts',
    },
    {
      label: 'Dismiss',
      action: 'dismiss',
    },
  ],
}

// ============================================================================
// Scenario and Simulation Mocks
// ============================================================================

export const mockScenario = {
  id: 'scenario-1',
  name: 'Optimistic Timeline',
  description: 'Best case scenario with no delays',
  project_id: 'project-1',
  parameters: {
    schedule_buffer: 0,
    resource_efficiency: 1.2,
    risk_factor: 0.5,
  },
  results: {
    estimated_completion: '2026-10-01',
    estimated_cost: 450000,
    success_probability: 0.85,
  },
  created_by: 'user-123',
  created_at: '2026-01-10T00:00:00Z',
  tenant_id: 'tenant-123',
}

export const mockSimulation = {
  id: 'simulation-1',
  name: 'Monte Carlo - Cost Analysis',
  type: 'monte_carlo',
  project_id: 'project-1',
  parameters: {
    iterations: 10000,
    confidence_level: 0.95,
    variables: ['cost', 'schedule'],
  },
  results: {
    mean_cost: 525000,
    p50_cost: 500000,
    p90_cost: 600000,
    mean_duration: 365,
    p50_duration: 350,
    p90_duration: 400,
  },
  status: 'completed',
  created_by: 'user-123',
  created_at: '2026-01-15T00:00:00Z',
  completed_at: '2026-01-15T00:05:00Z',
  tenant_id: 'tenant-123',
}

// ============================================================================
// Audit Event Mocks
// ============================================================================

export const mockAuditEvent = {
  id: 'audit-1',
  event_type: 'project_created',
  user_id: 'user-123',
  entity_type: 'project',
  entity_id: 'project-1',
  action_details: {
    project_name: 'Website Redesign',
    budget: 500000,
  },
  severity: 'info',
  timestamp: '2025-01-01T00:00:00Z',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0',
  tenant_id: 'tenant-123',
  is_anomaly: false,
  anomaly_score: 0.1,
}

export const mockAuditEvents = [
  mockAuditEvent,
  {
    ...mockAuditEvent,
    id: 'audit-2',
    event_type: 'budget_updated',
    severity: 'warning',
    is_anomaly: true,
    anomaly_score: 0.85,
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a mock UUID
 */
export const mockUUID = () => `mock-uuid-${Math.random().toString(36).substr(2, 9)}`

/**
 * Generate multiple mock items
 */
export function generateMockItems<T>(template: T, count: number, modifier?: (item: T, index: number) => Partial<T>): T[] {
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `${(template as any).id}-${index}`,
    ...(modifier ? modifier(template, index) : {}),
  }))
}

/**
 * Create a mock API response
 */
export function mockApiResponse<T>(data: T, success = true) {
  return {
    data,
    success,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Create a mock error response
 */
export function mockErrorResponse(message: string, code = 500) {
  return {
    error: message,
    code,
    success: false,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Export All Mocks
// ============================================================================

export const mockData = {
  // Users
  user: mockUser,
  adminUser: mockAdminUser,
  session: mockSession,
  
  // PMR
  pmrReport: mockPMRReport,
  pmrReports: mockPMRReports,
  pmrSection: mockPMRSection,
  
  // Projects
  project: mockProject,
  projects: mockProjects,
  
  // Portfolios
  portfolio: mockPortfolio,
  portfolios: mockPortfolios,
  
  // Dashboard
  dashboardStats: mockDashboardStats,
  quickStats: mockQuickStats,
  
  // Change Requests
  changeRequest: mockChangeRequest,
  changeRequests: mockChangeRequests,
  
  // Resources
  resource: mockResource,
  resources: mockResources,
  
  // Risks
  risk: mockRisk,
  risks: mockRisks,
  
  // Help Chat
  chatMessage: mockChatMessage,
  chatResponse: mockChatResponse,
  chatMessages: mockChatMessages,
  proactiveTip: mockProactiveTip,
  
  // Scenarios & Simulations
  scenario: mockScenario,
  simulation: mockSimulation,
  
  // Audit
  auditEvent: mockAuditEvent,
  auditEvents: mockAuditEvents,
}

export default mockData
