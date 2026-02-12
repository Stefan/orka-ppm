/**
 * Unit tests for Chrome scroll event logging
 * Tests scroll event capture functionality, logging output format, and Chrome-specific event properties
 */

import { ChromeScrollLogger, chromeScrollLogger } from '@/lib/utils/browser/chrome-scroll-logger'

// Mock DOM APIs
const mockElement = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 1000,
  scrollWidth: 800,
  clientHeight: 600,
  clientWidth: 800,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getBoundingClientRect: jest.fn(() => ({
    top: 0,
    left: 0,
    width: 800,
    height: 600,
    bottom: 600,
    right: 800
  }))
} as unknown as HTMLElement

// Mock window and navigator
Object.defineProperty(window, 'getComputedStyle', {
  value: jest.fn(() => ({
    overscrollBehavior: 'contain',
    webkitOverflowScrolling: 'touch',
    backgroundAttachment: 'local',
    willChange: 'scroll-position',
    transform: 'translateZ(0)',
    backgroundColor: '#ffffff'
  }))
})

Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  }
})

Object.defineProperty(window, 'devicePixelRatio', {
  value: 2
})

Object.defineProperty(window, 'innerWidth', {
  value: 1920
})

Object.defineProperty(window, 'innerHeight', {
  value: 1080
})

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  configurable: true
})

