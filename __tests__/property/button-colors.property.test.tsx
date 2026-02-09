/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Button Component Colors
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/Button'

describe('Button Color Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 4: Button-Farben stammen aus Design Tokens
   * Validates: Requirements 1.3
   * 
   * For any Button variant, all color classes used should come exclusively from
   * the defined design tokens (blue, gray, red for semantic). No arbitrary color
   * values should be used.
   */
  it('Property 4: Button colors come from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test Button</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Define valid color classes from design tokens (using Tailwind blue/gray)
          const validBlueColors = [
            'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300',
            'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700',
            'bg-blue-800', 'bg-blue-900',
            'text-blue-50', 'text-blue-100', 'text-blue-200', 'text-blue-300',
            'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700',
            'text-blue-800', 'text-blue-900',
            'border-blue-50', 'border-blue-100', 'border-blue-200', 'border-blue-300',
            'border-blue-400', 'border-blue-500', 'border-blue-600', 'border-blue-700',
            'border-blue-800', 'border-blue-900',
            'hover:bg-blue-50', 'hover:bg-blue-100', 'hover:bg-blue-200', 'hover:bg-blue-300',
            'hover:bg-blue-400', 'hover:bg-blue-500', 'hover:bg-blue-600', 'hover:bg-blue-700',
            'hover:bg-blue-800', 'hover:bg-blue-900',
            'active:bg-blue-50', 'active:bg-blue-100', 'active:bg-blue-200', 'active:bg-blue-300',
            'active:bg-blue-400', 'active:bg-blue-500', 'active:bg-blue-600', 'active:bg-blue-700',
            'active:bg-blue-800', 'active:bg-blue-900',
            'focus:ring-blue-500'
          ]
          
          const validGrayColors = [
            'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-300',
            'bg-gray-400', 'bg-gray-500', 'bg-gray-600', 'bg-gray-700',
            'bg-gray-800', 'bg-gray-900',
            'text-gray-50', 'text-gray-100', 'text-gray-200', 'text-gray-300',
            'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700',
            'text-gray-800', 'text-gray-900',
            'border-gray-50', 'border-gray-100', 'border-gray-200', 'border-gray-300',
            'border-gray-400', 'border-gray-500', 'border-gray-600', 'border-gray-700',
            'border-gray-800', 'border-gray-900',
            'hover:bg-gray-50', 'hover:bg-gray-100', 'hover:bg-gray-200', 'hover:bg-gray-300',
            'hover:bg-gray-400', 'hover:bg-gray-500', 'hover:bg-gray-600', 'hover:bg-gray-700',
            'hover:bg-gray-800', 'hover:bg-gray-900',
            'active:bg-gray-50', 'active:bg-gray-100', 'active:bg-gray-200', 'active:bg-gray-300',
            'active:bg-gray-400', 'active:bg-gray-500', 'active:bg-gray-600', 'active:bg-gray-700',
            'active:bg-gray-800', 'active:bg-gray-900'
          ]
          
          // Dark mode variants (added by dark mode compliance)
          const validDarkColors = [
            // Slate (dark mode equivalents of gray)
            'dark:bg-slate-700', 'dark:bg-slate-800', 'dark:bg-slate-800/50',
            'dark:text-slate-100', 'dark:text-slate-200', 'dark:text-slate-300',
            'dark:text-slate-400', 'dark:text-slate-500',
            'dark:border-slate-600', 'dark:border-slate-700',
            'dark:hover:bg-slate-600', 'dark:hover:bg-slate-700',
            // Blue dark variants
            'dark:text-blue-400', 'dark:bg-blue-900/30',
            // Red dark variants
            'dark:text-red-400', 'dark:bg-red-900/30',
          ]

          const validColors = [
            ...validBlueColors,
            ...validGrayColors,
            ...validDarkColors,
            'text-white', // White is a standard color
            'bg-transparent' // Transparent for outline variant
          ]
          
          // Extract color-related classes
          const colorClasses = className.split(' ').filter(cls => 
            cls.includes('bg-') || 
            cls.includes('text-') || 
            cls.includes('border-') ||
            cls.includes('ring-')
          )
          
          // All color classes should be from design tokens
          colorClasses.forEach(cls => {
            // Check if it's a valid design token color or a non-color class
            const isValidColor = validColors.includes(cls)
            const isNonColorClass = 
              cls === 'text-sm' || cls === 'text-base' || cls === 'text-lg' || // Font sizes
              cls === 'focus:ring-2' || cls === 'focus:ring-offset-2' || // Ring width
              cls === 'border-2' || cls === 'border' // Border width
            
            expect(isValidColor || isNonColorClass).toBe(true)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4.1: Primary variant uses blue color tokens
   * Validates: Requirements 1.3
   */
  it('Property 4.1: Primary variant uses blue color tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (buttonText) => {
          const { container } = render(<Button variant="primary">{buttonText}</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Primary variant should use blue-600 for background
          expect(className).toContain('bg-blue-600')
          
          // Primary variant should use blue-700 for hover
          expect(className).toContain('hover:bg-blue-700')
          
          // Primary variant should use blue-800 for active
          expect(className).toContain('active:bg-blue-800')
          
          // Primary variant should use blue-500 for focus ring
          expect(className).toContain('focus:ring-blue-500')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4.2: Secondary variant uses gray color tokens
   * Validates: Requirements 1.3
   */
  it('Property 4.2: Secondary variant uses gray color tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (buttonText) => {
          const { container } = render(<Button variant="secondary">{buttonText}</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Secondary variant should use gray-100 for background
          expect(className).toContain('bg-gray-100')
          
          // Secondary variant should use gray-900 for text
          expect(className).toContain('text-gray-900')
          
          // Secondary variant should use gray-200 for hover
          expect(className).toContain('hover:bg-gray-200')
          
          // Secondary variant should use gray-300 for active
          expect(className).toContain('active:bg-gray-300')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4.3: Outline variant uses blue color tokens for borders
   * Validates: Requirements 1.3
   */
  it('Property 4.3: Outline variant uses blue color tokens for borders', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (buttonText) => {
          const { container } = render(<Button variant="outline">{buttonText}</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // Outline variant should use blue-600 for border
          expect(className).toContain('border-blue-600')
          
          // Outline variant should use blue-600 for text
          expect(className).toContain('text-blue-600')
          
          // Outline variant should use blue-50 for hover background
          expect(className).toContain('hover:bg-blue-50')
          
          // Outline variant should use blue-100 for active background
          expect(className).toContain('active:bg-blue-100')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4.4: All variants use consistent focus ring color
   * Validates: Requirements 1.3, 1.6
   */
  it('Property 4.4: All variants use consistent focus ring color from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container } = render(<Button variant={variant}>Test</Button>)
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          
          // All variants should use blue-500 for focus ring (consistent across all buttons)
          expect(className).toContain('focus:ring-blue-500')
        }
      ),
      { numRuns: 100 }
    )
  })
})
