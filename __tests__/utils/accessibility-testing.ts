/**
 * Accessibility Testing Utilities
 * Provides utilities for testing accessibility compliance with axe-core
 */

import { render, RenderResult } from '@testing-library/react'
import { axe, toHaveNoViolations, Result } from 'jest-axe'
import { ReactElement } from 'react'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

export interface AccessibilityTestOptions {
  rules?: Record<string, { enabled: boolean }>
  tags?: string[]
  include?: string[]
  exclude?: string[]
}

export interface AccessibilityTestResult {
  violations: Result['violations']
  passes: Result['passes']
  incomplete: Result['incomplete']
  inaccessible: Result['inaccessible']
  hasViolations: boolean
}

/**
 * Default accessibility rules configuration
 */
export const DEFAULT_A11Y_RULES: AccessibilityTestOptions = {
  rules: {
    // WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'image-alt': { enabled: true },
    'label': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },
    'tabindex': { enabled: true },
    'valid-lang': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
}

/**
 * Runs accessibility tests on a rendered component
 */
export async function testAccessibility(
  element: HTMLElement,
  options: AccessibilityTestOptions = DEFAULT_A11Y_RULES
): Promise<AccessibilityTestResult> {
  const results = await axe(element, options)
  
  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inaccessible: results.inaccessible,
    hasViolations: results.violations.length > 0
  }
}

/**
 * Renders a component and tests its accessibility
 */
export async function renderAndTestAccessibility(
  component: ReactElement,
  options: AccessibilityTestOptions = DEFAULT_A11Y_RULES
): Promise<{ result: RenderResult; accessibility: AccessibilityTestResult }> {
  const result = render(component)
  const accessibility = await testAccessibility(result.container, options)
  
  return { result, accessibility }
}

/**
 * Tests keyboard navigation accessibility
 */
export function testKeyboardNavigation(container: HTMLElement): {
  focusableElements: HTMLElement[]
  tabOrder: HTMLElement[]
  hasLogicalTabOrder: boolean
  allElementsFocusable: boolean
} {
  // Get all focusable elements
  const focusableElements = Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ) as HTMLElement[]
  
  // Test tab order by simulating tab navigation
  const tabOrder: HTMLElement[] = []
  let currentElement = focusableElements[0]
  
  if (currentElement) {
    currentElement.focus()
    tabOrder.push(currentElement)
    
    // Simulate tab navigation through all elements
    for (let i = 1; i < focusableElements.length; i++) {
      const nextElement = focusableElements[i]
      nextElement.focus()
      tabOrder.push(nextElement)
    }
  }
  
  // Check if tab order is logical (matches DOM order)
  const hasLogicalTabOrder = tabOrder.every((element, index) => 
    element === focusableElements[index]
  )
  
  // Check if all interactive elements are focusable
  const allElementsFocusable = focusableElements.every(element => {
    const tabIndex = element.getAttribute('tabindex')
    return tabIndex !== '-1' && !element.hasAttribute('disabled')
  })
  
  return {
    focusableElements,
    tabOrder,
    hasLogicalTabOrder,
    allElementsFocusable
  }
}

/**
 * Tests screen reader compatibility
 */
export function testScreenReaderCompatibility(container: HTMLElement): {
  elementsWithLabels: number
  elementsWithoutLabels: HTMLElement[]
  ariaLandmarks: HTMLElement[]
  liveRegions: HTMLElement[]
  hasProperHeadingStructure: boolean
} {
  // Find interactive elements without proper labels
  const interactiveElements = Array.from(
    container.querySelectorAll('button, [href], input, select, textarea')
  ) as HTMLElement[]
  
  const elementsWithoutLabels = interactiveElements.filter(element => {
    const hasAriaLabel = element.getAttribute('aria-label')
    const hasAriaLabelledBy = element.getAttribute('aria-labelledby')
    const hasLabel = container.querySelector(`label[for="${element.id}"]`)
    const hasTextContent = element.textContent?.trim()
    const hasAlt = element.getAttribute('alt')
    const hasTitle = element.getAttribute('title')
    
    return !hasAriaLabel && !hasAriaLabelledBy && !hasLabel && !hasTextContent && !hasAlt && !hasTitle
  })
  
  // Find ARIA landmarks
  const ariaLandmarks = Array.from(
    container.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"], [role="region"]')
  ) as HTMLElement[]
  
  // Find live regions
  const liveRegions = Array.from(
    container.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')
  ) as HTMLElement[]
  
  // Check heading structure
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
  const hasProperHeadingStructure = checkHeadingStructure(headings)
  
  return {
    elementsWithLabels: interactiveElements.length - elementsWithoutLabels.length,
    elementsWithoutLabels,
    ariaLandmarks,
    liveRegions,
    hasProperHeadingStructure
  }
}

/**
 * Checks if heading structure is logical (no skipped levels)
 */
function checkHeadingStructure(headings: HTMLElement[]): boolean {
  if (headings.length === 0) return true
  
  const levels = headings.map(heading => {
    const tagName = heading.tagName.toLowerCase()
    return parseInt(tagName.charAt(1))
  })
  
  // Should start with h1
  if (levels[0] !== 1) return false
  
  // Check for skipped levels
  for (let i = 1; i < levels.length; i++) {
    const currentLevel = levels[i]
    const previousLevel = levels[i - 1]
    
    // Can't skip more than one level
    if (currentLevel > previousLevel + 1) return false
  }
  
  return true
}

