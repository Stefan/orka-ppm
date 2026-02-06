/**
 * Property 8.5: Multi-Level Nesting Constraint
 * Validates: Requirements 4.5
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import NestedGridContainer from '@/components/register-nested-grids/NestedGridContainer'

const mockSection = {
  id: 'sec-1',
  itemType: 'tasks' as const,
  columns: [{ id: 'c1', field: 'name', headerName: 'Name', order: 0 }],
  displayOrder: 0,
}

jest.mock('@/lib/register-nested-grids/hooks', () => ({
  useNestedGridData: jest.fn(() => ({ data: [], isLoading: true, error: null })),
}))

describe('Property 8.5: Multi-Level Nesting Constraint', () => {
  it('renders content when nestingLevel < 2', () => {
    render(
      <NestedGridContainer
        parentRowId="row-1"
        sections={[mockSection]}
        registerId="reg-1"
        nestingLevel={0}
      />
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('returns null when nestingLevel >= 2 (max nesting)', () => {
    const { container } = render(
      <NestedGridContainer
        parentRowId="row-1"
        sections={[mockSection]}
        registerId="reg-1"
        nestingLevel={2}
      />
    )
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('returns null when nestingLevel is 3', () => {
    const { container } = render(
      <NestedGridContainer
        parentRowId="row-1"
        sections={[mockSection]}
        registerId="reg-1"
        nestingLevel={3}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
