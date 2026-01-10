/**
 * Responsive Design Testing Utilities
 * Provides utilities for testing responsive behavior across different viewport sizes
 */

import { render, RenderResult } from '@testing-library/react'
import { ReactElement } from 'react'

export interface ViewportSize {
  width: number
  height: number
  name: string
}

export const VIEWPORT_SIZES: Record<string, ViewportSize> = {
  mobile: { width: 375, height: 667, name: 'Mobile' },
  mobileLarge: { width: 414, height: 896, name: 'Mobile Large' },
  tablet: { width: 768, height: 1024, name: 'Tablet' },
  tabletLandscape: { width: 1024, height: 768, name: 'Tablet Landscape' },
  desktop: { width: 1280, height: 720, name: 'Desktop' },
  desktopLarge: { width: 1920, height: 1080, name: 'Desktop Large' }
}

export interface ResponsiveTestResult {
  viewport: ViewportSize
  result: RenderResult
  cleanup: () => void
}

/**
 * Sets the viewport size for testing
 */
export function setViewportSize(width: number, height: number): void {
  // Mock window dimensions
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

  // Mock screen dimensions
  Object.defineProperty(window.screen, 'width', {
    writable: true,
    configurable: true,
    value: width,
  })
  
  Object.defineProperty(window.screen, 'height', {
    writable: true,
    configurable: true,
    value: height,
  })

  // Trigger resize event
  window.dispatchEvent(new Event('resize'))
}

/**
 * Renders a component at a specific viewport size
 */
export function renderAtViewport(
  component: ReactElement,
  viewport: ViewportSize
): ResponsiveTestResult {
  // Set viewport size
  setViewportSize(viewport.width, viewport.height)
  
  // Render component
  const result = render(component)
  
  return {
    viewport,
    result,
    cleanup: result.unmount
  }
}

/**
 * Renders a component at multiple viewport sizes
 */
export function renderAtMultipleViewports(
  component: ReactElement,
  viewports: ViewportSize[] = Object.values(VIEWPORT_SIZES)
): ResponsiveTestResult[] {
  return viewports.map(viewport => renderAtViewport(component, viewport))
}

/**
 * Tests if an element meets minimum touch target requirements
 */
export function checkTouchTargetSize(element: HTMLElement): {
  width: number
  height: number
  meetsRequirement: boolean
} {
  const rect = element.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(element)
  
  // Get actual or computed dimensions
  const width = rect.width || parseFloat(computedStyle.width) || 0
  const height = rect.height || parseFloat(computedStyle.height) || 0
  
  // Check if meets 44px minimum requirement
  const meetsRequirement = width >= 44 && height >= 44
  
  return { width, height, meetsRequirement }
}

/**
 * Checks if layout breaks at specific viewport size
 */
export function checkLayoutIntegrity(container: HTMLElement): {
  hasHorizontalOverflow: boolean
  hasVerticalOverflow: boolean
  hasOverlappingElements: boolean
} {
  const containerRect = container.getBoundingClientRect()
  const children = Array.from(container.children) as HTMLElement[]
  
  // Check for horizontal overflow
  const hasHorizontalOverflow = children.some(child => {
    const childRect = child.getBoundingClientRect()
    return childRect.right > containerRect.right + 1 // Allow 1px tolerance
  })
  
  // Check for vertical overflow (if container has fixed height)
  const containerStyle = window.getComputedStyle(container)
  const hasFixedHeight = containerStyle.height !== 'auto' && containerStyle.maxHeight !== 'none'
  const hasVerticalOverflow = hasFixedHeight && children.some(child => {
    const childRect = child.getBoundingClientRect()
    return childRect.bottom > containerRect.bottom + 1 // Allow 1px tolerance
  })
  
  // Check for overlapping elements
  const hasOverlappingElements = children.some((child1, index1) => {
    const rect1 = child1.getBoundingClientRect()
    return children.some((child2, index2) => {
      if (index1 >= index2) return false // Only check each pair once
      const rect2 = child2.getBoundingClientRect()
      
      // Check if rectangles overlap
      return !(rect1.right <= rect2.left || 
               rect2.right <= rect1.left || 
               rect1.bottom <= rect2.top || 
               rect2.bottom <= rect1.top)
    })
  })
  
  return {
    hasHorizontalOverflow,
    hasVerticalOverflow,
    hasOverlappingElements
  }
}

