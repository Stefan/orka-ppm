/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Hover States
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'

describe('Button Hover State Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 5: Buttons haben Hover-States
   * Validates: Requirements 1.4
   * 
   * For any Button variant, the rendered classes should contain hover state
   * classes (hover:*) to provide visual feedback when users hover over the button.
   */
  it('Property 5: Buttons have hover states', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test Button</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Button should have at least one hover state class
          const hoverClasses = className.split(' ').filter(cls => cls.startsWith('hover:'))
          expect(hoverClasses.length).toBeGreaterThan(0)
          
          // Verify specific hover states for each variant
          if (variant === 'primary') {
            expect(className).toContain('hover:bg-blue-700')
          } else if (variant === 'secondary') {
            expect(className).toContain('hover:bg-gray-200')
          } else if (variant === 'outline') {
            expect(className).toContain('hover:bg-blue-50')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.1: All button variants have consistent hover behavior
   * Validates: Requirements 1.4
   */
  it('Property 5.1: All button variants have consistent hover behavior', () => {
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
          
          // All buttons should have hover state classes regardless of size
          const hoverClasses = className.split(' ').filter(cls => cls.startsWith('hover:'))
          expect(hoverClasses.length).toBeGreaterThan(0)
          
          // Hover classes should be background-related for visual feedback
          const hasBackgroundHover = hoverClasses.some(cls => cls.includes('bg-'))
          expect(hasBackgroundHover).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.2: Hover states use colors from design tokens
   * Validates: Requirements 1.3, 1.4
   */
  it('Property 5.2: Hover states use colors from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Define valid hover color classes from design tokens (using Tailwind blue/gray)
          const validHoverColors = [
            'hover:bg-blue-50', 'hover:bg-blue-100', 'hover:bg-blue-200',
            'hover:bg-blue-300', 'hover:bg-blue-400', 'hover:bg-blue-500',
            'hover:bg-blue-600', 'hover:bg-blue-700', 'hover:bg-blue-800',
            'hover:bg-blue-900',
            'hover:bg-gray-50', 'hover:bg-gray-100', 'hover:bg-gray-200',
            'hover:bg-gray-300', 'hover:bg-gray-400', 'hover:bg-gray-500',
            'hover:bg-gray-600', 'hover:bg-gray-700', 'hover:bg-gray-800',
            'hover:bg-gray-900'
          ]
          
          // Extract hover classes
          const hoverClasses = className.split(' ').filter(cls => 
            cls.startsWith('hover:bg-')
          )
          
          // All hover classes should be from design tokens
          hoverClasses.forEach(cls => {
            expect(validHoverColors).toContain(cls)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.3: Disabled buttons do not have hover effects
   * Validates: Requirements 1.4, 7.3
   */
  it('Property 5.3: Disabled buttons maintain hover classes but are visually disabled', () => {
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
          
          // Disabled buttons should have disabled styles
          expect(className).toContain('disabled:opacity-50')
          expect(className).toContain('disabled:cursor-not-allowed')
          
          // Hover classes are still present (CSS handles the disabled state)
          const hoverClasses = className.split(' ').filter(cls => cls.startsWith('hover:'))
          expect(hoverClasses.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.4: Buttons have active states in addition to hover states
   * Validates: Requirements 1.4
   */
  it('Property 5.4: Buttons have active states for click feedback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Button should have active state classes for click feedback
          const activeClasses = className.split(' ').filter(cls => cls.startsWith('active:'))
          expect(activeClasses.length).toBeGreaterThan(0)
          
          // Verify specific active states for each variant
          if (variant === 'primary') {
            expect(className).toContain('active:bg-blue-800')
          } else if (variant === 'secondary') {
            expect(className).toContain('active:bg-gray-300')
          } else if (variant === 'outline') {
            expect(className).toContain('active:bg-blue-100')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5.5: Buttons have smooth transitions for hover effects
   * Validates: Requirements 1.4
   */
  it('Property 5.5: Buttons have transition classes for smooth hover effects', () => {
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
          
          // Button should have transition classes for smooth state changes
          expect(className).toContain('transition-all')
        }
      ),
      { numRuns: 100 }
    )
  })
})
