/**
 * NestedGridsTab component test
 * Feature: register-nested-grids, Property 1: Admin Panel Editability
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import NestedGridsTab from '@/components/register-nested-grids/NestedGridsTab'

describe('NestedGridsTab', () => {
  it('renders and shows read-only message when enableLinkedItems is false', () => {
    const onConfigChange = jest.fn()
    render(
      <NestedGridsTab
        registerId="reg-1"
        enableLinkedItems={false}
        config={null}
        onConfigChange={onConfigChange}
      />
    )
    expect(screen.getByText(/Enable Linked Items to edit/)).toBeInTheDocument()
  })

  it('renders add section button when editable', () => {
    const onConfigChange = jest.fn()
    render(
      <NestedGridsTab
        registerId="reg-1"
        enableLinkedItems={true}
        config={{ sections: [], enableLinkedItems: true }}
        onConfigChange={onConfigChange}
      />
    )
    expect(screen.getByText(/Add Section/)).toBeInTheDocument()
  })

  it('shows no sections when config has none', () => {
    render(
      <NestedGridsTab
        registerId="reg-1"
        enableLinkedItems={true}
        config={{ sections: [], enableLinkedItems: true }}
        onConfigChange={jest.fn()}
      />
    )
    expect(screen.getByText(/No sections configured/)).toBeInTheDocument()
  })
})
