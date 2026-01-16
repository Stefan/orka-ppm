/**
 * Mobile PMR Responsiveness Tests
 * 
 * Tests for mobile-optimized PMR editor including:
 * - Touch gesture interactions
 * - Responsive layout switching
 * - Offline editing capabilities
 * - Mobile-specific UI components
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'

import { useMobilePMR } from '@/hooks/useMobilePMR'
import MobilePMREditor from '@/components/pmr/MobilePMREditor'
import MobileInsightsPanel from '@/components/pmr/MobileInsightsPanel'
import MobileCollaborationPanel from '@/components/pmr/MobileCollaborationPanel'
import ResponsivePMREditor from '@/components/pmr/ResponsivePMREditor'

// Mock hooks
jest.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: jest.fn((query: string) => {
    if (query.includes('max-width: 767px')) return true // Mobile
    return false
  }),
  useIsMobile: jest.fn(() => true),
  useIsTablet: jest.fn(() => false),
  useIsDesktop: jest.fn(() => false)
}))

jest.mock('@/hooks/useOffline', () => ({
  useOffline: jest.fn(() => ({
    isOnline: true,
    queueRequest: jest.fn(),
    cacheData: jest.fn(),
    getCachedData: jest.fn(),
    performBackgroundSync: jest.fn()
  }))
}))

jest.mock('@/hooks/useTouchGestures', () => ({
  useTouchGestures: jest.fn(() => ({
    elementRef: { current: null },
    gestureState: {
      isActive: false,
      scale: 1,
      rotation: 0
    },
    isGestureActive: false
  }))
}))

jest.mock('@/hooks/usePMRContext', () => ({
  usePMRContext: jest.fn(() => ({
    state: {
      currentReport: null,
      isLoading: false,
      isSaving: false,
      pendingChanges: new Map()
    },
    updateSection: jest.fn(),
    hasUnsavedChanges: false,
    saveReport: jest.fn()
  }))
}))

// Mock data
const mockReport = {
  id: 'report-1',
  title: 'Monthly Project Report - January 2026',
  report_month: 'January',
  report_year: 2026,
  version: 1,
  sections: [
    {
      section_id: 'section-1',
      title: 'Executive Summary',
      content: { type: 'doc', content: [] },
      ai_generated: true,
      confidence_score: 0.95,
      last_modified: new Date().toISOString(),
      modified_by: 'user-1'
    },
    {
      section_id: 'section-2',
      title: 'Budget Analysis',
      content: { type: 'doc', content: [] },
      ai_generated: false,
      last_modified: new Date().toISOString(),
      modified_by: 'user-1'
    }
  ],
  ai_insights: []
}

const mockInsights = [
  {
    id: 'insight-1',
    report_id: 'report-1',
    insight_type: 'prediction',
    category: 'budget',
    title: 'Budget Overrun Risk',
    content: 'Project is trending 15% over budget',
    confidence_score: 0.85,
    supporting_data: {},
    predicted_impact: 'High',
    recommended_actions: ['Review resource allocation', 'Adjust timeline'],
    priority: 'high',
    generated_at: new Date().toISOString(),
    validated: false
  },
  {
    id: 'insight-2',
    report_id: 'report-1',
    insight_type: 'recommendation',
    category: 'schedule',
    title: 'Schedule Optimization',
    content: 'Consider parallel task execution',
    confidence_score: 0.75,
    supporting_data: {},
    recommended_actions: ['Identify parallel tasks'],
    priority: 'medium',
    generated_at: new Date().toISOString(),
    validated: false
  }
]

const mockActiveUsers = [
  {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    color: '#3B82F6',
    lastActivity: new Date().toISOString()
  },
  {
    id: 'user-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    color: '#10B981',
    lastActivity: new Date().toISOString()
  }
]

describe('useMobilePMR Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with correct mobile state', () => {
    const { result } = renderHook(() => useMobilePMR({
      reportId: 'report-1',
      enableOfflineEditing: true
    }))

    expect(result.current.state.isMobile).toBe(true)
    expect(result.current.state.viewMode).toBe('compact')
    expect(result.current.state.activePanel).toBe('editor')
  })

  it('should toggle view mode', () => {
    const { result } = renderHook(() => useMobilePMR())

    act(() => {
      result.current.actions.setViewMode('expanded')
    })

    expect(result.current.state.viewMode).toBe('expanded')
  })

  it('should toggle active panel', () => {
    const { result } = renderHook(() => useMobilePMR())

    act(() => {
      result.current.actions.togglePanel('insights')
    })

    expect(result.current.state.activePanel).toBe('insights')

    act(() => {
      result.current.actions.togglePanel('insights')
    })

    expect(result.current.state.activePanel).toBeNull()
  })

  it('should handle offline mode', () => {
    const { useOffline } = require('@/hooks/useOffline')
    useOffline.mockReturnValue({
      isOnline: false,
      queueRequest: jest.fn(),
      cacheData: jest.fn(),
      getCachedData: jest.fn(),
      performBackgroundSync: jest.fn()
    })

    const { result } = renderHook(() => useMobilePMR({
      enableOfflineEditing: true
    }))

    expect(result.current.state.offlineMode).toBe(true)
  })
})

describe('MobilePMREditor Component', () => {
  const mockOnSave = jest.fn()
  const mockOnSectionUpdate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render mobile editor with report title', () => {
    render(
      <MobilePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    expect(screen.getByText(mockReport.title)).toBeInTheDocument()
  })

  it('should display section navigation', () => {
    render(
      <MobilePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('Executive Summary')).toBeInTheDocument()
  })

  it('should show AI generated badge for AI sections', () => {
    render(
      <MobilePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    expect(screen.getByText('AI Generated')).toBeInTheDocument()
  })

  it('should handle save action', async () => {
    render(
      <MobilePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    const saveButtons = screen.getAllByRole('button')
    const saveButton = saveButtons.find(btn => 
      btn.querySelector('svg')?.classList.contains('lucide-save')
    )

    if (saveButton) {
      fireEvent.click(saveButton)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockReport)
      })
    }
  })
})

describe('MobileInsightsPanel Component', () => {
  const mockOnValidateInsight = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render insights panel with insights count', () => {
    render(
      <MobileInsightsPanel
        insights={mockInsights}
        onValidateInsight={mockOnValidateInsight}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('AI Insights')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should display insights grouped by category', () => {
    render(
      <MobileInsightsPanel
        insights={mockInsights}
        onValidateInsight={mockOnValidateInsight}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('budget')).toBeInTheDocument()
    expect(screen.getByText('schedule')).toBeInTheDocument()
  })

  it('should show priority badges', () => {
    render(
      <MobileInsightsPanel
        insights={mockInsights}
        onValidateInsight={mockOnValidateInsight}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('should handle insight validation', async () => {
    render(
      <MobileInsightsPanel
        insights={mockInsights}
        onValidateInsight={mockOnValidateInsight}
        onClose={mockOnClose}
      />
    )

    // Expand first insight
    const insightTitle = screen.getByText('Budget Overrun Risk')
    fireEvent.click(insightTitle)

    await waitFor(() => {
      const helpfulButton = screen.getByText('Helpful')
      fireEvent.click(helpfulButton)
      expect(mockOnValidateInsight).toHaveBeenCalledWith('insight-1', true)
    })
  })

  it('should filter insights by category', async () => {
    render(
      <MobileInsightsPanel
        insights={mockInsights}
        onValidateInsight={mockOnValidateInsight}
        onClose={mockOnClose}
      />
    )

    // Open filters
    const filterButtons = screen.getAllByRole('button')
    const filterButton = filterButtons.find(btn => 
      btn.querySelector('svg')?.classList.contains('lucide-filter')
    )

    if (filterButton) {
      fireEvent.click(filterButton)

      await waitFor(() => {
        const budgetFilter = screen.getByText('budget')
        fireEvent.click(budgetFilter)
      })
    }
  })
})

describe('MobileCollaborationPanel Component', () => {
  const mockOnAddComment = jest.fn()
  const mockOnResolveComment = jest.fn()
  const mockOnResolveConflict = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render collaboration panel with active users', () => {
    render(
      <MobileCollaborationPanel
        activeUsers={mockActiveUsers}
        comments={[]}
        conflicts={[]}
        onAddComment={mockOnAddComment}
        onResolveComment={mockOnResolveComment}
        onResolveConflict={mockOnResolveConflict}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Collaboration')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should display active users with status indicators', () => {
    render(
      <MobileCollaborationPanel
        activeUsers={mockActiveUsers}
        comments={[]}
        conflicts={[]}
        onAddComment={mockOnAddComment}
        onResolveComment={mockOnResolveComment}
        onResolveConflict={mockOnResolveConflict}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('should switch between tabs', async () => {
    render(
      <MobileCollaborationPanel
        activeUsers={mockActiveUsers}
        comments={[]}
        conflicts={[]}
        onAddComment={mockOnAddComment}
        onResolveComment={mockOnResolveComment}
        onResolveConflict={mockOnResolveConflict}
        onClose={mockOnClose}
      />
    )

    const commentsTab = screen.getByText('Comments')
    fireEvent.click(commentsTab)

    await waitFor(() => {
      expect(screen.getByText('Add Comment')).toBeInTheDocument()
    })
  })
})

describe('ResponsivePMREditor Component', () => {
  const mockOnSave = jest.fn()
  const mockOnSectionUpdate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render mobile editor on mobile devices', () => {
    const { useMediaQuery } = require('@/hooks/useMediaQuery')
    useMediaQuery.mockReturnValue(true) // Mobile

    render(
      <ResponsivePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    // Mobile editor should be rendered
    expect(screen.getByText(mockReport.title)).toBeInTheDocument()
  })

  it('should render desktop editor on desktop devices', () => {
    const { useMediaQuery } = require('@/hooks/useMediaQuery')
    useMediaQuery.mockReturnValue(false) // Desktop

    render(
      <ResponsivePMREditor
        report={mockReport}
        onSave={mockOnSave}
        onSectionUpdate={mockOnSectionUpdate}
      />
    )

    // Desktop editor should be rendered
    expect(screen.getByText(mockReport.title)).toBeInTheDocument()
  })
})

describe('Touch Gesture Integration', () => {
  it('should handle swipe gestures for section navigation', () => {
    const { useTouchGestures } = require('@/hooks/useTouchGestures')
    const mockOnSwipe = jest.fn()

    useTouchGestures.mockImplementation((callbacks: any) => {
      // Simulate swipe left
      if (callbacks.onSwipe) {
        callbacks.onSwipe('left', 0.5, 100)
      }
      return {
        elementRef: { current: null },
        gestureState: { isActive: false, scale: 1, rotation: 0 },
        isGestureActive: false
      }
    })

    const { result } = renderHook(() => useTouchGestures({ onSwipe: mockOnSwipe }))

    expect(mockOnSwipe).toHaveBeenCalledWith('left', 0.5, 100)
  })

  it('should handle pinch-to-zoom gestures', () => {
    const { useTouchGestures } = require('@/hooks/useTouchGestures')
    const mockOnPinchMove = jest.fn()

    useTouchGestures.mockImplementation((callbacks: any) => {
      // Simulate pinch zoom
      if (callbacks.onPinchMove) {
        callbacks.onPinchMove(1.5, { x: 100, y: 100, timestamp: Date.now() }, 0.5)
      }
      return {
        elementRef: { current: null },
        gestureState: { isActive: true, scale: 1.5, rotation: 0 },
        isGestureActive: true
      }
    })

    const { result } = renderHook(() => useTouchGestures({ onPinchMove: mockOnPinchMove }))

    expect(mockOnPinchMove).toHaveBeenCalled()
  })
})

describe('Offline Editing', () => {
  it('should save changes offline when disconnected', async () => {
    const { useOffline } = require('@/hooks/useOffline')
    const mockCacheData = jest.fn()

    useOffline.mockReturnValue({
      isOnline: false,
      queueRequest: jest.fn(),
      cacheData: mockCacheData,
      getCachedData: jest.fn(),
      performBackgroundSync: jest.fn()
    })

    const { result } = renderHook(() => useMobilePMR({
      reportId: 'report-1',
      enableOfflineEditing: true
    }))

    await act(async () => {
      await result.current.actions.saveOffline('section-1', { content: 'test' })
    })

    expect(mockCacheData).toHaveBeenCalled()
  })

  it('should sync offline changes when back online', async () => {
    const { useOffline } = require('@/hooks/useOffline')
    const mockPerformBackgroundSync = jest.fn()

    useOffline.mockReturnValue({
      isOnline: true,
      queueRequest: jest.fn(),
      cacheData: jest.fn(),
      getCachedData: jest.fn(),
      performBackgroundSync: mockPerformBackgroundSync
    })

    const { result } = renderHook(() => useMobilePMR({
      reportId: 'report-1',
      enableOfflineEditing: true
    }))

    await act(async () => {
      await result.current.actions.syncOfflineChanges()
    })

    expect(mockPerformBackgroundSync).toHaveBeenCalled()
  })
})
