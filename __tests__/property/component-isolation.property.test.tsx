/**
 * Property-Based Test: Component Isolation
 * 
 * Feature: dashboard-white-page-fix
 * Property 3: Component Isolation
 * 
 * This test validates that when a dashboard component fails, the dashboard should 
 * isolate the failure to that component only, display an error placeholder for 
 * that specific component, and continue rendering all other functional components.
 * 
 * Validates: Requirements 5.1, 5.2, 5.3
 */

import React from 'react'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { ComponentErrorBoundary } from '@/components/error-boundaries'

// Mock the diagnostic collector and error reporter
jest.mock('@/lib/diagnostics/diagnostic-collector', () => ({
  DiagnosticCollector: {
    getInstance: () => ({
      logError: jest.fn(),
      logUserAction: jest.fn()
    })
  }
}))

jest.mock('@/lib/diagnostics/error-reporting', () => ({
  ErrorReporter: {
    getInstance: () => ({
      reportError: jest.fn()
    })
  }
}))

// Test component that can throw errors on demand
interface TestComponentProps {
  shouldThrow: boolean
  errorMessage: string
  errorType: 'Error' | 'TypeError' | 'ReferenceError' | 'RangeError'
  componentName: string
  content: string
}

const TestComponent: React.FC<TestComponentProps> = ({ 
  shouldThrow, 
  errorMessage, 
  errorType,
  componentName,
  content
}) => {
  if (shouldThrow) {
    let error: Error
    switch (errorType) {
      case 'TypeError':
        error = new TypeError(errorMessage)
        break
      case 'ReferenceError':
        error = new ReferenceError(errorMessage)
        break
      case 'RangeError':
        error = new RangeError(errorMessage)
        break
      default:
        error = new Error(errorMessage)
    }
    throw error
  }
  
  const testId = componentName + '-content'
  return React.createElement('div', { 'data-testid': testId }, content)
}

// Arbitraries for generating test data
const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 })
const errorTypeArb = fc.constantFrom('Error', 'TypeError', 'ReferenceError', 'RangeError')
const componentNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
const contentArb = fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 3 && !s.includes('Error') && !s.includes('component'))

