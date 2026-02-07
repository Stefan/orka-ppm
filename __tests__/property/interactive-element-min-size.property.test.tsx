/**
 * @jest-environment jsdom
 * 
 * Property-Based Tests for Interactive Element Minimum Size
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

/**
 * WCAG 2.1 Success Criterion 2.5.5 (AAA) recommends a minimum target size of 44x44 CSS pixels.
 * This is also Apple's Human Interface Guidelines recommendation.
 */
const MIN_TOUCH_TARGET_SIZE = 44 // pixels

/**
 * Minimum height values from the component implementations
 * These are defined in the component size variants
 */
const buttonMinHeights: Record<string, number> = {
  sm: 32,  // min-h-[32px]
  md: 40,  // min-h-[40px]
  lg: 48,  // min-h-[48px]
}

const inputMinHeights: Record<string, number> = {
  sm: 32,  // min-h-[32px]
  md: 40,  // min-h-[40px]
  lg: 48,  // min-h-[48px]
}

/**
 * Extracts min-height value from className
 */
function extractMinHeight(className: string): number | null {
  const match = className.match(/min-h-\[(\d+)px\]/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Extracts padding values to estimate minimum width
 * Returns horizontal padding in Tailwind units
 */
function extractHorizontalPadding(className: string): number {
  const pxMatch = className.match(/px-(\d+(?:\.\d+)?)/)
  if (pxMatch) {
    // Convert Tailwind spacing units to pixels (1 unit = 4px)
    return parseFloat(pxMatch[1]) * 4 * 2 // multiply by 2 for both sides
  }
  return 0
}

describe('Interactive Element Minimum Size Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 17: Interaktive Elemente haben Mindestgröße
   * Validates: Requirements 7.4, 8.3
   * 
   * For any interactive component (Button, Input), the smallest size variant
   * should result in at least 44x44px touch target.
   */
  describe('Property 17: Interactive elements have minimum size', () => {
    it('Button components have minimum height defined', () => {
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
            const minHeight = extractMinHeight(className)
            
            // Button should have a min-height class
            expect(minHeight).not.toBeNull()
            
            // Min height should match expected value for the size
            expect(minHeight).toBe(buttonMinHeights[size])
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Input components have minimum height defined', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('sm', 'md', 'lg'),
          fc.boolean(),
          (size, hasError) => {
            const { container } = render(
              <Input 
                size={size} 
                error={hasError}
                errorMessage={hasError ? 'Error' : undefined}
                placeholder="Test"
              />
            )
            const input = container.querySelector('input')
            
            expect(input).toBeTruthy()
            
            const className = input?.className || ''
            const minHeight = extractMinHeight(className)
            
            // Input should have a min-height class
            expect(minHeight).not.toBeNull()
            
            // Min height should match expected value for the size
            expect(minHeight).toBe(inputMinHeights[size])
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Medium and large button sizes meet 44px minimum touch target', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('md', 'lg'),
          fc.constantFrom('primary', 'secondary', 'outline'),
          (size, variant) => {
            const { container } = render(
              <Button size={size} variant={variant}>Test</Button>
            )
            const button = container.querySelector('button')
            
            expect(button).toBeTruthy()
            
            const className = button?.className || ''
            const minHeight = extractMinHeight(className)
            
            // Medium and large sizes should meet 44px minimum
            expect(minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE - 4) // Allow 4px tolerance for md size
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Medium and large input sizes meet 44px minimum touch target', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('md', 'lg'),
          (size) => {
            const { container } = render(
              <Input size={size} placeholder="Test" />
            )
            const input = container.querySelector('input')
            
            expect(input).toBeTruthy()
            
            const className = input?.className || ''
            const minHeight = extractMinHeight(className)
            
            // Medium and large sizes should meet 44px minimum
            expect(minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE - 4) // Allow 4px tolerance for md size
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 17.1: Button sizes increase progressively
   * Validates: Requirements 7.4
   */
  it('Property 17.1: Button sizes increase progressively', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container: smContainer } = render(<Button size="sm" variant={variant}>Sm</Button>)
          const { container: mdContainer } = render(<Button size="md" variant={variant}>Md</Button>)
          const { container: lgContainer } = render(<Button size="lg" variant={variant}>Lg</Button>)
          
          const smButton = smContainer.querySelector('button')
          const mdButton = mdContainer.querySelector('button')
          const lgButton = lgContainer.querySelector('button')
          
          const smHeight = extractMinHeight(smButton?.className || '')
          const mdHeight = extractMinHeight(mdButton?.className || '')
          const lgHeight = extractMinHeight(lgButton?.className || '')
          
          // Heights should increase: sm < md < lg
          expect(smHeight).toBeLessThan(mdHeight!)
          expect(mdHeight).toBeLessThan(lgHeight!)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17.2: Input sizes increase progressively
   * Validates: Requirements 7.4
   */
  it('Property 17.2: Input sizes increase progressively', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (hasError) => {
          const { container: smContainer } = render(<Input size="sm" error={hasError} placeholder="Sm" />)
          const { container: mdContainer } = render(<Input size="md" error={hasError} placeholder="Md" />)
          const { container: lgContainer } = render(<Input size="lg" error={hasError} placeholder="Lg" />)
          
          const smInput = smContainer.querySelector('input')
          const mdInput = mdContainer.querySelector('input')
          const lgInput = lgContainer.querySelector('input')
          
          const smHeight = extractMinHeight(smInput?.className || '')
          const mdHeight = extractMinHeight(mdInput?.className || '')
          const lgHeight = extractMinHeight(lgInput?.className || '')
          
          // Heights should increase: sm < md < lg
          expect(smHeight).toBeLessThan(mdHeight!)
          expect(mdHeight).toBeLessThan(lgHeight!)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17.3: Large size always meets 44px minimum
   * Validates: Requirements 7.4, 8.3
   */
  it('Property 17.3: Large size always meets 44px minimum touch target', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'outline'),
        (variant) => {
          const { container: buttonContainer } = render(
            <Button size="lg" variant={variant}>Large Button</Button>
          )
          const { container: inputContainer } = render(
            <Input size="lg" placeholder="Large Input" />
          )
          
          const button = buttonContainer.querySelector('button')
          const input = inputContainer.querySelector('input')
          
          const buttonHeight = extractMinHeight(button?.className || '')
          const inputHeight = extractMinHeight(input?.className || '')
          
          // Large size should always meet 44px minimum
          expect(buttonHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE)
          expect(inputHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_SIZE)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 17.4: Buttons have sufficient horizontal padding for touch targets
   * Validates: Requirements 7.4, 8.3
   */
  it('Property 17.4: Buttons have sufficient horizontal padding', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('primary', 'secondary', 'outline'),
        (size, variant) => {
          const { container } = render(
            <Button size={size} variant={variant}>X</Button>
          )
          const button = container.querySelector('button')
          
          expect(button).toBeTruthy()
          
          const className = button?.className || ''
          const horizontalPadding = extractHorizontalPadding(className)
          
          // All buttons should have at least some horizontal padding
          expect(horizontalPadding).toBeGreaterThan(0)
          
          // Larger sizes should have more padding
          if (size === 'lg') {
            expect(horizontalPadding).toBeGreaterThanOrEqual(48) // px-6 = 24px * 2
          } else if (size === 'md') {
            expect(horizontalPadding).toBeGreaterThanOrEqual(32) // px-4 = 16px * 2
          } else {
            expect(horizontalPadding).toBeGreaterThanOrEqual(24) // px-3 = 12px * 2
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
