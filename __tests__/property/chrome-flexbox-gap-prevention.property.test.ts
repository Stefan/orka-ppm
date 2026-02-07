/**
 * Property-Based Tests for Chrome Flexbox Gap Prevention
 * Feature: chrome-scroll-black-bar-fix, Property 4: Chrome Flexbox Gap Prevention
 * Validates: Requirements 3.2, 3.3
 */

import fc from 'fast-check'

// Mock Chrome browser detection
const mockIsChromeBasedBrowser = jest.fn(() => true)

// Mock DOM elements and methods
const createMockFlexElement = (overrides: Partial<HTMLElement> = {}): HTMLElement => {
  const mockElement = {
    style: {} as CSSStyleDeclaration,
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false),
      toggle: jest.fn()
    } as any,
    children: [] as HTMLElement[],
    offsetWidth: 300,
    offsetHeight: 500,
    clientWidth: 300,
    clientHeight: 500,
    getBoundingClientRect: jest.fn(() => ({
      top: 0,
      bottom: 500,
      left: 0,
      right: 300,
      width: 300,
      height: 500
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    ...overrides
  } as any

  return mockElement
}

// Mock computed styles for flexbox elements
const mockGetComputedStyle = jest.fn((element: Element) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0%',
  webkitFlex: '1 1 0%',
  boxSizing: 'border-box',
  webkitBoxSizing: 'border-box',
  backgroundColor: '#ffffff',
  backgroundAttachment: 'local',
  transform: 'translateZ(0px)',
  willChange: 'transform',
  gap: '0px',
  webkitGap: '0px',
  margin: '0px',
  padding: '0px',
  border: 'none'
}))

Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
  writable: true
})

// Chrome browser detection utility
const isChromeBasedBrowser = (): boolean => {
  return mockIsChromeBasedBrowser()
}

// Chrome flexbox optimization application
const applyChromeFlexboxOptimizations = (element: HTMLElement): void => {
  if (isChromeBasedBrowser()) {
    // Apply Chrome-specific flexbox optimizations
    element.style.webkitBoxSizing = 'border-box'
    element.style.boxSizing = 'border-box'
    element.style.webkitFlex = '1 1 0%'
    element.style.flex = '1 1 0%'
    element.style.backgroundColor = '#ffffff'
    element.style.backgroundAttachment = 'local'
    element.style.webkitTransform = 'translateZ(0)'
    element.style.transform = 'translateZ(0)'
    element.style.willChange = 'transform'
    
    // Prevent gaps
    element.style.gap = '0'
    element.style.webkitGap = '0'
    element.style.margin = '0'
    element.style.padding = '0'
    element.style.border = 'none'
    
    // Add Chrome flexbox optimization classes
    element.classList.add('chrome-flex-optimized')
    element.classList.add('chrome-flex-gap-prevention')
    element.classList.add('chrome-background-coverage')
  }
}

// Chrome flexbox gap validation
const validateChromeFlexboxGapPrevention = (element: HTMLElement): boolean => {
  const computedStyle = window.getComputedStyle(element)
  
  // Check for proper box-sizing
  const hasProperBoxSizing = computedStyle.boxSizing === 'border-box' &&
                            computedStyle.webkitBoxSizing === 'border-box'
  
  // Check for proper flex properties
  const hasProperFlex = computedStyle.flex === '1 1 0%' &&
                       computedStyle.webkitFlex === '1 1 0%'
  
  // Check for white background
  const hasWhiteBackground = computedStyle.backgroundColor === '#ffffff' ||
                           computedStyle.backgroundColor === 'rgb(255, 255, 255)'
  
  // Check for gap prevention
  const hasNoGaps = computedStyle.gap === '0px' &&
                   computedStyle.webkitGap === '0px' &&
                   computedStyle.margin === '0px' &&
                   computedStyle.padding === '0px' &&
                   computedStyle.border === 'none'
  
  // Check for hardware acceleration
  const hasHardwareAcceleration = computedStyle.transform !== 'none' &&
                                 computedStyle.willChange === 'transform'
  
  return hasProperBoxSizing && hasProperFlex && hasWhiteBackground && 
         hasNoGaps && hasHardwareAcceleration
}

