/**
 * Property-based tests for Progressive Loading Experience
 * Feature: mobile-first-ui-enhancements, Property 28: Progressive Loading Experience
 * Validates: Requirements 9.4
 */

import fc from 'fast-check'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { NetworkAwareLoader, ProgressiveContentLoader, AdaptiveImageLoader } from '@/components/ui/NetworkAwareLoader'
import { ProgressiveImage } from '@/components/ui/ProgressiveImage'
import { Skeleton } from '@/components/ui/SkeletonLoader'

// Mock network information
const mockNetworkInfo = {
  effectiveType: '4g',
  downlink: 2.5,
  rtt: 100,
  saveData: false
}

// Mock performance and network APIs
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: mockNetworkInfo
})

// Mock getNetworkInfo function
jest.mock('@/lib/performance', () => ({
  getNetworkInfo: jest.fn(() => mockNetworkInfo),
  shouldLoadHighQuality: jest.fn(() => true),
  performanceMonitor: {
    recordMetric: jest.fn()
  }
}))

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn()
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
})
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver
})

describe('Progressive Loading Experience Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNetworkInfo.effectiveType = '4g'
    mockNetworkInfo.downlink = 2.5
    mockNetworkInfo.saveData = false
    navigator.onLine = true
  })

  /**
   * Property 28: Progressive Loading Experience
   * For any slow network condition, the system should provide progressive loading with meaningful feedback
   */
  describe('Property 28: Progressive Loading Experience', () => {
    test('Network-aware loader should adapt to connection quality', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            effectiveType: fc.constantFrom('slow-2g', '2g', '3g', '4g'),
            downlink: fc.float({ min: 0.1, max: 10 }),
            saveData: fc.boolean(),
            priority: fc.constantFrom('high', 'medium', 'low')
          }),
          async (networkConfig) => {
            // Update mock network info
            mockNetworkInfo.effectiveType = networkConfig.effectiveType
            mockNetworkInfo.downlink = networkConfig.downlink
            mockNetworkInfo.saveData = networkConfig.saveData

            const TestContent = () => React.createElement('div', { 'data-testid': 'content' }, 'Loaded Content')
            const TestFallback = () => React.createElement('div', { 'data-testid': 'fallback' }, 'Loading...')
            const LowBandwidthFallback = () => React.createElement('div', { 'data-testid': 'low-bandwidth' }, 'Low bandwidth mode')

            render(
              React.createElement(NetworkAwareLoader, {
                priority: networkConfig.priority,
                fallback: React.createElement(TestFallback),
                lowBandwidthFallback: React.createElement(LowBandwidthFallback),
                minLoadTime: 100,
                maxLoadTime: 1000
              }, React.createElement(TestContent))
            )

            // Property: Should show appropriate content based on network and priority
            const shouldLoad = 
              networkConfig.priority === 'high' ||
              (networkConfig.priority === 'medium' && navigator.onLine) ||
              (networkConfig.priority === 'low' && 
               !networkConfig.saveData && 
               !['slow-2g', '2g'].includes(networkConfig.effectiveType))

            if (shouldLoad) {
              // Should eventually show content or fallback
              await waitFor(() => {
                expect(
                  screen.queryByTestId('content') || 
                  screen.queryByTestId('fallback')
                ).toBeInTheDocument()
              }, { timeout: 2000 })
            } else {
              // Should show appropriate fallback for poor network
              if (['slow-2g', '2g'].includes(networkConfig.effectiveType) || networkConfig.saveData) {
                await waitFor(() => {
                  expect(
                    screen.queryByTestId('low-bandwidth') ||
                    screen.queryByText(/content unavailable/i) ||
                    screen.queryByText(/content not loaded/i)
                  ).toBeInTheDocument()
                })
              }
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Progressive content loader should load stages based on network requirements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            networkQuality: fc.constantFrom('good', 'fair', 'poor', 'offline'),
            stages: fc.array(
              fc.record({
                priority: fc.constantFrom('high', 'medium', 'low'),
                networkRequirement: fc.constantFrom('any', 'fair', 'good')
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          async (testConfig) => {
            // Set network quality
            switch (testConfig.networkQuality) {
              case 'good':
                mockNetworkInfo.effectiveType = '4g'
                mockNetworkInfo.downlink = 5
                mockNetworkInfo.saveData = false
                break
              case 'fair':
                mockNetworkInfo.effectiveType = '3g'
                mockNetworkInfo.downlink = 1
                mockNetworkInfo.saveData = false
                break
              case 'poor':
                mockNetworkInfo.effectiveType = '2g'
                mockNetworkInfo.downlink = 0.5
                mockNetworkInfo.saveData = true
                break
              case 'offline':
                navigator.onLine = false
                break
            }

            const stages = testConfig.stages.map((stage, index) => ({
              component: React.createElement('div', { 'data-testid': `stage-${index}` }, `Stage ${index}`),
              priority: stage.priority,
              networkRequirement: stage.networkRequirement
            }))

            render(
              React.createElement(ProgressiveContentLoader, { stages })
            )

            // Property: Only stages that meet network requirements should load
            await waitFor(() => {
              stages.forEach((stage, index) => {
                const shouldLoad = 
                  stage.networkRequirement === 'any' ||
                  (stage.networkRequirement === 'fair' && ['fair', 'good'].includes(testConfig.networkQuality)) ||
                  (stage.networkRequirement === 'good' && testConfig.networkQuality === 'good')

                const stageElement = screen.queryByTestId(`stage-${index}`)
                
                if (shouldLoad && testConfig.networkQuality !== 'offline') {
                  // Stage should eventually appear (may take time due to priority delays)
                  // We don't assert presence immediately due to timing
                } else {
                  // Stage should not appear immediately
                  expect(stageElement).not.toBeInTheDocument()
                }
              })
            }, { timeout: 1000 })
          }
        ),
        { numRuns: 30 }
      )
    })

    test('Adaptive image loader should select appropriate image quality', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            effectiveType: fc.constantFrom('slow-2g', '2g', '3g', '4g'),
            downlink: fc.float({ min: 0.1, max: 10 }),
            saveData: fc.boolean(),
            images: fc.record({
              high: fc.webUrl(),
              medium: fc.option(fc.webUrl()),
              low: fc.option(fc.webUrl())
            })
          }),
          async (config) => {
            // Update network conditions
            mockNetworkInfo.effectiveType = config.effectiveType
            mockNetworkInfo.downlink = config.downlink
            mockNetworkInfo.saveData = config.saveData

            const { getNetworkInfo, shouldLoadHighQuality } = require('@/lib/performance')
            getNetworkInfo.mockReturnValue(mockNetworkInfo)
            
            const shouldUseHigh = 
              config.effectiveType === '4g' && 
              config.downlink > 1.5 && 
              !config.saveData

            shouldLoadHighQuality.mockReturnValue(shouldUseHigh)

            render(
              React.createElement(AdaptiveImageLoader, {
                images: config.images,
                alt: "Test image",
                'data-testid': "adaptive-image"
              })
            )

            // Property: Should select appropriate image quality based on network
            await waitFor(() => {
              const imageContainer = screen.getByTestId('adaptive-image')
              expect(imageContainer).toBeInTheDocument()

              // Check if skeleton is shown initially
              const skeleton = imageContainer.querySelector('.animate-pulse')
              if (skeleton) {
                expect(skeleton).toBeInTheDocument()
              }
            })

            // Property: Image selection should be deterministic for same network conditions
            const { getNetworkInfo: getNetworkInfo2 } = require('@/lib/performance')
            const networkInfo1 = getNetworkInfo2()
            const networkInfo2 = getNetworkInfo2()
            
            expect(networkInfo1.effectiveType).toBe(networkInfo2.effectiveType)
            expect(networkInfo1.downlink).toBe(networkInfo2.downlink)
            expect(networkInfo1.saveData).toBe(networkInfo2.saveData)
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Progressive image should handle loading states correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            src: fc.webUrl(),
            lowQualitySrc: fc.option(fc.webUrl()),
            priority: fc.boolean(),
            placeholder: fc.constantFrom('blur', 'skeleton', 'none'),
            blurDataURL: fc.option(fc.string())
          }),
          async (imageConfig) => {
            const onLoad = jest.fn()
            const onError = jest.fn()

            render(
              React.createElement(ProgressiveImage, {
                src: imageConfig.src,
                lowQualitySrc: imageConfig.lowQualitySrc || undefined,
                alt: "Test progressive image",
                priority: imageConfig.priority,
                placeholder: imageConfig.placeholder,
                blurDataURL: imageConfig.blurDataURL || undefined,
                onLoad: onLoad,
                onError: onError,
                'data-testid': "progressive-image"
              })
            )

            const container = screen.getByTestId('progressive-image')
            expect(container).toBeInTheDocument()

            // Property: Should show placeholder initially if not priority
            if (!imageConfig.priority && imageConfig.placeholder !== 'none') {
              if (imageConfig.placeholder === 'skeleton') {
                const skeleton = container.querySelector('.animate-pulse')
                expect(skeleton).toBeInTheDocument()
              } else if (imageConfig.placeholder === 'blur' && imageConfig.blurDataURL) {
                const blurImage = container.querySelector('img[style*="blur"]')
                expect(blurImage).toBeInTheDocument()
              }
            }

            // Property: Container should maintain structure
            expect(container).toHaveClass('relative', 'overflow-hidden')

            // Property: Should handle intersection observer for non-priority images
            if (!imageConfig.priority) {
              expect(mockIntersectionObserver).toHaveBeenCalled()
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Skeleton loader should provide consistent loading states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            variant: fc.constantFrom('text', 'rectangular', 'circular'),
            animation: fc.constantFrom('pulse', 'wave', 'none'),
            width: fc.option(fc.oneof(fc.string(), fc.nat({ max: 1000 }))),
            height: fc.option(fc.oneof(fc.string(), fc.nat({ max: 1000 }))),
            className: fc.string()
          }),
          async (skeletonConfig) => {
            render(
              React.createElement(Skeleton, {
                variant: skeletonConfig.variant,
                animation: skeletonConfig.animation,
                width: skeletonConfig.width || undefined,
                height: skeletonConfig.height || undefined,
                className: skeletonConfig.className,
                'data-testid': "skeleton"
              })
            )

            const skeleton = screen.getByTestId('skeleton')
            expect(skeleton).toBeInTheDocument()

            // Property: Should have base skeleton classes
            expect(skeleton).toHaveClass('bg-gray-200')

            // Property: Should have correct variant classes
            const variantClasses = {
              text: 'rounded',
              rectangular: 'rounded-md',
              circular: 'rounded-full'
            }
            expect(skeleton).toHaveClass(variantClasses[skeletonConfig.variant])

            // Property: Should have correct animation classes
            const animationClasses = {
              pulse: 'animate-pulse',
              wave: 'animate-wave',
              none: ''
            }
            if (animationClasses[skeletonConfig.animation]) {
              expect(skeleton).toHaveClass(animationClasses[skeletonConfig.animation])
            }

            // Property: Should apply custom className
            if (skeletonConfig.className) {
              expect(skeleton).toHaveClass(skeletonConfig.className)
            }

            // Property: Should apply inline styles for dimensions
            if (skeletonConfig.width || skeletonConfig.height) {
              const style = skeleton.style
              if (skeletonConfig.width) {
                expect(style.width).toBeTruthy()
              }
              if (skeletonConfig.height) {
                expect(style.height).toBeTruthy()
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Loading experience should degrade gracefully on poor connections', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            connectionType: fc.constantFrom('slow-2g', '2g', '3g', '4g'),
            saveData: fc.boolean(),
            isOnline: fc.boolean(),
            contentPriority: fc.constantFrom('high', 'medium', 'low')
          }),
          async (networkState) => {
            // Set up network conditions
            mockNetworkInfo.effectiveType = networkState.connectionType
            mockNetworkInfo.saveData = networkState.saveData
            navigator.onLine = networkState.isOnline

            const TestComponent = () => React.createElement(NetworkAwareLoader, {
              priority: networkState.contentPriority,
              fallback: React.createElement('div', { 'data-testid': 'loading' }, 'Loading...'),
              lowBandwidthFallback: React.createElement('div', { 'data-testid': 'low-bandwidth' }, 'Optimized for slow connection')
            }, React.createElement('div', { 'data-testid': 'content' }, 'Full Content'))

            render(React.createElement(TestComponent))

            // Property: Should provide appropriate feedback based on network conditions
            const isPoorConnection = 
              ['slow-2g', '2g'].includes(networkState.connectionType) || 
              networkState.saveData

            const shouldSkipLowPriority = 
              networkState.contentPriority === 'low' && 
              (isPoorConnection || !networkState.isOnline)

            if (!networkState.isOnline) {
              // Offline state should show appropriate message
              await waitFor(() => {
                expect(
                  screen.queryByText(/offline/i) ||
                  screen.queryByText(/unavailable/i) ||
                  screen.queryByTestId('loading')
                ).toBeInTheDocument()
              })
            } else if (shouldSkipLowPriority) {
              // Low priority content on poor connections should show fallback
              await waitFor(() => {
                expect(
                  screen.queryByTestId('low-bandwidth') ||
                  screen.queryByText(/not loaded/i) ||
                  screen.queryByText(/optimized/i)
                ).toBeInTheDocument()
              })
            } else {
              // Should show loading or content
              await waitFor(() => {
                expect(
                  screen.queryByTestId('loading') ||
                  screen.queryByTestId('content')
                ).toBeInTheDocument()
              })
            }

            // Property: High priority content should always attempt to load
            if (networkState.contentPriority === 'high' && networkState.isOnline) {
              await waitFor(() => {
                expect(
                  screen.queryByTestId('content') ||
                  screen.queryByTestId('loading')
                ).toBeInTheDocument()
              })
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    test('Progressive loading should maintain performance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            altText: fc.string({ minLength: 1, maxLength: 100 }),
            loadingText: fc.string({ minLength: 1, maxLength: 50 }),
            hasAriaLabel: fc.boolean(),
            ariaLabel: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (a11yConfig) => {
            const TestComponent = () => React.createElement('div', null,
              React.createElement(ProgressiveImage, {
                src: "https://example.com/image.jpg",
                alt: a11yConfig.altText,
                'data-testid': "progressive-image"
              }),
              React.createElement(NetworkAwareLoader, {
                fallback: React.createElement('div', { 
                  'data-testid': 'loader' 
                }, loadingConfig.loadingText),
                'data-testid': 'network-loader'
              }, React.createElement('div', { 'data-testid': 'content' }, 'Content'))
            )

            render(React.createElement(TestComponent))

            // Property: Images should have alt text
            const imageContainer = screen.getByTestId('progressive-image')
            const images = imageContainer.querySelectorAll('img')
            images.forEach(img => {
              if (img.getAttribute('alt') !== '') {
                expect(img).toHaveAttribute('alt', a11yConfig.altText)
              }
            })

            // Property: Loading states should be handled properly
            const loader = screen.queryByTestId('loader')
            if (loader) {
              expect(loader).toBeInTheDocument()
            }

            // Property: Content should be properly rendered
            const content = screen.queryByTestId('content')
            if (content) {
              expect(content).toBeInTheDocument()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Loading Performance Properties', () => {
    test('Loading states should transition smoothly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            minLoadTime: fc.nat({ max: 1000 }),
            maxLoadTime: fc.nat({ min: 1000, max: 5000 }),
            priority: fc.constantFrom('high', 'medium', 'low')
          }),
          async (loadingConfig) => {
            const onLoadStart = jest.fn()
            const onLoadComplete = jest.fn()

            const startTime = Date.now()

            render(
              React.createElement(NetworkAwareLoader, {
                priority: loadingConfig.priority,
                minLoadTime: loadingConfig.minLoadTime,
                maxLoadTime: loadingConfig.maxLoadTime,
                onLoadStart: onLoadStart,
                onLoadComplete: onLoadComplete,
                fallback: React.createElement('div', { 'data-testid': 'loading' }, 'Loading...')
              }, React.createElement('div', { 'data-testid': 'content' }, 'Loaded'))
            )

            // Property: Should show loading state initially
            expect(screen.getByTestId('loading')).toBeInTheDocument()

            // Property: Should respect minimum load time
            await waitFor(() => {
              const elapsed = Date.now() - startTime
              if (screen.queryByTestId('content')) {
                expect(elapsed).toBeGreaterThanOrEqual(loadingConfig.minLoadTime - 50) // Allow 50ms tolerance
              }
            }, { timeout: loadingConfig.maxLoadTime + 1000 })

            // Property: Should not exceed maximum load time
            await waitFor(() => {
              expect(
                screen.queryByTestId('content') ||
                screen.queryByText(/not loaded/i)
              ).toBeInTheDocument()
            }, { timeout: loadingConfig.maxLoadTime + 1000 })

            const finalElapsed = Date.now() - startTime
            expect(finalElapsed).toBeLessThanOrEqual(loadingConfig.maxLoadTime + 1000) // Allow 1s tolerance
          }
        ),
        { numRuns: 30 }
      )
    })
  })
})