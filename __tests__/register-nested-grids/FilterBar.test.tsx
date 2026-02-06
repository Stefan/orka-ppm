/**
 * Feature: register-nested-grids, Property 20: Filter Bar Presence
 * Validates: Requirements 9.1
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterBar from '@/components/register-nested-grids/FilterBar'
import type { Filter } from '@/components/register-nested-grids/types'

const fields = [
  { field: 'status', label: 'Status' },
  { field: 'name', label: 'Name' },
]

describe('Feature: register-nested-grids, Property 20: Filter Bar Presence', () => {
  it('renders filter bar with fields and add/remove capability', () => {
    const onFiltersChange = jest.fn()
    const filters: Filter[] = []
    render(<FilterBar fields={fields} filters={filters} onFiltersChange={onFiltersChange} />)
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument()
  })

  it('shows existing filters and allows removal', async () => {
    const onFiltersChange = jest.fn()
    const filters: Filter[] = [
      { id: 'f1', field: 'status', operator: 'equals', value: 'open', label: 'Status' },
    ]
    render(<FilterBar fields={fields} filters={filters} onFiltersChange={onFiltersChange} />)
    const removeBtn = screen.getByRole('button', { name: /remove filter/i })
    await userEvent.click(removeBtn)
    expect(onFiltersChange).toHaveBeenCalledWith([])
  })
})
