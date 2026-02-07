/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Card Component Shadow
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Card } from '@/components/ui/card'

describe('Card Component Shadow Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 12: Card verwendet Shadow aus Design Tokens
   * Validates: Requirements 3.2
   * 
   * For any Card component, the shadow prop should only accept values from the
   * defined shadow scale ('sm', 'md', 'lg'), and the card should render with
   * the appropriate shadow classes from design tokens.
   */
  it('Property 12: Card uses shadow from design tokens', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (shadow) => {
          const { container } = render(
            <Card shadow={shadow}>
              <div>Test Card Content</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          // Card should exist
          expect(card).toBeTruthy()
          
          // Card should have the correct shadow class from design tokens
          const className = card?.className || ''
          
          if (shadow === 'sm') {
            expect(className).toContain('shadow-sm')
          } else if (shadow === 'md') {
            expect(className).toContain('shadow-md')
          } else if (shadow === 'lg') {
            expect(className).toContain('shadow-lg')
          }
          
          // Card should have base styles
          expect(className).toContain('bg-white')
          expect(className).toContain('rounded-lg')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12.1: Card defaults to md shadow when no shadow is specified
   * Validates: Requirements 3.2
   */
  it('Property 12.1: Card defaults to md shadow', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (content) => {
          const { container } = render(<Card><div>{content}</div></Card>)
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Should have md shadow by default
          expect(className).toContain('shadow-md')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12.2: All shadow variants maintain consistent base styles
   * Validates: Requirements 3.2, 3.3
   */
  it('Property 12.2: All shadow variants share consistent base styles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (shadow) => {
          const { container } = render(
            <Card shadow={shadow}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // All shadow variants should have these base styles
          expect(className).toContain('bg-white')
          expect(className).toContain('rounded-lg') // Border radius from design tokens
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12.3: Shadow classes are mutually exclusive
   * Validates: Requirements 3.2
   */
  it('Property 12.3: Only one shadow class is applied at a time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        (shadow) => {
          const { container } = render(
            <Card shadow={shadow}>
              <div>Test</div>
            </Card>
          )
          const card = container.querySelector('div')
          
          expect(card).toBeTruthy()
          
          const className = card?.className || ''
          
          // Count how many shadow classes are present
          const shadowClasses = ['shadow-sm', 'shadow-md', 'shadow-lg']
          const presentShadows = shadowClasses.filter(cls => className.includes(cls))
          
          // Only one shadow class should be present
          expect(presentShadows.length).toBe(1)
          expect(presentShadows[0]).toBe(`shadow-${shadow}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
