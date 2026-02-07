/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for CardHeader Component
 * Feature: design-system-consistency
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

describe('CardHeader Component Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 13: CardHeader hat konsistente Styles
   * Validates: Requirements 3.4
   * 
   * For any CardHeader component, it should render with consistent styles including
   * a bottom border and consistent padding/margin values from design tokens.
   */
  it('Property 13: CardHeader has consistent styles', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (headerContent) => {
          const { container } = render(
            <Card>
              <CardHeader>
                <h3>{headerContent}</h3>
              </CardHeader>
              <CardContent>
                <p>Content</p>
              </CardContent>
            </Card>
          )
          
          // Find the CardHeader div (second div, first is Card)
          const cardHeader = container.querySelectorAll('div')[1]
          
          expect(cardHeader).toBeTruthy()
          
          const className = cardHeader?.className || ''
          
          // CardHeader should have bottom border
          expect(className).toContain('border-b')
          expect(className).toContain('border-neutral-200')
          
          // CardHeader should have consistent padding/margin from design tokens
          expect(className).toContain('pb-4') // padding-bottom: 16px (spacing-4)
          expect(className).toContain('mb-4') // margin-bottom: 16px (spacing-4)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13.1: CardHeader styles are consistent regardless of content
   * Validates: Requirements 3.4
   */
  it('Property 13.1: CardHeader maintains consistent styles with varying content', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (contentArray) => {
          const { container } = render(
            <Card>
              <CardHeader>
                {contentArray.map((text, idx) => (
                  <div key={idx}>{text}</div>
                ))}
              </CardHeader>
            </Card>
          )
          
          const cardHeader = container.querySelectorAll('div')[1]
          
          expect(cardHeader).toBeTruthy()
          
          const className = cardHeader?.className || ''
          
          // Styles should be consistent regardless of content complexity
          expect(className).toContain('border-b')
          expect(className).toContain('border-neutral-200')
          expect(className).toContain('pb-4')
          expect(className).toContain('mb-4')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13.2: CardHeader can accept custom className while maintaining base styles
   * Validates: Requirements 3.4
   */
  it('Property 13.2: CardHeader accepts custom className without losing base styles', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('text-center', 'font-bold', 'text-lg', 'uppercase'),
        (customClass) => {
          const { container } = render(
            <Card>
              <CardHeader className={customClass}>
                <h3>Header</h3>
              </CardHeader>
            </Card>
          )
          
          const cardHeader = container.querySelectorAll('div')[1]
          
          expect(cardHeader).toBeTruthy()
          
          const className = cardHeader?.className || ''
          
          // Should have custom class
          expect(className).toContain(customClass)
          
          // Should still have base styles
          expect(className).toContain('border-b')
          expect(className).toContain('border-neutral-200')
          expect(className).toContain('pb-4')
          expect(className).toContain('mb-4')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13.3: CardHeader border uses design token colors
   * Validates: Requirements 3.4
   */
  it('Property 13.3: CardHeader border color comes from design tokens', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (content) => {
          const { container } = render(
            <Card>
              <CardHeader>
                <div>{content}</div>
              </CardHeader>
            </Card>
          )
          
          const cardHeader = container.querySelectorAll('div')[1]
          
          expect(cardHeader).toBeTruthy()
          
          const className = cardHeader?.className || ''
          
          // Border color should be from neutral palette (design token)
          expect(className).toContain('border-neutral-200')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13.4: Multiple CardHeaders in same Card maintain consistent styles
   * Validates: Requirements 3.4
   */
  it('Property 13.4: Multiple CardHeaders maintain consistency', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 })
        ),
        ([header1, header2]) => {
          const { container } = render(
            <Card>
              <CardHeader>
                <div>{header1}</div>
              </CardHeader>
              <CardHeader>
                <div>{header2}</div>
              </CardHeader>
            </Card>
          )
          
          // Get all divs and filter for CardHeader components (they have border-b class)
          const allDivs = Array.from(container.querySelectorAll('div'))
          const cardHeaders = allDivs.filter(div => 
            div.className.includes('border-b') && 
            div.className.includes('border-neutral-200') &&
            div.className.includes('pb-4')
          )
          
          expect(cardHeaders.length).toBe(2)
          
          // Both should have identical base styles
          cardHeaders.forEach(header => {
            const className = header?.className || ''
            
            expect(className).toContain('border-b')
            expect(className).toContain('border-neutral-200')
            expect(className).toContain('pb-4')
            expect(className).toContain('mb-4')
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
