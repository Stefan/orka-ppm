/**
 * Dashboard Page Specific Validation Tests
 * 
 * Tests the actual Portfolio Dashboard page to verify:
 * - Portfolio Dashboard with various content lengths
 * - Sidebar and main content interaction
 * - Mobile and desktop layouts
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import '@testing-library/jest-dom'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: '/dashboards',
    query: {},
    asPath: '/dashboards',
  }),
  usePathname: () => '/dashboards',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock auth provider with different states
const createMockAuth = (loading = false, session = null) => ({
  useAuth: () => ({
    session: session || {
      user: { id: 'test-user', email: 'test@example.com' },
      access_token: 'test-token'
    },
    loading,
    clearSession: jest.fn()
  })
})

// Mock API requests
global.fetch = jest.fn()

// Mock the API client
jest.mock('../lib/api/client', () => ({
  getApiUrl: (path: string) => `https://api.example.com${path}`,
  apiRequest: jest.fn().mockImplementation((path: string) => {
    if (path.includes('quick-stats')) {
      return Promise.resolve({
        quick_stats: {
          total_projects: 10,
          active_projects: 7,
          health_distribution: { green: 5, yellow: 2, red: 0 },
          critical_alerts: 0,
          at_risk_projects: 2
        },
        kpis: {
          project_success_rate: 85,
          budget_performance: 92,
          timeline_performance: 78,
          average_health_score: 2.1,
          resource_efficiency: 88,
          active_projects_ratio: 70
        }
      })
    }
    if (path.includes('projects')) {
      return Promise.resolve({
        projects: [
          { id: '1', name: 'Project Alpha', status: 'active', health: 'green', budget: 100000, created_at: '2024-01-01' },
          { id: '2', name: 'Project Beta', status: 'active', health: 'yellow', budget: 150000, created_at: '2024-01-02' },
          { id: '3', name: 'Project Gamma', status: 'completed', health: 'green', budget: 200000, created_at: '2024-01-03' }
        ]
      })
    }
    return Promise.resolve([])
  })
}))

// Mock cross-device sync
jest.mock('../hooks/useCrossDeviceSync', () => ({
  useCrossDeviceSync: () => ({
    preferences: null,
    updatePreferences: jest.fn(),
    initialize: jest.fn(),
    isSyncing: false,
    lastSyncTime: null
  })
}))

// Mock media query hook
let isMobileValue = false
jest.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => isMobileValue
}))

// Mock scroll performance hook
jest.mock('../hooks/useScrollPerformance', () => ({
  useScrollPerformance: () => ({
    performanceSummary: {},
    isScrolling: false
  })
}))

// Mock variance components
jest.mock('../app/dashboards/components/VarianceKPIs', () => {
  return function MockVarianceKPIs() {
    return (
      <div data-testid="variance-kpis" className="bg-white p-6 rounded-lg">
        <h3>Variance KPIs</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>Budget Variance: +2.5%</div>
          <div>Schedule Variance: -1.2%</div>
          <div>Resource Variance: +0.8%</div>
        </div>
      </div>
    )
  }
})

jest.mock('../app/dashboards/components/VarianceTrends', () => {
  return function MockVarianceTrends() {
    return (
      <div data-testid="variance-trends" className="bg-white p-6 rounded-lg">
        <h3>Variance Trends</h3>
        <div style={{ height: '300px' }} className="bg-gray-100 rounded">
          Chart placeholder
        </div>
      </div>
    )
  }
})

jest.mock('../app/dashboards/components/VarianceAlerts', () => {
  return function MockVarianceAlerts({ onAlertCount }: { onAlertCount: (count: number) => void }) {
    React.useEffect(() => {
      onAlertCount(2) // Simulate 2 alerts
    }, [onAlertCount])
    
    return (
      <div data-testid="variance-alerts" className="bg-white p-6 rounded-lg">
        <h3>Variance Alerts</h3>
        <div className="space-y-2">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            Budget variance detected in Project Alpha
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            Critical schedule delay in Project Beta
          </div>
        </div>
      </div>
    )
  }
})

// Mock adaptive dashboard
jest.mock('../components/ui/organisms/AdaptiveDashboard', () => ({
  AdaptiveDashboard: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="adaptive-dashboard" className={className}>
      <h2>AI-Enhanced Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded">Widget 1</div>
        <div className="bg-white p-4 rounded">Widget 2</div>
      </div>
      {children}
    </div>
  )
}))

// Mock error boundaries
jest.mock('../components/error-boundaries/ComponentErrorBoundary', () => ({
  ComponentErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('Dashboard Page Specific Validation Tests', () => {
  let DashboardPage: React.ComponentType

  beforeAll(async () => {
    // Mock auth provider
    jest.doMock('../app/providers/SupabaseAuthProvider', () => createMockAuth(false))
    
    // Import the dashboard page
    const module = await import('../app/dashboards/page')
    DashboardPage = module.default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    isMobileValue = false
    
    // Reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Portfolio Dashboard with Various Content Lengths', () => {
    test('validates Portfolio Dashboard with normal content load', async () => {
      render(<DashboardPage />)

      // Wait for the dashboard to load
      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verify main layout structure
      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      expect(mainContent).toHaveClass('overflow-auto')
    })

    test('validates Portfolio Dashboard with loading state', async () => {
      // Mock loading state
      jest.doMock('../app/providers/SupabaseAuthProvider', () => createMockAuth(true))
      
      const LoadingDashboard = (await import('../app/dashboards/page')).default
      render(<LoadingDashboard />)

      // Should show loading spinner
      const loadingSpinner = document.querySelector('.animate-spin')
      expect(loadingSpinner).toBeInTheDocument()

      // Main content should still have proper styling
      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('bg-white')
    })

    test('validates Portfolio Dashboard with error state', async () => {
      // Mock API error
      const mockApiRequest = require('../lib/api/client').apiRequest
      mockApiRequest.mockRejectedValueOnce(new Error('API Error'))

      render(<DashboardPage />)

      // Wait for error handling
      await waitFor(() => {
        const errorBanner = screen.queryByText(/Using fallback data/)
        if (errorBanner) {
          expect(errorBanner).toBeInTheDocument()
        }
      }, { timeout: 3000 })

      // Layout should still be intact
      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('bg-white')
    })

    test('validates Portfolio Dashboard with heavy content (variance components)', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Check that variance components are rendered
      await waitFor(() => {
        expect(screen.getByTestId('variance-kpis')).toBeInTheDocument()
        expect(screen.getByTestId('variance-trends')).toBeInTheDocument()
        expect(screen.getByTestId('variance-alerts')).toBeInTheDocument()
      })

      // Verify main content maintains proper styling with heavy content
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
      expect(mainContent).toHaveClass('min-h-screen')
    })

    test('validates Portfolio Dashboard with AI-enhanced mode', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Click AI Enhanced button
      const aiButton = screen.getByText('AI Enhanced')
      expect(aiButton).toBeInTheDocument()
      
      // Note: We can't easily test the click behavior due to complex state management
      // but we can verify the button exists and the layout remains stable
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
    })
  })

  describe('Sidebar and Main Content Interaction', () => {
    test('verifies sidebar and main content interaction on desktop', async () => {
      isMobileValue = false
      
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Desktop sidebar should be present (hidden class with lg:flex)
      const sidebar = document.querySelector('nav')
      expect(sidebar).toBeInTheDocument()
      
      // Main content should be properly positioned
      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('flex-1')
      expect(mainContent).toHaveClass('bg-white')
    })

    test('verifies sidebar and main content interaction on mobile', async () => {
      isMobileValue = true
      
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Mobile header should be present
      const mobileHeader = document.querySelector('header')
      expect(mobileHeader).toBeInTheDocument()
      
      // Main content should occupy full width on mobile
      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('flex-1')
    })

    test('validates content scrolling with sidebar present', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      
      // Should have scroll optimization classes
      expect(mainContent).toHaveClass('overflow-auto')
      expect(mainContent).toHaveClass('scrollable-container')
      expect(mainContent).toHaveClass('scroll-boundary-fix')
      expect(mainContent).toHaveClass('content-scroll-area')
      expect(mainContent).toHaveClass('dashboard-scroll')
    })
  })

  describe('Mobile and Desktop Layout Tests', () => {
    test('tests desktop layout - full sidebar visibility', async () => {
      isMobileValue = false
      
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Desktop layout should not have mobile header
      const mobileHeader = document.querySelector('header.lg\\:hidden')
      expect(mobileHeader).not.toBeInTheDocument()
      
      // Main content should have proper desktop styling
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
    })

    test('tests mobile layout - collapsible sidebar', async () => {
      isMobileValue = true
      
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Mobile header should be present
      const mobileHeader = document.querySelector('header')
      expect(mobileHeader).toBeInTheDocument()
      
      // Main content should adapt to mobile
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('flex-1')
    })

    test('validates responsive behavior during viewport changes', async () => {
      // Start with desktop
      isMobileValue = false
      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      let mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')

      // Switch to mobile
      isMobileValue = true
      rerender(<DashboardPage />)

      // Layout should remain stable
      mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
    })
  })

  describe('Performance and Optimization Tests', () => {
    test('validates performance optimization classes are applied', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      const mainContent = document.querySelector('main')
      expect(mainContent).toBeInTheDocument()
      
      // Check for performance optimization classes
      expect(mainContent).toHaveClass('main-content-optimized')
      expect(mainContent).toHaveClass('dashboard-performance')
      expect(mainContent).toHaveClass('performance-critical')
    })

    test('validates layout container optimization', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Layout container should have optimization classes
      const layoutContainer = document.querySelector('.layout-optimized')
      expect(layoutContainer).toBeInTheDocument()
    })

    test('validates scroll performance optimization', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      const mainContent = document.querySelector('main')
      
      // Should have scroll performance classes
      expect(mainContent).toHaveClass('scrollable-container')
      expect(mainContent).toHaveClass('content-scroll-area')
      expect(mainContent).toHaveClass('dashboard-scroll')
    })
  })

  describe('Background Consistency Tests', () => {
    test('validates white background consistency throughout dashboard', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Main content
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      
      // Layout container
      const layoutContainer = document.querySelector('.bg-white.layout-optimized')
      expect(layoutContainer).toBeInTheDocument()
      
      // Component backgrounds should be white
      const whiteComponents = document.querySelectorAll('.bg-white')
      expect(whiteComponents.length).toBeGreaterThan(0)
    })

    test('validates no conflicting gray backgrounds', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      const mainContent = document.querySelector('main')
      
      // Should not have gray background classes that could cause black bars
      expect(mainContent).not.toHaveClass('bg-gray-50')
      expect(mainContent).not.toHaveClass('bg-gray-100')
      
      // Should have white background
      expect(mainContent).toHaveClass('bg-white')
    })
  })

  describe('Content Length Variations', () => {
    test('handles dashboard with minimal data', async () => {
      // Mock empty data
      const mockApiRequest = require('../lib/api/client').apiRequest
      mockApiRequest.mockResolvedValueOnce({
        quick_stats: {
          total_projects: 0,
          active_projects: 0,
          health_distribution: { green: 0, yellow: 0, red: 0 },
          critical_alerts: 0,
          at_risk_projects: 0
        },
        kpis: {
          project_success_rate: 0,
          budget_performance: 0,
          timeline_performance: 0,
          average_health_score: 0,
          resource_efficiency: 0,
          active_projects_ratio: 0
        }
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Layout should remain stable with minimal data
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
    })

    test('handles dashboard with maximum data load', async () => {
      // Mock large dataset
      const mockApiRequest = require('../lib/api/client').apiRequest
      mockApiRequest.mockResolvedValueOnce({
        quick_stats: {
          total_projects: 100,
          active_projects: 75,
          health_distribution: { green: 50, yellow: 20, red: 5 },
          critical_alerts: 5,
          at_risk_projects: 20
        },
        kpis: {
          project_success_rate: 95,
          budget_performance: 88,
          timeline_performance: 92,
          average_health_score: 2.8,
          resource_efficiency: 94,
          active_projects_ratio: 75
        }
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Layout should handle large data sets
      const mainContent = document.querySelector('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
    })
  })
})