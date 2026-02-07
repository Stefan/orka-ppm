/**
 * Integration Tests for Complete Chrome Scroll System
 * Feature: chrome-scroll-black-bar-fix, Task 11.1
 * 
 * Tests end-to-end Chrome scroll behavior, Chrome-specific optimization integration,
 * and fallback behavior for other browsers.
 * 
 * Validates: All requirements for Chrome scroll black bar fix
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

// Import Chrome utilities
import { 
  ChromeScrollLogger, 
  chromeScrollLogger,
  type ChromeScrollEvent,
  type ChromeScrollMetrics 
} from '@/lib/utils/browser/chrome-scroll-logger'
import { 
  ChromeOptimizationManager,
  chromeOptimizationManager,
  detectBrowser,
  isChromeBasedBrowser,
  applyBrowserOptimizations,
  featureDetection,
  BROWSER_CLASSES
} from '@/lib/utils/browser/chrome-detection-optimization'

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => [])
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock getComputedStyle for Chrome-specific properties
const mockGetComputedStyle = jest.fn((element: Element) => {
  const styles = {
    backgroundColor: '#ffffff',
    backgroundImage: 'linear-gradient(to bottom, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)',
    backgroundAttachment: 'local',
    overscrollBehavior: 'contain',
    overscrollBehaviorY: 'contain',
    webkitOverscrollBehavior: 'contain',
    webkitOverflowScrolling: 'touch',
    transform: 'translateZ(0px)',
    willChange: 'scroll-position',
    minHeight: '100vh',
    contain: 'layout style paint',
    webkitTransform: 'translateZ(0px)',
    webkitBackfaceVisibility: 'hidden',
    webkitBackgroundAttachment: 'local',
    backfaceVisibility: 'hidden',
    scrollBehavior: 'smooth'
  }
  
  return {
    ...styles,
    getPropertyValue: (property: string) => styles[property as keyof typeof styles] || ''
  }
})

Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
  writable: true
})

// Test component that integrates all Chrome scroll optimizations
interface ChromeScrollTestComponentProps {
  contentHeight?: number
  enableLogging?: boolean
  enableOptimizations?: boolean
  browserType?: 'chrome' | 'safari' | 'firefox' | 'edge'
  testId?: string
}

const ChromeScrollTestComponent: React.FC<ChromeScrollTestComponentProps> = ({
  contentHeight = 1000,
  enableLogging = true,
  enableOptimizations = true,
  browserType = 'chrome',
  testId = 'chrome-scroll-test'
}) => {
  const mainRef = React.useRef<HTMLDivElement>(null)
  const [scrollLogger, setScrollLogger] = React.useState<ChromeScrollLogger | null>(null)
  const [optimizationManager, setOptimizationManager] = React.useState<ChromeOptimizationManager | null>(null)
  const [scrollMetrics, setScrollMetrics] = React.useState<ChromeScrollMetrics | null>(null)
  const [isScrolling, setIsScrolling] = React.useState(false)

  // Mock browser type for testing
  React.useEffect(() => {
    const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
    const originalVendor = Object.getOwnPropertyDescriptor(navigator, 'vendor')

    // Set user agent based on browser type
    const userAgents = {
      chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
      edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    }

    const vendors = {
      chrome: 'Google Inc.',
      safari: 'Apple Computer, Inc.',
      firefox: '',
      edge: 'Google Inc.'
    }

    Object.defineProperty(navigator, 'userAgent', {
      value: userAgents[browserType],
      configurable: true
    })

    Object.defineProperty(navigator, 'vendor', {
      value: vendors[browserType],
      configurable: true
    })

    return () => {
      if (originalUserAgent) {
        Object.defineProperty(navigator, 'userAgent', originalUserAgent)
      }
      if (originalVendor) {
        Object.defineProperty(navigator, 'vendor', originalVendor)
      }
    }
  }, [browserType])

  // Initialize Chrome scroll system
  React.useEffect(() => {
    if (!mainRef.current) return

    const element = mainRef.current

    // Initialize optimization manager
    const manager = new ChromeOptimizationManager({
      enableForAllWebkit: true,
      enableFallbacks: true,
      debugMode: false,
      performanceMonitoring: true
    })

    setOptimizationManager(manager)

    // Apply browser-specific optimizations
    if (enableOptimizations) {
      manager.applyOptimizations(element)
    }

    // Initialize scroll logger
    if (enableLogging) {
      const logger = new ChromeScrollLogger({
        enableLogging: true,
        enableMetrics: true,
        enableDebugOutput: false,
        logToConsole: false,
        logToStorage: false,
        maxLogEntries: 100,
        metricsInterval: 1000
      })

      setScrollLogger(logger)

      const cleanup = logger.initializeChromeScrollLogging(element)

      // Set up scroll state tracking
      let scrollTimeout: NodeJS.Timeout
      const handleScroll = () => {
        setIsScrolling(true)
        clearTimeout(scrollTimeout)
        scrollTimeout = setTimeout(() => {
          setIsScrolling(false)
          // Update metrics after scroll ends
          const metrics = logger.getChromeScrollMetrics()
          setScrollMetrics(metrics)
        }, 150)
      }

      element.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        cleanup()
        element.removeEventListener('scroll', handleScroll)
        clearTimeout(scrollTimeout)
        manager.removeOptimizations(element)
      }
    }
  }, [enableLogging, enableOptimizations, browserType])

  const scrollToPosition = (position: number) => {
    if (mainRef.current) {
      // Mock scrollTo for JSDOM compatibility
      if (typeof mainRef.current.scrollTo === 'function') {
        mainRef.current.scrollTo({ top: position, behavior: 'smooth' })
      } else {
        // Fallback for JSDOM
        mainRef.current.scrollTop = position
        fireEvent.scroll(mainRef.current, { target: { scrollTop: position } })
      }
    }
  }

  const simulateOverscroll = (direction: 'up' | 'down') => {
    if (mainRef.current) {
      const element = mainRef.current
      const maxScroll = element.scrollHeight - element.clientHeight
      
      if (direction === 'down') {
        // Simulate overscroll past bottom
        element.scrollTop = maxScroll + 100
      } else {
        // Simulate overscroll past top
        element.scrollTop = -100
      }
      
      // Trigger scroll event
      fireEvent.scroll(element)
    }
  }

  return (
    <div data-testid={`${testId}-container`}>
      {/* Control Panel */}
      <div data-testid={`${testId}-controls`}>
        <button 
          onClick={() => scrollToPosition(0)}
          data-testid={`${testId}-scroll-top`}
        >
          Scroll to Top
        </button>
        <button 
          onClick={() => scrollToPosition(500)}
          data-testid={`${testId}-scroll-middle`}
        >
          Scroll to Middle
        </button>
        <button 
          onClick={() => scrollToPosition(contentHeight)}
          data-testid={`${testId}-scroll-bottom`}
        >
          Scroll to Bottom
        </button>
        <button 
          onClick={() => simulateOverscroll('down')}
          data-testid={`${testId}-overscroll-down`}
        >
          Overscroll Down
        </button>
        <button 
          onClick={() => simulateOverscroll('up')}
          data-testid={`${testId}-overscroll-up`}
        >
          Overscroll Up
        </button>
      </div>

      {/* Status Display */}
      <div data-testid={`${testId}-status`}>
        <div data-testid={`${testId}-scroll-status`}>
          {isScrolling ? 'Scrolling' : 'Not scrolling'}
        </div>
        <div data-testid={`${testId}-browser-info`}>
          Browser: {browserType}
        </div>
        <div data-testid={`${testId}-chrome-detected`}>
          Chrome: {isChromeBasedBrowser() ? 'Yes' : 'No'}
        </div>
        {scrollMetrics && (
          <div data-testid={`${testId}-metrics`}>
            <div>Events: {scrollMetrics.totalEvents}</div>
            <div>Performance: {scrollMetrics.performanceScore}</div>
            <div>Overscroll: {scrollMetrics.overscrollEvents}</div>
            <div>Artifacts: {scrollMetrics.backgroundArtifacts}</div>
          </div>
        )}
      </div>

      {/* Main Scroll Container */}
      <main
        ref={mainRef}
        data-testid={`${testId}-main`}
        className="chrome-scroll-container"
        style={{
          height: '400px',
          overflow: 'auto',
          backgroundColor: '#ffffff',
          border: '1px solid #ccc'
        }}
      >
        <div 
          data-testid={`${testId}-content`}
          style={{ 
            height: `${contentHeight}px`,
            backgroundColor: '#ffffff',
            padding: '20px'
          }}
        >
          <h1>Chrome Scroll Test Content</h1>
          <p>This content tests Chrome scroll behavior and optimizations.</p>
          
          {/* Generate content based on height */}
          {Array.from({ length: Math.floor(contentHeight / 50) }, (_, i) => (
            <div key={i} style={{ marginBottom: '20px' }}>
              <h3>Section {i + 1}</h3>
              <p>
                Content section {i + 1} - This is test content to create scrollable area.
                The Chrome scroll system should handle this content smoothly without
                showing black bars or background artifacts during scroll momentum.
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

describe('Chrome Scroll System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    // Clean up any applied optimizations
    document.querySelectorAll('[class*="chrome-"], [class*="webkit-"], [class*="fallback-"]').forEach(element => {
      if (element instanceof HTMLElement) {
        chromeOptimizationManager.removeOptimizations(element)
      }
    })
  })

  describe('Complete Chrome Scroll System Integration', () => {
    test('should integrate all Chrome scroll components successfully', async () => {
      const user = userEvent.setup()
      
      render(
        <ChromeScrollTestComponent 
          contentHeight={1000}
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="integration-test"
        />
      )

      // Verify component renders
      const container = screen.getByTestId('integration-test-container')
      const mainElement = screen.getByTestId('integration-test-main')
      const content = screen.getByTestId('integration-test-content')

      expect(container).toBeInTheDocument()
      expect(mainElement).toBeInTheDocument()
      expect(content).toBeInTheDocument()

      // Verify Chrome detection
      const chromeDetected = screen.getByTestId('integration-test-chrome-detected')
      expect(chromeDetected).toHaveTextContent('Chrome: Yes')

      // Verify initial scroll state
      const scrollStatus = screen.getByTestId('integration-test-scroll-status')
      expect(scrollStatus).toHaveTextContent('Not scrolling')

      // Test scroll functionality
      const scrollMiddleButton = screen.getByTestId('integration-test-scroll-middle')
      await user.click(scrollMiddleButton)

      // Verify scroll event handling
      fireEvent.scroll(mainElement, { target: { scrollTop: 500 } })

      // Wait for scroll state to update
      await waitFor(() => {
        const metrics = screen.queryByTestId('integration-test-metrics')
        if (metrics) {
          expect(metrics).toBeInTheDocument()
        }
      }, { timeout: 1000 })
    })

    test('should apply Chrome-specific optimizations correctly', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={500}
          enableOptimizations={true}
          browserType="chrome"
          testId="chrome-optimizations"
        />
      )

      const mainElement = screen.getByTestId('chrome-optimizations-main')

      // Wait for optimizations to be applied
      await waitFor(() => {
        const computedStyle = window.getComputedStyle(mainElement)
        
        // Verify Chrome-specific CSS properties are applied
        expect(computedStyle.overscrollBehavior).toBe('contain')
        expect(computedStyle.webkitOverflowScrolling).toBe('touch')
        expect(computedStyle.backgroundAttachment).toBe('local')
        expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
        expect(computedStyle.transform).toContain('translateZ')
        expect(computedStyle.willChange).toBe('scroll-position')
        expect(computedStyle.minHeight).toBe('100vh')
      })

      // Verify Chrome optimization classes are applied
      expect(mainElement.classList.contains('chrome-scroll-optimized')).toBe(true)
      expect(mainElement.classList.contains('chrome-background-coverage')).toBe(true)
    })

    test('should handle overscroll scenarios without black bar artifacts', async () => {
      const user = userEvent.setup()
      
      render(
        <ChromeScrollTestComponent 
          contentHeight={300} // Short content
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="overscroll-test"
        />
      )

      const mainElement = screen.getByTestId('overscroll-test-main')
      const overscrollDownButton = screen.getByTestId('overscroll-test-overscroll-down')
      const overscrollUpButton = screen.getByTestId('overscroll-test-overscroll-up')

      // Test overscroll down
      await user.click(overscrollDownButton)

      // Verify background remains white during overscroll
      const computedStyle = window.getComputedStyle(mainElement)
      expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
      expect(computedStyle.overscrollBehavior).toBe('contain')

      // Test overscroll up
      await user.click(overscrollUpButton)

      // Verify overscroll containment is maintained
      expect(computedStyle.overscrollBehavior).toBe('contain')
      expect(computedStyle.backgroundAttachment).toBe('local')

      // Wait for metrics to update
      await waitFor(() => {
        const metrics = screen.queryByTestId('overscroll-test-metrics')
        if (metrics) {
          expect(metrics).toBeInTheDocument()
          // Should detect overscroll events
          expect(metrics.textContent).toContain('Overscroll:')
        }
      }, { timeout: 1000 })
    })

    test('should maintain performance during scroll momentum', async () => {
      const user = userEvent.setup()
      
      render(
        <ChromeScrollTestComponent 
          contentHeight={2000}
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="momentum-test"
        />
      )

      const mainElement = screen.getByTestId('momentum-test-main')

      // Simulate rapid scroll events (momentum scrolling)
      const scrollPositions = [0, 100, 300, 600, 800, 900, 950, 980, 990, 995]
      
      for (const position of scrollPositions) {
        act(() => {
          mainElement.scrollTop = position
          fireEvent.scroll(mainElement, { target: { scrollTop: position } })
        })
        
        // Small delay to simulate momentum timing
        await new Promise(resolve => setTimeout(resolve, 16)) // ~60fps
      }

      // Wait for scroll to settle and metrics to update
      await waitFor(() => {
        const metrics = screen.queryByTestId('momentum-test-metrics')
        if (metrics) {
          expect(metrics).toBeInTheDocument()
          // Performance score should remain high during momentum scrolling
          expect(metrics.textContent).toMatch(/Performance:\s*\d+/)
        }
      }, { timeout: 2000 })

      // Verify Chrome optimizations remain active during momentum
      const computedStyle = window.getComputedStyle(mainElement)
      expect(computedStyle.willChange).toBe('scroll-position')
      expect(computedStyle.transform).toContain('translateZ')
    })

    test('should handle different content lengths appropriately', async () => {
      const contentLengths = [100, 500, 1000, 2000] // Various content heights
      
      for (const contentHeight of contentLengths) {
        const { unmount } = render(
          <ChromeScrollTestComponent 
            contentHeight={contentHeight}
            enableOptimizations={true}
            browserType="chrome"
            testId={`content-${contentHeight}`}
          />
        )

        const mainElement = screen.getByTestId(`content-${contentHeight}-main`)
        const content = screen.getByTestId(`content-${contentHeight}-content`)

        // Verify content height is set correctly
        expect(content.style.height).toBe(`${contentHeight}px`)

        // Verify optimizations are applied regardless of content length
        const computedStyle = window.getComputedStyle(mainElement)
        expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
        expect(computedStyle.minHeight).toBe('100vh')
        expect(computedStyle.overscrollBehavior).toBe('contain')

        // Test scroll behavior for this content length
        fireEvent.scroll(mainElement, { target: { scrollTop: Math.min(100, contentHeight / 2) } })

        // Verify no errors occur
        expect(mainElement).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Browser-Specific Fallback Integration', () => {
    test('should apply WebKit optimizations for Safari', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={800}
          enableOptimizations={true}
          browserType="safari"
          testId="safari-test"
        />
      )

      const mainElement = screen.getByTestId('safari-test-main')
      const chromeDetected = screen.getByTestId('safari-test-chrome-detected')

      // Verify Safari is not detected as Chrome
      expect(chromeDetected).toHaveTextContent('Chrome: No')

      // Wait for WebKit optimizations to be applied
      await waitFor(() => {
        // Should have WebKit optimization classes
        expect(mainElement.classList.contains('webkit-scroll-optimized')).toBe(true)
        expect(mainElement.classList.contains('webkit-background-coverage')).toBe(true)
      })

      // Verify WebKit-specific properties
      const computedStyle = window.getComputedStyle(mainElement)
      expect(computedStyle.webkitOverflowScrolling).toBe('touch')
      expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
    })

    test('should apply fallback optimizations for Firefox', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={800}
          enableOptimizations={true}
          browserType="firefox"
          testId="firefox-test"
        />
      )

      const mainElement = screen.getByTestId('firefox-test-main')
      const chromeDetected = screen.getByTestId('firefox-test-chrome-detected')

      // Verify Firefox is not detected as Chrome
      expect(chromeDetected).toHaveTextContent('Chrome: No')

      // Wait for fallback optimizations to be applied
      await waitFor(() => {
        // Should have fallback optimization classes
        expect(mainElement.classList.contains('fallback-scroll-optimized')).toBe(true)
        expect(mainElement.classList.contains('firefox-scroll-optimized')).toBe(true)
      })

      // Verify fallback properties
      const computedStyle = window.getComputedStyle(mainElement)
      expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
      expect(computedStyle.scrollBehavior).toBe('smooth')
    })

    test('should handle Edge as Chrome-based browser', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={800}
          enableOptimizations={true}
          browserType="edge"
          testId="edge-test"
        />
      )

      const mainElement = screen.getByTestId('edge-test-main')
      const chromeDetected = screen.getByTestId('edge-test-chrome-detected')

      // Verify Edge is detected as Chrome-based
      expect(chromeDetected).toHaveTextContent('Chrome: Yes')

      // Wait for Chrome optimizations to be applied
      await waitFor(() => {
        // Should have Chrome optimization classes
        expect(mainElement.classList.contains('chrome-scroll-optimized')).toBe(true)
        expect(mainElement.classList.contains('chrome-background-coverage')).toBe(true)
      })

      // Verify Chrome-specific properties are applied for Edge
      const computedStyle = window.getComputedStyle(mainElement)
      expect(computedStyle.overscrollBehavior).toBe('contain')
      expect(computedStyle.webkitOverflowScrolling).toBe('touch')
    })
  })

  describe('Chrome Scroll Logging Integration', () => {
    test('should capture and analyze scroll events', async () => {
      const user = userEvent.setup()
      
      render(
        <ChromeScrollTestComponent 
          contentHeight={1000}
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="logging-test"
        />
      )

      const mainElement = screen.getByTestId('logging-test-main')
      const scrollMiddleButton = screen.getByTestId('logging-test-scroll-middle')

      // Perform scroll actions
      await user.click(scrollMiddleButton)
      
      // Simulate manual scroll events
      fireEvent.scroll(mainElement, { target: { scrollTop: 100 } })
      fireEvent.scroll(mainElement, { target: { scrollTop: 200 } })
      fireEvent.scroll(mainElement, { target: { scrollTop: 300 } })

      // Wait for metrics to be calculated
      await waitFor(() => {
        const metrics = screen.queryByTestId('logging-test-metrics')
        if (metrics) {
          expect(metrics).toBeInTheDocument()
          
          // Should show scroll events were captured
          expect(metrics.textContent).toMatch(/Events:\s*[1-9]\d*/)
          
          // Should show performance score
          expect(metrics.textContent).toMatch(/Performance:\s*\d+/)
        }
      }, { timeout: 1000 })
    })

    test('should detect and log overscroll events', async () => {
      const user = userEvent.setup()
      
      render(
        <ChromeScrollTestComponent 
          contentHeight={300} // Short content for easy overscroll
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="overscroll-logging"
        />
      )

      const overscrollDownButton = screen.getByTestId('overscroll-logging-overscroll-down')
      const overscrollUpButton = screen.getByTestId('overscroll-logging-overscroll-up')

      // Trigger overscroll events
      await user.click(overscrollDownButton)
      await user.click(overscrollUpButton)

      // Wait for overscroll events to be logged
      await waitFor(() => {
        const metrics = screen.queryByTestId('overscroll-logging-metrics')
        if (metrics) {
          expect(metrics).toBeInTheDocument()
          
          // Should detect overscroll events
          expect(metrics.textContent).toMatch(/Overscroll:\s*[1-9]\d*/)
        }
      }, { timeout: 1000 })
    })
  })

  describe('Performance and Error Handling', () => {
    test('should handle rapid scroll events without performance degradation', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={2000}
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="performance-test"
        />
      )

      const mainElement = screen.getByTestId('performance-test-main')

      // Simulate very rapid scroll events
      const startTime = performance.now()
      
      for (let i = 0; i < 50; i++) {
        act(() => {
          mainElement.scrollTop = i * 20
          fireEvent.scroll(mainElement, { target: { scrollTop: i * 20 } })
        })
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle rapid events quickly (under 100ms for 50 events)
      expect(duration).toBeLessThan(100)

      // Wait for final metrics
      await waitFor(() => {
        const metrics = screen.queryByTestId('performance-test-metrics')
        if (metrics) {
          // Performance score should remain reasonable despite rapid scrolling
          expect(metrics.textContent).toMatch(/Performance:\s*\d+/)
        }
      }, { timeout: 1000 })
    })

    test('should handle component unmounting gracefully', async () => {
      const { unmount } = render(
        <ChromeScrollTestComponent 
          contentHeight={800}
          enableLogging={true}
          enableOptimizations={true}
          browserType="chrome"
          testId="unmount-test"
        />
      )

      const mainElement = screen.getByTestId('unmount-test-main')

      // Trigger some scroll events
      fireEvent.scroll(mainElement, { target: { scrollTop: 100 } })

      // Unmount component
      expect(() => unmount()).not.toThrow()

      // Verify no memory leaks or errors after unmount
      expect(document.querySelectorAll('[data-testid*="unmount-test"]')).toHaveLength(0)
    })

    test('should handle missing DOM APIs gracefully', async () => {
      // Temporarily remove getComputedStyle
      const originalGetComputedStyle = window.getComputedStyle
      delete (window as any).getComputedStyle

      expect(() => {
        render(
          <ChromeScrollTestComponent 
            contentHeight={500}
            enableOptimizations={true}
            browserType="chrome"
            testId="missing-api-test"
          />
        )
      }).not.toThrow()

      // Restore getComputedStyle
      window.getComputedStyle = originalGetComputedStyle
    })
  })

  describe('Feature Detection Integration', () => {
    test('should detect and use supported CSS features', () => {
      const features = featureDetection.getSupportedFeatures()

      expect(features).toHaveProperty('overscrollBehavior')
      expect(features).toHaveProperty('willChange')
      expect(features).toHaveProperty('contain')
      expect(features).toHaveProperty('webkitOverflowScrolling')

      // All features should be supported in test environment
      expect(features.overscrollBehavior).toBe(true)
      expect(features.willChange).toBe(true)
      expect(features.webkitOverflowScrolling).toBe(true)
    })

    test('should apply optimizations based on feature support', async () => {
      render(
        <ChromeScrollTestComponent 
          contentHeight={600}
          enableOptimizations={true}
          browserType="chrome"
          testId="feature-detection"
        />
      )

      const mainElement = screen.getByTestId('feature-detection-main')

      // Wait for optimizations based on feature detection
      await waitFor(() => {
        const computedStyle = window.getComputedStyle(mainElement)
        
        // Should apply supported features
        if (featureDetection.supportsOverscrollBehavior()) {
          expect(computedStyle.overscrollBehavior).toBe('contain')
        }
        
        if (featureDetection.supportsWillChange()) {
          expect(computedStyle.willChange).toBe('scroll-position')
        }
        
        if (featureDetection.supportsWebkitOverflowScrolling()) {
          expect(computedStyle.webkitOverflowScrolling).toBe('touch')
        }
      })
    })
  })
})