describe('Property 3: Component Isolation', () => {
  beforeEach(() => {
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('Component failures are isolated to individual components', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        componentNameArb,
        contentArb,
        contentArb,
        (errorMessage, errorType, failingComponentName, workingComponentName, failingContent, workingContent) => {
          // Ensure component names are different
          if (failingComponentName === workingComponentName) {
            workingComponentName = workingComponentName + 'Working'
          }
          
          // Render multiple components, one that fails and others that work
          const { container, unmount } = render(
            <div>
              <div data-testid="dashboard-header">Dashboard Header</div>
              
              <ComponentErrorBoundary componentName={failingComponentName}>
                <TestComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                  componentName={failingComponentName}
                  content={failingContent}
                />
              </ComponentErrorBoundary>
              
              <ComponentErrorBoundary componentName={workingComponentName}>
                <TestComponent
                  shouldThrow={false}
                  errorMessage=""
                  errorType="Error"
                  componentName={workingComponentName}
                  content={workingContent}
                />
              </ComponentErrorBoundary>
              
              <div data-testid="dashboard-footer">Dashboard Footer</div>
            </div>
          )

          // Verify failing component shows error placeholder
          expect(container.textContent).toContain(failingComponentName + ' Error')
          expect(container.textContent).toContain('This component encountered an error')
          
          // Verify failing component content is NOT rendered
          expect(container.textContent).not.toContain(failingContent)
          
          // Verify working component continues to function
          expect(container.textContent).toContain(workingContent)
          
          // Verify other dashboard elements are still rendered
          expect(container.textContent).toContain('Dashboard Header')
          expect(container.textContent).toContain('Dashboard Footer')
          
          // Verify no white page
          expect(container.textContent).not.toBe('')
          expect(container.textContent?.trim()).not.toBe('')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Multiple component failures are isolated independently', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        componentNameArb,
        componentNameArb,
        contentArb,
        contentArb,
        contentArb,
        (errorMessage, errorType, component1Name, component2Name, component3Name, content1, content2, content3) => {
          // Ensure component names are unique
          if (component1Name === component2Name) component2Name = component2Name + '2'
          if (component1Name === component3Name) component3Name = component3Name + '3'
          if (component2Name === component3Name) component3Name = component3Name + 'Alt'
          
          // Render multiple components with different failure states
          const { container, unmount } = render(
            <div>
              <ComponentErrorBoundary componentName={component1Name}>
                <TestComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                  componentName={component1Name}
                  content={content1}
                />
              </ComponentErrorBoundary>
              
              <ComponentErrorBoundary componentName={component2Name}>
                <TestComponent
                  shouldThrow={true}
                  errorMessage={errorMessage}
                  errorType={errorType}
                  componentName={component2Name}
                  content={content2}
                />
              </ComponentErrorBoundary>
              
              <ComponentErrorBoundary componentName={component3Name}>
                <TestComponent
                  shouldThrow={false}
                  errorMessage=""
                  errorType="Error"
                  componentName={component3Name}
                  content={content3}
                />
              </ComponentErrorBoundary>
            </div>
          )

          // Verify both failing components show their own error placeholders
          expect(container.textContent).toContain(component1Name + ' Error')
          expect(container.textContent).toContain(component2Name + ' Error')
          
          // Verify failing components' content is NOT rendered
          expect(container.textContent).not.toContain(content1)
          expect(container.textContent).not.toContain(content2)
          
          // Verify working component continues to function
          expect(container.textContent).toContain(content3)
          
          // Verify error messages appear twice (for each failing component)
          const errorCount = (container.textContent?.match(/This component encountered an error/g) || []).length
          expect(errorCount).toBe(2)
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Component error placeholders provide retry functionality', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        contentArb,
        (errorMessage, errorType, componentName, content) => {
          // Render component that will throw an error
          const { container, unmount } = render(
            <ComponentErrorBoundary componentName={componentName}>
              <TestComponent
                shouldThrow={true}
                errorMessage={errorMessage}
                errorType={errorType}
                componentName={componentName}
                content={content}
              />
            </ComponentErrorBoundary>
          )

          // Verify error placeholder is shown
          expect(container.textContent).toContain(componentName + ' Error')
          
          // Verify retry functionality is available
          expect(container.textContent).toContain('Retry')
          
          // Verify show details functionality is available
          expect(container.textContent).toContain('Show Details')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Component isolation preserves overall page structure', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        fc.array(componentNameArb, { minLength: 2, maxLength: 5 }),
        fc.array(contentArb, { minLength: 2, maxLength: 5 }),
        (errorMessage, errorType, componentNames, contents) => {
          // Ensure we have matching arrays
          const minLength = Math.min(componentNames.length, contents.length)
          const components = componentNames.slice(0, minLength)
          const componentContents = contents.slice(0, minLength)
          
          // Make component names unique
          const uniqueComponents = components.map((name, index) => name + index)
          
          // Randomly select which components should fail (at least one should work)
          const failureStates = components.map((_, index) => index < components.length - 1 ? Math.random() > 0.5 : false)
          
          // Render dashboard with multiple components
          const { container, unmount } = render(
            <div>
              <header data-testid="page-header">Page Header</header>
              <nav data-testid="navigation">Navigation</nav>
              <main data-testid="main-content">
                {uniqueComponents.map((componentName, index) => (
                  <ComponentErrorBoundary key={componentName} componentName={componentName}>
                    <TestComponent
                      shouldThrow={failureStates[index]}
                      errorMessage={errorMessage}
                      errorType={errorType}
                      componentName={componentName}
                      content={componentContents[index]}
                    />
                  </ComponentErrorBoundary>
                ))}
              </main>
              <footer data-testid="page-footer">Page Footer</footer>
            </div>
          )

          // Verify page structure is preserved
          expect(container.textContent).toContain('Page Header')
          expect(container.textContent).toContain('Navigation')
          expect(container.textContent).toContain('Page Footer')
          
          // Verify at least one working component shows its content
          const workingComponents = uniqueComponents.filter((_, index) => !failureStates[index])
          if (workingComponents.length > 0) {
            const workingIndex = uniqueComponents.indexOf(workingComponents[0])
            expect(container.textContent).toContain(componentContents[workingIndex])
          }
          
          // Verify failed components show error placeholders
          const failedComponents = uniqueComponents.filter((_, index) => failureStates[index])
          failedComponents.forEach(componentName => {
            expect(container.textContent).toContain(componentName + ' Error')
          })
          
          // Verify no white page
          expect(container.textContent).not.toBe('')
          expect(container.textContent?.trim()).not.toBe('')
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Component isolation works with nested error boundaries', () => {
    fc.assert(
      fc.property(
        errorMessageArb,
        errorTypeArb,
        componentNameArb,
        componentNameArb,
        contentArb,
        contentArb,
        (errorMessage, errorType, parentComponentName, childComponentName, parentContent, childContent) => {
          // Ensure component names are different
          if (parentComponentName === childComponentName) {
            childComponentName = childComponentName + 'Child'
          }
          
          // Render nested components with error boundaries
          const { container, unmount } = render(
            <ComponentErrorBoundary componentName={parentComponentName}>
              <div>
                <div>{parentContent}</div>
                <ComponentErrorBoundary componentName={childComponentName}>
                  <TestComponent
                    shouldThrow={true}
                    errorMessage={errorMessage}
                    errorType={errorType}
                    componentName={childComponentName}
                    content={childContent}
                  />
                </ComponentErrorBoundary>
              </div>
            </ComponentErrorBoundary>
          )

          // Verify parent component content is still rendered
          expect(container.textContent).toContain(parentContent)
          
          // Verify child component shows error placeholder
          expect(container.textContent).toContain(childComponentName + ' Error')
          
          // Verify child component content is NOT rendered
          expect(container.textContent).not.toContain(childContent)
          
          // Verify parent component doesn't show error (isolation worked)
          // The parent should not have its own error boundary triggered
          const errorTitles = container.textContent?.match(/\w+ Error/g) || []
          const parentErrorTitle = parentComponentName + ' Error'
          expect(errorTitles).not.toContain(parentErrorTitle)
          
          // Clean up
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})