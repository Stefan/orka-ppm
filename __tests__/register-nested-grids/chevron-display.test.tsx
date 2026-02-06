/**
 * Property 8.6: Nested Items Chevron Display
 * Validates: Requirements 4.4
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import RegisterGrid from '@/components/register-nested-grids/RegisterGrid'

const mockConfig = {
  sections: [
    {
      id: 'sec-1',
      itemType: 'tasks' as const,
      columns: [{ id: 'c1', field: 'name', headerName: 'Name', order: 0 }],
      displayOrder: 0,
    },
  ],
  enableLinkedItems: true,
}

describe('Property 8.6: Nested Items Chevron Display', () => {
  it('shows expand button (chevron) for row with linked items', () => {
    const rows = [
      { id: 'row-1', name: 'Project A' },
      { id: 'row-2', name: 'Project B' },
    ]
    render(
      <RegisterGrid
        registerId="reg-1"
        rows={rows}
        config={mockConfig}
        getRowId={(r) => r.id}
        columns={[{ field: 'name', headerName: 'Name' }]}
        renderCell={(row, field) => (row as Record<string, unknown>)[field] as React.ReactNode}
        getLinkedCount={(r) => (r.id === 'row-1' ? 3 : 0)}
      />
    )
    expect(screen.getByTestId('expand-row-row-1')).toBeInTheDocument()
  })

  it('does not show expand button for row with no linked items', () => {
    const rows = [{ id: 'row-1', name: 'Project A' }]
    render(
      <RegisterGrid
        registerId="reg-1"
        rows={rows}
        config={mockConfig}
        getRowId={(r) => r.id}
        columns={[{ field: 'name', headerName: 'Name' }]}
        renderCell={(row, field) => (row as Record<string, unknown>)[field] as React.ReactNode}
        getLinkedCount={() => 0}
      />
    )
    expect(screen.queryByTestId('expand-row-row-1')).not.toBeInTheDocument()
  })
})
