/**
 * Feature: register-nested-grids, Property 25: Costbook Integration Completeness
 * Validates: Requirements 10.4
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import CostbookRegisterGrid from '@/components/register-nested-grids/CostbookRegisterGrid'

jest.mock('@/lib/register-nested-grids/hooks', () => ({
  useNestedGridConfig: () => ({ data: null }),
}))

jest.mock('@/lib/register-nested-grids/api', () => ({
  fetchNestedGridConfig: () => Promise.resolve(null),
}))

describe('Feature: register-nested-grids, Property 25: Costbook Integration Completeness', () => {
  it('CostbookRegisterGrid renders with projects', () => {
    const projects = [
      { id: 'p1', name: 'Project A', budget: 100, eac: 90, variance: -10 },
    ]
    render(<CostbookRegisterGrid projects={projects} />)
    expect(screen.getByTestId('costbook-register-grid')).toBeInTheDocument()
  })

  it('Task 17.2: renders with registerId and columns', () => {
    const projects = [{ id: 'p1', name: 'P1' }]
    render(
      <CostbookRegisterGrid
        projects={projects}
        registerId="costbook-1"
        columns={[{ field: 'name', headerName: 'Project' }]}
      />
    )
    expect(screen.getByTestId('costbook-register-grid')).toBeInTheDocument()
  })
})
