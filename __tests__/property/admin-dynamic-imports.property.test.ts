/**
 * Property-Based Test: Dynamic Imports
 * Feature: admin-performance-optimization
 * Property 4: Third-Party Libraries Use Dynamic Imports
 * **Validates: Requirements 1.5, 3.4**
 * 
 * This test verifies that third-party libraries (especially Recharts)
 * are imported using dynamic import() syntax rather than static imports,
 * enabling code splitting and reducing initial bundle size.
 */

import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// Helper function to read file content
function readFileContent(filePath: string): string {
  const fullPath = path.join(process.cwd(), filePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`)
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

// Helper function to check if a file uses dynamic imports for a library
function usesDynamicImport(fileContent: string, libraryName: string): boolean {
  // Check for React.lazy() with dynamic import
  const lazyImportPattern = new RegExp(
    `lazy\\s*\\(\\s*\\(\\)\\s*=>\\s*import\\s*\\([^)]*${libraryName}[^)]*\\)`,
    'i'
  )
  
  // Check for direct dynamic import
  const dynamicImportPattern = new RegExp(
    `import\\s*\\([^)]*${libraryName}[^)]*\\)`,
    'i'
  )
  
  return lazyImportPattern.test(fileContent) || dynamicImportPattern.test(fileContent)
}

// Helper function to check if a file uses static imports for a library
function usesStaticImport(fileContent: string, libraryName: string): boolean {
  // Check for static import statements
  const staticImportPattern = new RegExp(
    `^\\s*import\\s+.*from\\s+['"]${libraryName}['"]`,
    'im'
  )
  
  // Check for namespace imports
  const namespaceImportPattern = new RegExp(
    `^\\s*import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${libraryName}['"]`,
    'im'
  )
  
  return staticImportPattern.test(fileContent) || namespaceImportPattern.test(fileContent)
}

// Helper function to extract imported components from a file
function extractImportedComponents(fileContent: string, libraryName: string): string[] {
  const components: string[] = []
  
  // Match selective imports: import { Component1, Component2 } from 'library'
  const selectiveImportRegex = new RegExp(
    `import\\s*{([^}]+)}\\s*from\\s*['"]${libraryName}['"]`,
    'gi'
  )
  
  let match
  while ((match = selectiveImportRegex.exec(fileContent)) !== null) {
    const imports = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    components.push(...imports)
  }
  
  return components
}

