/**
 * Chrome Scroll Event Logger
 * Implements Requirements 8.5 for Chrome-specific scroll event capture and debugging
 */

export interface ChromeScrollEvent {
  timestamp: number
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
  scrollDirection: 'up' | 'down' | 'left' | 'right' | 'none'
  scrollSpeed: number
  scrollAcceleration: number
  overscrollBehavior: string
  webkitOverflowScrolling: string
  isOverscrolling: boolean
  isMomentumScrolling: boolean
  chromeVersion: string
  userAgent: string
  devicePixelRatio: number
  viewportWidth: number
  viewportHeight: number
  backgroundAttachment: string
  willChange: string
  transform: string
}

export interface ChromeScrollMetrics {
  totalEvents: number
  scrollDuration: number
  averageSpeed: number
  maxSpeed: number
  minSpeed: number
  scrollDistance: number
  overscrollEvents: number
  momentumEvents: number
  backgroundArtifacts: number
  performanceScore: number
}

export interface ChromeScrollLoggerConfig {
  enableLogging: boolean
  enableMetrics: boolean
  enableDebugOutput: boolean
  logToConsole: boolean
  logToStorage: boolean
  maxLogEntries: number
  metricsInterval: number
}

class ChromeScrollLogger {
  private scrollEvents: ChromeScrollEvent[] = []
  private lastScrollEvent: ChromeScrollEvent | null = null
  private scrollStartTime: number = 0
  private isScrolling: boolean = false
  private config: ChromeScrollLoggerConfig
  private chromeVersion: string
  private isChromeBrowser: boolean

  constructor(config: Partial<ChromeScrollLoggerConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableMetrics: true,
      enableDebugOutput: false,
      logToConsole: false,
      logToStorage: true,
      maxLogEntries: 1000,
      metricsInterval: 5000,
      ...config
    }

    this.chromeVersion = this.detectChromeVersion()
    this.isChromeBrowser = this.detectChromeBrowser()

