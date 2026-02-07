/**
 * Chrome-specific scroll performance optimizations
 * Implements Requirements 6.4 - Chrome scroll performance optimizations
 */

export interface ChromeScrollConfig {
  enableWillChange: boolean
  enableContainment: boolean
  enableHardwareAcceleration: boolean
  enableMomentumScrolling: boolean
  enableOverscrollContainment: boolean
  enableBackgroundOptimization: boolean
  debugMode: boolean
}

export interface ChromeScrollMetrics {
  scrollPosition: number
  scrollVelocity: number
  isScrolling: boolean
  isMomentumScrolling: boolean
  backgroundConsistency: boolean
  performanceScore: number
  timestamp: number
}

/**
 * Chrome browser detection utility
 */
export function isChromeBasedBrowser(): boolean {
  if (typeof window === 'undefined') return false
  
  const userAgent = window.navigator.userAgent
  const vendor = window.navigator.vendor
  
  // Check for Chrome-based browsers
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(vendor)
  const isEdge = /Edg/.test(userAgent)
  const isBrave = (window.navigator as any).brave !== undefined
  const isOpera = /OPR/.test(userAgent)
  
  return isChrome || isEdge || isBrave || isOpera
}

/**
 * Chrome scroll performance manager
 */
export class ChromeScrollPerformanceManager {
  private config: ChromeScrollConfig
  private metrics: ChromeScrollMetrics[] = []
  private scrollTimeout: NodeJS.Timeout | null = null
  private momentumTimeout: NodeJS.Timeout | null = null
  private lastScrollPosition = 0
  private lastScrollTime = 0
  private isScrolling = false
  private isMomentumScrolling = false

  constructor(config: Partial<ChromeScrollConfig> = {}) {
    this.config = {
      enableWillChange: true,
      enableContainment: true,
      enableHardwareAcceleration: true,
      enableMomentumScrolling: true,
      enableOverscrollContainment: true,
      enableBackgroundOptimization: true,
      debugMode: false,
      ...config
    }
  }

  /**
   * Apply Chrome-specific optimizations to an element
   */
  applyChromeOptimizations(element: HTMLElement): void {
    if (!isChromeBasedBrowser()) {
      if (this.config.debugMode) {
        console.log('Chrome optimizations skipped - not a Chrome-based browser')
      }
      return
    }

    // Check if this is a sidebar element (has gray background)
    const computedStyle = window.getComputedStyle(element)
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     computedStyle.backgroundColor === 'rgb(31, 41, 55)' ||
                     element.id === 'navigation'

    // Apply will-change properties for scroll optimization
    if (this.config.enableWillChange) {
      element.style.willChange = 'transform'
      ;(element.style as any).webkitWillChange = 'scroll-position'
    }

    // Add contain properties for layout optimization
    if (this.config.enableContainment) {
      element.style.contain = 'layout style paint'
    }

    // Enable Chrome hardware acceleration
    if (this.config.enableHardwareAcceleration) {
      element.style.webkitTransform = 'translateZ(0)'
      element.style.transform = 'translateZ(0)'
      ;(element.style as any).webkitBackfaceVisibility = 'hidden'
      element.style.backfaceVisibility = 'hidden'
    }

    // Enable Chrome momentum scrolling
    if (this.config.enableMomentumScrolling) {
      ;(element.style as any).webkitOverflowScrolling = 'touch'
    }

    // Enable overscroll containment
    if (this.config.enableOverscrollContainment) {
      ;(element.style as any).webkitOverscrollBehavior = 'contain'
      element.style.overscrollBehavior = 'contain'
      ;(element.style as any).webkitOverscrollBehaviorY = 'contain'
      element.style.overscrollBehaviorY = 'contain'
    }

    // Apply background optimization - different for sidebar vs main content
    if (this.config.enableBackgroundOptimization) {
      if (isSidebar) {
        // Sidebar: maintain gray-800 background
        element.style.backgroundColor = '#1f2937'
        element.style.backgroundAttachment = 'local'
        ;(element.style as any).webkitBackgroundAttachment = 'local'
        element.style.backgroundImage = 'linear-gradient(to bottom, #1f2937 0%, #1f2937 100%)'
      } else {
        // Main content: white background
        element.style.backgroundColor = '#ffffff'
        element.style.backgroundAttachment = 'local'
        ;(element.style as any).webkitBackgroundAttachment = 'local'
        element.style.backgroundImage = 'linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)'
      }
    }

    // Add Chrome optimization classes - different for sidebar
    if (isSidebar) {
      element.classList.add(
        'chrome-sidebar-scroll-optimized',
        'chrome-sidebar-background-consistency',
        'chrome-sidebar-scroll-state-background',
        'chrome-sidebar-momentum-artifact-prevention'
      )
    } else {
      element.classList.add(
        'chrome-scroll-performance',
        'chrome-scroll-container-performance',
        'chrome-background-consistency',
        'chrome-scroll-state-background',
        'chrome-momentum-artifact-prevention'
      )
    }

    if (this.config.debugMode) {
      console.log('Chrome scroll optimizations applied to element:', element, 'isSidebar:', isSidebar)
    }
  }

