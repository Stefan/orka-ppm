/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Spacing Consistency
 * Feature: design-system-consistency
 * 
 * Tests use fast-check library with minimum 100 iterations per property.
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import fc from 'fast-check'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

/**
 * Valid spacing values from the design token system.
 * These correspond to the spacing scale defined in tailwind.config.ts:
 * 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (in 4px increments)
 * Plus Tailwind's fractional values like 1.5, 2.5
 */
const validSpacingValues = [
  '0', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32', '40', '48', '56', '64'
]

/**
 * Extracts spacing classes (padding and margin) from a className string
 */
function extractSpacingClasses(className: string): string[] {
  const spacingPrefixes = ['p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-', 'gap-']
  return className.split(' ').filter(cls => 
    spacingPrefixes.some(prefix => cls.startsWith(prefix))
  )
}

/**
 * Validates that a spacing class uses a value from the design token system
 */
function isValidSpacingClass(spacingClass: string): boolean {
  // Extract the value part (e.g., 'px-4' -> '4', 'py-1.5' -> '1.5')
  const match = spacingClass.match(/^(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap)-(.+)$/)
  if (!match) return false
  
  const value = match[1]
  return validSpacingValues.includes(value)
}

describe('Spacing Consistency Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 3: Alle Komponenten verwenden Spacing aus Design Tokens
   * Validates: Requirements 1.2, 2.1, 3.1, 4.2
   * 
   * For any component (Button, Input, Card), all padding and margin classes
   * should exclusively come from the defined spacing scale.
   */
  describe('Property 3: All components use spacing from design tokens', () => {
    it('Button components use valid spacing values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('sm', 'md', 'lg'),
          fc.constantFrom('primary', 'secondary', 'outline'),
          (size, variant) => {
            const { container } = render(
              <Button size={size} variant={variant}>Test Button</Button>
            )
            const button = container.querySelector('button')
            
            expect(button).toBeTruthy()
            
            const className = button?.className || ''
            const spacingClasses = extractSpacingClasses(className)
            
            // All spacing classes should be from valid design token values
            spacingClasses.forEach(cls => {
              expect(isValidSpacingClass(cls)).toBe(true)
            })
            
            // Button should have at least padding classes
            expect(spacingClasses.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Input components use valid spacing values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('sm', 'md', 'lg'),
          fc.boolean(),
          (size, hasError) => {
            const { container } = render(
              <Input 
                size={size} 
                error={hasError}
                errorMessage={hasError ? 'Error message' : undefined}
                placeholder="Test input"
              />
            )
            const input = container.querySelector('input')
            
            expect(input).toBeTruthy()
            
            const className = input?.className || ''
            const spacingClasses = extractSpacingClasses(className)
            
            // All spacing classes should be from valid design token values
            spacingClasses.forEach(cls => {
              expect(isValidSpacingClass(cls)).toBe(true)
            })
            
            // Input should have at least padding classes
            expect(spacingClasses.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Card components use valid spacing values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('sm', 'md', 'lg'),
          fc.constantFrom('sm', 'md', 'lg'),
          fc.boolean(),
          (padding, shadow, hasBorder) => {
            const { container } = render(
              <Card padding={padding} shadow={shadow} border={hasBorder}>
                <CardHeader>Header</CardHeader>
                <CardContent>Content</CardContent>
              </Card>
            )
            const card = container.firstChild as HTMLElement
            
            expect(card).toBeTruthy()
            
            const className = card?.className || ''
            const spacingClasses = extractSpacingClasses(className)
            
            // All spacing classes should be from valid design token values
            spacingClasses.forEach(cls => {
              expect(isValidSpacingClass(cls)).toBe(true)
            })
            
            // Card should have at least padding classes
            expect(spacingClasses.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('CardHeader uses valid spacing values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (headerText) => {
            const { container } = render(
              <Card>
                <CardHeader>{headerText}</CardHeader>
              </Card>
            )
            const cardHeader = container.querySelector('[class*="border-b"]')
            
            expect(cardHeader).toBeTruthy()
            
            const className = cardHeader?.className || ''
            const spacingClasses = extractSpacingClasses(className)
            
            // All spacing classes should be from valid design token values
            spacingClasses.forEach(cls => {
              expect(isValidSpacingClass(cls)).toBe(true)
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3.1: Spacing values are consistent across component sizes
   * Validates: Requirements 1.2, 2.1, 4.2
   */
  it('Property 3.1: Spacing increases proportionally with component size', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          // Render buttons of all sizes
          const { container: smContainer } = render(<Button size="sm" variant={variant}>Sm</Button>)
          const { container: mdContainer } = render(<Button size="md" variant={variant}>Md</Button>)
          const { container: lgContainer } = render(<Button size="lg" variant={variant}>Lg</Button>)
          
          const smButton = smContainer.querySelector('button')
          const mdButton = mdContainer.querySelector('button')
          const lgButton = lgContainer.querySelector('button')
          
          expect(smButton).toBeTruthy()
          expect(mdButton).toBeTruthy()
          expect(lgButton).toBeTruthy()
          
          // Extract horizontal padding values
          const getPxValue = (className: string): number => {
            const match = className.match(/px-(\d+(?:\.\d+)?)/)
            return match ? parseFloat(match[1]) : 0
          }
          
          const smPx = getPxValue(smButton?.className || '')
          const mdPx = getPxValue(mdButton?.className || '')
          const lgPx = getPxValue(lgButton?.className || '')
          
          // Larger sizes should have equal or larger padding
          expect(mdPx).toBeGreaterThanOrEqual(smPx)
          expect(lgPx).toBeGreaterThanOrEqual(mdPx)
        }
      ),
      { numRuns: 100 }
    )
  })
})
