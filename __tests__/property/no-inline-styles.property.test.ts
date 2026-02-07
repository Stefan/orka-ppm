/**
 * Property-Based Tests for No Inline Tailwind Styles
 * Feature: design-system-consistency
 * 
 * Tests use fast-check library with minimum 100 iterations per property.
 * 
 * This test performs source code analysis to ensure components use
 * variant functions instead of hardcoded className strings.
 */

import fs from 'fs'
import path from 'path'
import fc from 'fast-check'

/**
 * Design system component files to analyze
 */
const designSystemComponents = [
  'components/ui/button.tsx',
  'components/ui/input.tsx',
  'components/ui/card.tsx',
]

/**
 * Patterns that indicate proper use of design system patterns
 */
const validPatterns = {
  // Using cn() function for class composition
  cnFunction: /cn\s*\(/,
  // Using variant objects (lowercase or uppercase) - handles both TypeScript type annotations and direct assignments
  variantObject: /const\s+\w+(?:[Vv]ariants?|[Ss]izes?|[Pp]adding|[Ss]hadow|[Bb]aseStyles?)\s*(?::|=)/,
  // Using array.join for multi-line class definitions
  arrayJoin: /\]\s*\.join\s*\(/,
  // Using template literals with variables
  templateLiteral: /`[^`]*\$\{/,
}

/**
 * Patterns that indicate problematic inline styles
 * These are hardcoded className strings that should use design tokens instead
 */
const problematicPatterns = {
  // Hardcoded color values (not from design tokens)
  hardcodedColors: /className\s*=\s*["'][^"']*(?:bg-\[#|text-\[#|border-\[#)[^"']*["']/,
  // Hardcoded spacing values (arbitrary values)
  hardcodedSpacing: /className\s*=\s*["'][^"']*(?:p-\[|m-\[|gap-\[)[^"']*["']/,
  // Hardcoded font sizes (arbitrary values)
  hardcodedFontSize: /className\s*=\s*["'][^"']*text-\[\d+px\][^"']*["']/,
  // Inline style attribute (should use Tailwind classes)
  inlineStyleAttribute: /style\s*=\s*\{\s*\{[^}]*(?:color|backgroundColor|padding|margin|fontSize)[^}]*\}\s*\}/,
}

/**
 * Reads a component file and returns its content
 */
function readComponentFile(filePath: string): string {
  const fullPath = path.join(process.cwd(), filePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Component file not found: ${fullPath}`)
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

/**
 * Checks if a component uses the cn() function for class composition
 */
function usesCnFunction(content: string): boolean {
  return validPatterns.cnFunction.test(content)
}

/**
 * Checks if a component uses variant objects for style definitions
 */
function usesVariantObjects(content: string): boolean {
  return validPatterns.variantObject.test(content)
}

/**
 * Checks if a component has problematic inline styles
 */
function hasProblematicInlineStyles(content: string): { hasIssues: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (problematicPatterns.hardcodedColors.test(content)) {
    issues.push('Contains hardcoded color values (use design tokens instead)')
  }
  
  if (problematicPatterns.hardcodedSpacing.test(content)) {
    issues.push('Contains hardcoded spacing values (use design tokens instead)')
  }
  
  if (problematicPatterns.hardcodedFontSize.test(content)) {
    issues.push('Contains hardcoded font size values (use design tokens instead)')
  }
  
  if (problematicPatterns.inlineStyleAttribute.test(content)) {
    issues.push('Contains inline style attributes (use Tailwind classes instead)')
  }
  
  return { hasIssues: issues.length > 0, issues }
}

/**
 * Counts the number of className assignments in a component
 */
function countClassNameAssignments(content: string): number {
  const matches = content.match(/className\s*=\s*[{"`']/g)
  return matches ? matches.length : 0
}

/**
 * Checks if className assignments use cn() or variant functions
 */
function classNameUsesDesignSystem(content: string): { total: number; usingCn: number; percentage: number } {
  const totalAssignments = countClassNameAssignments(content)
  
  // Count className assignments that use cn()
  const cnUsages = (content.match(/className\s*=\s*\{?\s*cn\s*\(/g) || []).length
  
  // Count className assignments that reference variant objects
  const variantUsages = (content.match(/className\s*=\s*\{[^}]*Variants?\[/g) || []).length
  
  const usingDesignSystem = cnUsages + variantUsages
  const percentage = totalAssignments > 0 ? (usingDesignSystem / totalAssignments) * 100 : 100
  
  return { total: totalAssignments, usingCn: usingDesignSystem, percentage }
}

describe('No Inline Styles Property Tests', () => {
  /**
   * Feature: design-system-consistency, Property 18: Komponenten verwenden keine inline Tailwind-Styles
   * Validates: Requirements 10.2
   * 
   * For any component in the design system, the source code should not contain
   * hardcoded className strings, but should use variant functions instead.
   */
  describe('Property 18: Components use no inline Tailwind styles', () => {
    it('All design system components use cn() function', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...designSystemComponents),
          (componentPath) => {
            const content = readComponentFile(componentPath)
            
            // Component should use cn() function for class composition
            expect(usesCnFunction(content)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('All design system components use variant objects', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...designSystemComponents),
          (componentPath) => {
            const content = readComponentFile(componentPath)
            
            // Component should use variant objects for style definitions
            expect(usesVariantObjects(content)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('No design system components have problematic inline styles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...designSystemComponents),
          (componentPath) => {
            const content = readComponentFile(componentPath)
            const { hasIssues, issues } = hasProblematicInlineStyles(content)
            
            // Component should not have problematic inline styles
            if (hasIssues) {
              console.log(`Issues in ${componentPath}:`, issues)
            }
            expect(hasIssues).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 18.1: Components import cn from design-system
   * Validates: Requirements 10.2, 10.3
   */
  it('Property 18.1: Components import cn from design-system', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...designSystemComponents),
        (componentPath) => {
          const content = readComponentFile(componentPath)
          
          // Component should import cn from design-system
          const importsCn = /import\s*\{[^}]*cn[^}]*\}\s*from\s*['"]@\/lib\/design-system['"]/.test(content)
          
          expect(importsCn).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 18.2: Components define styles in variant objects, not inline
   * Validates: Requirements 10.2
   */
  it('Property 18.2: Components define styles in variant objects', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...designSystemComponents),
        (componentPath) => {
          const content = readComponentFile(componentPath)
          
          // Check for variant object patterns (handles TypeScript type annotations)
          const hasVariantDefinitions = 
            /const\s+\w+[Vv]ariants?\s*(?::|=)/.test(content) ||
            /const\s+\w+[Ss]izes?\s*(?::|=)/.test(content) ||
            /const\s+\w+[Bb]aseStyles?\s*=/.test(content) ||
            /const\s+\w+[Pp]adding\s*(?::|=)/.test(content) ||
            /const\s+\w+[Ss]hadow\s*(?::|=)/.test(content)
          
          expect(hasVariantDefinitions).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 18.3: Components use TypeScript types for variants
   * Validates: Requirements 10.2
   */
  it('Property 18.3: Components use TypeScript types for variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...designSystemComponents),
        (componentPath) => {
          const content = readComponentFile(componentPath)
          
          // Check for TypeScript type imports or definitions
          const hasTypeDefinitions = 
            /import\s+.*type\s+/.test(content) ||
            /interface\s+\w+Props/.test(content) ||
            /type\s+\w+Props\s*=/.test(content)
          
          expect(hasTypeDefinitions).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 18.4: Components export properly typed components
   * Validates: Requirements 10.2
   */
  it('Property 18.4: Components export properly typed components', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...designSystemComponents),
        (componentPath) => {
          const content = readComponentFile(componentPath)
          
          // Check for proper exports
          const hasExports = 
            /export\s+function\s+\w+/.test(content) ||
            /export\s+const\s+\w+/.test(content) ||
            /export\s+default\s+/.test(content)
          
          expect(hasExports).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Additional source code quality tests
 */
describe('Source Code Quality Tests', () => {
  it('Button component follows design system patterns', () => {
    const content = readComponentFile('components/ui/button.tsx')
    
    // Should have buttonVariants object
    expect(content).toMatch(/buttonVariants/)
    
    // Should have buttonSizes object
    expect(content).toMatch(/buttonSizes/)
    
    // Should have buttonBaseStyles
    expect(content).toMatch(/buttonBaseStyles/)
    
    // Should use cn() in the component
    expect(content).toMatch(/cn\s*\(\s*buttonBaseStyles/)
  })

  it('Input component follows design system patterns', () => {
    const content = readComponentFile('components/ui/input.tsx')
    
    // Should have inputSizes object
    expect(content).toMatch(/inputSizes/)
    
    // Should have inputBaseStyles
    expect(content).toMatch(/inputBaseStyles/)
    
    // Should have inputErrorStyles
    expect(content).toMatch(/inputErrorStyles/)
    
    // Should use cn() in the component
    expect(content).toMatch(/cn\s*\(\s*inputBaseStyles/)
  })

  it('Card component follows design system patterns', () => {
    const content = readComponentFile('components/ui/card.tsx')
    
    // Should have cardPadding object
    expect(content).toMatch(/cardPadding/)
    
    // Should have cardShadow object
    expect(content).toMatch(/cardShadow/)
    
    // Should use cn() in the component
    expect(content).toMatch(/cn\s*\(/)
  })
})
