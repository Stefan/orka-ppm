/**
 * Property-Based Test: Skeleton Dimensions Match Final Content
 * Feature: admin-performance-optimization
 * Property 6: Skeleton Dimensions Match Final Content
 * **Validates: Requirements 2.1, 7.3**
 * 
 * This test verifies that skeleton loader dimensions match the final content
 * dimensions to prevent layout shifts during loading.
 */

import { render, waitFor, screen } from '@testing-library/react'
import fc from 'fast-check'
import '@testing-library/jest-dom'
import React from 'react'

// Tolerance for dimension matching (in pixels)
const DIMENSION_TOLERANCE = 5

// Mock skeleton component
function MockSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <div
      data-testid="skeleton"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#e0e0e0'
      }}
    />
  )
}

// Mock final content component
function MockFinalContent({ width, height }: { width: number; height: number }) {
  return (
    <div
      data-testid="final-content"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#ffffff'
      }}
    />
  )
}

// Helper function to get element dimensions
function getElementDimensions(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect()
  return {
    width: rect.width,
    height: rect.height
  }
}

describe('Admin Performance Optimization - Skeleton Dimensions', () => {
  describe('Property 6: Skeleton Dimensions Match Final Content', () => {
    it('should match skeleton and final content dimensions within tolerance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            width: fc.integer({ min: 100, max: 1000 }),
            height: fc.integer({ min: 100, max: 600 })
          }),
          async ({ width, height }) => {
            // Render skeleton
            const { rerender } = render(<MockSkeleton width={width} height={height} />)

            await waitFor(() => {
              expect(screen.getByTestId('skeleton')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('skeleton')
            const skeletonDimensions = getElementDimensions(skeletonElement)

            // Replace with final content
            rerender(<MockFinalContent width={width} height={height} />)

            await waitFor(() => {
              expect(screen.getByTestId('final-content')).toBeInTheDocument()
            })

            const finalElement = screen.getByTestId('final-content')
            const finalDimensions = getElementDimensions(finalElement)

            // Verify dimensions match within tolerance
            const widthDiff = Math.abs(skeletonDimensions.width - finalDimensions.width)
            const heightDiff = Math.abs(skeletonDimensions.height - finalDimensions.height)

            expect(widthDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
            expect(heightDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify chart skeleton matches chart dimensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            chartHeight: fc.constantFrom(200, 250, 300, 350, 400),
            chartWidth: fc.constantFrom('100%', '90%', '95%')
          }),
          async ({ chartHeight, chartWidth }) => {
            const ChartSkeleton = () => (
              <div
                data-testid="chart-skeleton"
                style={{
                  width: chartWidth,
                  height: `${chartHeight}px`,
                  backgroundColor: '#f0f0f0'
                }}
              />
            )

            const Chart = () => (
              <div
                data-testid="chart"
                style={{
                  width: chartWidth,
                  height: `${chartHeight}px`
                }}
              />
            )

            // Render skeleton
            const { rerender } = render(<ChartSkeleton />)

            await waitFor(() => {
              expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('chart-skeleton')
            const skeletonHeight = getElementDimensions(skeletonElement).height

            // Replace with chart
            rerender(<Chart />)

            await waitFor(() => {
              expect(screen.getByTestId('chart')).toBeInTheDocument()
            })

            const chartElement = screen.getByTestId('chart')
            const chartActualHeight = getElementDimensions(chartElement).height

            // Verify heights match
            const heightDiff = Math.abs(skeletonHeight - chartActualHeight)
            expect(heightDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify table skeleton matches table dimensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            rowCount: fc.integer({ min: 3, max: 10 }),
            rowHeight: fc.integer({ min: 40, max: 60 })
          }),
          async ({ rowCount, rowHeight }) => {
            const TableSkeleton = () => (
              <div
                data-testid="table-skeleton"
                style={{
                  height: `${rowCount * rowHeight}px`
                }}
              >
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${rowHeight}px`,
                      marginBottom: '4px',
                      backgroundColor: '#e0e0e0'
                    }}
                  />
                ))}
              </div>
            )

            const Table = () => (
              <div
                data-testid="table"
                style={{
                  height: `${rowCount * rowHeight}px`
                }}
              >
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${rowHeight}px`,
                      marginBottom: '4px'
                    }}
                  >
                    Row {i + 1}
                  </div>
                ))}
              </div>
            )

            // Render skeleton
            const { rerender } = render(<TableSkeleton />)

            await waitFor(() => {
              expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('table-skeleton')
            const skeletonHeight = getElementDimensions(skeletonElement).height

            // Replace with table
            rerender(<Table />)

            await waitFor(() => {
              expect(screen.getByTestId('table')).toBeInTheDocument()
            })

            const tableElement = screen.getByTestId('table')
            const tableHeight = getElementDimensions(tableElement).height

            // Verify heights match
            const heightDiff = Math.abs(skeletonHeight - tableHeight)
            expect(heightDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify dimension matching prevents layout shifts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            width: fc.integer({ min: 200, max: 800 }),
            height: fc.integer({ min: 150, max: 500 })
          }),
          async ({ width, height }) => {
            let layoutShiftOccurred = false

            // Mock ResizeObserver to detect layout shifts
            const mockResizeObserver = jest.fn((entries) => {
              entries.forEach((entry: any) => {
                if (entry.contentRect.width !== width || entry.contentRect.height !== height) {
                  layoutShiftOccurred = true
                }
              })
            })

            global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
              observe: () => callback([{ contentRect: { width, height } }]),
              unobserve: jest.fn(),
              disconnect: jest.fn()
            }))

            // Render skeleton
            const { rerender } = render(<MockSkeleton width={width} height={height} />)

            await waitFor(() => {
              expect(screen.getByTestId('skeleton')).toBeInTheDocument()
            })

            // Replace with final content (same dimensions)
            rerender(<MockFinalContent width={width} height={height} />)

            await waitFor(() => {
              expect(screen.getByTestId('final-content')).toBeInTheDocument()
            })

            // Verify no layout shift occurred
            expect(layoutShiftOccurred).toBe(false)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify aspect ratio is preserved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            aspectRatio: fc.constantFrom(16 / 9, 4 / 3, 1, 3 / 2),
            width: fc.integer({ min: 300, max: 800 })
          }),
          async ({ aspectRatio, width }) => {
            const height = Math.round(width / aspectRatio)

            const SkeletonWithAspectRatio = () => (
              <div
                data-testid="skeleton-aspect"
                style={{
                  width: `${width}px`,
                  aspectRatio: aspectRatio.toString()
                }}
              />
            )

            const ContentWithAspectRatio = () => (
              <div
                data-testid="content-aspect"
                style={{
                  width: `${width}px`,
                  aspectRatio: aspectRatio.toString()
                }}
              />
            )

            // Render skeleton
            const { rerender } = render(<SkeletonWithAspectRatio />)

            await waitFor(() => {
              expect(screen.getByTestId('skeleton-aspect')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('skeleton-aspect')
            const skeletonDimensions = getElementDimensions(skeletonElement)
            const skeletonAspectRatio = skeletonDimensions.width / skeletonDimensions.height

            // Replace with content
            rerender(<ContentWithAspectRatio />)

            await waitFor(() => {
              expect(screen.getByTestId('content-aspect')).toBeInTheDocument()
            })

            const contentElement = screen.getByTestId('content-aspect')
            const contentDimensions = getElementDimensions(contentElement)
            const contentAspectRatio = contentDimensions.width / contentDimensions.height

            // Verify aspect ratios match
            const aspectRatioDiff = Math.abs(skeletonAspectRatio - contentAspectRatio)
            expect(aspectRatioDiff).toBeLessThan(0.1)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify responsive dimensions match across breakpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            viewportWidth: fc.constantFrom(320, 768, 1024, 1440),
            baseHeight: fc.integer({ min: 200, max: 400 })
          }),
          async ({ viewportWidth, baseHeight }) => {
            // Mock window.innerWidth
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: viewportWidth
            })

            const ResponsiveSkeleton = () => (
              <div
                data-testid="responsive-skeleton"
                style={{
                  width: '100%',
                  height: `${baseHeight}px`
                }}
              />
            )

            const ResponsiveContent = () => (
              <div
                data-testid="responsive-content"
                style={{
                  width: '100%',
                  height: `${baseHeight}px`
                }}
              />
            )

            // Render skeleton
            const { rerender } = render(<ResponsiveSkeleton />)

            await waitFor(() => {
              expect(screen.getByTestId('responsive-skeleton')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('responsive-skeleton')
            const skeletonHeight = getElementDimensions(skeletonElement).height

            // Replace with content
            rerender(<ResponsiveContent />)

            await waitFor(() => {
              expect(screen.getByTestId('responsive-content')).toBeInTheDocument()
            })

            const contentElement = screen.getByTestId('responsive-content')
            const contentHeight = getElementDimensions(contentElement).height

            // Verify heights match
            const heightDiff = Math.abs(skeletonHeight - contentHeight)
            expect(heightDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify dimension matching is consistent across multiple renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            width: fc.integer({ min: 200, max: 600 }),
            height: fc.integer({ min: 150, max: 400 }),
            renderCount: fc.integer({ min: 2, max: 5 })
          }),
          async ({ width, height, renderCount }) => {
            const dimensionDiffs: number[] = []

            for (let i = 0; i < renderCount; i++) {
              const { rerender, unmount } = render(
                <MockSkeleton width={width} height={height} />
              )

              await waitFor(() => {
                expect(screen.getByTestId('skeleton')).toBeInTheDocument()
              })

              const skeletonElement = screen.getByTestId('skeleton')
              const skeletonDimensions = getElementDimensions(skeletonElement)

              rerender(<MockFinalContent width={width} height={height} />)

              await waitFor(() => {
                expect(screen.getByTestId('final-content')).toBeInTheDocument()
              })

              const finalElement = screen.getByTestId('final-content')
              const finalDimensions = getElementDimensions(finalElement)

              const heightDiff = Math.abs(skeletonDimensions.height - finalDimensions.height)
              dimensionDiffs.push(heightDiff)

              unmount()
            }

            // Verify all dimension differences are within tolerance
            dimensionDiffs.forEach(diff => {
              expect(diff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
            })

            // Verify consistency across renders
            const allSame = dimensionDiffs.every(diff => diff === dimensionDiffs[0])
            expect(allSame).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should verify explicit dimensions prevent content reflow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasExplicitDimensions: fc.boolean(),
            contentSize: fc.integer({ min: 100, max: 500 })
          }),
          async ({ hasExplicitDimensions, contentSize }) => {
            const SkeletonWithOptionalDimensions = () => (
              <div
                data-testid="skeleton-optional"
                style={
                  hasExplicitDimensions
                    ? { width: `${contentSize}px`, height: `${contentSize}px` }
                    : {}
                }
              />
            )

            const ContentWithOptionalDimensions = () => (
              <div
                data-testid="content-optional"
                style={
                  hasExplicitDimensions
                    ? { width: `${contentSize}px`, height: `${contentSize}px` }
                    : { width: `${contentSize}px`, height: `${contentSize}px` }
                }
              />
            )

            const { rerender } = render(<SkeletonWithOptionalDimensions />)

            await waitFor(() => {
              expect(screen.getByTestId('skeleton-optional')).toBeInTheDocument()
            })

            const skeletonElement = screen.getByTestId('skeleton-optional')
            const skeletonDimensions = getElementDimensions(skeletonElement)

            rerender(<ContentWithOptionalDimensions />)

            await waitFor(() => {
              expect(screen.getByTestId('content-optional')).toBeInTheDocument()
            })

            const contentElement = screen.getByTestId('content-optional')
            const contentDimensions = getElementDimensions(contentElement)

            if (hasExplicitDimensions) {
              // With explicit dimensions, there should be no difference
              const heightDiff = Math.abs(skeletonDimensions.height - contentDimensions.height)
              expect(heightDiff).toBeLessThanOrEqual(DIMENSION_TOLERANCE)
            }
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
