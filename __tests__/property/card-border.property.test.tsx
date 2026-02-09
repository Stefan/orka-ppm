/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Card Component Border
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Card } from '@/components/ui/Card'

describe('Card Component Border Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 14: Card mit Border verwendet konsistente Border-Styles
   * Validates: Requirements 3.5
   * 
   * For any Card component with border=true, it should render with consistent
   * border styles including border width and color from design tokens.
   */
  it('Property 14: Card with border uses consistent border styles', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (borderEnabled) => {
          const { container } = render(
            <Card border={borderEnabled}>
              <div>Test Card Content</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          if (borderEnabled) {
            // Card with border should have border class
            expect(className).toContain('border')
            // Border color from design tokens (neutral/gray palette)
            expect(className.match(/border-(neutral|gray)-200/) || className.includes('border-slate-700')).toBeTruthy()
          } else {
            // Card without border should not have border color classes
            expect(className).not.toMatch(/border-(neutral|gray)-200/)
          }

          // Card should always have base styles regardless of border
          expect(className).toContain('bg-white')
          expect(className).toMatch(/rounded-(lg|xl)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14.1: Card border width is consistent
   * Validates: Requirements 3.5
   */
  it('Property 14.1: Card border has consistent width', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (padding) => {
          const { container } = render(
            <Card border={true} padding={padding}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Border should be present with consistent width (1px default)
          expect(className).toContain('border')
          expect(className.match(/border-(neutral|gray)-200/) || className.includes('border-slate-700')).toBeTruthy()
          
          // Should not have border-2, border-4, etc. (only default 1px border)
          expect(className).not.toContain('border-2')
          expect(className).not.toContain('border-4')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14.2: Card border color comes from design tokens
   * Validates: Requirements 3.5
   */
  it('Property 14.2: Card border color is from neutral palette', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (shadow) => {
          const { container } = render(
            <Card border={true} shadow={shadow}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Border color from design tokens (neutral/gray/slate)
          expect(className.match(/border-(neutral|gray)-200|border-slate-700/)).toBeTruthy()

          // Should not use other color palettes for border
          expect(className).not.toContain('border-primary')
          expect(className).not.toContain('border-secondary')
          expect(className).not.toContain('border-error')
          expect(className).not.toContain('border-success')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14.3: Card border works with all padding variants
   * Validates: Requirements 3.5, 3.1
   */
  it('Property 14.3: Card border is compatible with all padding variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (padding) => {
          const { container } = render(
            <Card border={true} padding={padding}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Should have border
          expect(className).toContain('border')
          expect(className.match(/border-(neutral|gray)-200|border-slate-700/)).toBeTruthy()

          // Should have the specified padding
          if (padding === 'sm') {
            expect(className).toContain('p-4')
          } else if (padding === 'md') {
            expect(className).toContain('p-6')
          } else if (padding === 'lg') {
            expect(className).toContain('p-8')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14.4: Card border works with all shadow variants
   * Validates: Requirements 3.5, 3.2
   */
  it('Property 14.4: Card border is compatible with all shadow variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (shadow) => {
          const { container } = render(
            <Card border={true} shadow={shadow}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Should have border
          expect(className).toContain('border')
          expect(className.match(/border-(neutral|gray)-200|border-slate-700/)).toBeTruthy()

          // Should have the specified shadow
          expect(className).toContain(`shadow-${shadow}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14.5: Card without border prop defaults to no border
   * Validates: Requirements 3.5
   */
  it('Property 14.5: Card defaults to no border when border prop is omitted', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (content) => {
          const { container } = render(
            <Card>
              <div>{content}</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Should not have border-neutral-200 class
          expect(className).not.toContain('border-neutral-200')
        }
      ),
      { numRuns: 100 }
    )
  })
})
