/**
 * Snapshot test: Error message component (error state)
 * Enterprise Test Strategy - Section 8 (Phase 1)
 */

import React from 'react'
import { render } from '@testing-library/react'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

describe('ErrorMessage snapshot', () => {
  it('matches snapshot for error type', () => {
    const { container } = render(
      <ErrorMessage
        type="error"
        title="Request failed"
        message="The server returned an error. Please try again."
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for warning type', () => {
    const { container } = render(
      <ErrorMessage
        type="warning"
        title="Unsaved changes"
        message="You have unsaved changes that will be lost."
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with actionable buttons', () => {
    const { container } = render(
      <ErrorMessage
        type="error"
        message="Something went wrong."
        actionable
        actions={[
          { label: 'Retry', onClick: () => {}, variant: 'primary' },
          { label: 'Cancel', onClick: () => {}, variant: 'secondary' },
        ]}
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