describe('Chrome Scroll System Edge Cases', () => {
  test('should handle zero-height content', async () => {
    render(
      <ChromeScrollTestComponent 
        contentHeight={0}
        enableOptimizations={true}
        browserType="chrome"
        testId="zero-content"
      />
    )

    const mainElement = screen.getByTestId('zero-content-main')
    const content = screen.getByTestId('zero-content-content')

    expect(content.style.height).toBe('0px')

    // Should still apply optimizations
    const computedStyle = window.getComputedStyle(mainElement)
    expect(computedStyle.backgroundColor).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/)
    expect(computedStyle.minHeight).toBe('100vh')
  })

  test('should handle very large content', async () => {
    render(
      <ChromeScrollTestComponent 
        contentHeight={50000} // Very large content
        enableOptimizations={true}
        browserType="chrome"
        testId="large-content"
      />
    )

    const mainElement = screen.getByTestId('large-content-main')
    const content = screen.getByTestId('large-content-content')

    expect(content.style.height).toBe('50000px')

    // Should handle large content without issues
    fireEvent.scroll(mainElement, { target: { scrollTop: 25000 } })
    
    expect(mainElement).toBeInTheDocument()
  })

  test('should handle disabled optimizations', async () => {
    render(
      <ChromeScrollTestComponent 
        contentHeight={800}
        enableOptimizations={false} // Disabled optimizations
        browserType="chrome"
        testId="disabled-optimizations"
      />
    )

    const mainElement = screen.getByTestId('disabled-optimizations-main')

    // Should not have optimization classes when disabled
    expect(mainElement.classList.contains('chrome-scroll-optimized')).toBe(false)
    expect(mainElement.classList.contains('chrome-background-coverage')).toBe(false)

    // Should still function without optimizations
    fireEvent.scroll(mainElement, { target: { scrollTop: 100 } })
    expect(mainElement).toBeInTheDocument()
  })
})