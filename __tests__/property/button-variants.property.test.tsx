/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Variants
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'

describe('Button Component Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 1: Button-Varianten sind auf definierte Werte beschränkt
   * Validates: Requirements 1.1
   * 
   * For any Button component, the variant prop should only accept the values
   * 'primary', 'secondary', or 'outline', and the button should render correctly
   * with the appropriate variant classes.
   */
  it('Property 1: Button variants are restricted to defined values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test Button</Button>)
          const button = container.querySelector('button')
          
          // Button should exist
          expect(button).toBeTruthy()
          
          // Button should have the correct variant classes
          const className = button?.className || ''
          
          if (variant === 'primary') {
            expect(className).toContain('bg-blue-600')
            expect(className).toContain('text-white')
            expect(className).toContain('hover:bg-blue-700')
          } else if (variant === 'secondary') {
            expect(className).toContain('bg-gray-100')
            expect(className).toContain('text-gray-900')
            expect(className).toContain('hover:bg-gray-200')
          } else if (variant === 'outline') {
            expect(className).toContain('border-2')
            expect(className).toContain('border-blue-600')
            expect(className).toContain('text-blue-600')
            expect(className).toContain('hover:bg-blue-50')
          }
          
          // Button should have base styles
          expect(className).toContain('rounded-lg')
          expect(className).toContain('font-medium')
          expect(className).toContain('transition-all')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1.1: Button defaults to primary variant when no variant is specified
   * Validates: Requirements 1.1
   */
  it('Property 1.1: Button defaults to primary variant', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (buttonText) => {
          const { container } = render(<Button>{buttonText}</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Should have primary variant classes
          expect(className).toContain('bg-blue-600')
          expect(className).toContain('text-white')
          expect(className).toContain('hover:bg-blue-700')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1.2: All button variants have consistent base styles
   * Validates: Requirements 1.1, 1.5, 1.6
   */
  it('Property 1.2: All button variants share consistent base styles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // All variants should have these base styles
          expect(className).toContain('rounded-lg') // Border radius from design tokens
          expect(className).toContain('font-medium')
          expect(className).toContain('transition-all')
          expect(className).toContain('focus:outline-none')
          expect(className).toContain('focus:ring-2') // Focus ring with 2px width
          expect(className).toContain('focus:ring-blue-500')
          expect(className).toContain('focus:ring-offset-2')
          expect(className).toContain('disabled:opacity-50')
          expect(className).toContain('disabled:cursor-not-allowed')
        }
      ),
      { numRuns: 100 }
    )
  })
})
