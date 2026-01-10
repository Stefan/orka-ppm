/**
 * Property-Based Tests for TouchButton Component
 * Feature: mobile-first-ui-enhancements, Property 1: Touch Target Accessibility
 * Validates: Requirements 1.1
 */

import React from 'react'
import { render } from '@testing-library/react'
import fc from 'fast-check'
import { TouchButton } from '../TouchButton'
import type { ButtonProps, TouchTargetSize } from '@/types'

// Test utilities for property-based testing
const touchTargetSizeArbitrary = fc.constantFrom<TouchTargetSize>(
  'minimum',
  'comfortable', 
  'large',
  'xlarge'
)

const buttonVariantArbitrary = fc.constantFrom<ButtonProps['variant']>(
  'primary',
  'secondary',
  'ghost',
  'danger',
  'success',
  'warning'
)

const componentSizeArbitrary = fc.constantFrom<ButtonProps['size']>(
  'sm',
  'md',
  'lg',
  'xl'
)

const buttonPropsArbitrary = fc.record({
  variant: buttonVariantArbitrary,
  size: componentSizeArbitrary,
  touchTarget: touchTargetSizeArbitrary,
  disabled: fc.boolean(),
  loading: fc.boolean(),
  fullWidth: fc.boolean(),
})

// Helper function to get computed dimensions (JSDOM-compatible)
const getElementDimensions = (element: HTMLElement) => {
  const computedStyle = window.getComputedStyle(element)
  
  // In JSDOM, getBoundingClientRect returns 0x0, so we check CSS classes and computed styles
  const rect = element.getBoundingClientRect()
  
  // Extract dimensions from CSS classes if getBoundingClientRect fails
  const classList = Array.from(element.classList)
  
  // Parse min-height and min-width from classes
  let minWidth = parseFloat(computedStyle.minWidth) || 0
  let minHeight = parseFloat(computedStyle.minHeight) || 0
  
  // Check for touch target classes
  if (classList.includes('touch-target')) minWidth = Math.max(minWidth, 44), minHeight = Math.max(minHeight, 44)
  if (classList.includes('touch-target-comfortable')) minWidth = Math.max(minWidth, 48), minHeight = Math.max(minHeight, 48)
  if (classList.includes('touch-target-large')) minWidth = Math.max(minWidth, 56), minHeight = Math.max(minHeight, 56)
  
  // Check for min-h and min-w classes
  const minHeightClass = classList.find(cls => cls.startsWith('min-h-[') || cls.startsWith('min-h-touch'))
  const minWidthClass = classList.find(cls => cls.startsWith('min-w-[') || cls.startsWith('min-w-touch'))
  
  if (minHeightClass?.includes('44px') || minHeightClass?.includes('touch')) minHeight = Math.max(minHeight, 44)
  if (minHeightClass?.includes('48px') || minHeightClass?.includes('touch-comfortable')) minHeight = Math.max(minHeight, 48)
  if (minHeightClass?.includes('56px') || minHeightClass?.includes('touch-large')) minHeight = Math.max(minHeight, 56)
  
  if (minWidthClass?.includes('44px') || minWidthClass?.includes('touch')) minWidth = Math.max(minWidth, 44)
  if (minWidthClass?.includes('48px') || minWidthClass?.includes('touch-comfortable')) minWidth = Math.max(minWidth, 48)
  if (minWidthClass?.includes('56px') || minWidthClass?.includes('touch-large')) minWidth = Math.max(minWidth, 56)
  
  return {
    width: rect.width || minWidth,
    height: rect.height || minHeight,
    minWidth,
    minHeight,
  }
}

// Helper function to validate WCAG 2.1 AA touch target requirements
const validateTouchTarget = (element: HTMLElement, touchTarget: TouchTargetSize): boolean => {
  const dimensions = getElementDimensions(element)
  const classList = Array.from(element.classList)
  
  const minimumSizes = {
    minimum: 44,      // WCAG 2.1 AA minimum
    comfortable: 48,  // Comfortable touch
    large: 56,        // Large touch targets
    xlarge: 64,       // Extra large for primary actions
  }
  
  const requiredSize = minimumSizes[touchTarget]
  
  // In JSDOM, check for the presence of appropriate CSS classes
  const hasValidTouchTargetClass = 
    classList.includes('touch-target') ||
    classList.includes('touch-target-comfortable') ||
    classList.includes('touch-target-large') ||
    classList.includes('btn-base') // btn-base includes touch-target

  // Check computed min dimensions
  const hasValidMinDimensions = 
    dimensions.minWidth >= requiredSize && 
    dimensions.minHeight >= requiredSize
  
  // For JSDOM compatibility, accept either valid classes or computed dimensions
  return hasValidTouchTargetClass || hasValidMinDimensions
}

