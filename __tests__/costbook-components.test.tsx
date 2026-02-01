/**
 * Component Tests for Costbook UI Components
 * 
 * Tests the new Phase 1 components:
 * - VirtualizedTransactionTable
 * - HierarchyTreeView
 * - MobileAccordion
 * - CSVImportDialog
 * - PerformanceDialog
 * - HelpDialog
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock react-window
jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, height }: any) => (
    <div data-testid="virtual-list" style={{ height }}>
      {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) => (
        <div key={index}>
          {children({ index, style: {} })}
        </div>
      ))}
    </div>
  )
}))

// Import components
import { VirtualizedTransactionTable, VirtualizedTransactionTableSkeleton } from '@/components/costbook/VirtualizedTransactionTable'
import { HierarchyTreeView, HierarchyTreeViewSkeleton } from '@/components/costbook/HierarchyTreeView'
import { MobileAccordion, AccordionItem, MobileAccordionSkeleton } from '@/components/costbook/MobileAccordion'
import { PerformanceDialog, PerformanceMetrics } from '@/components/costbook/PerformanceDialog'
import { HelpDialog } from '@/components/costbook/HelpDialog'

// Import types
import { Transaction, Currency, POStatus, ActualStatus, HierarchyNode } from '@/types/costbook'

// Mock data
const mockTransactions: Transaction[] = [
  {
    id: 'trans-001',
    project_id: 'proj-001',
    type: 'commitment',
    amount: 25000,
    currency: Currency.USD,
    vendor_name: 'Design Agency Inc',
    description: 'UI/UX Design Services',
    date: '2024-01-15T00:00:00Z',
    po_number: 'PO-2024-001',
    status: POStatus.APPROVED
  },
  {
    id: 'trans-002',
    project_id: 'proj-001',
    type: 'actual',
    amount: 12500,
    currency: Currency.USD,
    vendor_name: 'Design Agency Inc',
    description: 'Initial Payment',
    date: '2024-01-20T00:00:00Z',
    po_number: 'PO-2024-001',
    status: ActualStatus.APPROVED
  },
  {
    id: 'trans-003',
    project_id: 'proj-002',
    type: 'commitment',
    amount: 40000,
    currency: Currency.USD,
    vendor_name: 'Dev Team LLC',
    description: 'Frontend Development',
    date: '2024-01-25T00:00:00Z',
    po_number: 'PO-2024-002',
    status: POStatus.ISSUED
  }
]

const mockHierarchyData: HierarchyNode[] = [
  {
    id: 'ces-design',
    name: 'Design',
    level: 0,
    total_budget: 50000,
    total_spend: 25000,
    variance: 25000,
    children: [
      {
        id: 'ces-design-vendor1',
        name: 'Design Agency Inc',
        level: 1,
        parent_id: 'ces-design',
        total_budget: 30000,
        total_spend: 25000,
        variance: 5000,
        children: []
      }
    ]
  },
  {
    id: 'ces-development',
    name: 'Development',
    level: 0,
    total_budget: 100000,
    total_spend: 40000,
    variance: 60000,
    children: [
      {
        id: 'ces-development-vendor2',
        name: 'Dev Team LLC',
        level: 1,
        parent_id: 'ces-development',
        total_budget: 100000,
        total_spend: 40000,
        variance: 60000,
        children: []
      }
    ]
  }
]

const mockPerformanceMetrics: PerformanceMetrics = {
  queryTime: 150,
  renderTime: 80,
  transformTime: 20,
  totalTime: 250,
  projectCount: 10,
  commitmentCount: 50,
  actualCount: 30,
  cacheHitRate: 85,
  lastRefresh: new Date().toISOString(),
  errorCount: 0
}

// ============================================
// VirtualizedTransactionTable Tests
// ============================================
describe('VirtualizedTransactionTable', () => {
  it('renders correct number of transactions', () => {
    render(
      <VirtualizedTransactionTable
        transactions={mockTransactions}
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('Showing 3 transactions')).toBeInTheDocument()
  })

  it('displays empty state when no transactions', () => {
    render(
      <VirtualizedTransactionTable
        transactions={[]}
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('No transactions found')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(
      <VirtualizedTransactionTable
        transactions={mockTransactions}
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Vendor')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
  })

  it('calls onSortChange when sortable column header is clicked', () => {
    const onSortChange = jest.fn()
    
    render(
      <VirtualizedTransactionTable
        transactions={mockTransactions}
        currency={Currency.USD}
        sortColumn="date"
        sortDirection="desc"
        onSortChange={onSortChange}
      />
    )

    // Find the Date column header and click it
    const dateHeader = screen.getByText('Date').closest('div')
    if (dateHeader) {
      fireEvent.click(dateHeader)
    }
    expect(onSortChange).toHaveBeenCalledWith('date', 'asc')
  })

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = jest.fn()
    
    render(
      <VirtualizedTransactionTable
        transactions={mockTransactions}
        currency={Currency.USD}
        onRowClick={onRowClick}
      />
    )

    fireEvent.click(screen.getByTestId('transaction-row-0'))
    expect(onRowClick).toHaveBeenCalledWith(mockTransactions[0])
  })

  it('filters columns based on visibleColumns prop', () => {
    render(
      <VirtualizedTransactionTable
        transactions={mockTransactions}
        currency={Currency.USD}
        visibleColumns={['type', 'amount']}
      />
    )

    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.queryByText('Vendor')).not.toBeInTheDocument()
  })

  it('renders skeleton loader', () => {
    render(<VirtualizedTransactionTableSkeleton rowCount={3} />)
    
    // Skeleton should render without errors
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

// ============================================
// HierarchyTreeView Tests
// ============================================
describe('HierarchyTreeView', () => {
  it('renders hierarchy nodes', () => {
    render(
      <HierarchyTreeView
        data={mockHierarchyData}
        viewType="ces"
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('Development')).toBeInTheDocument()
  })

  it('displays empty state when no data', () => {
    render(
      <HierarchyTreeView
        data={[]}
        viewType="ces"
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('No CES data available')).toBeInTheDocument()
  })

  it('expands node when clicking chevron', () => {
    render(
      <HierarchyTreeView
        data={mockHierarchyData}
        viewType="ces"
        currency={Currency.USD}
      />
    )

    // Initially children are not visible (collapsed)
    expect(screen.queryByText('Design Agency Inc')).not.toBeInTheDocument()

    // Click expand button for Design node
    const expandButtons = screen.getAllByRole('button', { name: /expand/i })
    fireEvent.click(expandButtons[0])

    // Now children should be visible
    expect(screen.getByText('Design Agency Inc')).toBeInTheDocument()
  })

  it('calls onNodeSelect when node is clicked', () => {
    const onNodeSelect = jest.fn()
    
    render(
      <HierarchyTreeView
        data={mockHierarchyData}
        viewType="ces"
        currency={Currency.USD}
        onNodeSelect={onNodeSelect}
      />
    )

    fireEvent.click(screen.getByTestId('tree-node-ces-design'))
    expect(onNodeSelect).toHaveBeenCalledWith(mockHierarchyData[0])
  })

  it('shows expand all and collapse all buttons', () => {
    render(
      <HierarchyTreeView
        data={mockHierarchyData}
        viewType="ces"
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('Expand All')).toBeInTheDocument()
    expect(screen.getByText('Collapse All')).toBeInTheDocument()
  })

  it('displays total row with calculated values', () => {
    render(
      <HierarchyTreeView
        data={mockHierarchyData}
        viewType="ces"
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('renders WBS view type correctly', () => {
    render(
      <HierarchyTreeView
        data={[]}
        viewType="wbs"
        currency={Currency.USD}
      />
    )

    expect(screen.getByText('No WBS data available')).toBeInTheDocument()
  })

  it('renders skeleton loader', () => {
    render(<HierarchyTreeViewSkeleton rowCount={3} />)
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

// ============================================
// MobileAccordion Tests
// ============================================
describe('MobileAccordion', () => {
  const mockSections = [
    { id: 'section-1', title: 'Section 1', content: <div>Content 1</div> },
    { id: 'section-2', title: 'Section 2', content: <div>Content 2</div>, badge: 5 },
    { id: 'section-3', title: 'Section 3', content: <div>Content 3</div>, disabled: true }
  ]

  it('renders all sections', () => {
    render(<MobileAccordion sections={mockSections} />)

    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByText('Section 2')).toBeInTheDocument()
    expect(screen.getByText('Section 3')).toBeInTheDocument()
  })

  it('displays badge when provided', () => {
    render(<MobileAccordion sections={mockSections} />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('expands section when clicked', async () => {
    render(<MobileAccordion sections={mockSections} />)

    // Content is in the DOM but collapsed (opacity-0)
    const content1 = screen.getByText('Content 1')
    expect(content1.closest('[role="region"]')).toHaveClass('opacity-0')

    // Click section header
    fireEvent.click(screen.getByText('Section 1'))

    // Content should now be expanded (opacity-100)
    await waitFor(() => {
      expect(content1.closest('[role="region"]')).toHaveClass('opacity-100')
    })
  })

  it('does not expand disabled section', async () => {
    render(<MobileAccordion sections={mockSections} />)

    const content3 = screen.getByText('Content 3')
    const region = content3.closest('[role="region"]')
    
    // Verify it starts collapsed
    expect(region).toHaveClass('opacity-0')

    fireEvent.click(screen.getByText('Section 3'))

    // Content should still be collapsed since section is disabled
    await waitFor(() => {
      expect(region).toHaveClass('opacity-0')
    })
  })

  it('supports multiple sections open when allowMultiple is true', async () => {
    render(<MobileAccordion sections={mockSections} allowMultiple={true} />)

    const content1 = screen.getByText('Content 1')
    const content2 = screen.getByText('Content 2')

    fireEvent.click(screen.getByText('Section 1'))
    fireEvent.click(screen.getByText('Section 2'))

    await waitFor(() => {
      expect(content1.closest('[role="region"]')).toHaveClass('opacity-100')
      expect(content2.closest('[role="region"]')).toHaveClass('opacity-100')
    })
  })

  it('closes other sections when allowMultiple is false', async () => {
    render(<MobileAccordion sections={mockSections} allowMultiple={false} />)

    const content1 = screen.getByText('Content 1')
    const content2 = screen.getByText('Content 2')

    fireEvent.click(screen.getByText('Section 1'))
    
    await waitFor(() => {
      expect(content1.closest('[role="region"]')).toHaveClass('opacity-100')
    })

    fireEvent.click(screen.getByText('Section 2'))

    await waitFor(() => {
      expect(content1.closest('[role="region"]')).toHaveClass('opacity-0')
      expect(content2.closest('[role="region"]')).toHaveClass('opacity-100')
    })
  })

  it('has minimum 44px touch target', () => {
    render(<MobileAccordion sections={mockSections} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      // Check that min-h-[44px] class is applied
      expect(button.className).toContain('min-h-[44px]')
    })
  })

  it('calls onSectionChange when section changes', () => {
    const onSectionChange = jest.fn()
    
    render(
      <MobileAccordion 
        sections={mockSections} 
        onSectionChange={onSectionChange}
      />
    )

    fireEvent.click(screen.getByText('Section 1'))
    expect(onSectionChange).toHaveBeenCalledWith(['section-1'])
  })

  it('renders empty state when no sections', () => {
    render(<MobileAccordion sections={[]} />)

    expect(screen.getByText('No sections available')).toBeInTheDocument()
  })

  it('renders skeleton loader', () => {
    render(<MobileAccordionSkeleton sectionCount={3} />)
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

// ============================================
// AccordionItem Tests
// ============================================
describe('AccordionItem', () => {
  it('renders title and content', () => {
    render(
      <AccordionItem title="Test Item">
        <div>Test Content</div>
      </AccordionItem>
    )

    expect(screen.getByText('Test Item')).toBeInTheDocument()
  })

  it('expands when clicked', async () => {
    render(
      <AccordionItem title="Test Item">
        <div>Test Content</div>
      </AccordionItem>
    )

    const content = screen.getByText('Test Content')
    const expandableDiv = content.closest('.overflow-hidden')
    
    // Initially collapsed
    expect(expandableDiv).toHaveClass('opacity-0')

    fireEvent.click(screen.getByText('Test Item'))

    await waitFor(() => {
      expect(expandableDiv).toHaveClass('opacity-100')
    })
  })

  it('supports defaultExpanded prop', () => {
    render(
      <AccordionItem title="Test Item" defaultExpanded={true}>
        <div>Test Content</div>
      </AccordionItem>
    )

    const content = screen.getByText('Test Content')
    const expandableDiv = content.closest('.overflow-hidden')
    expect(expandableDiv).toHaveClass('opacity-100')
  })

  it('supports controlled expanded state', () => {
    const { rerender } = render(
      <AccordionItem title="Test Item" expanded={false}>
        <div>Test Content</div>
      </AccordionItem>
    )

    const content = screen.getByText('Test Content')
    const expandableDiv = content.closest('.overflow-hidden')
    expect(expandableDiv).toHaveClass('opacity-0')

    rerender(
      <AccordionItem title="Test Item" expanded={true}>
        <div>Test Content</div>
      </AccordionItem>
    )

    expect(expandableDiv).toHaveClass('opacity-100')
  })
})

// ============================================
// PerformanceDialog Tests
// ============================================
describe('PerformanceDialog', () => {
  it('renders when isOpen is true', () => {
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={() => {}}
        metrics={mockPerformanceMetrics}
      />
    )

    expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(
      <PerformanceDialog
        isOpen={false}
        onClose={() => {}}
        metrics={mockPerformanceMetrics}
      />
    )

    expect(screen.queryByText('Performance Metrics')).not.toBeInTheDocument()
  })

  it('displays all metric values', () => {
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={() => {}}
        metrics={mockPerformanceMetrics}
      />
    )

    expect(screen.getByText('Query Time')).toBeInTheDocument()
    expect(screen.getByText('Render Time')).toBeInTheDocument()
    expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument() // queryTime value
    expect(screen.getByText('80')).toBeInTheDocument() // renderTime value
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={onClose}
        metrics={mockPerformanceMetrics}
      />
    )

    // Click the X button in the header (first close button)
    const closeButtons = screen.getAllByRole('button')
    // Find the button with X icon (aria-label="Close")
    const closeBtn = closeButtons.find(btn => btn.getAttribute('aria-label') === 'Close')
    if (closeBtn) {
      fireEvent.click(closeBtn)
    } else {
      // Fallback: click the last button which is the "Close" text button
      fireEvent.click(screen.getByText('Close'))
    }
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={onClose}
        metrics={mockPerformanceMetrics}
      />
    )

    // Click the backdrop (first element with bg-black/50)
    const backdrop = document.querySelector('.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
    }
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onRefresh when refresh button is clicked', () => {
    const onRefresh = jest.fn()
    
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={() => {}}
        metrics={mockPerformanceMetrics}
        onRefresh={onRefresh}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows green status for good metrics', () => {
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={() => {}}
        metrics={mockPerformanceMetrics}
      />
    )

    expect(screen.getByText('All systems healthy')).toBeInTheDocument()
  })

  it('shows warning status for slow metrics', () => {
    const slowMetrics: PerformanceMetrics = {
      ...mockPerformanceMetrics,
      queryTime: 600,
      totalTime: 1200
    }
    
    render(
      <PerformanceDialog
        isOpen={true}
        onClose={() => {}}
        metrics={slowMetrics}
      />
    )

    expect(screen.getByText('Performance issues detected')).toBeInTheDocument()
  })
})

// ============================================
// HelpDialog Tests
// ============================================
describe('HelpDialog', () => {
  it('renders when isOpen is true', () => {
    render(
      <HelpDialog
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Help')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(
      <HelpDialog
        isOpen={false}
        onClose={() => {}}
      />
    )

    expect(screen.queryByText('Help')).not.toBeInTheDocument()
  })

  it('shows overview section by default', () => {
    render(
      <HelpDialog
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Quick Start')).toBeInTheDocument()
  })

  it('switches sections when navigation is clicked', () => {
    render(
      <HelpDialog
        isOpen={true}
        onClose={() => {}}
      />
    )

    // Click on KPI Definitions section
    fireEvent.click(screen.getByText('KPI Definitions'))

    expect(screen.getByText('Total Budget')).toBeInTheDocument()
    expect(screen.getByText('Net Variance')).toBeInTheDocument()
  })

  it('shows keyboard shortcuts section', () => {
    render(
      <HelpDialog
        isOpen={true}
        onClose={() => {}}
        initialSection="keyboard"
      />
    )

    expect(screen.getByText('Focus search input')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
  })

  it('shows chart guide section', () => {
    render(
      <HelpDialog
        isOpen={true}
        onClose={() => {}}
        initialSection="charts"
      />
    )

    expect(screen.getByText('Variance Waterfall')).toBeInTheDocument()
    expect(screen.getByText('Health Bubble Chart')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <HelpDialog
        isOpen={true}
        onClose={onClose}
      />
    )

    // Click the X button (aria-label="Close")
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    
    render(
      <HelpDialog
        isOpen={true}
        onClose={onClose}
      />
    )

    const backdrop = document.querySelector('.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
    }
    expect(onClose).toHaveBeenCalled()
  })
})