    if (this.config.enableDebugOutput) {
      console.log('Chrome Scroll Logger initialized:', {
        isChrome: this.isChromeBrowser,
        version: this.chromeVersion,
        config: this.config
      })
    }
  }

  /**
   * Detect if browser is Chrome-based
   */
  private detectChromeBrowser(): boolean {
    const userAgent = navigator.userAgent
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor)
    const isEdge = /Edg/.test(userAgent)
    const isBrave = (navigator as any).brave !== undefined
    const isOpera = /OPR/.test(userAgent)
    
    return isChrome || isEdge || isBrave || isOpera
  }

  /**
   * Detect Chrome version
   */
  private detectChromeVersion(): string {
    const userAgent = navigator.userAgent
    const edgeMatch = userAgent.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/)
    const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/)
    
    if (edgeMatch) {
      return `Edge ${edgeMatch[1]}`
    } else if (chromeMatch) {
      return `Chrome ${chromeMatch[1]}`
    }
    
    return 'Unknown'
  }

  /**
   * Initialize Chrome scroll event logging for an element
   */
  initializeChromeScrollLogging(element: HTMLElement): () => void {
    if (!this.config.enableLogging) {
      return () => {}
    }

    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      if (!this.isScrolling) {
        this.isScrolling = true
        this.scrollStartTime = performance.now()
        this.onChromeScrollStart(element)
      }

      // Clear existing timeout
      clearTimeout(scrollTimeout)

      // Capture Chrome scroll event
      this.captureScrollEvent(element)

      // Set timeout to detect scroll end
      scrollTimeout = setTimeout(() => {
        this.isScrolling = false
        this.onChromeScrollEnd(element)
      }, 150)
    }

    // Add scroll listener with Chrome-specific options
    element.addEventListener('scroll', handleScroll, { 
      passive: true,
      capture: false
    })

    // Log initial state
    this.logChromeScrollState(element, 'initialization')

    // Return cleanup function
    return () => {
      element.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
      this.logChromeScrollState(element, 'cleanup')
    }
  }

  /**
   * Capture Chrome-specific scroll event data
   */
  private captureScrollEvent(element: HTMLElement) {
    const now = performance.now()
    const computedStyle = window.getComputedStyle(element)

    // Get scroll properties
    const scrollTop = element.scrollTop
    const scrollLeft = element.scrollLeft
    const scrollHeight = element.scrollHeight
    const scrollWidth = element.scrollWidth
    const clientHeight = element.clientHeight
    const clientWidth = element.clientWidth

    // Calculate scroll direction and speed
    let scrollDirection: 'up' | 'down' | 'left' | 'right' | 'none' = 'none'
    let scrollSpeed = 0
    let scrollAcceleration = 0

    if (this.lastScrollEvent) {
      const deltaY = scrollTop - this.lastScrollEvent.scrollTop
      const deltaX = scrollLeft - this.lastScrollEvent.scrollLeft
      const deltaTime = now - this.lastScrollEvent.timestamp

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        scrollDirection = deltaY > 0 ? 'down' : 'up'
      } else if (Math.abs(deltaX) > 0) {
        scrollDirection = deltaX > 0 ? 'right' : 'left'
      }

      scrollSpeed = deltaTime > 0 ? Math.sqrt(deltaY * deltaY + deltaX * deltaX) / deltaTime : 0
      
      if (this.lastScrollEvent) {
        scrollAcceleration = scrollSpeed - this.lastScrollEvent.scrollSpeed
      }
    }

    // Detect overscrolling and momentum
    const isOverscrolling = this.detectOverscrolling(element)
    const isMomentumScrolling = this.detectMomentumScrolling(scrollSpeed)

    // Create Chrome scroll event
    const chromeScrollEvent: ChromeScrollEvent = {
      timestamp: now,
      scrollTop,
      scrollLeft,
      scrollHeight,
      scrollWidth,
      clientHeight,
      clientWidth,
      scrollDirection,
      scrollSpeed,
      scrollAcceleration,
      overscrollBehavior: computedStyle.overscrollBehavior || 'auto',
      webkitOverflowScrolling: (computedStyle as any).webkitOverflowScrolling || 'auto',
      isOverscrolling,
      isMomentumScrolling,
      chromeVersion: this.chromeVersion,
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      backgroundAttachment: computedStyle.backgroundAttachment || 'scroll',
      willChange: computedStyle.willChange || 'auto',
      transform: computedStyle.transform || 'none'
    }

    // Store event
    this.scrollEvents.push(chromeScrollEvent)
    this.lastScrollEvent = chromeScrollEvent

    // Maintain max entries
    if (this.scrollEvents.length > this.config.maxLogEntries) {
      this.scrollEvents = this.scrollEvents.slice(-this.config.maxLogEntries)
    }

    // Log to console if enabled
    if (this.config.logToConsole) {
      console.log('Chrome Scroll Event:', chromeScrollEvent)
    }

    // Log to storage if enabled
    if (this.config.logToStorage) {
      this.saveToStorage(chromeScrollEvent)
    }

    // Debug output
    if (this.config.enableDebugOutput) {
      this.debugScrollEvent(chromeScrollEvent)
    }
  }

  /**
   * Detect if element is overscrolling
   */
  private detectOverscrolling(element: HTMLElement): boolean {
    const scrollTop = element.scrollTop
    const scrollHeight = element.scrollHeight
    const clientHeight = element.clientHeight

    // Check if scrolled past boundaries
    return scrollTop < 0 || scrollTop > (scrollHeight - clientHeight)
  }

  /**
   * Detect momentum scrolling based on speed patterns
   */
  private detectMomentumScrolling(currentSpeed: number): boolean {
    if (!this.lastScrollEvent) return false

    // Momentum scrolling typically shows decreasing speed over time
    const speedDecrease = this.lastScrollEvent.scrollSpeed - currentSpeed
    return speedDecrease > 0 && currentSpeed > 1
  }

  /**
   * Handle Chrome scroll start
   */
  private onChromeScrollStart(element: HTMLElement) {
    if (this.config.enableDebugOutput) {
      console.log('Chrome scroll started')
    }

    this.logChromeScrollState(element, 'scroll-start')
  }

  /**
   * Handle Chrome scroll end
   */
  private onChromeScrollEnd(element: HTMLElement) {
    const scrollDuration = performance.now() - this.scrollStartTime

    if (this.config.enableDebugOutput) {
      console.log('Chrome scroll ended', { duration: scrollDuration })
    }

    this.logChromeScrollState(element, 'scroll-end')
    
    if (this.config.enableMetrics) {
      this.logScrollMetrics()
    }
  }

  /**
   * Log Chrome scroll state for debugging
   */
  private logChromeScrollState(element: HTMLElement, phase: string) {
    if (!this.config.enableDebugOutput) return

    const computedStyle = window.getComputedStyle(element)
    
    console.log(`Chrome Scroll State [${phase}]:`, {
      overscrollBehavior: computedStyle.overscrollBehavior,
      webkitOverflowScrolling: (computedStyle as any).webkitOverflowScrolling,
      backgroundAttachment: computedStyle.backgroundAttachment,
      willChange: computedStyle.willChange,
      transform: computedStyle.transform,
      backgroundColor: computedStyle.backgroundColor,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    })
  }

  /**
   * Debug individual scroll event
   */
  private debugScrollEvent(event: ChromeScrollEvent) {
    if (event.isOverscrolling) {
      console.warn('Chrome overscroll detected:', event)
    }

    if (event.scrollSpeed > 10) {
      console.log('Chrome fast scroll:', { speed: event.scrollSpeed, direction: event.scrollDirection })
    }

    if (event.isMomentumScrolling) {
      console.log('Chrome momentum scroll:', { speed: event.scrollSpeed, acceleration: event.scrollAcceleration })
    }
  }

  /**
   * Save scroll event to local storage
   */
  private saveToStorage(event: ChromeScrollEvent) {
    try {
      const storageKey = 'chrome-scroll-events'
      const existingData = localStorage.getItem(storageKey)
      const events = existingData ? JSON.parse(existingData) : []
      
      events.push(event)
      
      // Keep only recent events
      if (events.length > this.config.maxLogEntries) {
        events.splice(0, events.length - this.config.maxLogEntries)
      }
      
      localStorage.setItem(storageKey, JSON.stringify(events))
    } catch (error) {
      console.error('Failed to save Chrome scroll event to storage:', error)
    }
  }

  /**
   * Get Chrome scroll metrics
   */
  getChromeScrollMetrics(): ChromeScrollMetrics {
    if (this.scrollEvents.length === 0) {
      return {
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
      }
    }

    const speeds = this.scrollEvents.map(e => e.scrollSpeed)
    const totalEvents = this.scrollEvents.length
    const scrollDuration = totalEvents > 1 ? 
      this.scrollEvents[this.scrollEvents.length - 1]!.timestamp - this.scrollEvents[0]!.timestamp : 0
    const averageSpeed = speeds.length > 0 ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0
    
    // Calculate total scroll distance
    let scrollDistance = 0
    for (let i = 1; i < this.scrollEvents.length; i++) {
      const prev = this.scrollEvents[i - 1]
      const curr = this.scrollEvents[i]
      if (prev && curr) {
        const deltaY = Math.abs(curr.scrollTop - prev.scrollTop)
        const deltaX = Math.abs(curr.scrollLeft - prev.scrollLeft)
        scrollDistance += Math.sqrt(deltaY * deltaY + deltaX * deltaX)
      }
    }

    const overscrollEvents = this.scrollEvents.filter(e => e.isOverscrolling).length
    const momentumEvents = this.scrollEvents.filter(e => e.isMomentumScrolling).length
    
    // Estimate background artifacts (simplified heuristic)
    const backgroundArtifacts = this.scrollEvents.filter(e => 
      e.isOverscrolling && e.backgroundAttachment !== 'local'
    ).length

    // Calculate performance score (0-100, higher is better)
    const overscrollRatio = overscrollEvents / totalEvents
    const artifactRatio = backgroundArtifacts / totalEvents
    const performanceScore = Math.max(0, 100 - (overscrollRatio * 50) - (artifactRatio * 30))

    return {
      totalEvents,
      scrollDuration,
      averageSpeed: Number(averageSpeed.toFixed(2)),
      maxSpeed: Number(maxSpeed.toFixed(2)),
      minSpeed: Number(minSpeed.toFixed(2)),
      scrollDistance: Number(scrollDistance.toFixed(2)),
      overscrollEvents,
      momentumEvents,
      backgroundArtifacts,
      performanceScore: Number(performanceScore.toFixed(1))
    }
  }

  /**
   * Log scroll performance metrics
   */
  private logScrollMetrics() {
    const metrics = this.getChromeScrollMetrics()
    
    if (this.config.enableDebugOutput) {
      console.log('Chrome Scroll Performance Metrics:', metrics)
    }

    // Log performance issues
    if (metrics.overscrollEvents > 0) {
      console.warn(`Chrome overscroll detected: ${metrics.overscrollEvents} events`)
    }

    if (metrics.backgroundArtifacts > 0) {
      console.warn(`Chrome background artifacts detected: ${metrics.backgroundArtifacts} events`)
    }

    if (metrics.performanceScore < 80) {
      console.warn(`Chrome scroll performance score low: ${metrics.performanceScore}`)
    }
  }

  /**
   * Get all Chrome scroll events
   */
  getChromeScrollEvents(): ChromeScrollEvent[] {
    return [...this.scrollEvents]
  }

  /**
   * Get Chrome scroll events from storage
   */
  getChromeScrollEventsFromStorage(): ChromeScrollEvent[] {
    try {
      const storageKey = 'chrome-scroll-events'
      const data = localStorage.getItem(storageKey)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Failed to load Chrome scroll events from storage:', error)
      return []
    }
  }

  /**
   * Clear all Chrome scroll events
   */
  clearChromeScrollEvents() {
    this.scrollEvents = []
    this.lastScrollEvent = null
    
    try {
      localStorage.removeItem('chrome-scroll-events')
    } catch (error) {
      console.error('Failed to clear Chrome scroll events from storage:', error)
    }
  }

  /**
   * Export Chrome scroll data for analysis
   */
  exportChromeScrollData(): string {
    const data = {
      metadata: {
        chromeVersion: this.chromeVersion,
        userAgent: navigator.userAgent,
        isChromeBrowser: this.isChromeBrowser,
        exportTime: new Date().toISOString(),
        config: this.config
      },
      events: this.scrollEvents,
      metrics: this.getChromeScrollMetrics()
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<ChromeScrollLoggerConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Check if browser is Chrome-based
   */
  isChrome(): boolean {
    return this.isChromeBrowser
  }

  /**
   * Get Chrome version
   */
  getChromeVersion(): string {
    return this.chromeVersion
  }
}

// Export singleton instance
export const chromeScrollLogger = new ChromeScrollLogger()

// Export class for custom instances
export { ChromeScrollLogger }