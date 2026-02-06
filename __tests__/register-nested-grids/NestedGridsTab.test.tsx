/**
 * NestedGridsTab component test
 * Feature: register-nested-grids, Property 1 / 5.2: Admin Panel Editability
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import NestedGridsTab from '@/components/register-nested-grids/NestedGridsTab'

jest.mock('@/lib/register-nested-grids/api', () => ({
  saveNestedGridConfig: jest.fn().mockResolvedValue({}),
}))

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

  describe('Property 5.2: Admin Panel Editability basierend auf Enable Flag', () => {
    it('does not show Save or Add Section when enableLinkedItems is false', () => {
      render(
        <NestedGridsTab
          registerId="reg-1"
          enableLinkedItems={false}
          config={{ sections: [], enableLinkedItems: false }}
          onConfigChange={jest.fn()}
        />
      )
      expect(screen.queryByTestId('nested-grids-save')).not.toBeInTheDocument()
      expect(screen.queryByText(/Add Section/)).not.toBeInTheDocument()
    })

    it('does not show Save or Add Section when readOnly is true even if enableLinkedItems is true', () => {
      render(
        <NestedGridsTab
          registerId="reg-1"
          enableLinkedItems={true}
          config={{ sections: [], enableLinkedItems: true }}
          onConfigChange={jest.fn()}
          readOnly={true}
        />
      )
      expect(screen.queryByTestId('nested-grids-save')).not.toBeInTheDocument()
      expect(screen.queryByText(/Add Section/)).not.toBeInTheDocument()
    })

    it('shows Add Section and Save when editable and config is present', () => {
      render(
        <NestedGridsTab
          registerId="reg-1"
          enableLinkedItems={true}
          config={{ sections: [], enableLinkedItems: true }}
          onConfigChange={jest.fn()}
        />
      )
      expect(screen.getByTestId('nested-grids-save')).toBeInTheDocument()
      expect(screen.getByText(/Add Section/)).toBeInTheDocument()
    })
  })
})
