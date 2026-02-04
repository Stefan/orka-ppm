/**
 * Feature: register-nested-grids, Property 14: Inline Editing ohne Popups
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import EditableCell from '@/components/register-nested-grids/EditableCell'

describe('EditableCell', () => {
  it('renders value when not editable', () => {
    render(<EditableCell value="test" editable={false} />)
    expect(screen.getByText('test')).toBeInTheDocument()
  })

  it('shows edit button when editable', () => {
    render(<EditableCell value="test" editable onSave={async () => {}} />)
    expect(screen.getByTestId('editable-cell')).toBeInTheDocument()
  })
})
