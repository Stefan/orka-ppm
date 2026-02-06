/**
 * Feature: register-nested-grids, Property 14: Inline Editing ohne Popups
 * Property 15: Save Operation mit Backend Sync
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableCell from '@/components/register-nested-grids/EditableCell'

describe('Feature: register-nested-grids, Property 14: Inline Editing ohne Popups', () => {
  it('renders value when not editable', () => {
    render(<EditableCell value="test" editable={false} />)
    expect(screen.getByText('test')).toBeInTheDocument()
  })

  it('shows edit button when editable (no popup)', () => {
    render(<EditableCell value="test" editable onSave={async () => {}} />)
    expect(screen.getByTestId('editable-cell')).toBeInTheDocument()
  })

  it('inline input on click, no modal', async () => {
    render(<EditableCell value="old" editable onSave={async () => {}} />)
    await userEvent.click(screen.getByTestId('editable-cell'))
    expect(screen.getByTestId('editable-cell-input')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Feature: register-nested-grids, Property 15: Save Operation mit Backend Sync', () => {
  it('calls onSave with new value on blur', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    render(<EditableCell value="v1" editable onSave={onSave} />)
    await userEvent.click(screen.getByTestId('editable-cell'))
    const input = screen.getByTestId('editable-cell-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'v2')
    input.blur()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('v2'))
  })
})
