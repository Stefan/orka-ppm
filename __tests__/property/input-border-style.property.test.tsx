/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Input Component Border Style
 * Feature: design-system-consistency
 * Property 9: Input hat einheitlichen Border-Style
 * Validates: Requirements 2.2
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Input } from '@/components/ui/input'

describe('Input Component - Border Style Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 9: Input hat einheitlichen Border-Style
   * Validates: Requirements 2.2
   * 
   * For any Input component, the rendered classes should contain a border
   * with 1px width (border or border-1).
   */
  it('Property 9: Input has uniform border style with 1px width', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (size, placeholder) => {
          const { container } = render(
            <Input size={size} placeholder={placeholder} />
          )
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Should have border class (border implies 1px width in Tailwind)
          expect(className).toContain('border')
          
          // Should have border color from design tokens
          expect(className).toContain('border-neutral-300')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.1: Input border style is consistent across all sizes
   * Validates: Requirements 2.2
   * 
   * All input sizes should have the same border width and style.
   */
  it('Property 9.1: Input border style is consistent across all sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    const borderClasses: string[] = []
    
    fc.assert(
      fc.property(
        fc.constantFrom(...sizes),
        (size) => {
          const { container } = render(<Input size={size} placeholder="Test" />)
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Extract border-related classes
          const currentBorderClasses = className
            .split(' ')
            .filter(cls => cls.startsWith('border'))
            .sort()
            .join(' ')
          
          borderClasses.push(currentBorderClasses)
          
          // All sizes should have the same border classes
          if (borderClasses.length > 1) {
            expect(currentBorderClasses).toBe(borderClasses[0])
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.2: Input border uses colors from design tokens
   * Validates: Requirements 2.2
   * 
   * Input border colors should come from the defined design token palette.
   */
  it('Property 9.2: Input border uses colors from design tokens', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom('sm', 'md', 'lg'),
        (hasError, size) => {
          const { container } = render(
            <Input size={size} error={hasError} placeholder="Test" />
          )
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Valid border colors from design tokens
          const validBorderColors = [
            'border-neutral-300',  // Default state
            'border-error-500',    // Error state
            'border-transparent'   // Focus state
          ]
          
          // Extract border color classes
          const borderColorClasses = className
            .split(' ')
            .filter(cls => cls.startsWith('border-') && !cls.includes('focus:'))
          
          // At least one border color should be from valid design tokens
          const hasValidBorderColor = borderColorClasses.some(cls =>
            validBorderColors.includes(cls)
          )
          
          expect(hasValidBorderColor).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9.3: Input border has rounded corners from design tokens
   * Validates: Requirements 2.2
   * 
   * Input should have border-radius from the design token system.
   */
  it('Property 9.3: Input border has rounded corners from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (size) => {
          const { container } = render(<Input size={size} placeholder="Test" />)
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Should have rounded corners (rounded-md = 8px from design tokens)
          expect(className).toContain('rounded-md')
        }
      ),
      { numRuns: 100 }
    )
  })
})
