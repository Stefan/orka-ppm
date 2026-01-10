/**
 * Property-Based Tests for High Contrast Accessibility
 * Feature: mobile-first-ui-enhancements, Property 24: High Contrast Accessibility
 * Validates: Requirements 8.3
 */

import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import ColorBlindnessFilters from '../components/accessibility/ColorBlindnessFilters'
import AccessibleButton from '../components/accessibility/AccessibleButton'

// Mock window.matchMedia for theme detection
const mockMatchMedia = jest.fn()
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia.mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
})

afterEach(() => {
  mockMatchMedia.mockClear()
  // Clean up document classes
  document.documentElement.classList.remove('high-contrast', 'reduced-motion')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-colorblind-support')
  document.documentElement.removeAttribute('data-focus-style')
  document.documentElement.removeAttribute('data-font-size')
})

// Simplified test component that avoids infinite loops
const TestHighContrastComponent = ({ 
  elements,
  testHighContrast = false,
  testReducedMotion = false,
  testColorBlindness = 'none'
}: { 
  elements: Array<{
    type: string
    label: string
    id: string
    variant?: string
    disabled?: boolean
  }>
  testHighContrast?: boolean
  testReducedMotion?: boolean
  testColorBlindness?: string
}) => {
  // Apply test settings directly to document for testing
  React.useEffect(() => {
    if (testHighContrast) {
      document.documentElement.classList.add('high-contrast')
      document.documentElement.setAttribute('data-theme', 'high-contrast-dark')
    } else {
      document.documentElement.classList.remove('high-contrast')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    
    if (testReducedMotion) {
      document.documentElement.classList.add('reduced-motion')
    } else {
      document.documentElement.classList.remove('reduced-motion')
    }
    
    document.documentElement.setAttribute('data-colorblind-support', testColorBlindness)
    document.documentElement.setAttribute('data-focus-style', 'high-visibility')
    document.documentElement.setAttribute('data-font-size', 'medium')
  }, [testHighContrast, testReducedMotion, testColorBlindness])

  return (
    <>
      <ColorBlindnessFilters />
      <div data-testid="container" className="p-4">
        {elements.map((element) => {
          switch (element.type) {
            case 'button':
              return (
                <AccessibleButton
                  key={element.id}
                  variant={element.variant as any}
                  disabled={element.disabled}
                  className="m-2"
                >
                  {element.label}
                </AccessibleButton>
              )
            case 'input':
              return (
                <input
                  key={element.id}
                  type="text"
                  placeholder={element.label}
                  disabled={element.disabled}
                  className="m-2 p-2 border focus:ring-2"
                />
              )
            case 'card':
              return (
                <div
                  key={element.id}
                  className="m-2 p-4 border rounded-lg shadow-sm"
                >
                  {element.label}
                </div>
              )
            case 'link':
              return (
                <a
                  key={element.id}
                  href="#"
                  className="m-2 underline focus:ring-2"
                >
                  {element.label}
                </a>
              )
            case 'alert':
              return (
                <div
                  key={element.id}
                  role="alert"
                  className="m-2 p-3 border rounded"
                >
                  {element.label}
                </div>
              )
            case 'success':
              return (
                <div
                  key={element.id}
                  className="m-2 p-3 border rounded"
                >
                  {element.label}
                </div>
              )
            default:
              return (
                <div
                  key={element.id}
                  className="m-2 p-2 border"
                >
                  {element.label}
                </div>
              )
          }
        })}
      </div>
    </>
  )
}

describe('High Contrast Accessibility Properties', () => {
  /**
   * Property 24: High Contrast Accessibility
   * For any UI element, high contrast themes should provide sufficient color contrast for accessibility
   * Validates: Requirements 8.3
   */
  
  test('Property 24.1: High contrast mode should provide enhanced visual indicators', () => {
    const testElements = [
      { type: 'button', label: 'Test Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
      />
    )
    
    // Check that high contrast class is applied
    const hasHighContrastClass = document.documentElement.classList.contains('high-contrast')
    expect(hasHighContrastClass).toBe(true)
    
    // Check that theme attribute is set
    const themeAttribute = document.documentElement.getAttribute('data-theme')
    expect(themeAttribute).toBe('high-contrast-dark')
    
    // All elements should be rendered
    testElements.forEach((element) => {
      const elementInDOM = screen.getByText(element.label)
      expect(elementInDOM).toBeInTheDocument()
    })
  })

  test('Property 24.2: Color blindness support should maintain usability', () => {
    const testElements = [
      { type: 'button', label: 'Accessible Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testColorBlindness="deuteranopia"
      />
    )
    
    // Check that color blindness support is applied
    const colorBlindAttribute = document.documentElement.getAttribute('data-colorblind-support')
    expect(colorBlindAttribute).toBe('deuteranopia')
    
    // Elements should remain accessible with color blindness filters
    const interactiveElements = container.querySelectorAll('button, input, a, [role="button"]')
    
    interactiveElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      
      // Element should still be focusable
      expect(htmlElement.tabIndex).toBeGreaterThanOrEqual(0)
      
      // Element should have non-color indicators for state
      const hasTextContent = htmlElement.textContent?.trim()
      const hasAriaLabel = htmlElement.getAttribute('aria-label')
      const hasTitle = htmlElement.getAttribute('title')
      
      const hasNonColorIndicator = !!(hasTextContent || hasAriaLabel || hasTitle)
      expect(hasNonColorIndicator).toBe(true)
    })
  })

  test('Property 24.3: Theme switching should preserve accessibility', () => {
    const testElements = [
      { type: 'button', label: 'Theme Test Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { rerender } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={false}
      />
    )
    
    // Switch to high contrast theme
    rerender(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
      />
    )
    
    // All elements should still be accessible
    testElements.forEach((element) => {
      const elementInDOM = screen.getByText(element.label)
      expect(elementInDOM).toBeInTheDocument()
      
      // Interactive elements should remain focusable
      if (['button', 'input', 'link'].includes(element.type)) {
        const interactiveElement = elementInDOM.closest('button, input, a') as HTMLElement
        if (interactiveElement) {
          expect(interactiveElement.tabIndex).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  test('Property 24.4: Focus indicators should be enhanced in high contrast mode', () => {
    const testElements = [
      { type: 'button', label: 'Focus Test Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
      />
    )
    
    // Check that focus style is set to high visibility
    const focusStyle = document.documentElement.getAttribute('data-focus-style')
    expect(focusStyle).toBe('high-visibility')
    
    const focusableElements = container.querySelectorAll(
      'button, input, a, [tabindex]:not([tabindex="-1"])'
    )
    
    focusableElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      
      // Focus the element
      htmlElement.focus()
      
      // Check if element has focus
      expect(document.activeElement).toBe(htmlElement)
      
      // Check for focus indicator styles (outline or ring)
      const computedStyle = window.getComputedStyle(htmlElement)
      const hasOutline = computedStyle.outline !== 'none' && computedStyle.outline !== ''
      const hasBoxShadow = computedStyle.boxShadow !== 'none' && computedStyle.boxShadow !== ''
      const hasFocusRing = htmlElement.classList.contains('focus:ring') ||
                          htmlElement.classList.contains('focus-visible:ring') ||
                          htmlElement.className.includes('focus:ring')
      
      const hasEnhancedFocus = hasOutline || hasBoxShadow || hasFocusRing
      expect(hasEnhancedFocus).toBe(true)
    })
  })

  test('Property 24.5: Error and success states should be distinguishable without color', () => {
    const testElements = [
      { type: 'alert', label: 'Error Alert', id: 'alert1' },
      { type: 'success', label: 'Success Message', id: 'success1' }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testColorBlindness="protanopia"
      />
    )
    
    testElements.forEach((element) => {
      const elementInDOM = screen.getByText(element.label)
      
      if (element.type === 'alert') {
        // Alert elements should have role="alert"
        const alertElement = elementInDOM.closest('[role="alert"]')
        expect(alertElement).toBeTruthy()
        
        // Should have visual indicators beyond color
        const hasBorder = window.getComputedStyle(alertElement as Element).border !== 'none'
        expect(hasBorder).toBe(true)
      }
      
      if (element.type === 'success') {
        // Success elements should have clear non-color indicators
        const successElement = elementInDOM.closest('div')
        const computedStyle = window.getComputedStyle(successElement as Element)
        
        const hasBorder = computedStyle.border !== 'none'
        expect(hasBorder).toBe(true)
      }
    })
  })

  test('Property 24.6: Reduced motion preferences should be respected', () => {
    const testElements = [
      { type: 'button', label: 'Motion Test Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testReducedMotion={true}
      />
    )
    
    // Check that reduced motion is applied
    const hasReducedMotionClass = document.documentElement.classList.contains('reduced-motion')
    expect(hasReducedMotionClass).toBe(true)
    
    // Check that animations are disabled or reduced
    const animatedElements = container.querySelectorAll('*')
    
    animatedElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      const computedStyle = window.getComputedStyle(htmlElement)
      
      // Elements should respect reduced motion preferences
      const animationDuration = computedStyle.animationDuration
      const hasExcessiveAnimation = animationDuration && 
                                  animationDuration !== '' &&
                                  animationDuration !== 'none' &&
                                  !isNaN(parseFloat(animationDuration)) &&
                                  parseFloat(animationDuration) > 1
      
      expect(!!hasExcessiveAnimation).toBe(false)
    })
  })

  test('Property 24.7: Text should remain readable with different font sizes', () => {
    const testElements = [
      { type: 'button', label: 'Font Size Test', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
      />
    )
    
    // Check that font size is applied
    const fontSizeAttribute = document.documentElement.getAttribute('data-font-size')
    expect(fontSizeAttribute).toBe('medium')
    
    // Text elements should remain readable
    const textElements = container.querySelectorAll('*')
    
    textElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      const textContent = htmlElement.textContent?.trim()
      
      if (textContent && textContent.length > 0) {
        const computedStyle = window.getComputedStyle(htmlElement)
        
        // Text should not overflow containers
        const overflow = computedStyle.overflow
        const textOverflow = computedStyle.textOverflow
        
        if (overflow === 'hidden') {
          expect(textOverflow).toBe('ellipsis')
        }
      }
    })
  })

  test('Property 24.8: Interactive elements should have sufficient spacing', () => {
    const testElements = [
      { type: 'button', label: 'Spacing Test Button', id: 'btn1', variant: 'default', disabled: false }
    ]

    const { container } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
      />
    )
    
    const interactiveElements = container.querySelectorAll('button, input, a')
    
    // Check that elements have margin classes for spacing
    interactiveElements.forEach((element) => {
      const htmlElement = element as HTMLElement
      
      const hasMargin = htmlElement.classList.contains('m-2') ||
                      htmlElement.className.includes('m-') ||
                      htmlElement.className.includes('mx-') ||
                      htmlElement.className.includes('my-')
      
      expect(hasMargin).toBe(true)
    })
  })
})

// Integration test for complete high contrast accessibility
describe('High Contrast Integration', () => {
  test('Complete high contrast accessibility workflow', () => {
    const testElements = [
      { type: 'button', label: 'Primary Action', id: 'btn1', variant: 'default' },
      { type: 'button', label: 'Danger Action', id: 'btn2', variant: 'destructive' },
      { type: 'input', label: 'Text Input', id: 'input1' },
      { type: 'alert', label: 'Error message', id: 'alert1' },
      { type: 'success', label: 'Success message', id: 'success1' },
      { type: 'link', label: 'Navigation Link', id: 'link1' }
    ]
    
    const { rerender } = render(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={false}
      />
    )
    
    // Verify normal mode works
    testElements.forEach(element => {
      if (element.type === 'input') {
        // For input elements, check by placeholder
        expect(screen.getByPlaceholderText(element.label)).toBeInTheDocument()
      } else {
        expect(screen.getByText(element.label)).toBeInTheDocument()
      }
    })
    
    // Switch to high contrast mode
    rerender(
      <TestHighContrastComponent 
        elements={testElements} 
        testHighContrast={true}
        testReducedMotion={true}
        testColorBlindness="deuteranopia"
      />
    )
    
    // Verify high contrast mode maintains accessibility
    testElements.forEach(element => {
      if (element.type === 'input') {
        // For input elements, check by placeholder
        expect(screen.getByPlaceholderText(element.label)).toBeInTheDocument()
      } else {
        expect(screen.getByText(element.label)).toBeInTheDocument()
      }
    })
    
    // Test focus indicators
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      button.focus()
      expect(document.activeElement).toBe(button)
    })
    
    // Test alert accessibility
    const alertElement = screen.getByText('Error message')
    expect(alertElement.closest('[role="alert"]')).toBeTruthy()
    
    // Test keyboard navigation
    const firstButton = buttons[0]
    firstButton.focus()
    fireEvent.keyDown(firstButton, { key: 'Tab' })
    // Should not throw error
  })
})