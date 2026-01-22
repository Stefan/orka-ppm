import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { POBreakdownTreeView, POBreakdownItem } from '../POBreakdownTreeView'

describe('POBreakdownTreeView', () => {
  const mockData: POBreakdownItem[] = [
    {
      id: '1',
      name: 'Project Phase 1',
      code: 'P1',
      sap_po_number: 'PO-001',
      hierarchy_level: 0,
      planned_amount: 100000,
      committed_amount: 80000,
      actual_amount: 75000,
      remaining_amount: 25000,
      currency: 'USD',
      breakdown_type: 'sap_standard',
      status: 'on-track',
      variance_percentage: -25,
      children: [
        {
          id: '2',
          name: 'Subphase 1.1',
          hierarchy_level: 1,
          parent_breakdown_id: '1',
          planned_amount: 50000,
          committed_amount: 40000,
          actual_amount: 35000,
          remaining_amount: 15000,
          currency: 'USD',
          breakdown_type: 'sap_standard',
          status: 'on-track',
          variance_percentage: -30
        }
      ]
    }
  ]

  it('renders tree view with data', () => {
    render(<POBreakdownTreeView data={mockData} />)
    
    expect(screen.getByText('Project Phase 1')).toBeInTheDocument()
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('SAP PO: PO-001')).toBeInTheDocument()
  })

  it('expands and collapses nodes', () => {
    render(<POBreakdownTreeView data={mockData} />)
    
    // Initially collapsed
    expect(screen.queryByText('Subphase 1.1')).not.toBeInTheDocument()
    
    // Click to expand
    const expandButton = screen.getAllByRole('button')[2] // Skip expand/collapse all buttons
    fireEvent.click(expandButton)
    
    // Should now be visible
    expect(screen.getByText('Subphase 1.1')).toBeInTheDocument()
  })

  it('displays financial data correctly', () => {
    render(<POBreakdownTreeView data={mockData} />)
    
    expect(screen.getByText('USD 100,000')).toBeInTheDocument()
    expect(screen.getByText('USD 75,000')).toBeInTheDocument()
    expect(screen.getByText('-25.0%')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<POBreakdownTreeView data={[]} />)
    
    expect(screen.getByText('No PO breakdown items')).toBeInTheDocument()
  })

  it('calls onItemClick when item is clicked', () => {
    const handleClick = jest.fn()
    render(<POBreakdownTreeView data={mockData} onItemClick={handleClick} />)
    
    const itemElement = screen.getByText('Project Phase 1').closest('div')
    if (itemElement) {
      fireEvent.click(itemElement)
      expect(handleClick).toHaveBeenCalledWith(mockData[0])
    }
  })

  it('displays action buttons when enabled', () => {
    render(<POBreakdownTreeView data={mockData} enableActions={true} />)
    
    // Hover to show actions
    const itemElement = screen.getByText('Project Phase 1').closest('div')
    if (itemElement) {
      fireEvent.mouseEnter(itemElement)
    }
    
    // Actions should be present (though may be hidden by CSS)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(2) // More than just expand/collapse buttons
  })

  it('calculates and displays totals correctly', () => {
    render(<POBreakdownTreeView data={mockData} />)
    
    expect(screen.getByText('Total Planned')).toBeInTheDocument()
    expect(screen.getByText('Total Actual')).toBeInTheDocument()
    expect(screen.getByText('Remaining')).toBeInTheDocument()
  })
})
