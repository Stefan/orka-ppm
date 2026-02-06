'use client'

import React, { useEffect, useRef, useState } from 'react'
import { chromeScrollPerformanceManager, isChromeBasedBrowser } from '../../lib/utils/chrome-scroll-performance'

export default function ChromeScrollTestPage() {
  const mainContentRef = useRef<HTMLDivElement>(null)
  const [isChromeDetected, setIsChromeDetected] = useState(false)
  const [scrollMetrics, setScrollMetrics] = useState<any>(null)
  const [testResults, setTestResults] = useState<{
    backgroundConsistency: boolean
    overscrollContainment: boolean
    momentumHandling: boolean
    flexboxGaps: boolean
  }>({
    backgroundConsistency: false,
    overscrollContainment: false,
    momentumHandling: false,
    flexboxGaps: false
  })

  useEffect(() => {
    // Detect Chrome browser
    const isChrome = isChromeBasedBrowser()
    setIsChromeDetected(isChrome)

    // Apply Chrome optimizations if Chrome is detected
    if (isChrome && mainContentRef.current) {
      chromeScrollPerformanceManager.applyChromeOptimizations(mainContentRef.current)
      
      // Initialize Chrome scroll handling
      const cleanup = chromeScrollPerformanceManager.initializeChromeScrollHandling(mainContentRef.current)
      
      return cleanup
    }
    
    // Return empty cleanup function for non-Chrome browsers
    return () => {}
  }, [])

  useEffect(() => {
    // Update scroll metrics every second
    const interval = setInterval(() => {
      const metrics = chromeScrollPerformanceManager.getChromePerformanceSummary()
      setScrollMetrics(metrics)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const runTests = () => {
    if (!mainContentRef.current) return

    const element = mainContentRef.current
    const computedStyle = window.getComputedStyle(element)

    // Test 1: Background Consistency
    const backgroundColor = computedStyle.backgroundColor
    const backgroundConsistency = backgroundColor === 'rgb(255, 255, 255)' || backgroundColor === '#ffffff'

    // Test 2: Overscroll Containment
    const overscrollBehavior = computedStyle.overscrollBehavior || (computedStyle as any).webkitOverscrollBehavior
    const overscrollContainment = overscrollBehavior === 'contain'

    // Test 3: Momentum Handling (check for webkit properties)
    const webkitOverflowScrolling = (computedStyle as any).webkitOverflowScrolling
    const momentumHandling = webkitOverflowScrolling === 'touch'

    // Test 4: Flexbox Gaps (check for proper flex properties)
    const display = computedStyle.display
    const flexDirection = computedStyle.flexDirection
    const flexboxGaps = display.includes('flex') && flexDirection === 'column'

    setTestResults({
      backgroundConsistency,
      overscrollContainment,
      momentumHandling,
      flexboxGaps
    })
  }

  const scrollToBottom = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({
        top: mainContentRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const scrollToTop = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-800">
      {/* Test Header */}
      <div className="bg-blue-600 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">Chrome Scroll Black Bar Fix - Test Page</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="mb-2">
              <strong>Chrome Detected:</strong> {isChromeDetected ? '✅ Yes' : '❌ No'}
            </p>
            <p className="mb-2">
              <strong>User Agent:</strong> {typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 50) + '...' : 'N/A'}
            </p>
          </div>
          <div>
            <button
              onClick={runTests}
              className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-4 py-2 rounded mr-2 mb-2"
            >
              Run Tests
            </button>
            <button
              onClick={scrollToBottom}
              className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-4 py-2 rounded mr-2 mb-2"
            >
              Scroll to Bottom
            </button>
            <button
              onClick={scrollToTop}
              className="bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-4 py-2 rounded mb-2"
            >
              Scroll to Top
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div className="p-6 bg-gray-50 dark:bg-slate-800/50">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded ${testResults.backgroundConsistency ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
            <h3 className="font-semibold">Background Consistency</h3>
            <p>{testResults.backgroundConsistency ? '✅ Pass' : '❌ Fail'}</p>
          </div>
          <div className={`p-4 rounded ${testResults.overscrollContainment ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
            <h3 className="font-semibold">Overscroll Containment</h3>
            <p>{testResults.overscrollContainment ? '✅ Pass' : '❌ Fail'}</p>
          </div>
          <div className={`p-4 rounded ${testResults.momentumHandling ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
            <h3 className="font-semibold">Momentum Handling</h3>
            <p>{testResults.momentumHandling ? '✅ Pass' : '❌ Fail'}</p>
          </div>
          <div className={`p-4 rounded ${testResults.flexboxGaps ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
            <h3 className="font-semibold">Flexbox Layout</h3>
            <p>{testResults.flexboxGaps ? '✅ Pass' : '❌ Fail'}</p>
          </div>
        </div>

        {/* Scroll Metrics */}
        {scrollMetrics && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Scroll Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Avg Velocity:</strong> {scrollMetrics.avgVelocity.toFixed(2)}
              </div>
              <div>
                <strong>Max Velocity:</strong> {scrollMetrics.maxVelocity.toFixed(2)}
              </div>
              <div>
                <strong>Performance Score:</strong> {scrollMetrics.avgPerformanceScore.toFixed(1)}
              </div>
              <div>
                <strong>Background Consistency:</strong> {scrollMetrics.backgroundConsistencyRate.toFixed(1)}%
              </div>
              <div>
                <strong>Momentum Events:</strong> {scrollMetrics.momentumScrollEvents}
              </div>
              <div>
                <strong>Total Events:</strong> {scrollMetrics.totalScrollEvents}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - This is where we test Chrome scroll behavior */}
      <div 
        ref={mainContentRef}
        className="flex-1 min-h-screen bg-white dark:bg-slate-800 overflow-auto chrome-scroll-optimized chrome-background-coverage chrome-flex-optimized"
        style={{
          // Chrome-specific optimizations
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          backgroundAttachment: 'local',
          backgroundColor: '#ffffff',
          minHeight: '100vh',
          // Hardware acceleration
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          willChange: 'scroll-position'
        } as React.CSSProperties}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Chrome Scroll Test Content</h2>
          
          {/* Short Content Scenario */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">Test Scenario 1: Short Content</h3>
            <p className="mb-4">
              This section tests Chrome scroll behavior with content shorter than the viewport height.
              In Chrome, this scenario can cause black bars to appear when scrolling past the content boundaries.
            </p>
            <div className="bg-blue-50 p-4 rounded">
              <p>Short content that doesn't fill the viewport.</p>
              <p>Try scrolling down with momentum to test boundary handling.</p>
            </div>
          </div>

          {/* Long Content Scenario */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">Test Scenario 2: Long Content</h3>
            <p className="mb-4">
              This section provides long content to test Chrome scroll momentum and background consistency
              during normal scrolling operations.
            </p>
            
            {/* Generate long content */}
            {Array.from({ length: 50 }, (_, i) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded">
                <h4 className="font-semibold mb-2">Content Block {i + 1}</h4>
                <p>
                  This is test content block {i + 1}. It contains enough text to create a scrollable area
                  that will test Chrome's scroll momentum behavior. The background should remain consistently
                  white throughout all scroll operations, including momentum scrolling and overscroll boundaries.
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                  Watch for any black bars or background artifacts during scrolling, especially when using
                  Chrome's aggressive scroll momentum or when reaching scroll boundaries.
                </p>
              </div>
            ))}
          </div>

          {/* Flexbox Test Scenario */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-purple-600 dark:text-purple-400">Test Scenario 3: Flexbox Layout</h3>
            <p className="mb-4">
              This section tests Chrome flexbox rendering to ensure no gaps appear that could show
              parent backgrounds during scroll operations.
            </p>
            
            <div className="flex flex-col space-y-4">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
                  <p>Flexbox item {i + 1} - No gaps should be visible between items</p>
                </div>
              ))}
            </div>
          </div>

          {/* Overscroll Test Scenario */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Test Scenario 4: Overscroll Boundaries</h3>
            <p className="mb-4">
              This is the final section. Try scrolling past this content (overscrolling) to test
              Chrome's boundary handling and ensure no black bars appear.
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded">
              <p className="font-semibold">End of Content</p>
              <p>
                Try scrolling down past this point with momentum. Chrome should contain the overscroll
                and maintain a white background without showing any black bars or parent container backgrounds.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-800 text-white p-6">
        <h2 className="text-xl font-bold mb-4">Testing Instructions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Manual Testing Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Open this page in Chrome browser</li>
              <li>Click "Run Tests" to check CSS properties</li>
              <li>Scroll down with momentum (fast scroll)</li>
              <li>Try overscrolling past content boundaries</li>
              <li>Check for any black bars or background artifacts</li>
              <li>Test on mobile Chrome if available</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What to Look For:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>✅ Consistent white background during all scroll states</li>
              <li>✅ No black bars during momentum scrolling</li>
              <li>✅ Proper overscroll containment at boundaries</li>
              <li>✅ Smooth scroll performance without artifacts</li>
              <li>❌ Any dark/black backgrounds showing through</li>
              <li>❌ Layout gaps or background inconsistencies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}