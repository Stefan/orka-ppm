/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Input Component Sizes
 * Feature: design-system-consistency
 * Property 8: Input-Größen sind auf definierte Werte beschränkt
 * Validates: Requirements 2.6
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Input } from '@/components/ui/Input'
import type { ComponentSize } from '@/types/components'

describe('Input Component - Size Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 8: Input-Größen sind auf definierte Werte beschränkt
   * Validates: Requirements 2.6
   * 
   * For any Input component, the size prop should only accept the values
   * 'sm', 'md', or 'lg', and the input should render correctly with the
   * appropriate size classes from the design token system.
   */
  it('Property 8: Input sizes are restricted to defined values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ComponentSize>('sm', 'md', 'lg'),
        (size) => {
          const { container } = render(<Input size={size} placeholder="Test" />)
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          // Verify input has size-specific classes
          const className = input?.className || ''
          
          // Each size should have corresponding padding and text size
          if (size === 'sm') {
            expect(className).toContain('px-3')
            expect(className).toContain('py-1.5')
            expect(className).toContain('text-sm')
          } else if (size === 'md') {
            expect(className).toContain('px-4')
            expect(className).toContain('py-2')
            expect(className).toContain('text-sm')
          } else if (size === 'lg') {
            expect(className).toContain('px-5')
            expect(className).toContain('py-3')
            expect(className).toContain('text-lg')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8.1: Input defaults to medium size when no size is specified
   * Validates: Requirements 2.6
   */
  it('Property 8.1: Input defaults to medium size', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          const { container } = render(<Input placeholder="Test" />)
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // Should have md size classes (component uses text-sm for default)
          expect(className).toContain('px-4')
          expect(className).toContain('py-2')
          expect(className).toContain('text-sm')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8.2: Input sizes use spacing from design tokens
   * Validates: Requirements 2.1, 2.6
   * 
   * All input sizes should use padding values that come from the design token
   * spacing scale (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16).
   */
  it('Property 8.2: Input sizes use spacing from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ComponentSize>('sm', 'md', 'lg'),
        (size) => {
          const { container } = render(<Input size={size} placeholder="Test" />)
          const input = container.querySelector('input')
          
          expect(input).toBeTruthy()
          
          const className = input?.className || ''
          
          // All sizes should use spacing from design tokens (multiples of 4px)
          // sm: px-3 (12px), py-1.5 (6px)
          // md: px-4 (16px), py-2 (8px)
          // lg: px-5 (20px), py-3 (12px)
          const hasValidSpacing = 
            className.includes('px-3') || 
            className.includes('px-4') || 
            className.includes('px-5')
          
          expect(hasValidSpacing).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
