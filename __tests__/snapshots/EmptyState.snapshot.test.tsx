/**
 * Snapshot test: EmptyState (central empty/error-state component)
 * Enterprise Test Strategy - Section 8 (Phase 1)
 */

import React from 'react'
import { render } from '@testing-library/react'
import { EmptyState } from '@/components/ui/ErrorMessage'

describe('EmptyState snapshot', () => {
  it('matches snapshot without action', () => {
    const { container } = render(
      <EmptyState
        title="No projects yet"
        description="Create your first project to get started."
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with action button', () => {
    const { container } = render(
      <EmptyState
        title="No results"
        description="Try adjusting your filters or search term."
        action={{ label: 'Clear filters', onClick: () => {} }}
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
