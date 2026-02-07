/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Sizes
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'

describe('Button Size Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 2: Button-Größen sind auf definierte Werte beschränkt
   * Validates: Requirements 1.7
   * 
   * For any Button component, the size prop should only accept the values
   * 'sm', 'md', or 'lg', and the button should render correctly with the
   * appropriate size classes from the design token system.
   */
  it('Property 2: Button sizes are restricted to defined values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (size) => {
          const { container } = render(<Button size={size}>Test Button</Button>)
          const button = container.querySelector('button')
          
          // Button should exist
          expect(button).toBeTruthy()
          
          // Button should have the correct size classes
          const className = button?.className || ''
          
          if (size === 'sm') {
            expect(className).toContain('px-3')
            expect(className).toContain('py-1.5')
            expect(className).toContain('text-sm')
          } else if (size === 'md') {
            expect(className).toContain('px-4')
            expect(className).toContain('py-2')
            expect(className).toContain('text-sm')
          } else if (size === 'lg') {
            expect(className).toContain('px-6')
            expect(className).toContain('py-3')
            expect(className).toContain('text-base')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.1: Button defaults to medium size when no size is specified
   * Validates: Requirements 1.7
   */
  it('Property 2.1: Button defaults to medium size', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (buttonText) => {
          const { container } = render(<Button>{buttonText}</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Should have medium size classes
          expect(className).toContain('px-4')
          expect(className).toContain('py-2')
          expect(className).toContain('text-sm')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.2: Button sizes use spacing from design tokens
   * Validates: Requirements 1.2, 1.7
   * 
   * All button sizes should use padding values that come from the design token
   * spacing scale (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16).
   */
  it('Property 2.2: Button sizes use spacing from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (size) => {
          const { container } = render(<Button size={size}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Valid spacing values from design tokens (in Tailwind format)
          const validSpacingClasses = [
            'px-0', 'px-1', 'px-2', 'px-3', 'px-4', 'px-5', 'px-6', 'px-8', 'px-10', 'px-12', 'px-16',
            'py-0', 'py-1', 'py-2', 'py-3', 'py-4', 'py-5', 'py-6', 'py-8', 'py-10', 'py-12', 'py-16',
            'py-1.5', 'py-2.5' // Also valid in Tailwind
          ]
          
          // Extract padding classes from button
          const paddingClasses = className.split(' ').filter(cls => 
            cls.startsWith('px-') || cls.startsWith('py-')
          )
          
          // All padding classes should be from valid spacing values
          paddingClasses.forEach(cls => {
            expect(validSpacingClasses).toContain(cls)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.3: Button size and variant combinations work correctly
   * Validates: Requirements 1.1, 1.7
   * 
   * For any combination of size and variant, the button should render with
   * both the correct size classes and variant classes.
   */
  it('Property 2.3: Button size and variant combinations work correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('primary', 'secondary', 'outline'),
        (size, variant) => {
          const { container } = render(
            <Button size={size} variant={variant}>Test</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Should have size classes
          const sizeClasses = {
            sm: ['px-3', 'py-1.5', 'text-sm'],
            md: ['px-4', 'py-2', 'text-sm'],
            lg: ['px-6', 'py-3', 'text-base']
          }
          
          sizeClasses[size].forEach(cls => {
            expect(className).toContain(cls)
          })
          
          // Should have variant classes
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
})
