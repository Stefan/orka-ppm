/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Border Radius Consistency
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
 * Valid border-radius values from the design token system.
 * These correspond to the borderRadius scale defined in tailwind.config.ts:
 * none, sm, DEFAULT, md, lg, full, touch, touch-large
 */
const validBorderRadiusClasses = [
  'rounded-none',
  'rounded-sm',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-full',
  'rounded-touch',
  'rounded-touch-large'
]

/**
 * Extracts border-radius classes from a className string
 */
function extractBorderRadiusClasses(className: string): string[] {
  return className.split(' ').filter(cls => 
    cls.startsWith('rounded') && !cls.includes(':')
  )
}

/**
 * Validates that a border-radius class uses a value from the design token system
 */
function isValidBorderRadiusClass(borderRadiusClass: string): boolean {
  return validBorderRadiusClasses.includes(borderRadiusClass)
}

describe('Border Radius Consistency Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 6: Alle Komponenten verwenden Border-Radius aus Design Tokens
   * Validates: Requirements 1.5, 3.3
   * 
   * For any component (Button, Card, Input), all border-radius classes
   * should exclusively come from the defined border-radius scale.
   */
  describe('Property 6: All components use border-radius from design tokens', () => {
    it('Button components use valid border-radius values', () => {
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
            const borderRadiusClasses = extractBorderRadiusClasses(className)
            
            // Button should have at least one border-radius class
            expect(borderRadiusClasses.length).toBeGreaterThan(0)
            
            // All border-radius classes should be from valid design token values
            borderRadiusClasses.forEach(cls => {
              expect(isValidBorderRadiusClass(cls)).toBe(true)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Input components use valid border-radius values', () => {
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
            const borderRadiusClasses = extractBorderRadiusClasses(className)
            
            // Input should have at least one border-radius class
            expect(borderRadiusClasses.length).toBeGreaterThan(0)
            
            // All border-radius classes should be from valid design token values
            borderRadiusClasses.forEach(cls => {
              expect(isValidBorderRadiusClass(cls)).toBe(true)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Card components use valid border-radius values', () => {
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
            const borderRadiusClasses = extractBorderRadiusClasses(className)
            
            // Card should have at least one border-radius class
            expect(borderRadiusClasses.length).toBeGreaterThan(0)
            
            // All border-radius classes should be from valid design token values
            borderRadiusClasses.forEach(cls => {
              expect(isValidBorderRadiusClass(cls)).toBe(true)
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 6.1: Border-radius is consistent across all button variants
   * Validates: Requirements 1.5
   */
  it('Property 6.1: Border-radius is consistent across all button variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant1, variant2) => {
          const { container: container1 } = render(
            <Button variant={variant1}>Button 1</Button>
          )
          const { container: container2 } = render(
            <Button variant={variant2}>Button 2</Button>
          )
          
          const button1 = container1.querySelector('button')
          const button2 = container2.querySelector('button')
          
          expect(button1).toBeTruthy()
          expect(button2).toBeTruthy()
          
          const borderRadius1 = extractBorderRadiusClasses(button1?.className || '')
          const borderRadius2 = extractBorderRadiusClasses(button2?.className || '')
          
          // Both buttons should have the same border-radius
          expect(borderRadius1).toEqual(borderRadius2)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6.2: Border-radius is consistent across all button sizes
   * Validates: Requirements 1.5
   */
  it('Property 6.2: Border-radius is consistent across all button sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('sm', 'md', 'lg'),
        (size1, size2) => {
          const { container: container1 } = render(
            <Button size={size1}>Button 1</Button>
          )
          const { container: container2 } = render(
            <Button size={size2}>Button 2</Button>
          )
          
          const button1 = container1.querySelector('button')
          const button2 = container2.querySelector('button')
          
          expect(button1).toBeTruthy()
          expect(button2).toBeTruthy()
          
          const borderRadius1 = extractBorderRadiusClasses(button1?.className || '')
          const borderRadius2 = extractBorderRadiusClasses(button2?.className || '')
          
          // Both buttons should have the same border-radius
          expect(borderRadius1).toEqual(borderRadius2)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6.3: Border-radius is consistent across all input sizes
   * Validates: Requirements 3.3
   */
  it('Property 6.3: Border-radius is consistent across all input sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('sm', 'md', 'lg'),
        (size1, size2) => {
          const { container: container1 } = render(
            <Input size={size1} placeholder="Input 1" />
          )
          const { container: container2 } = render(
            <Input size={size2} placeholder="Input 2" />
          )
          
          const input1 = container1.querySelector('input')
          const input2 = container2.querySelector('input')
          
          expect(input1).toBeTruthy()
          expect(input2).toBeTruthy()
          
          const borderRadius1 = extractBorderRadiusClasses(input1?.className || '')
          const borderRadius2 = extractBorderRadiusClasses(input2?.className || '')
          
          // Both inputs should have the same border-radius
          expect(borderRadius1).toEqual(borderRadius2)
        }
      ),
      { numRuns: 100 }
    )
  })
})
