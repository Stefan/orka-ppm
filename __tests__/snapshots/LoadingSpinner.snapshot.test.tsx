/**
 * Snapshot test: LoadingSpinner
 * Enterprise Test Strategy - Section 8 (Phase 1)
 */

import React from 'react'
import { render } from '@testing-library/react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

describe('LoadingSpinner snapshot', () => {
  it('matches snapshot default (md, primary)', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for lg size', () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for secondary color', () => {
    const { container } = render(<LoadingSpinner color="secondary" />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
