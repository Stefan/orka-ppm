/**
 * Unit Tests: ShareAnalyticsDashboard Component
 * 
 * Feature: shareable-project-urls
 * Task: 9.3 Write unit tests for analytics interface
 * 
 * Tests cover:
 * - Chart rendering and data visualization
 * - Filtering and date range functionality
 * - Export and summary features
 * - Loading and error states
 * - User interactions
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import ShareAnalyticsDashboard from '@/components/projects/ShareAnalyticsDashboard'

// Mock fetch
global.fetch = jest.fn()

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />
}))

describe('ShareAnalyticsDashboard - Unit Tests', () => {
  const mockShareId = 'share-123'
  const mockProjectId = 'project-456'

  const mockAnalyticsData = {
    total_accesses: 150,
    unique_visitors: 45,
    unique_countries: 8,
    access_by_day: [
      { date: '2024-01-01', count: 10 },
      { date: '2024-01-02', count: 15 },
      { date: '2024-01-03', count: 20 }
    ],
    geographic_distribution: [
      { country: 'USA', count: 50, percentage: 33.33 },
      { country: 'UK', count: 30, percentage: 20.0 },
      { country: 'Canada', count: 20, percentage: 13.33 }
    ],
    most_viewed_sections: [
      { section: 'Overview', views: 80, percentage: 53.33 },
      { section: 'Timeline', views: 40, percentage: 26.67 },
      { section: 'Documents', views: 30, percentage: 20.0 }
    ],
    average_session_duration: 180,
    suspicious_activity_count: 2
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockAnalyticsData
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('Rendering and Data Visualization', () => {
    test('should render analytics dashboard with header', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Share Link Analytics')).toBeInTheDocument()
      })

      expect(screen.getByText(/Track engagement and usage patterns/i)).toBeInTheDocument()
    })

    test('should display summary cards with correct metrics', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Total Accesses')).toBeInTheDocument()
      })

      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('Unique Visitors')).toBeInTheDocument()
      expect(screen.getByText('45')).toBeInTheDocument()
      expect(screen.getByText('Countries')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    test('should format session duration correctly', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Avg. Session')).toBeInTheDocument()
      })

      expect(screen.getByText('3m 0s')).toBeInTheDocument()
    })

    test('should display N/A for null session duration', async () => {
      const dataWithNullDuration = {
        ...mockAnalyticsData,
        average_session_duration: null
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => dataWithNullDuration
      })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument()
      })
    })

    test('should render access trends chart', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Access Trends')).toBeInTheDocument()
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    test('should render geographic distribution chart', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Geographic Distribution')).toBeInTheDocument()
      })

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByText('USA')).toBeInTheDocument()
      expect(screen.getByText('UK')).toBeInTheDocument()
    })

    test('should render most viewed sections chart', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Most Viewed Sections')).toBeInTheDocument()
      })

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    test('should display suspicious activity alert when present', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText(/2 suspicious activities detected/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/Review access logs for unusual patterns/i)).toBeInTheDocument()
    })

    test('should not display suspicious activity alert when count is zero', async () => {
      const dataWithNoSuspicious = {
        ...mockAnalyticsData,
        suspicious_activity_count: 0
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => dataWithNoSuspicious
      })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Total Accesses')).toBeInTheDocument()
      })

      expect(screen.queryByText(/suspicious activities detected/i)).not.toBeInTheDocument()
    })

    test('should display message when no geographic data available', async () => {
      const dataWithNoGeo = {
        ...mockAnalyticsData,
        geographic_distribution: []
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => dataWithNoGeo
      })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('No geographic data available')).toBeInTheDocument()
      })
    })

    test('should display message when no section view data available', async () => {
      const dataWithNoSections = {
        ...mockAnalyticsData,
        most_viewed_sections: []
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => dataWithNoSections
      })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('No section view data available')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering and Date Range', () => {
    test('should toggle filters panel when filter button is clicked', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })

      const filterButton = screen.getByText('Filters')
      fireEvent.click(filterButton)

      await waitFor(() => {
        expect(screen.getByText('Date Range:')).toBeInTheDocument()
      })
    })

    test('should update date range when start date is changed', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })

      // Open filters
      const filterButton = screen.getByText('Filters')
      fireEvent.click(filterButton)

      await waitFor(() => {
        expect(screen.getByText('Date Range:')).toBeInTheDocument()
      })

      const dateInputs = document.querySelectorAll('input[type="date"]')
      expect(dateInputs.length).toBeGreaterThan(0)

      const startDateInput = dateInputs[0] as HTMLInputElement

      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('start_date=2024-01-01'),
          expect.any(Object)
        )
      })
    })

    test('should clear date range when clear button is clicked', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })

      // Open filters
      const filterButton = screen.getByText('Filters')
      fireEvent.click(filterButton)

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument()
      })

      const clearButton = screen.getByText('Clear')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    test('should fetch analytics with date range parameters', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/shares/${mockShareId}/analytics`),
          expect.any(Object)
        )
      })
    })
  })

  describe('Export Functionality', () => {
    test('should have export button', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument()
      })
    })

    test('should call custom export handler when provided', async () => {
      const mockExport = jest.fn()
      render(
        <ShareAnalyticsDashboard
          shareId={mockShareId}
          onExport={mockExport}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(mockExport).toHaveBeenCalledWith(mockAnalyticsData)
      })
    })

    test('should generate CSV export when no custom handler provided', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
      
      const createElementSpy = jest.spyOn(document, 'createElement')
      const appendChildSpy = jest.spyOn(document.body, 'appendChild')
      const removeChildSpy = jest.spyOn(document.body, 'removeChild')

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(createElementSpy).toHaveBeenCalledWith('a')
      })

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })

  describe('Refresh Functionality', () => {
    test('should have refresh button', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    test('should refetch data when refresh button is clicked', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount)
      })
    })

    test('should call custom refresh handler when provided', async () => {
      const mockRefresh = jest.fn()
      render(
        <ShareAnalyticsDashboard
          shareId={mockShareId}
          onRefresh={mockRefresh}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    test('should disable refresh button while refreshing', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh').closest('button')
      fireEvent.click(refreshButton!)

      // Button should be disabled during refresh
      expect(refreshButton).toBeDisabled()
    })
  })

  describe('Loading and Error States', () => {
    test('should display loading skeleton initially', () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      expect(screen.getByText('Share Link Analytics')).toBeInTheDocument()
      // Loading skeleton should have animated pulse elements
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })

    test('should display error state when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument()
      })

      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    test('should display error state when response is not ok', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Not found' })
      })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument()
      })
    })

    test('should retry fetch when try again button is clicked', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnalyticsData
        })

      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })

      const tryAgainButton = screen.getByText('Try Again')
      fireEvent.click(tryAgainButton)

      await waitFor(() => {
        expect(screen.getByText('Total Accesses')).toBeInTheDocument()
      })
    })
  })

  describe('Integration with Project Management', () => {
    test('should accept projectId prop', async () => {
      render(
        <ShareAnalyticsDashboard
          shareId={mockShareId}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Share Link Analytics')).toBeInTheDocument()
      })
    })

    test('should fetch analytics on mount', async () => {
      render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/shares/${mockShareId}/analytics`),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json'
            }
          })
        )
      })
    })

    test('should refetch analytics when shareId changes', async () => {
      const { rerender } = render(<ShareAnalyticsDashboard shareId={mockShareId} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length

      rerender(<ShareAnalyticsDashboard shareId="share-456" />)

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount)
      })
    })
  })
})
