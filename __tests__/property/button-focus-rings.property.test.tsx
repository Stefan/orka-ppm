/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Focus Rings
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'

describe('Button Focus Ring Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 7: Interaktive Elemente haben Focus-Rings
   * Validates: Requirements 1.6
   * 
   * For any interactive Button component, the rendered classes should contain
   * focus ring classes with at least 2px width to ensure accessibility and
   * keyboard navigation visibility.
   */
  it('Property 7: Interactive elements have focus rings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test Button</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Button should have focus ring classes
          const focusClasses = className.split(' ').filter(cls => cls.startsWith('focus:'))
          expect(focusClasses.length).toBeGreaterThan(0)
          
          // Button should have focus:ring-2 (2px width) or greater
          const hasFocusRing = className.includes('focus:ring-2') || 
                               className.includes('focus:ring-3') ||
                               className.includes('focus:ring-4')
          expect(hasFocusRing).toBe(true)
          
          // Button should remove default outline
          expect(className).toContain('focus:outline-none')
          
          // Button should have focus ring color
          expect(className).toContain('focus:ring-blue-500')
          
          // Button should have focus ring offset
          expect(className).toContain('focus:ring-offset-2')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.1: All button sizes have consistent focus rings
   * Validates: Requirements 1.6
   */
  it('Property 7.1: All button sizes have consistent focus rings', () => {
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
          
          // All sizes should have the same focus ring configuration
          expect(className).toContain('focus:ring-2')
          expect(className).toContain('focus:ring-blue-500')
          expect(className).toContain('focus:ring-offset-2')
          expect(className).toContain('focus:outline-none')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.2: Focus ring width meets accessibility requirements
   * Validates: Requirements 1.6, 7.1
   */
  it('Property 7.2: Focus ring width meets minimum 2px accessibility requirement', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Extract focus ring width class
          const focusRingClasses = className.split(' ').filter(cls => 
            cls.match(/focus:ring-\d+/)
          )
          
          expect(focusRingClasses.length).toBeGreaterThan(0)
          
          // Check that ring width is at least 2px
          const ringWidthClass = focusRingClasses[0]
          const widthMatch = ringWidthClass.match(/focus:ring-(\d+)/)
          
          if (widthMatch) {
            const width = parseInt(widthMatch[1], 10)
            expect(width).toBeGreaterThanOrEqual(2)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.3: Focus ring color comes from design tokens
   * Validates: Requirements 1.3, 1.6
   */
  it('Property 7.3: Focus ring color comes from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Define valid focus ring colors from design tokens (using Tailwind blue/gray)
          const validFocusRingColors = [
            'focus:ring-blue-50', 'focus:ring-blue-100', 'focus:ring-blue-200',
            'focus:ring-blue-300', 'focus:ring-blue-400', 'focus:ring-blue-500',
            'focus:ring-blue-600', 'focus:ring-blue-700', 'focus:ring-blue-800',
            'focus:ring-blue-900',
            'focus:ring-gray-50', 'focus:ring-gray-100', 'focus:ring-gray-200',
            'focus:ring-gray-300', 'focus:ring-gray-400', 'focus:ring-gray-500',
            'focus:ring-gray-600', 'focus:ring-gray-700', 'focus:ring-gray-800',
            'focus:ring-gray-900'
          ]
          
          // Extract focus ring color classes
          const focusRingColorClasses = className.split(' ').filter(cls => 
            cls.match(/focus:ring-(blue|gray)-\d+/)
          )
          
          expect(focusRingColorClasses.length).toBeGreaterThan(0)
          
          // All focus ring colors should be from design tokens
          focusRingColorClasses.forEach(cls => {
            expect(validFocusRingColors).toContain(cls)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.4: Disabled buttons maintain focus ring classes
   * Validates: Requirements 1.6, 7.3
   */
  it('Property 7.4: Disabled buttons maintain focus ring classes for consistency', () => {
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
          
          // Disabled buttons should still have focus ring classes
          // (browser handles disabled focus behavior)
          expect(className).toContain('focus:ring-2')
          expect(className).toContain('focus:ring-blue-500')
          expect(className).toContain('focus:outline-none')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.5: Focus ring offset provides visual separation
   * Validates: Requirements 1.6
   */
  it('Property 7.5: Focus ring has offset for visual separation from button', () => {
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
          
          const className = button?.className || ''
          
          // Button should have focus ring offset for visual separation
          const hasRingOffset = className.includes('focus:ring-offset-1') ||
                                className.includes('focus:ring-offset-2') ||
                                className.includes('focus:ring-offset-3') ||
                                className.includes('focus:ring-offset-4')
          
          expect(hasRingOffset).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7.6: All button variants have consistent focus ring configuration
   * Validates: Requirements 1.6
   */
  it('Property 7.6: All button variants use the same focus ring configuration', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // All variants should have identical focus ring configuration
          // This ensures consistent keyboard navigation experience
          expect(className).toContain('focus:outline-none')
          expect(className).toContain('focus:ring-2')
          expect(className).toContain('focus:ring-blue-500')
          expect(className).toContain('focus:ring-offset-2')
        }
      ),
      { numRuns: 100 }
    )
  })
})