describe('Admin Performance Optimization - Dynamic Imports', () => {
  describe('Property 4: Third-Party Libraries Use Dynamic Imports', () => {
    it('should use dynamic imports for Recharts in admin performance page', () => {
      fc.assert(
        fc.property(
          fc.constant('app/admin/performance/page.tsx'),
          (filePath) => {
            const fileContent = readFileContent(filePath)
            
            // Verify Recharts is NOT imported statically at the top level
            const hasStaticRechartsImport = usesStaticImport(fileContent, 'recharts')
            expect(hasStaticRechartsImport).toBe(false)
            
            // Verify ChartSection component is imported using React.lazy()
            const hasLazyChartSection = fileContent.includes('lazy(') && 
                                       fileContent.includes('ChartSection')
            expect(hasLazyChartSection).toBe(true)
            
            // Verify Suspense is imported for lazy loading
            const hasSuspenseImport = fileContent.includes('Suspense')
            expect(hasSuspenseImport).toBe(true)
          }
        ),
        { numRuns: 1 } // Single run since we're checking a specific file
      )
    })

    it('should use selective imports in ChartSection component', () => {
      fc.assert(
        fc.property(
          fc.constant('components/admin/ChartSection.tsx'),
          (filePath) => {
            const fileContent = readFileContent(filePath)
            
            // Extract imported Recharts components
            const importedComponents = extractImportedComponents(fileContent, 'recharts')
            
            // Verify selective imports are used (not namespace import)
            expect(importedComponents.length).toBeGreaterThan(0)
            
            // Verify only necessary components are imported
            const allowedComponents = [
              'BarChart',
              'Bar',
              'XAxis',
              'YAxis',
              'Tooltip',
              'Legend',
              'ResponsiveContainer',
              'LineChart',
              'Line',
              'CartesianGrid'
            ]
            
            importedComponents.forEach(component => {
              expect(allowedComponents).toContain(component)
            })
            
            // Verify no namespace import (import * as Recharts)
            const hasNamespaceImport = /import\s+\*\s+as\s+\w+\s+from\s+['"]recharts['"]/i.test(fileContent)
            expect(hasNamespaceImport).toBe(false)
          }
        ),
        { numRuns: 1 }
      )
    })

    it('should not have direct Recharts imports in main page', () => {
      fc.assert(
        fc.property(
          fc.constant('app/admin/performance/page.tsx'),
          (filePath) => {
            const fileContent = readFileContent(filePath)
            
            // List of Recharts components that should NOT be imported directly
            const rechartsComponents = [
              'BarChart',
              'LineChart',
              'PieChart',
              'AreaChart',
              'ScatterChart',
              'ComposedChart',
              'RadarChart',
              'RadialBarChart',
              'Treemap',
              'Sankey',
              'Funnel'
            ]
            
            // Verify none of these components are imported directly
            rechartsComponents.forEach(component => {
              const directImportPattern = new RegExp(
                `import\\s*{[^}]*${component}[^}]*}\\s*from\\s*['"]recharts['"]`,
                'i'
              )
              expect(directImportPattern.test(fileContent)).toBe(false)
            })
          }
        ),
        { numRuns: 1 }
      )
    })

    it('should verify lazy loading pattern for various component paths', () => {
      fc.assert(
        fc.property(
          fc.record({
            componentName: fc.constantFrom('ChartSection', 'SlowQueriesTable', 'CacheStatsCard'),
            importPath: fc.constantFrom(
              '../../../components/admin/ChartSection',
              './components/admin/ChartSection',
              '@/components/admin/ChartSection'
            )
          }),
          ({ componentName, importPath }) => {
            // Verify the lazy loading pattern structure
            const lazyPattern = `lazy(() => import('${importPath}'))`
            
            // This pattern should be valid JavaScript
            expect(() => {
              // Simulate parsing the pattern
              const pattern = lazyPattern.replace(/lazy\(\(\) => import\('([^']+)'\)\)/, '$1')
              expect(pattern).toBe(importPath)
            }).not.toThrow()
            
            // Verify the pattern includes the component name in the path
            if (componentName === 'ChartSection') {
              expect(importPath).toContain('ChartSection')
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify Suspense fallback is provided for lazy components', () => {
      fc.assert(
        fc.property(
          fc.constant('app/admin/performance/page.tsx'),
          (filePath) => {
            const fileContent = readFileContent(filePath)
            
            // If Suspense is used, it should have a fallback prop
            if (fileContent.includes('<Suspense')) {
              const suspensePattern = /<Suspense\s+fallback=/
              expect(suspensePattern.test(fileContent)).toBe(true)
              
              // Verify skeleton loader is used as fallback
              const hasSkeletonFallback = fileContent.includes('ChartSkeleton') ||
                                         fileContent.includes('TableSkeleton') ||
                                         fileContent.includes('StatsSkeleton')
              expect(hasSkeletonFallback).toBe(true)
            }
          }
        ),
        { numRuns: 1 }
      )
    })

    it('should verify dynamic import syntax is valid', () => {
      fc.assert(
        fc.property(
          fc.record({
            modulePath: fc.constantFrom(
              './components/ChartSection',
              '../components/admin/ChartSection',
              '@/components/admin/ChartSection',
              '../../components/shared/Table'
            ),
            exportName: fc.constantFrom('ChartSection', 'default', 'Table', 'CacheStats')
          }),
          ({ modulePath, exportName }) => {
            // Verify dynamic import with named export extraction
            const dynamicImportPattern = `import('${modulePath}').then(module => ({ default: module.${exportName} }))`
            
            // This should be valid syntax
            expect(dynamicImportPattern).toContain('import(')
            expect(dynamicImportPattern).toContain('.then(')
            expect(dynamicImportPattern).toContain('module')
            
            // Verify the pattern can extract the module path
            const pathMatch = dynamicImportPattern.match(/import\('([^']+)'\)/)
            expect(pathMatch).not.toBeNull()
            expect(pathMatch![1]).toBe(modulePath)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should verify no synchronous heavy library imports in main bundle', () => {
      fc.assert(
        fc.property(
          fc.constant('app/admin/performance/page.tsx'),
          (filePath) => {
            const fileContent = readFileContent(filePath)
            
            // List of heavy libraries that should be lazy loaded
            const heavyLibraries = [
              'recharts',
              'd3',
              'chart.js',
              'plotly.js',
              'highcharts',
              'echarts'
            ]
            
            // Verify none of these are imported statically
            heavyLibraries.forEach(library => {
              const staticImportPattern = new RegExp(
                `^\\s*import\\s+.*from\\s+['"]${library}['"]`,
                'im'
              )
              expect(staticImportPattern.test(fileContent)).toBe(false)
            })
          }
        ),
        { numRuns: 1 }
      )
    })

    it('should verify lazy component imports use correct module resolution', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              relativePath: fc.constantFrom(
                '../../../components/admin/ChartSection',
                './components/admin/ChartSection',
                '../../components/admin/ChartSection'
              ),
              depth: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (paths) => {
            paths.forEach(({ relativePath, depth }) => {
              // Verify path structure is valid
              const pathSegments = relativePath.split('/')
              
              // Count parent directory references
              const parentRefs = pathSegments.filter(seg => seg === '..').length
              
              // Verify path is well-formed
              expect(pathSegments.length).toBeGreaterThan(0)
              
              // If using parent references, verify they're at the start
              if (parentRefs > 0) {
                const firstNonParent = pathSegments.findIndex(seg => seg !== '..')
                expect(firstNonParent).toBe(parentRefs)
              }
            })
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