  /**
   * Initialize Chrome-specific scroll event handling
   * Implements Requirements 6.5 - Chrome scroll momentum handling
   */
  initializeChromeScrollHandling(element: HTMLElement): () => void {
    if (!isChromeBasedBrowser()) {
      return () => {} // No-op cleanup for non-Chrome browsers
    }

    const handleScroll = (event: Event) => {
      this.handleChromeScrollEvent(element, event)
    }

    const handleScrollStart = () => {
      this.handleChromeScrollStart(element)
    }

    const handleScrollEnd = () => {
      this.handleChromeScrollEnd(element)
    }

    // Chrome-specific momentum detection handlers
    const handleMomentumStart = (event: Event) => {
      this.handleChromeMomentumDetection(element, event)
    }

    const handleBoundaryScroll = () => {
      this.handleChromeScrollBoundary(element)
    }

    // Add Chrome-optimized scroll event listeners
    element.addEventListener('scroll', handleScroll, { 
      passive: true,
      capture: false 
    })

    // Add Chrome momentum detection listeners
    element.addEventListener('touchstart', handleScrollStart, { passive: true })
    element.addEventListener('touchend', handleScrollEnd, { passive: true })
    element.addEventListener('wheel', handleScrollStart, { passive: true })

    // Add Chrome-specific momentum and boundary listeners
    element.addEventListener('wheel', handleMomentumStart, { passive: true })
    element.addEventListener('touchmove', handleMomentumStart, { passive: true })
    element.addEventListener('scroll', handleBoundaryScroll, { passive: true })

    // Add Chrome overscroll listeners for boundary management
    element.addEventListener('overscroll', handleBoundaryScroll, { passive: true })

    // Cleanup function
    return () => {
      element.removeEventListener('scroll', handleScroll)
      element.removeEventListener('touchstart', handleScrollStart)
      element.removeEventListener('touchend', handleScrollEnd)
      element.removeEventListener('wheel', handleScrollStart)
      element.removeEventListener('wheel', handleMomentumStart)
      element.removeEventListener('touchmove', handleMomentumStart)
      element.removeEventListener('scroll', handleBoundaryScroll)
      element.removeEventListener('overscroll', handleBoundaryScroll)
      
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout)
      }
      if (this.momentumTimeout) {
        clearTimeout(this.momentumTimeout)
      }
    }
  }

  /**
   * Handle Chrome momentum detection
   * Implements Requirements 6.5 - Chrome momentum scroll artifact prevention
   */
  private handleChromeMomentumDetection(element: HTMLElement, event: Event): void {
    const currentTime = performance.now()
    
    // Detect high-velocity momentum scrolling
    let velocity = 0
    if (event.type === 'wheel') {
      const wheelEvent = event as WheelEvent
      velocity = Math.abs(wheelEvent.deltaY)
    } else if (event.type === 'touchmove') {
      const touchEvent = event as TouchEvent
      if (touchEvent.touches.length > 0) {
        const currentPosition = element.scrollTop
        velocity = Math.abs(currentPosition - this.lastScrollPosition) / (currentTime - this.lastScrollTime || 1)
      }
    }

    // Chrome momentum threshold detection
    const isMomentumScroll = velocity > 15 || (velocity > 8 && this.isMomentumScrolling)
    
    if (isMomentumScroll && !this.isMomentumScrolling) {
      this.isMomentumScrolling = true
      this.handleMomentumScrollStart(element)
      
      // Apply Chrome-specific momentum artifact prevention
      this.applyChromeArtifactPrevention(element)
      
      if (this.config.debugMode) {
        console.log('Chrome momentum detected:', { velocity, timestamp: currentTime })
      }
    }

    this.lastScrollTime = currentTime
  }

  /**
   * Handle Chrome scroll boundary management
   * Implements Requirements 6.5 - Chrome scroll boundary management
   */
  private handleChromeScrollBoundary(element: HTMLElement): void {
    const scrollTop = element.scrollTop
    const scrollHeight = element.scrollHeight
    const clientHeight = element.clientHeight
    const maxScroll = scrollHeight - clientHeight

    // Detect boundary conditions
    const isAtTop = scrollTop <= 0
    const isAtBottom = scrollTop >= maxScroll - 1 // Allow 1px tolerance
    const isNearTop = scrollTop <= 50
    const isNearBottom = scrollTop >= maxScroll - 50

    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Apply boundary-specific optimizations
    if (isAtTop || isAtBottom || isNearTop || isNearBottom) {
      // Ensure background consistency at boundaries
      if (isSidebar) {
        element.style.backgroundColor = '#1f2937' // gray-800
        element.style.backgroundImage = 'linear-gradient(to bottom, #1f2937 0%, #1f2937 100%)'
      } else {
        element.style.backgroundColor = '#ffffff' // white
        element.style.backgroundImage = 'linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)'
      }

      // Apply Chrome boundary containment
      element.style.overscrollBehavior = 'contain'
      ;(element.style as any).webkitOverscrollBehavior = 'contain'
      
      // Add boundary management class
      element.classList.add('chrome-boundary-active')
      
      if (this.config.debugMode) {
        console.log('Chrome boundary detected:', { 
          isAtTop, 
          isAtBottom, 
          isNearTop, 
          isNearBottom, 
          scrollTop, 
          maxScroll,
          isSidebar 
        })
      }
    } else {
      // Remove boundary class when not at boundary
      element.classList.remove('chrome-boundary-active')
    }
  }

  /**
   * Apply Chrome-specific artifact prevention
   * Implements Requirements 6.5 - Chrome momentum scroll artifact prevention
   */
  private applyChromeArtifactPrevention(element: HTMLElement): void {
    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Apply hardware acceleration for smooth momentum
    element.style.webkitTransform = 'translate3d(0, 0, 0)'
    element.style.transform = 'translate3d(0, 0, 0)'
    ;(element.style as any).webkitBackfaceVisibility = 'hidden'
    element.style.backfaceVisibility = 'hidden'

    // Force background attachment to prevent artifacts
    element.style.backgroundAttachment = 'local'
    ;(element.style as any).webkitBackgroundAttachment = 'local'

    // Ensure proper background coverage during momentum
    if (isSidebar) {
      element.style.backgroundColor = '#1f2937 !important'
      element.style.backgroundImage = 'linear-gradient(to bottom, #1f2937 0%, #1f2937 100%)'
    } else {
      element.style.backgroundColor = '#ffffff !important'
      element.style.backgroundImage = 'linear-gradient(to bottom, #ffffff 0%, #ffffff 100%)'
    }

    // Apply Chrome-specific containment
    element.style.contain = 'layout style paint'
    element.style.willChange = 'scroll-position, transform'

    // Add artifact prevention class
    element.classList.add('chrome-artifact-prevention-active')

    if (this.config.debugMode) {
      console.log('Chrome artifact prevention applied', 'isSidebar:', isSidebar)
    }
  }
  private handleChromeScrollEvent(element: HTMLElement, _event: Event): void {
    const currentTime = performance.now()
    const currentPosition = element.scrollTop
    const velocity = Math.abs(currentPosition - this.lastScrollPosition) / (currentTime - this.lastScrollTime || 1)

    // Update scroll state
    this.isScrolling = true
    
    // Detect momentum scrolling (high velocity without user input)
    if (velocity > 10 && !this.isMomentumScrolling) {
      this.isMomentumScrolling = true
      this.handleMomentumScrollStart(element)
    }

    // Clear existing timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }
    if (this.momentumTimeout) {
      clearTimeout(this.momentumTimeout)
    }

    // Set scroll end timeout
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false
      this.handleChromeScrollEnd(element)
    }, 150)

    // Set momentum end timeout
    this.momentumTimeout = setTimeout(() => {
      this.isMomentumScrolling = false
      this.handleMomentumScrollEnd(element)
    }, 300)

    // Record metrics
    const metrics: ChromeScrollMetrics = {
      scrollPosition: currentPosition,
      scrollVelocity: velocity,
      isScrolling: this.isScrolling,
      isMomentumScrolling: this.isMomentumScrolling,
      backgroundConsistency: this.checkBackgroundConsistency(element),
      performanceScore: this.calculatePerformanceScore(velocity),
      timestamp: currentTime
    }

    this.metrics.push(metrics)

    // Keep only last 100 metrics for performance
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }

    // Update last values
    this.lastScrollPosition = currentPosition
    this.lastScrollTime = currentTime

    if (this.config.debugMode) {
      console.log('Chrome scroll metrics:', metrics)
    }
  }

  /**
   * Handle Chrome scroll start
   */
  private handleChromeScrollStart(element: HTMLElement): void {
    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Optimize will-change during scroll
    if (this.config.enableWillChange) {
      element.style.willChange = 'transform'
      ;(element.style as any).webkitWillChange = 'scroll-position, transform'
    }

    // Add scrolling class for CSS optimizations
    element.classList.add('chrome-scrolling')

    // Ensure correct background color during scroll
    if (isSidebar) {
      element.style.backgroundColor = '#1f2937' // gray-800
    } else {
      element.style.backgroundColor = '#ffffff' // white
    }

    if (this.config.debugMode) {
      console.log('Chrome scroll started', 'isSidebar:', isSidebar)
    }
  }

  /**
   * Handle Chrome scroll end
   */
  private handleChromeScrollEnd(element: HTMLElement): void {
    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Reset will-change to auto for performance
    if (this.config.enableWillChange) {
      element.style.willChange = 'auto'
      ;(element.style as any).webkitWillChange = 'auto'
    }

    // Remove scrolling class
    element.classList.remove('chrome-scrolling')

    // Ensure background consistency after scroll
    if (this.config.enableBackgroundOptimization) {
      if (isSidebar) {
        element.style.backgroundColor = '#1f2937' // gray-800
      } else {
        element.style.backgroundColor = '#ffffff' // white
      }
    }

    if (this.config.debugMode) {
      console.log('Chrome scroll ended', 'isSidebar:', isSidebar)
    }
  }

  /**
   * Handle momentum scroll start
   */
  private handleMomentumScrollStart(element: HTMLElement): void {
    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Add momentum scrolling class
    element.classList.add('chrome-momentum-scrolling')

    // Optimize for momentum scrolling
    if (this.config.enableHardwareAcceleration) {
      element.style.webkitTransform = 'translate3d(0, 0, 0)'
      element.style.transform = 'translate3d(0, 0, 0)'
    }

    // Ensure correct background during momentum
    if (isSidebar) {
      element.style.backgroundColor = '#1f2937' // gray-800
    } else {
      element.style.backgroundColor = '#ffffff' // white
    }

    if (this.config.debugMode) {
      console.log('Chrome momentum scroll started', 'isSidebar:', isSidebar)
    }
  }

  /**
   * Handle momentum scroll end
   */
  private handleMomentumScrollEnd(element: HTMLElement): void {
    // Check if this is a sidebar element
    const isSidebar = element.classList.contains('bg-gray-800') || 
                     element.id === 'navigation' ||
                     element.classList.contains('chrome-sidebar-scroll-optimized')

    // Remove momentum scrolling class
    element.classList.remove('chrome-momentum-scrolling')
    
    // Remove artifact prevention class
    element.classList.remove('chrome-artifact-prevention-active')

    // Reset transforms
    element.style.webkitTransform = 'translateZ(0)'
    element.style.transform = 'translateZ(0)'

    // Reset will-change for performance
    element.style.willChange = 'auto'

    // Ensure correct background after momentum
    if (isSidebar) {
      element.style.backgroundColor = '#1f2937' // gray-800
    } else {
      element.style.backgroundColor = '#ffffff' // white
    }

    if (this.config.debugMode) {
      console.log('Chrome momentum scroll ended', 'isSidebar:', isSidebar)
    }
  }

  /**
   * Check background consistency
   */
  private checkBackgroundConsistency(element: HTMLElement): boolean {
    const computedStyle = window.getComputedStyle(element)
    const backgroundColor = computedStyle.backgroundColor
    
    // Check if background is white or transparent
    return backgroundColor === 'rgb(255, 255, 255)' || 
           backgroundColor === '#ffffff' || 
           backgroundColor === 'rgba(0, 0, 0, 0)' ||
           backgroundColor === 'transparent'
  }

  /**
   * Calculate performance score based on scroll velocity
   */
  private calculatePerformanceScore(velocity: number): number {
    // Score based on smooth scrolling (lower velocity = higher score)
    if (velocity < 5) return 100
    if (velocity < 10) return 90
    if (velocity < 20) return 80
    if (velocity < 50) return 70
    return 60
  }

  /**
   * Get Chrome scroll metrics
   */
  getChromeScrollMetrics(): ChromeScrollMetrics[] {
    return [...this.metrics]
  }

  /**
   * Get Chrome performance summary
   */
  getChromePerformanceSummary() {
    if (this.metrics.length === 0) {
      return {
        avgVelocity: 0,
        maxVelocity: 0,
        avgPerformanceScore: 100,
        backgroundConsistencyRate: 100,
        momentumScrollEvents: 0,
        totalScrollEvents: 0
      }
    }

    const velocities = this.metrics.map(m => m.scrollVelocity)
    const performanceScores = this.metrics.map(m => m.performanceScore)
    const backgroundConsistent = this.metrics.filter(m => m.backgroundConsistency).length
    const momentumEvents = this.metrics.filter(m => m.isMomentumScrolling).length

    return {
      avgVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
      maxVelocity: Math.max(...velocities),
      avgPerformanceScore: performanceScores.reduce((a, b) => a + b, 0) / performanceScores.length,
      backgroundConsistencyRate: (backgroundConsistent / this.metrics.length) * 100,
      momentumScrollEvents: momentumEvents,
      totalScrollEvents: this.metrics.length
    }
  }

  /**
   * Clear Chrome metrics
   */
  clearChromeMetrics(): void {
    this.metrics = []
  }

  /**
   * Get current Chrome scroll state
   */
  getCurrentChromeScrollState() {
    return {
      isScrolling: this.isScrolling,
      isMomentumScrolling: this.isMomentumScrolling,
      lastScrollPosition: this.lastScrollPosition,
      lastScrollTime: this.lastScrollTime
    }
  }
}