/**
 * Simulates device orientation change
 */
export function simulateOrientationChange(orientation: 'portrait' | 'landscape'): void {
  const currentWidth = window.innerWidth
  const currentHeight = window.innerHeight
  
  if (orientation === 'landscape') {
    // Swap dimensions for landscape
    setViewportSize(Math.max(currentWidth, currentHeight), Math.min(currentWidth, currentHeight))
  } else {
    // Ensure portrait (height > width)
    setViewportSize(Math.min(currentWidth, currentHeight), Math.max(currentWidth, currentHeight))
  }
  
  // Mock orientation API
  Object.defineProperty(screen, 'orientation', {
    writable: true,
    configurable: true,
    value: {
      angle: orientation === 'landscape' ? 90 : 0,
      type: orientation === 'landscape' ? 'landscape-primary' : 'portrait-primary'
    }
  })
  
  // Trigger orientation change event
  window.dispatchEvent(new Event('orientationchange'))
}

/**
 * Checks if text is readable at current viewport size
 */
export function checkTextReadability(element: HTMLElement): {
  fontSize: number
  lineHeight: number
  isReadable: boolean
} {
  const computedStyle = window.getComputedStyle(element)
  const fontSize = parseFloat(computedStyle.fontSize)
  const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2
  
  // Minimum readable font size is 16px on mobile, 14px on desktop
  const viewport = window.innerWidth
  const minFontSize = viewport < 768 ? 16 : 14
  const isReadable = fontSize >= minFontSize
  
  return { fontSize, lineHeight, isReadable }
}

/**
 * Simulates touch events for testing touch interactions
 */
export function simulateTouchEvent(
  element: HTMLElement,
  eventType: 'touchstart' | 'touchmove' | 'touchend',
  touches: { clientX: number; clientY: number }[]
): void {
  const touchEvent = new TouchEvent(eventType, {
    bubbles: true,
    cancelable: true,
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: element,
      radiusX: 10,
      radiusY: 10,
      rotationAngle: 0,
      force: 1
    })) as any
  })
  
  element.dispatchEvent(touchEvent)
}

/**
 * Tests swipe gesture recognition
 */
export function testSwipeGesture(
  element: HTMLElement,
  direction: 'left' | 'right' | 'up' | 'down',
  distance: number = 100
): void {
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  
  let startX = centerX
  let startY = centerY
  let endX = centerX
  let endY = centerY
  
  switch (direction) {
    case 'left':
      endX = startX - distance
      break
    case 'right':
      endX = startX + distance
      break
    case 'up':
      endY = startY - distance
      break
    case 'down':
      endY = startY + distance
      break
  }
  
  // Simulate swipe sequence
  simulateTouchEvent(element, 'touchstart', [{ clientX: startX, clientY: startY }])
  simulateTouchEvent(element, 'touchmove', [{ clientX: endX, clientY: endY }])
  simulateTouchEvent(element, 'touchend', [])
}

/**
 * Cleanup function to reset viewport to default
 */
export function resetViewport(): void {
  setViewportSize(1024, 768) // Default test viewport
}

/**
 * Custom matcher for Jest to check touch target sizes
 */
export function toMeetTouchTargetRequirements(element: HTMLElement) {
  const { width, height, meetsRequirement } = checkTouchTargetSize(element)
  
  return {
    message: () => 
      `Expected element to meet touch target requirements (44px x 44px), but got ${width}px x ${height}px`,
    pass: meetsRequirement
  }
}

/**
 * Custom matcher for Jest to check responsive layout integrity
 */
export function toHaveResponsiveLayout(container: HTMLElement) {
  const { hasHorizontalOverflow, hasVerticalOverflow, hasOverlappingElements } = checkLayoutIntegrity(container)
  
  const issues = []
  if (hasHorizontalOverflow) issues.push('horizontal overflow')
  if (hasVerticalOverflow) issues.push('vertical overflow')
  if (hasOverlappingElements) issues.push('overlapping elements')
  
  return {
    message: () => 
      issues.length > 0 
        ? `Expected responsive layout but found: ${issues.join(', ')}`
        : 'Expected layout to have issues but none were found',
    pass: issues.length === 0
  }
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toMeetTouchTargetRequirements(): R
      toHaveResponsiveLayout(): R
    }
  }
}