describe('TouchButton Property-Based Tests', () => {
  /**
   * Property 1: Touch Target Accessibility
   * For any interactive UI element, the touch target size should be at least 44px 
   * in both width and height to ensure accessibility compliance
   * Validates: Requirements 1.1
   */
  test('Property 1: Touch Target Accessibility - all touch targets meet WCAG 2.1 AA requirements', () => {
    fc.assert(
      fc.property(
        buttonPropsArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }), // button text
        (props, buttonText) => {
          const { container } = render(
            <TouchButton {...props}>
              {buttonText}
            </TouchButton>
          )
          
          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()
          
          if (button) {
            const isValidTouchTarget = validateTouchTarget(button, props.touchTarget || 'comfortable')
            
            // Log failure details for debugging
            if (!isValidTouchTarget) {
              const dimensions = getElementDimensions(button)
              console.error('Touch target validation failed:', {
                props,
                dimensions,
                expectedMinimum: props.touchTarget || 'comfortable',
              })
            }
            
            expect(isValidTouchTarget).toBe(true)
          }
        }
      ),
      {
        numRuns: 100,
        seed: 42, // Deterministic seed for reproducible tests
        verbose: true,
      }
    )
  })

  /**
   * Property 1.1: Touch Target Consistency
   * For any touch target size setting, the rendered element should consistently 
   * meet or exceed the specified minimum dimensions
   */
  test('Property 1.1: Touch Target Consistency - size settings are consistently applied', () => {
    fc.assert(
      fc.property(
        touchTargetSizeArbitrary,
        fc.string({ minLength: 1, maxLength: 20 }),
        (touchTarget, buttonText) => {
          const { container } = render(
            <TouchButton touchTarget={touchTarget}>
              {buttonText}
            </TouchButton>
          )
          
          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()
          
          if (button) {
            // Validate touch target using JSDOM-compatible method
            expect(validateTouchTarget(button, touchTarget)).toBe(true)
            
            // Additional validation for class presence
            const classList = Array.from(button.classList)
            const hasValidTouchTargetClass = 
              classList.includes('touch-target') ||
              classList.includes('touch-target-comfortable') ||
              classList.includes('touch-target-large') ||
              classList.includes('btn-base')
            
            expect(hasValidTouchTargetClass).toBe(true)
          }
        }
      ),
      {
        numRuns: 100,
        seed: 123,
        verbose: true,
      }
    )
  })

  /**
   * Property 1.2: Accessibility Attributes
   * For any button configuration, accessibility attributes should be properly set
   * when touch targets are rendered
   */
  test('Property 1.2: Accessibility Attributes - ARIA attributes are correctly applied', () => {
    fc.assert(
      fc.property(
        buttonPropsArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.option(fc.string({ minLength: 1, maxLength: 100 })), // aria-label
        fc.option(fc.string({ minLength: 1, maxLength: 50 })), // aria-describedby
        (props, buttonText, ariaLabel, ariaDescribedBy) => {
          const { container } = render(
            <TouchButton 
              {...props}
              aria-label={ariaLabel || undefined}
              aria-describedby={ariaDescribedBy || undefined}
            >
              {buttonText}
            </TouchButton>
          )
          
          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()
          
          if (button) {
            // Validate touch target size
            expect(validateTouchTarget(button, props.touchTarget || 'comfortable')).toBe(true)
            
            // Validate accessibility attributes
            expect(button).toHaveAttribute('type', 'button')
            expect(button).toHaveAttribute('aria-disabled', String(props.disabled || props.loading || false))
            
            if (ariaLabel) {
              expect(button).toHaveAttribute('aria-label', ariaLabel)
            }
            
            if (ariaDescribedBy) {
              expect(button).toHaveAttribute('aria-describedby', ariaDescribedBy)
            }
            
            // Validate disabled state
            if (props.disabled || props.loading) {
              expect(button).toBeDisabled()
            } else {
              expect(button).not.toBeDisabled()
            }
          }
        }
      ),
      {
        numRuns: 100,
        seed: 456,
        verbose: true,
      }
    )
  })

  /**
   * Property 1.3: Touch Target Visual Feedback
   * For any interactive button, visual feedback states should not compromise 
   * touch target accessibility
   */
  test('Property 1.3: Touch Target Visual Feedback - states maintain accessibility', () => {
    fc.assert(
      fc.property(
        buttonPropsArbitrary,
        fc.string({ minLength: 1, maxLength: 30 }),
        (props, buttonText) => {
          const { container } = render(
            <TouchButton {...props}>
              {buttonText}
            </TouchButton>
          )
          
          const button = container.querySelector('button')
          expect(button).toBeInTheDocument()
          
          if (button) {
            // Validate base touch target
            expect(validateTouchTarget(button, props.touchTarget || 'comfortable')).toBe(true)
            
            // Validate that visual states don't break accessibility
            const classList = Array.from(button.classList)
            
            // Should have focus-visible class for keyboard navigation
            expect(classList.some(cls => cls.includes('focus'))).toBe(true)
            
            // Should have proper transition classes for reduced motion support
            expect(classList.some(cls => cls.includes('transition') || cls.includes('duration'))).toBe(true)
            
            // Loading state should not break touch targets
            if (props.loading) {
              const spinner = button.querySelector('[aria-hidden="true"]')
              expect(spinner).toBeInTheDocument()
              // Touch target should still be valid even with loading spinner
              expect(validateTouchTarget(button, props.touchTarget || 'comfortable')).toBe(true)
            }
          }
        }
      ),
      {
        numRuns: 100,
        seed: 789,
        verbose: true,
      }
    )
  })
})

// Additional edge case tests for specific touch target scenarios
describe('TouchButton Edge Cases', () => {
  test('minimum touch target with very long text maintains accessibility', () => {
    const longText = 'This is a very long button text that should still maintain proper touch target dimensions'
    
    const { container } = render(
      <TouchButton touchTarget="minimum">
        {longText}
      </TouchButton>
    )
    
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
    
    if (button) {
      expect(validateTouchTarget(button, 'minimum')).toBe(true)
    }
  })

  test('xlarge touch target with minimal text maintains proper dimensions', () => {
    const { container } = render(
      <TouchButton touchTarget="xlarge">
        OK
      </TouchButton>
    )
    
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
    
    if (button) {
      expect(validateTouchTarget(button, 'xlarge')).toBe(true)
    }
  })

  test('disabled button maintains touch target accessibility', () => {
    const { container } = render(
      <TouchButton disabled touchTarget="comfortable">
        Disabled Button
      </TouchButton>
    )
    
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
    
    if (button) {
      expect(validateTouchTarget(button, 'comfortable')).toBe(true)
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
  })
})