// Global Chrome scroll performance manager instance
export const chromeScrollPerformanceManager = new ChromeScrollPerformanceManager()

/**
 * Apply Chrome optimizations to multiple elements
 */
export function applyChromeOptimizationsToElements(
  elements: HTMLElement[], 
  config?: Partial<ChromeScrollConfig>
): void {
  if (!isChromeBasedBrowser()) return

  const manager = new ChromeScrollPerformanceManager(config)
  
  elements.forEach(element => {
    manager.applyChromeOptimizations(element)
  })
}

/**
 * Chrome scroll performance CSS class names
 */
export const CHROME_SCROLL_CLASSES = {
  PERFORMANCE: 'chrome-scroll-performance',
  CONTAINER_PERFORMANCE: 'chrome-scroll-container-performance',
  MAIN_CONTENT_PERFORMANCE: 'chrome-main-content-performance',
  BACKGROUND_CONSISTENCY: 'chrome-background-consistency',
  SCROLL_STATE_BACKGROUND: 'chrome-scroll-state-background',
  MOMENTUM_ARTIFACT_PREVENTION: 'chrome-momentum-artifact-prevention',
  SCROLL_EVENTS: 'chrome-scroll-events',
  SCROLLING: 'chrome-scrolling',
  MOMENTUM_SCROLLING: 'chrome-momentum-scrolling',
  MOBILE_PERFORMANCE: 'chrome-mobile-scroll-performance',
  DESKTOP_PERFORMANCE: 'chrome-desktop-scroll-performance',
  // Sidebar-specific classes
  SIDEBAR_SCROLL_OPTIMIZED: 'chrome-sidebar-scroll-optimized',
  SIDEBAR_BACKGROUND_CONSISTENCY: 'chrome-sidebar-background-consistency',
  SIDEBAR_SCROLL_STATE_BACKGROUND: 'chrome-sidebar-scroll-state-background',
  SIDEBAR_MOMENTUM_ARTIFACT_PREVENTION: 'chrome-sidebar-momentum-artifact-prevention'
} as const