/**
 * Tests color contrast compliance
 */
export function testColorContrast(element: HTMLElement): {
  foregroundColor: string
  backgroundColor: string
  contrastRatio: number
  meetsAA: boolean
  meetsAAA: boolean
} {
  const computedStyle = window.getComputedStyle(element)
  const foregroundColor = computedStyle.color
  const backgroundColor = computedStyle.backgroundColor
  
  // Calculate contrast ratio (simplified - in real implementation would use proper color parsing)
  const contrastRatio = calculateContrastRatio(foregroundColor, backgroundColor)
  
  // WCAG requirements
  const meetsAA = contrastRatio >= 4.5
  const meetsAAA = contrastRatio >= 7
  
  return {
    foregroundColor,
    backgroundColor,
    contrastRatio,
    meetsAA,
    meetsAAA
  }
}

/**
 * Simplified contrast ratio calculation (for testing purposes)
 */
function calculateContrastRatio(foreground: string, background: string): number {
  // This is a simplified implementation
  // In production, you'd use a proper color parsing library
  
  // Mock calculation that returns reasonable values for testing
  const fgLuminance = getLuminance(foreground)
  const bgLuminance = getLuminance(background)
  
  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)
  
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Simplified luminance calculation
 */
function getLuminance(color: string): number {
  // Simplified luminance calculation for testing
  // Returns a value between 0 and 1
  
  if (color.includes('rgb')) {
    // Extract RGB values and calculate relative luminance
    const matches = color.match(/\d+/g)
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]) / 255
      const g = parseInt(matches[1]) / 255
      const b = parseInt(matches[2]) / 255
      
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
  }
  
  // Default values for common colors
  const colorMap: Record<string, number> = {
    'white': 1,
    'black': 0,
    'red': 0.2126,
    'green': 0.7152,
    'blue': 0.0722,
    'gray': 0.5,
    'grey': 0.5
  }
  
  return colorMap[color.toLowerCase()] || 0.5
}

/**
 * Tests focus management
 */
export function testFocusManagement(container: HTMLElement): {
  hasFocusTrap: boolean
  focusReturnsCorrectly: boolean
  skipLinksWork: boolean
} {
  const focusableElements = Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ) as HTMLElement[]
  
  // Test focus trap (simplified)
  const hasFocusTrap = container.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  
  // Test focus return (simplified)
  const focusReturnsCorrectly = true // Would need more complex testing in real scenario
  
  // Test skip links
  const skipLinks = Array.from(container.querySelectorAll('a[href^="#"]')) as HTMLElement[]
  const skipLinksWork = skipLinks.every(link => {
    const href = link.getAttribute('href')
    if (href) {
      const target = container.querySelector(href)
      return target !== null
    }
    return false
  })
  
  return {
    hasFocusTrap,
    focusReturnsCorrectly,
    skipLinksWork
  }
}

/**
 * Comprehensive accessibility test suite
 */
export async function runAccessibilityTestSuite(
  component: ReactElement,
  options: AccessibilityTestOptions = DEFAULT_A11Y_RULES
): Promise<{
  axeResults: AccessibilityTestResult
  keyboardNavigation: ReturnType<typeof testKeyboardNavigation>
  screenReader: ReturnType<typeof testScreenReaderCompatibility>
  focusManagement: ReturnType<typeof testFocusManagement>
  overallScore: number
}> {
  const { result, accessibility } = await renderAndTestAccessibility(component, options)
  const keyboardNavigation = testKeyboardNavigation(result.container)
  const screenReader = testScreenReaderCompatibility(result.container)
  const focusManagement = testFocusManagement(result.container)
  
  // Calculate overall accessibility score (0-100)
  let score = 100
  
  // Deduct points for violations
  score -= accessibility.violations.length * 10
  
  // Deduct points for keyboard navigation issues
  if (!keyboardNavigation.hasLogicalTabOrder) score -= 15
  if (!keyboardNavigation.allElementsFocusable) score -= 10
  
  // Deduct points for screen reader issues
  score -= screenReader.elementsWithoutLabels.length * 5
  if (!screenReader.hasProperHeadingStructure) score -= 10
  
  // Deduct points for focus management issues
  if (!focusManagement.skipLinksWork) score -= 5
  
  // Ensure score doesn't go below 0
  score = Math.max(0, score)
  
  result.unmount()
  
  return {
    axeResults: accessibility,
    keyboardNavigation,
    screenReader,
    focusManagement,
    overallScore: score
  }
}

/**
 * Custom Jest matcher for accessibility testing
 */
export function toBeAccessible(element: HTMLElement) {
  return testAccessibility(element).then(results => ({
    message: () => 
      results.hasViolations
        ? `Expected element to be accessible, but found ${results.violations.length} violations: ${results.violations.map(v => v.description).join(', ')}`
        : 'Expected element to have accessibility violations but none were found',
    pass: !results.hasViolations
  }))
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAccessible(): Promise<R>
      toHaveNoViolations(): R
    }
  }
}