/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Disabled State
 * Feature: design-system-consistency
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'

describe('Button Disabled State Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 16: Disabled Buttons haben visuell erkennbaren State
   * Validates: Requirements 7.3
   * 
   * For any Button component with disabled=true, the button should have a
   * visually recognizable disabled state with reduced opacity and changed cursor.
   */
  it('Property 16: Disabled buttons have visually recognizable state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(
            <Button variant={variant} disabled>Test Button</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).toBeDisabled()
          
          const className = button?.className || ''
          
          // Disabled button should have opacity reduction
          expect(className).toContain('disabled:opacity-50')
          
          // Disabled button should have cursor change
          expect(className).toContain('disabled:cursor-not-allowed')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.1: Disabled buttons are not clickable
   * Validates: Requirements 7.3
   */
  it('Property 16.1: Disabled buttons do not respond to click events', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const handleClick = jest.fn()
          const { container } = render(
            <Button variant={variant} disabled onClick={handleClick}>
              Test Button
            </Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).toBeDisabled()
          
          // Try to click the disabled button
          if (button) {
            fireEvent.click(button)
          }
          
          // Click handler should not be called
          expect(handleClick).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.2: All button sizes have consistent disabled state
   * Validates: Requirements 7.3
   */
  it('Property 16.2: All button sizes have consistent disabled state styling', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('primary', 'secondary', 'outline'),
        (size, variant) => {
          const { container } = render(
            <Button size={size} variant={variant} disabled>Test</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).toBeDisabled()
          
          const className = button?.className || ''
          
          // All sizes should have the same disabled styling
          expect(className).toContain('disabled:opacity-50')
          expect(className).toContain('disabled:cursor-not-allowed')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.3: Disabled state is independent of variant styling
   * Validates: Requirements 7.3
   */
  it('Property 16.3: Disabled state works consistently across all variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(
            <Button variant={variant} disabled>Test</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).toBeDisabled()
          
          const className = button?.className || ''
          
          // Disabled styling should be present regardless of variant
          expect(className).toContain('disabled:opacity-50')
          expect(className).toContain('disabled:cursor-not-allowed')
          
          // Variant styling should still be present
          if (variant === 'primary') {
            expect(className).toContain('bg-blue-600')
          } else if (variant === 'secondary') {
            expect(className).toContain('bg-gray-100')
          } else if (variant === 'outline') {
            expect(className).toContain('border-blue-600')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.4: Enabled buttons do not have disabled styling
   * Validates: Requirements 7.3
   */
  it('Property 16.4: Enabled buttons are fully interactive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const handleClick = jest.fn()
          const { container } = render(
            <Button variant={variant} onClick={handleClick}>Test Button</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).not.toBeDisabled()
          
          // Click the enabled button
          if (button) {
            fireEvent.click(button)
          }
          
          // Click handler should be called
          expect(handleClick).toHaveBeenCalledTimes(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.5: Disabled prop defaults to false
   * Validates: Requirements 7.3
   */
  it('Property 16.5: Buttons are enabled by default', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        fc.constantFrom('sm', 'md', 'lg'),
        (variant, size) => {
          const { container } = render(
            <Button variant={variant} size={size}>Test</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).not.toBeDisabled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 16.6: Disabled state can be toggled
   * Validates: Requirements 7.3
   */
  it('Property 16.6: Disabled state can be dynamically changed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container, rerender } = render(
            <Button variant={variant} disabled={false}>Test</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          expect(button).not.toBeDisabled()
          
          // Re-render with disabled=true
          rerender(<Button variant={variant} disabled={true}>Test</Button>)
          
          expect(button).toBeDisabled()
          
          // Re-render with disabled=false again
          rerender(<Button variant={variant} disabled={false}>Test</Button>)
          
          expect(button).not.toBeDisabled()
        }
      ),
      { numRuns: 50 } // Reduced runs for rerender tests
    )
  })
})
