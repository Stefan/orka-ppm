/**
 * Dashboard Layout Integration Tests
 * 
 * Tests the complete layout system to verify:
 * - Black bar issue is resolved
 * - All responsive breakpoints work correctly
 * - Scroll behavior across different content types
 * - Background color consistency
 * - Sidebar and main content interaction
 * - Mobile and desktop layouts
 * 
 * Requirements: All requirements (1.1-7.2)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { jest } from '@jest/globals'
import '@testing-library/jest-dom'
import AppLayout from '../components/shared/AppLayout'
import Sidebar from '../components/navigation/Sidebar'

// Mock Next.js router
const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
  pathname: '/dashboards',
  query: {},
  asPath: '/dashboards',
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock auth provider
const mockSession = {
  user: { id: 'test-user', email: 'test@example.com' },
  access_token: 'test-token'
}

jest.mock('../app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    loading: false,
    clearSession: jest.fn()
  })
}))

// Mock other providers and hooks
jest.mock('../app/providers/HelpChatProvider', () => ({
  HelpChatProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../hooks/useScrollPerformance', () => ({
  useScrollPerformance: () => ({
    performanceSummary: {},
    isScrolling: false
  })
}))

jest.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => false
}))

// Mock components that aren't essential for layout testing
jest.mock('../components/HelpChat', () => {
  return function MockHelpChat() {
    return <div data-testid="help-chat">Help Chat</div>
  }
})

jest.mock('../components/HelpChatToggle', () => {
  return function MockHelpChatToggle() {
    return <div data-testid="help-chat-toggle">Help Chat Toggle</div>
  }
})

jest.mock('../components/onboarding/ProactiveTips', () => {
  return function MockProactiveTips() {
    return <div data-testid="proactive-tips">Proactive Tips</div>
  }
})

jest.mock('../components/accessibility/KeyboardNavigation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FocusIndicator: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../components/accessibility/LandmarkNavigation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SkipLink: ({ children, href }: { children: React.ReactNode; href: string }) => 
    <a href={href}>{children}</a>
}))

jest.mock('../components/accessibility/ScreenReaderSupport', () => ({
  AnnouncementManager: () => <div data-testid="announcement-manager">Announcement Manager</div>
}))

jest.mock('../components/accessibility/AccessibilityThemes', () => ({
  AccessibilityProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../components/accessibility/ColorBlindnessFilters', () => {
  return function MockColorBlindnessFilters() {
    return <div data-testid="color-blindness-filters">Color Blindness Filters</div>
  }
})

// Test content component with various heights
const TestContent = ({ height = 'normal' }: { height?: 'short' | 'normal' | 'long' | 'very-long' }) => {
  const heights = {
    short: '200px',
    normal: '800px', 
    long: '1500px',
    'very-long': '3000px'
  }
  
  return (
    <div 
      data-testid="test-content"
      style={{ height: heights[height], backgroundColor: 'white' }}
      className="bg-white p-4"
    >
      <h1>Test Content</h1>
      <p>This is test content with {height} height.</p>
      {height === 'long' || height === 'very-long' ? (
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <p key={i}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Paragraph {i + 1}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

describe('Dashboard Layout Integration Tests', () => {
  // Helper function to get computed styles
  const getComputedStyle = (element: Element) => {
    return window.getComputedStyle(element)
  }

  // Helper function to simulate viewport resize
  const resizeViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    })
    
    // Trigger resize event
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }

  beforeEach(() => {
    // Reset viewport to desktop size
    resizeViewport(1024, 768)
    
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('Task 8.1: Complete Layout System Tests', () => {
    test('verifies black bar issue is resolved - main content has white background', () => {
      render(
        <AppLayout>
          <TestContent height="long" />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      expect(mainContent).toBeInTheDocument()
      
      // Check that main content has white background
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      
      // Verify computed styles
      const styles = getComputedStyle(mainContent)
      expect(styles.backgroundColor).toBe('rgb(255, 255, 255)') // white
      expect(styles.minHeight).toBe('100vh')
    })

    test('verifies layout container has white background', () => {
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Find the layout container (should have flex h-screen bg-white)
      const layoutContainer = document.querySelector('.flex.h-screen.bg-white')
      expect(layoutContainer).toBeInTheDocument()
      
      if (layoutContainer) {
        const styles = getComputedStyle(layoutContainer)
        expect(styles.backgroundColor).toBe('rgb(255, 255, 255)') // white
        expect(styles.display).toBe('flex')
      }
    })

    test('tests all responsive breakpoints - desktop (1024px+)', () => {
      resizeViewport(1024, 768)
      
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Desktop sidebar should be visible
      const sidebar = screen.getByRole('navigation')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('hidden', 'lg:flex') // hidden on mobile, flex on lg+
      
      // Main content should have proper flex layout
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('flex-1')
    })

    test('tests all responsive breakpoints - tablet (768px)', () => {
      resizeViewport(768, 1024)
      
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Should still show desktop layout at 768px
      const sidebar = screen.getByRole('navigation')
      expect(sidebar).toBeInTheDocument()
    })

    test('tests all responsive breakpoints - mobile (640px)', () => {
      // Mock mobile hook
      jest.doMock('../hooks/useMediaQuery', () => ({
        useIsMobile: () => true
      }))
      
      resizeViewport(640, 800)
      
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Mobile header should be present
      const mobileHeader = screen.getByRole('banner')
      expect(mobileHeader).toBeInTheDocument()
      
      // Menu button should be present
      const menuButton = screen.getByLabelText('Open navigation menu')
      expect(menuButton).toBeInTheDocument()
    })

    test('validates scroll behavior with short content', () => {
      render(
        <AppLayout>
          <TestContent height="short" />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Should have overflow-auto for scrolling
      expect(mainContent).toHaveClass('overflow-auto')
      
      // Should still have min-h-screen even with short content
      expect(mainContent).toHaveClass('min-h-screen')
      
      const styles = getComputedStyle(mainContent)
      expect(styles.overflowY).toBe('auto')
    })

    test('validates scroll behavior with long content', () => {
      render(
        <AppLayout>
          <TestContent height="very-long" />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Should have proper scroll classes
      expect(mainContent).toHaveClass('overflow-auto')
      expect(mainContent).toHaveClass('scrollable-container')
      expect(mainContent).toHaveClass('scroll-boundary-fix')
      
      // Should maintain white background during scroll
      expect(mainContent).toHaveClass('bg-white')
    })

    test('validates scroll behavior with different content types - text heavy', () => {
      const TextHeavyContent = () => (
        <div className="bg-white p-8">
          <h1 className="text-3xl font-bold mb-4">Text Heavy Content</h1>
          {Array.from({ length: 100 }, (_, i) => (
            <p key={i} className="mb-4 text-gray-700">
              This is paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim 
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
          ))}
        </div>
      )

      render(
        <AppLayout>
          <TextHeavyContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
    })

    test('validates scroll behavior with different content types - image heavy', () => {
      const ImageHeavyContent = () => (
        <div className="bg-white p-8">
          <h1 className="text-3xl font-bold mb-4">Image Heavy Content</h1>
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="mb-4">
              <div 
                className="w-full h-64 bg-gray-200 rounded-lg mb-2"
                style={{ backgroundColor: '#f3f4f6' }}
              >
                Placeholder Image {i + 1}
              </div>
              <p className="text-gray-700">Caption for image {i + 1}</p>
            </div>
          ))}
        </div>
      )

      render(
        <AppLayout>
          <ImageHeavyContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
    })

    test('validates scroll behavior with different content types - mixed content', () => {
      const MixedContent = () => (
        <div className="bg-white p-8">
          <h1 className="text-3xl font-bold mb-4">Mixed Content</h1>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className="mb-6">
              {i % 3 === 0 ? (
                <div className="w-full h-48 bg-blue-100 rounded-lg p-4 mb-2">
                  <h3 className="font-bold">Chart/Graph {i + 1}</h3>
                  <p>Data visualization content</p>
                </div>
              ) : i % 3 === 1 ? (
                <div className="bg-gray-50 p-4 rounded-lg mb-2">
                  <h3 className="font-bold">Table {i + 1}</h3>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-white p-2 text-center">Cell 1</div>
                    <div className="bg-white p-2 text-center">Cell 2</div>
                    <div className="bg-white p-2 text-center">Cell 3</div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 mb-2">
                  Regular text content {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              )}
            </div>
          ))}
        </div>
      )

      render(
        <AppLayout>
          <MixedContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
      expect(mainContent).toHaveClass('min-h-screen')
    })
  })

  describe('Task 8.2: Dashboard Page Specific Validation', () => {
    test('validates Portfolio Dashboard with short content', async () => {
      // Import and render the actual dashboard page
      const DashboardPage = (await import('../app/dashboards/page')).default
      
      render(<DashboardPage />)

      // Wait for the dashboard to load
      await waitFor(() => {
        expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()
      })

      // Verify main content has proper styling
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      expect(mainContent).toHaveClass('overflow-auto')
    })

    test('validates Portfolio Dashboard with various content lengths - loading state', () => {
      // Mock loading state
      jest.doMock('../app/providers/SupabaseAuthProvider', () => ({
        useAuth: () => ({
          session: mockSession,
          loading: true,
          clearSession: jest.fn()
        })
      }))

      const DashboardPage = require('../app/dashboards/page').default
      
      render(<DashboardPage />)

      // Should show loading state with proper layout
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
    })

    test('verifies sidebar and main content interaction - desktop', () => {
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const sidebar = screen.getByRole('navigation')
      const mainContent = screen.getByRole('main')

      // Sidebar should be fixed width on desktop
      expect(sidebar).toHaveClass('w-64')
      expect(sidebar).toHaveClass('h-screen')
      
      // Main content should be flex-1 to fill remaining space
      expect(mainContent).toHaveClass('flex-1')
      
      // Both should have proper backgrounds
      expect(sidebar).toHaveClass('bg-gray-800')
      expect(mainContent).toHaveClass('bg-white')
    })

    test('verifies sidebar and main content interaction - mobile', async () => {
      // Mock mobile environment
      jest.doMock('../hooks/useMediaQuery', () => ({
        useIsMobile: () => true
      }))
      
      const { rerender } = render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Force re-render to apply mobile mock
      rerender(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      // Mobile menu button should be present
      const menuButton = screen.getByLabelText('Open navigation menu')
      expect(menuButton).toBeInTheDocument()

      // Click to open mobile sidebar
      fireEvent.click(menuButton)

      await waitFor(() => {
        // Mobile sidebar should appear
        const mobileSidebar = document.querySelector('.fixed.left-0.top-0')
        expect(mobileSidebar).toBeInTheDocument()
        
        // Backdrop should be present
        const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50')
        expect(backdrop).toBeInTheDocument()
      })
    })

    test('tests mobile layout - sidebar overlay behavior', async () => {
      // Mock mobile environment
      jest.doMock('../hooks/useMediaQuery', () => ({
        useIsMobile: () => true
      }))

      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const menuButton = screen.getByLabelText('Open navigation menu')
      
      // Open sidebar
      fireEvent.click(menuButton)

      await waitFor(() => {
        // Check for backdrop
        const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50')
        expect(backdrop).toBeInTheDocument()
        
        // Click backdrop to close
        if (backdrop) {
          fireEvent.click(backdrop)
        }
      })

      // Sidebar should close (backdrop should disappear)
      await waitFor(() => {
        const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50')
        expect(backdrop).not.toBeInTheDocument()
      })
    })

    test('tests desktop layout - sidebar always visible', () => {
      resizeViewport(1200, 800)
      
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const sidebar = screen.getByRole('navigation')
      
      // Desktop sidebar should have proper classes
      expect(sidebar).toHaveClass('hidden', 'lg:flex')
      expect(sidebar).toHaveClass('w-64')
      expect(sidebar).toHaveClass('h-screen')
      expect(sidebar).toHaveClass('bg-gray-800')
      
      // Should have overflow handling
      expect(sidebar).toHaveClass('overflow-y-auto')
    })

    test('validates main content maintains white background during interactions', async () => {
      render(
        <AppLayout>
          <TestContent height="long" />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Initial state
      expect(mainContent).toHaveClass('bg-white')
      
      // Simulate scroll event
      fireEvent.scroll(mainContent, { target: { scrollY: 500 } })
      
      // Should still have white background after scroll
      expect(mainContent).toHaveClass('bg-white')
      
      // Simulate resize
      act(() => {
        resizeViewport(800, 600)
      })
      
      // Should still have white background after resize
      expect(mainContent).toHaveClass('bg-white')
    })

    test('validates layout stability during content changes', () => {
      const { rerender } = render(
        <AppLayout>
          <TestContent height="short" />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Initial state
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      
      // Change to long content
      rerender(
        <AppLayout>
          <TestContent height="very-long" />
        </AppLayout>
      )
      
      // Layout should remain stable
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      expect(mainContent).toHaveClass('overflow-auto')
    })
  })

  describe('Cross-browser Compatibility Tests', () => {
    test('validates CSS fallbacks are present', () => {
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      const layoutContainer = document.querySelector('.flex.h-screen.bg-white')
      
      // Check that critical classes are applied
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
      expect(mainContent).toHaveClass('overflow-auto')
      
      if (layoutContainer) {
        expect(layoutContainer).toHaveClass('flex')
        expect(layoutContainer).toHaveClass('h-screen')
        expect(layoutContainer).toHaveClass('bg-white')
      }
    })

    test('validates performance optimization classes are applied', () => {
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Check for performance optimization classes
      expect(mainContent).toHaveClass('main-content-optimized')
      expect(mainContent).toHaveClass('dashboard-performance')
      expect(mainContent).toHaveClass('performance-critical')
      
      const layoutContainer = document.querySelector('.layout-optimized')
      expect(layoutContainer).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('handles missing content gracefully', () => {
      render(
        <AppLayout>
          {/* No content */}
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Should still have proper styling even with no content
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('min-h-screen')
    })

    test('handles extremely long content', () => {
      const ExtremelyLongContent = () => (
        <div className="bg-white">
          {Array.from({ length: 1000 }, (_, i) => (
            <div key={i} style={{ height: '100px' }} className="border-b border-gray-200 p-4">
              Content block {i + 1}
            </div>
          ))}
        </div>
      )

      render(
        <AppLayout>
          <ExtremelyLongContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Should handle extremely long content without layout issues
      expect(mainContent).toHaveClass('bg-white')
      expect(mainContent).toHaveClass('overflow-auto')
      expect(mainContent).toHaveClass('scroll-boundary-fix')
    })

    test('handles rapid viewport changes', () => {
      render(
        <AppLayout>
          <TestContent />
        </AppLayout>
      )

      const mainContent = screen.getByRole('main')
      
      // Rapid viewport changes
      act(() => {
        resizeViewport(1200, 800) // Desktop
      })
      expect(mainContent).toHaveClass('bg-white')
      
      act(() => {
        resizeViewport(768, 1024) // Tablet
      })
      expect(mainContent).toHaveClass('bg-white')
      
      act(() => {
        resizeViewport(375, 667) // Mobile
      })
      expect(mainContent).toHaveClass('bg-white')
      
      act(() => {
        resizeViewport(1920, 1080) // Large desktop
      })
      expect(mainContent).toHaveClass('bg-white')
    })
  })
})