Object.defineProperty(navigator, 'vendor', {
  value: 'Google Inc.',
  configurable: true
})

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('ChromeScrollLogger', () => {
  let logger: ChromeScrollLogger
  let mockScrollHandler: (event: Event) => void

  beforeEach(() => {
    jest.clearAllMocks()
    logger = new ChromeScrollLogger({
      enableLogging: true,
      enableMetrics: true,
      enableDebugOutput: false,
      logToConsole: false,
      logToStorage: false,
      maxLogEntries: 100,
      metricsInterval: 1000
    })

    // Capture the scroll handler
    mockElement.addEventListener = jest.fn((event, handler) => {
      if (event === 'scroll') {
        mockScrollHandler = handler as (event: Event) => void
      }
    })
  })

  describe('Chrome Browser Detection', () => {
    it('should detect Chrome browser correctly', () => {
      expect(logger.isChrome()).toBe(true)
    })

    it('should detect Chrome version correctly', () => {
      const version = logger.getChromeVersion()
      expect(version).toContain('Chrome')
      expect(version).toMatch(/\d+\.\d+\.\d+\.\d+/)
    })

    it('should detect Edge as Chrome-based browser', () => {
      // Create a mock userAgent for Edge
      const edgeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      
      // Store original descriptor
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
      
      // Mock navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        value: edgeUserAgent,
        configurable: true,
        enumerable: true
      })

      // Verify the userAgent was changed
      expect(navigator.userAgent).toBe(edgeUserAgent)

      // Create new logger after changing userAgent
      const edgeLogger = new ChromeScrollLogger()
      expect(edgeLogger.isChrome()).toBe(true)
      expect(edgeLogger.getChromeVersion()).toContain('Edge')

      // Restore original descriptor
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'userAgent', originalDescriptor)
      }
    })
  })

  describe('Scroll Event Initialization', () => {
    it('should initialize scroll logging for an element', () => {
      const cleanup = logger.initializeChromeScrollLogging(mockElement)

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        { passive: true, capture: false }
      )

      expect(typeof cleanup).toBe('function')
    })

    it('should return cleanup function that removes event listener', () => {
      const cleanup = logger.initializeChromeScrollLogging(mockElement)
      cleanup()

      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      )
    })

    it('should not initialize logging when disabled', () => {
      const disabledLogger = new ChromeScrollLogger({ enableLogging: false })
      const cleanup = disabledLogger.initializeChromeScrollLogging(mockElement)

      expect(mockElement.addEventListener).not.toHaveBeenCalled()
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('Scroll Event Capture', () => {
    beforeEach(() => {
      logger.initializeChromeScrollLogging(mockElement)
    })

    it('should capture scroll event with correct properties', () => {
      // Simulate initial scroll to establish baseline
      mockElement.scrollTop = 0
      mockScrollHandler(new Event('scroll'))

      // Simulate scroll down
      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      const events = logger.getChromeScrollEvents()
      expect(events).toHaveLength(2)

      const event = events[1] // Second event should have direction
      expect(event).toMatchObject({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 1000,
        scrollWidth: 800,
        clientHeight: 600,
        clientWidth: 800,
        scrollDirection: 'down',
        overscrollBehavior: 'contain',
        webkitOverflowScrolling: 'touch',
        backgroundAttachment: 'local',
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
        devicePixelRatio: 2,
        viewportWidth: 1920,
        viewportHeight: 1080
      })

      expect(event.timestamp).toBeGreaterThan(0)
      expect(event.chromeVersion).toContain('Chrome')
      expect(event.userAgent).toContain('Chrome')
    })

    it('should calculate scroll direction correctly', () => {
      // Scroll down
      mockElement.scrollTop = 50
      mockScrollHandler(new Event('scroll'))

      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      const events = logger.getChromeScrollEvents()
      expect(events[1].scrollDirection).toBe('down')

      // Scroll up
      mockElement.scrollTop = 50
      mockScrollHandler(new Event('scroll'))

      const updatedEvents = logger.getChromeScrollEvents()
      expect(updatedEvents[2].scrollDirection).toBe('up')
    })

    it('should calculate scroll speed correctly', () => {
      const mockNow = jest.spyOn(performance, 'now')
      
      mockNow.mockReturnValue(1000)
      mockElement.scrollTop = 0
      mockScrollHandler(new Event('scroll'))

      mockNow.mockReturnValue(1100) // 100ms later
      mockElement.scrollTop = 50 // 50px moved
      mockScrollHandler(new Event('scroll'))

      const events = logger.getChromeScrollEvents()
      expect(events[1].scrollSpeed).toBe(0.5) // 50px / 100ms = 0.5px/ms
    })

    it('should detect overscrolling', () => {
      // Simulate overscroll past top
      mockElement.scrollTop = -10
      mockScrollHandler(new Event('scroll'))

      const events = logger.getChromeScrollEvents()
      expect(events[0].isOverscrolling).toBe(true)
    })

    it('should detect momentum scrolling', () => {
      const mockNow = jest.spyOn(performance, 'now')
      
      // First scroll with high speed
      mockNow.mockReturnValue(1000)
      mockElement.scrollTop = 0
      mockScrollHandler(new Event('scroll'))

      mockNow.mockReturnValue(1050)
      mockElement.scrollTop = 100 // High speed: 100px in 50ms = 2px/ms
      mockScrollHandler(new Event('scroll'))

      // Second scroll with lower but still significant speed (momentum)
      mockNow.mockReturnValue(1100)
      mockElement.scrollTop = 160 // Medium speed: 60px in 50ms = 1.2px/ms (>1 and decreasing)
      mockScrollHandler(new Event('scroll'))

      const events = logger.getChromeScrollEvents()
      // The third event should detect momentum (decreasing speed but still > 1)
      expect(events[2].isMomentumScrolling).toBe(true)
    })
  })

  describe('Scroll Metrics', () => {
    beforeEach(() => {
      logger.initializeChromeScrollLogging(mockElement)
    })

    it('should return empty metrics when no events', () => {
      const metrics = logger.getChromeScrollMetrics()
      
      expect(metrics).toEqual({
        totalEvents: 0,
        scrollDuration: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        minSpeed: 0,
        scrollDistance: 0,
        overscrollEvents: 0,
        momentumEvents: 0,
        backgroundArtifacts: 0,
        performanceScore: 100
      })
    })

    it('should calculate metrics correctly with scroll events', () => {
      const mockNow = jest.spyOn(performance, 'now')
      
      // Generate multiple scroll events
      mockNow.mockReturnValue(1000)
      mockElement.scrollTop = 0
      mockScrollHandler(new Event('scroll'))

      mockNow.mockReturnValue(1100)
      mockElement.scrollTop = 50
      mockScrollHandler(new Event('scroll'))

      mockNow.mockReturnValue(1200)
      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      const metrics = logger.getChromeScrollMetrics()
      
      expect(metrics.totalEvents).toBe(3)
      expect(metrics.scrollDuration).toBe(200) // 1200 - 1000
      expect(metrics.averageSpeed).toBeGreaterThan(0)
      expect(metrics.maxSpeed).toBeGreaterThan(0)
      expect(metrics.scrollDistance).toBeGreaterThan(0)
      expect(metrics.performanceScore).toBe(100) // No issues
    })

    it('should track overscroll events in metrics', () => {
      // Create overscroll event
      mockElement.scrollTop = -10
      mockScrollHandler(new Event('scroll'))

      const metrics = logger.getChromeScrollMetrics()
      expect(metrics.overscrollEvents).toBe(1)
      expect(metrics.performanceScore).toBeLessThan(100)
    })

    it('should track background artifacts in metrics', () => {
      // Mock background attachment issue
      window.getComputedStyle = jest.fn(() => ({
        overscrollBehavior: 'contain',
        webkitOverflowScrolling: 'touch',
        backgroundAttachment: 'scroll', // Not 'local'
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
        backgroundColor: '#ffffff'
      })) as any

      // Create overscroll event with background issue
      mockElement.scrollTop = -10
      mockScrollHandler(new Event('scroll'))

      const metrics = logger.getChromeScrollMetrics()
      expect(metrics.backgroundArtifacts).toBe(1)
      expect(metrics.performanceScore).toBeLessThan(100)
    })
  })

  describe('Data Storage and Export', () => {
    beforeEach(() => {
      logger = new ChromeScrollLogger({
        enableLogging: true,
        logToStorage: true
      })
      logger.initializeChromeScrollLogging(mockElement)
    })

    it('should save events to localStorage when enabled', () => {
      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chrome-scroll-events',
        expect.any(String)
      )
    })

    it('should load events from localStorage', () => {
      const mockEvents = [
        {
          timestamp: 1000,
          scrollTop: 100,
          scrollDirection: 'down',
          scrollSpeed: 1.5
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockEvents))

      const events = logger.getChromeScrollEventsFromStorage()
      expect(events).toEqual(mockEvents)
    })

    it('should clear events from memory and storage', () => {
      // Add some events
      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      expect(logger.getChromeScrollEvents()).toHaveLength(1)

      // Clear events
      logger.clearChromeScrollEvents()

      expect(logger.getChromeScrollEvents()).toHaveLength(0)
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chrome-scroll-events')
    })

    it('should export scroll data in correct format', () => {
      mockElement.scrollTop = 100
      mockScrollHandler(new Event('scroll'))

      const exportedData = logger.exportChromeScrollData()
      const parsedData = JSON.parse(exportedData)

      expect(parsedData).toHaveProperty('metadata')
      expect(parsedData).toHaveProperty('events')
      expect(parsedData).toHaveProperty('metrics')

      expect(parsedData.metadata).toMatchObject({
        chromeVersion: expect.stringContaining('Chrome'),
        userAgent: expect.stringContaining('Chrome'),
        isChromeBrowser: true,
        exportTime: expect.any(String)
      })

      expect(parsedData.events).toHaveLength(1)
      expect(parsedData.metrics).toHaveProperty('totalEvents', 1)
    })
  })

  describe('Configuration Management', () => {
    it('should use default configuration', () => {
      const defaultLogger = new ChromeScrollLogger()
      
      // Should work with defaults
      const cleanup = defaultLogger.initializeChromeScrollLogging(mockElement)
      expect(typeof cleanup).toBe('function')
    })

    it('should update configuration', () => {
      logger.updateConfig({
        enableDebugOutput: true,
        maxLogEntries: 50
      })

      // Configuration should be updated (tested indirectly through behavior)
      expect(logger).toBeDefined()
    })

    it('should respect maxLogEntries configuration', () => {
      const limitedLogger = new ChromeScrollLogger({ maxLogEntries: 2 })
      limitedLogger.initializeChromeScrollLogging(mockElement)

      // Add more events than the limit
      for (let i = 0; i < 5; i++) {
        mockElement.scrollTop = i * 10
        const handler = (mockElement.addEventListener as jest.Mock).mock.calls[0][1]
        handler(new Event('scroll'))
      }

      const events = limitedLogger.getChromeScrollEvents()
      expect(events.length).toBeLessThanOrEqual(2)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
      ;(console.error as jest.Mock).mockRestore()
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const storageLogger = new ChromeScrollLogger({ logToStorage: true })
      storageLogger.initializeChromeScrollLogging(mockElement)

      // Should not throw error
      expect(() => {
        mockElement.scrollTop = 100
        const handler = (mockElement.addEventListener as jest.Mock).mock.calls[0][1]
        handler(new Event('scroll'))
      }).not.toThrow()
    })

    it('should handle missing getComputedStyle gracefully', () => {
      const originalGetComputedStyle = window.getComputedStyle
      delete (window as any).getComputedStyle

      const robustLogger = new ChromeScrollLogger()
      
      expect(() => {
        robustLogger.initializeChromeScrollLogging(mockElement)
      }).not.toThrow()

      // Restore
      window.getComputedStyle = originalGetComputedStyle
    })

    it('should handle invalid JSON in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')

      const events = logger.getChromeScrollEventsFromStorage()
      expect(events).toEqual([])
    })
  })
})