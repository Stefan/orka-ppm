/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Input Component Error State
 * Feature: design-system-consistency
 * Property 11: Input im Error-State zeigt visuelles Feedback
 * Validates: Requirements 2.5
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Input } from '@/components/ui/input'

describe('Input Component - Error State Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 11: Input im Error-State zeigt visuelles Feedback
   * Validates: Requirements 2.5
   * 
   * For any Input component with error=true, the rendered classes should contain
   * error border classes and an error message should be rendered.
   */
  it('Property 11: Input in error state shows visual feedback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (size, errorMessage, placeholder) => {
          const { container } = render(
            <Input 
              size={size} 
              error={true} 
              errorMessage={errorMessage}
              placeholder={placeholder}
            />
          )
          const input = container.querySelector('input')
          const errorText = container.querySelector('p')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Should have error border class
          expect(className).toContain('border-error-500')
          
          // Should have error focus ring
          expect(className).toContain('focus:ring-error-500')
          
          // Error message should be rendered
          expect(errorText).toBeTruthy()
          expect(errorText?.textContent).toBe(errorMessage)
          
          // Error message should have error color
          expect(errorText?.className).toContain('text-error-500')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.1: Input without error does not show error styles
   * Validates: Requirements 2.5
   * 
   * When error is false or undefined, the input should not have error styles.
   */
  it('Property 11.1: Input without error does not show error styles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (size, placeholder) => {
          const { container } = render(
            <Input 
              size={size} 
              error={false}
              placeholder={placeholder}
            />
          )
          const input = container.querySelector('input')
          const errorText = container.querySelector('p')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Should NOT have error border class
          expect(className).not.toContain('border-error-500')
          
          // Should have default border class
          expect(className).toContain('border-neutral-300')
          
          // Error message should NOT be rendered
          expect(errorText).toBeFalsy()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.2: Error message is only shown when both error and errorMessage are provided
   * Validates: Requirements 2.5
   * 
   * Error message should only be displayed when both error=true and errorMessage is provided.
   */
  it('Property 11.2: Error message is only shown when both error and errorMessage are provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.boolean(),
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        (size, hasError, errorMessage) => {
          const { container } = render(
            <Input 
              size={size} 
              error={hasError}
              errorMessage={errorMessage}
              placeholder="Test"
            />
          )
          const errorText = container.querySelector('p')
          
          // Error message should only be shown when both error=true AND errorMessage is provided
          if (hasError && errorMessage) {
            expect(errorText).toBeTruthy()
            expect(errorText?.textContent).toBe(errorMessage)
          } else {
            expect(errorText).toBeFalsy()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.3: Error state uses colors from design tokens
   * Validates: Requirements 2.5
   * 
   * Error border and text colors should come from the semantic error color in design tokens.
   */
  it('Property 11.3: Error state uses colors from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.string({ minLength: 1, maxLength: 100 }),
        (size, errorMessage) => {
          const { container } = render(
            <Input 
              size={size} 
              error={true}
              errorMessage={errorMessage}
              placeholder="Test"
            />
          )
          const input = container.querySelector('input')
          const errorText = container.querySelector('p')
          
          expect(input).toBeTruthy()
          expect(errorText).toBeTruthy()
          
          const inputClassName = input?.className || ''
          const errorClassName = errorText?.className || ''
          
          // Input should use error-500 from design tokens
          expect(inputClassName).toContain('border-error-500')
          expect(inputClassName).toContain('focus:ring-error-500')
          
          // Error text should use error-500 from design tokens
          expect(errorClassName).toContain('text-error-500')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.4: Error state is consistent across all sizes
   * Validates: Requirements 2.5
   * 
   * Error styling should be the same regardless of input size.
   */
  it('Property 11.4: Error state is consistent across all sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.string({ minLength: 1, maxLength: 100 }),
        (size, errorMessage) => {
          const { container } = render(
            <Input 
              size={size} 
              error={true}
              errorMessage={errorMessage}
              placeholder="Test"
            />
          )
          const input = container.querySelector('input')
          const errorText = container.querySelector('p')
          
          expect(input).toBeTruthy()
          expect(errorText).toBeTruthy()
          
          const inputClassName = input?.className || ''
          const errorClassName = errorText?.className || ''
          
          // All sizes should have the same error classes
          expect(inputClassName).toContain('border-error-500')
          expect(inputClassName).toContain('focus:ring-error-500')
          expect(errorClassName).toContain('text-error-500')
          expect(errorClassName).toContain('text-sm')
          expect(errorClassName).toContain('mt-1')
        }
      ),
      { numRuns: 100 }
    )
  })
})
