/**
 * Unit tests for Suspense and error boundary behavior (Task 57.4)
 */

import React, { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CostbookErrorBoundary } from '@/components/costbook/CostbookErrorBoundary'
import { LoadingSpinner } from '@/components/costbook/LoadingSpinner'

const Throw = () => {
  throw new Error('Test error')
}

describe('Suspense and Error Boundary (Task 57.4)', () => {
  it('error boundary catches errors and shows fallback UI', () => {
    render(
      <CostbookErrorBoundary>
        <Throw />
      </CostbookErrorBoundary>
    )
    const fallback = screen.getAllByText(/error|something went wrong|reload|try again/i)
    expect(fallback.length).toBeGreaterThanOrEqual(1)
    expect(fallback[0]).toBeInTheDocument()
  })

  it('LoadingSpinner shows when used as Suspense fallback', () => {
    const Lazy = React.lazy(() => Promise.resolve({ default: () => <div>Loaded</div> }))
    render(
      <Suspense fallback={<LoadingSpinner message="Loading..." />}>
        <Lazy />
      </Suspense>
    )
    const loading = screen.getAllByText('Loading...')
    expect(loading.length).toBeGreaterThanOrEqual(1)
    expect(loading[0]).toBeInTheDocument()
  })
})