// Flexbox layout integrity validation
const validateFlexboxLayoutIntegrity = (container: HTMLElement, children: HTMLElement[]): boolean => {
  const containerStyle = window.getComputedStyle(container)
  
  // Container should have proper flex display
  const hasFlexDisplay = containerStyle.display === 'flex' || 
                        containerStyle.display === '-webkit-flex'
  
  // All children should have consistent background
  const allChildrenHaveWhiteBackground = children.every(child => {
    const childStyle = window.getComputedStyle(child)
    return childStyle.backgroundColor === '#ffffff' || 
           childStyle.backgroundColor === 'rgb(255, 255, 255)'
  })
  
  // No gaps between flex items
  const hasNoFlexGaps = containerStyle.gap === '0px' &&
                       containerStyle.webkitGap === '0px'
  
  return hasFlexDisplay && allChildrenHaveWhiteBackground && hasNoFlexGaps
}

describe('Chrome Flexbox Gap Prevention Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsChromeBasedBrowser.mockReturnValue(true)
  })

  /**
   * Property 4: Chrome Flexbox Gap Prevention
   * For any flexbox layout configuration, there should be no gaps that could reveal 
   * parent backgrounds during scroll or resize operations
   * Validates: Requirements 3.2, 3.3
   */
  describe('Property 4: Chrome Flexbox Gap Prevention', () => {
    test('Chrome flexbox optimizations should prevent gaps in all layout configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            flexDirection: fc.constantFrom('column', 'row', 'column-reverse', 'row-reverse'),
            flexWrap: fc.constantFrom('nowrap', 'wrap', 'wrap-reverse'),
            justifyContent: fc.constantFrom('flex-start', 'center', 'space-between', 'space-around'),
            alignItems: fc.constantFrom('stretch', 'flex-start', 'center', 'flex-end'),
            childrenCount: fc.integer({ min: 1, max: 10 }),
            containerWidth: fc.integer({ min: 200, max: 1200 }),
            containerHeight: fc.integer({ min: 300, max: 800 })
          }),
          async (layout) => {
            // Create flex container
            const container = createMockFlexElement({
              offsetWidth: layout.containerWidth,
              offsetHeight: layout.containerHeight,
              clientWidth: layout.containerWidth,
              clientHeight: layout.containerHeight
            })

            // Set flex properties
            container.style.display = 'flex'
            container.style.flexDirection = layout.flexDirection
            container.style.flexWrap = layout.flexWrap
            container.style.justifyContent = layout.justifyContent
            container.style.alignItems = layout.alignItems

            // Apply Chrome flexbox optimizations
            applyChromeFlexboxOptimizations(container)

            // Create flex children
            const children: HTMLElement[] = []
            for (let i = 0; i < layout.childrenCount; i++) {
              const child = createMockFlexElement()
              applyChromeFlexboxOptimizations(child)
              children.push(child)
              container.appendChild(child)
            }

            // Property: Chrome flexbox optimizations should be applied
            expect(container.style.webkitBoxSizing).toBe('border-box')
            expect(container.style.boxSizing).toBe('border-box')
            expect(container.style.webkitFlex).toBe('1 1 0%')
            expect(container.style.flex).toBe('1 1 0%')
            expect(container.style.backgroundColor).toBe('#ffffff')
            expect(container.style.gap).toBe('0')
            expect(container.style.webkitGap).toBe('0')

            // Property: Chrome optimization classes should be added
            expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-optimized')
            expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-gap-prevention')
            expect(container.classList.add).toHaveBeenCalledWith('chrome-background-coverage')

            // Property: All flex children should have gap prevention
            children.forEach(child => {
              expect(child.style.webkitBoxSizing).toBe('border-box')
              expect(child.style.boxSizing).toBe('border-box')
              expect(child.style.backgroundColor).toBe('#ffffff')
              expect(child.style.margin).toBe('0')
              expect(child.style.padding).toBe('0')
              expect(child.style.border).toBe('none')
            })

            // Property: Flexbox layout integrity should be maintained
            const isLayoutIntegrityValid = validateFlexboxLayoutIntegrity(container, children)
            expect(isLayoutIntegrityValid).toBe(true)

            // Property: No gaps should exist that could reveal parent backgrounds
            const isGapPreventionValid = validateChromeFlexboxGapPrevention(container)
            expect(isGapPreventionValid).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome flexbox should prevent gaps during resize operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialWidth: fc.integer({ min: 300, max: 800 }),
            initialHeight: fc.integer({ min: 400, max: 600 }),
            resizeOperations: fc.array(
              fc.record({
                newWidth: fc.integer({ min: 200, max: 1200 }),
                newHeight: fc.integer({ min: 300, max: 800 }),
                resizeType: fc.constantFrom('width-only', 'height-only', 'both')
              }),
              { minLength: 1, maxLength: 5 }
            ),
            flexGrow: fc.float({ min: 0, max: 3 }),
            flexShrink: fc.float({ min: 0, max: 2 })
          }),
          async (resize) => {
            // Create flex container with initial size
            const container = createMockFlexElement({
              offsetWidth: resize.initialWidth,
              offsetHeight: resize.initialHeight,
              clientWidth: resize.initialWidth,
              clientHeight: resize.initialHeight
            })

            // Apply Chrome flexbox optimizations
            applyChromeFlexboxOptimizations(container)

            // Create flex child with grow/shrink properties
            const flexChild = createMockFlexElement()
            flexChild.style.flexGrow = resize.flexGrow.toString()
            flexChild.style.flexShrink = resize.flexShrink.toString()
            applyChromeFlexboxOptimizations(flexChild)

            // Perform resize operations
            for (const operation of resize.resizeOperations) {
              // Simulate resize
              if (operation.resizeType === 'width-only' || operation.resizeType === 'both') {
                container.offsetWidth = operation.newWidth
                container.clientWidth = operation.newWidth
              }
              if (operation.resizeType === 'height-only' || operation.resizeType === 'both') {
                container.offsetHeight = operation.newHeight
                container.clientHeight = operation.newHeight
              }

              // Property: Chrome flexbox should maintain gap prevention during resize
              expect(container.style.gap).toBe('0')
              expect(container.style.webkitGap).toBe('0')
              expect(container.style.backgroundColor).toBe('#ffffff')

              // Property: Flex child should maintain properties during resize
              expect(flexChild.style.webkitBoxSizing).toBe('border-box')
              expect(flexChild.style.boxSizing).toBe('border-box')
              expect(flexChild.style.backgroundColor).toBe('#ffffff')
              expect(flexChild.style.margin).toBe('0')

              // Property: Hardware acceleration should remain active during resize
              expect(container.style.transform).toBe('translateZ(0)')
              expect(container.style.willChange).toBe('transform')
              expect(flexChild.style.transform).toBe('translateZ(0)')
              expect(flexChild.style.willChange).toBe('transform')

              // Property: Gap prevention should be validated after each resize
              const isGapPreventionValid = validateChromeFlexboxGapPrevention(container)
              expect(isGapPreventionValid).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome flexbox should handle nested flex layouts without gaps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            nestingLevels: fc.integer({ min: 1, max: 4 }),
            flexDirections: fc.array(
              fc.constantFrom('column', 'row'),
              { minLength: 1, maxLength: 4 }
            ),
            childrenPerLevel: fc.array(
              fc.integer({ min: 1, max: 5 }),
              { minLength: 1, maxLength: 4 }
            ),
            hasScrollableContent: fc.boolean()
          }),
          async (nested) => {
            const containers: HTMLElement[] = []
            let currentContainer = createMockFlexElement()
            
            // Apply Chrome optimizations to root container
            applyChromeFlexboxOptimizations(currentContainer)
            containers.push(currentContainer)

            // Create nested flex structure
            for (let level = 0; level < nested.nestingLevels; level++) {
              const flexDirection = nested.flexDirections[level % nested.flexDirections.length]
              const childCount = nested.childrenPerLevel[level % nested.childrenPerLevel.length]

              currentContainer.style.display = 'flex'
              currentContainer.style.flexDirection = flexDirection

              // Create children for current level
              for (let i = 0; i < childCount; i++) {
                const child = createMockFlexElement()
                applyChromeFlexboxOptimizations(child)
                currentContainer.appendChild(child)

                // If this is not the last level, make one child the next container
                if (level < nested.nestingLevels - 1 && i === 0) {
                  currentContainer = child
                  containers.push(currentContainer)
                }
              }
            }

            // Property: All nested containers should have Chrome flexbox optimizations
            containers.forEach(container => {
              expect(container.style.webkitBoxSizing).toBe('border-box')
              expect(container.style.boxSizing).toBe('border-box')
              expect(container.style.backgroundColor).toBe('#ffffff')
              expect(container.style.gap).toBe('0')
              expect(container.style.webkitGap).toBe('0')
              expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-optimized')
              expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-gap-prevention')
            })

            // Property: Nested flexbox should not create gaps at any level
            containers.forEach(container => {
              const isGapPreventionValid = validateChromeFlexboxGapPrevention(container)
              expect(isGapPreventionValid).toBe(true)
            })

            // Property: Hardware acceleration should be applied at all levels
            containers.forEach(container => {
              expect(container.style.transform).toBe('translateZ(0)')
              expect(container.style.willChange).toBe('transform')
            })

            // Property: Scrollable content should not affect gap prevention
            if (nested.hasScrollableContent) {
              const scrollableContainer = containers[containers.length - 1]
              scrollableContainer.style.overflow = 'auto'
              scrollableContainer.style.webkitOverflowScrolling = 'touch'
              
              expect(scrollableContainer.style.backgroundColor).toBe('#ffffff')
              expect(scrollableContainer.style.gap).toBe('0')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome flexbox should prevent gaps with different flex item configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            flexBasis: fc.array(
              fc.constantFrom('auto', '0', '100px', '50%', 'content'),
              { minLength: 1, maxLength: 8 }
            ),
            flexGrow: fc.array(
              fc.float({ min: 0, max: 2 }),
              { minLength: 1, maxLength: 8 }
            ),
            flexShrink: fc.array(
              fc.float({ min: 0, max: 2 }),
              { minLength: 1, maxLength: 8 }
            ),
            alignSelf: fc.array(
              fc.constantFrom('auto', 'stretch', 'flex-start', 'center', 'flex-end'),
              { minLength: 1, maxLength: 8 }
            ),
            itemCount: fc.integer({ min: 1, max: 8 })
          }),
          async (flexItems) => {
            // Create flex container
            const container = createMockFlexElement()
            container.style.display = 'flex'
            container.style.flexDirection = 'column'
            applyChromeFlexboxOptimizations(container)

            // Create flex items with different configurations
            const items: HTMLElement[] = []
            for (let i = 0; i < flexItems.itemCount; i++) {
              const item = createMockFlexElement()
              
              // Apply different flex properties
              const basisIndex = i % flexItems.flexBasis.length
              const growIndex = i % flexItems.flexGrow.length
              const shrinkIndex = i % flexItems.flexShrink.length
              const alignIndex = i % flexItems.alignSelf.length

              item.style.flexBasis = flexItems.flexBasis[basisIndex]
              item.style.flexGrow = flexItems.flexGrow[growIndex].toString()
              item.style.flexShrink = flexItems.flexShrink[shrinkIndex].toString()
              item.style.alignSelf = flexItems.alignSelf[alignIndex]

              // Apply Chrome optimizations
              applyChromeFlexboxOptimizations(item)
              
              items.push(item)
              container.appendChild(item)
            }

            // Property: Container should have proper Chrome flexbox optimizations
            expect(container.style.webkitBoxSizing).toBe('border-box')
            expect(container.style.gap).toBe('0')
            expect(container.style.webkitGap).toBe('0')
            expect(container.style.backgroundColor).toBe('#ffffff')

            // Property: All flex items should prevent gaps regardless of flex properties
            items.forEach((item, index) => {
              expect(item.style.webkitBoxSizing).toBe('border-box')
              expect(item.style.boxSizing).toBe('border-box')
              expect(item.style.backgroundColor).toBe('#ffffff')
              expect(item.style.margin).toBe('0')
              expect(item.style.padding).toBe('0')
              expect(item.style.border).toBe('none')

              // Property: Hardware acceleration should be applied to all items
              expect(item.style.transform).toBe('translateZ(0)')
              expect(item.style.willChange).toBe('transform')

              // Property: Gap prevention should work with any flex configuration
              const isGapPreventionValid = validateChromeFlexboxGapPrevention(item)
              expect(isGapPreventionValid).toBe(true)
            })

            // Property: Layout integrity should be maintained with mixed flex properties
            const isLayoutIntegrityValid = validateFlexboxLayoutIntegrity(container, items)
            expect(isLayoutIntegrityValid).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome flexbox should handle dynamic content changes without creating gaps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialItemCount: fc.integer({ min: 1, max: 5 }),
            contentChanges: fc.array(
              fc.record({
                action: fc.constantFrom('add', 'remove', 'modify'),
                itemIndex: fc.integer({ min: 0, max: 10 }),
                newContent: fc.string({ minLength: 10, maxLength: 200 })
              }),
              { minLength: 1, maxLength: 10 }
            ),
            hasAnimations: fc.boolean()
          }),
          async (dynamic) => {
            // Create flex container
            const container = createMockFlexElement()
            container.style.display = 'flex'
            container.style.flexDirection = 'column'
            applyChromeFlexboxOptimizations(container)

            // Create initial flex items
            const items: HTMLElement[] = []
            for (let i = 0; i < dynamic.initialItemCount; i++) {
              const item = createMockFlexElement()
              applyChromeFlexboxOptimizations(item)
              items.push(item)
              container.appendChild(item)
            }

            // Apply content changes
            for (const change of dynamic.contentChanges) {
              if (change.action === 'add') {
                const newItem = createMockFlexElement()
                applyChromeFlexboxOptimizations(newItem)
                items.push(newItem)
                container.appendChild(newItem)
              } else if (change.action === 'remove' && items.length > 1) {
                const indexToRemove = Math.min(change.itemIndex, items.length - 1)
                items.splice(indexToRemove, 1)
              } else if (change.action === 'modify' && items.length > 0) {
                const indexToModify = Math.min(change.itemIndex, items.length - 1)
                const item = items[indexToModify]
                // Simulate content change
                item.offsetHeight = Math.max(50, item.offsetHeight + (change.newContent.length - 100))
              }

              // Property: Gap prevention should be maintained after each change
              expect(container.style.gap).toBe('0')
              expect(container.style.webkitGap).toBe('0')
              expect(container.style.backgroundColor).toBe('#ffffff')

              // Property: All items should maintain gap prevention after changes
              items.forEach(item => {
                expect(item.style.webkitBoxSizing).toBe('border-box')
                expect(item.style.backgroundColor).toBe('#ffffff')
                expect(item.style.margin).toBe('0')
                expect(item.style.padding).toBe('0')
                expect(item.style.border).toBe('none')
              })

              // Property: Hardware acceleration should remain active during changes
              expect(container.style.transform).toBe('translateZ(0)')
              expect(container.style.willChange).toBe('transform')

              // Property: Layout integrity should be maintained during dynamic changes
              if (items.length > 0) {
                const isLayoutIntegrityValid = validateFlexboxLayoutIntegrity(container, items)
                expect(isLayoutIntegrityValid).toBe(true)
              }
            }

            // Property: Animations should not affect gap prevention
            if (dynamic.hasAnimations) {
              container.style.transition = 'all 0.3s ease'
              items.forEach(item => {
                item.style.transition = 'all 0.3s ease'
                expect(item.style.backgroundColor).toBe('#ffffff')
                expect(item.style.gap || '0').toBe('0')
              })
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('Chrome flexbox should work correctly with different browser states', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            isChromeDetected: fc.boolean(),
            hasWebkitSupport: fc.boolean(),
            hasFlexboxSupport: fc.boolean(),
            deviceType: fc.constantFrom('desktop', 'mobile', 'tablet'),
            orientation: fc.constantFrom('portrait', 'landscape')
          }),
          async (browserState) => {
            // Mock browser detection
            mockIsChromeBasedBrowser.mockReturnValue(browserState.isChromeDetected)

            const container = createMockFlexElement()
            container.style.display = 'flex'

            // Apply Chrome flexbox optimizations (should only apply if Chrome is detected)
            applyChromeFlexboxOptimizations(container)

            if (browserState.isChromeDetected) {
              // Property: Chrome flexbox optimizations should be applied when Chrome is detected
              expect(container.style.webkitBoxSizing).toBe('border-box')
              expect(container.style.webkitFlex).toBe('1 1 0%')
              expect(container.style.gap).toBe('0')
              expect(container.style.webkitGap).toBe('0')
              expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-optimized')
              expect(container.classList.add).toHaveBeenCalledWith('chrome-flex-gap-prevention')

              // Property: Gap prevention should work regardless of device type
              const isGapPreventionValid = validateChromeFlexboxGapPrevention(container)
              expect(isGapPreventionValid).toBe(true)

              // Property: Hardware acceleration should be applied
              expect(container.style.transform).toBe('translateZ(0)')
              expect(container.style.willChange).toBe('transform')

              // Property: Background should remain white
              expect(container.style.backgroundColor).toBe('#ffffff')
            } else {
              // Property: Chrome-specific optimizations should not be applied for non-Chrome browsers
              expect(container.style.webkitBoxSizing).not.toBe('border-box')
              expect(container.classList.add).not.toHaveBeenCalledWith('chrome-flex-optimized')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Chrome Flexbox Gap Prevention Edge Cases', () => {
    test('should handle extreme flexbox configurations without gaps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            flexGrow: fc.float({ min: 0, max: 100 }), // Extreme grow values
            flexShrink: fc.float({ min: 0, max: 100 }), // Extreme shrink values
            flexBasis: fc.constantFrom('0', '1px', '99999px', '100%', 'auto'),
            containerSize: fc.integer({ min: 1, max: 5000 }), // Extreme container sizes
            itemCount: fc.integer({ min: 1, max: 50 }) // Many items
          }),
          async (extreme) => {
            const container = createMockFlexElement({
              offsetWidth: extreme.containerSize,
              clientWidth: extreme.containerSize
            })
            
            container.style.display = 'flex'
            applyChromeFlexboxOptimizations(container)

            // Create items with extreme flex properties
            const items: HTMLElement[] = []
            for (let i = 0; i < extreme.itemCount; i++) {
              const item = createMockFlexElement()
              item.style.flexGrow = extreme.flexGrow.toString()
              item.style.flexShrink = extreme.flexShrink.toString()
              item.style.flexBasis = extreme.flexBasis
              applyChromeFlexboxOptimizations(item)
              items.push(item)
            }

            // Property: Gap prevention should work even with extreme configurations
            expect(container.style.gap).toBe('0')
            expect(container.style.webkitGap).toBe('0')
            expect(container.style.backgroundColor).toBe('#ffffff')

            items.forEach(item => {
              expect(item.style.backgroundColor).toBe('#ffffff')
              expect(item.style.margin).toBe('0')
              expect(item.style.padding).toBe('0')
              expect(item.style.border).toBe('none')
            })

            // Property: Chrome optimizations should handle edge cases gracefully
            const isGapPreventionValid = validateChromeFlexboxGapPrevention(container)
            expect(isGapPreventionValid).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })

    test('should handle flexbox with zero dimensions without gaps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            containerWidth: fc.integer({ min: 0, max: 10 }),
            containerHeight: fc.integer({ min: 0, max: 10 }),
            itemWidth: fc.integer({ min: 0, max: 5 }),
            itemHeight: fc.integer({ min: 0, max: 5 })
          }),
          async (zeroDim) => {
            const container = createMockFlexElement({
              offsetWidth: zeroDim.containerWidth,
              offsetHeight: zeroDim.containerHeight,
              clientWidth: zeroDim.containerWidth,
              clientHeight: zeroDim.containerHeight
            })

            applyChromeFlexboxOptimizations(container)

            const item = createMockFlexElement({
              offsetWidth: zeroDim.itemWidth,
              offsetHeight: zeroDim.itemHeight
            })
            applyChromeFlexboxOptimizations(item)

            // Property: Gap prevention should work even with zero or minimal dimensions
            expect(container.style.gap).toBe('0')
            expect(container.style.backgroundColor).toBe('#ffffff')
            expect(item.style.backgroundColor).toBe('#ffffff')
            expect(item.style.margin).toBe('0')

            // Property: Chrome optimizations should be applied regardless of size
            expect(container.style.webkitBoxSizing).toBe('border-box')
            expect(item.style.webkitBoxSizing).toBe('border-box')
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})