/**
 * Accessibility: key components have no axe violations
 * Enterprise Gaps Plan - Optional. Target WCAG 2.1 where applicable.
 */
import React from 'react'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/ErrorMessage'

expect.extend(toHaveNoViolations)

describe('A11y: ErrorMessage', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <ErrorMessage
        type="error"
        title="Error title"
        message="Something went wrong."
      />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('A11y: EmptyState', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState
        title="No results"
        description="Try adjusting your filters."
      />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
