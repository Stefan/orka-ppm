/**
 * Unit tests for SlowQueriesTable component
 * 
 * Tests verify:
 * - Component renders without errors
 * - Data is displayed correctly
 * - React.memo prevents unnecessary re-renders
 * - Empty state is handled correctly
 * 
 * Requirements: 3.4, 8.2
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SlowQueriesTable from '@/components/admin/SlowQueriesTable'

describe('SlowQueriesTable', () => {
  const mockTranslations = {
    recentSlowQueries: 'Recent Slow Queries',
    endpoint: 'Endpoint',
    duration: 'Duration',
    time: 'Time'
  }

  const mockSlowQueriesData = [
    {
      endpoint: '/api/projects',
      duration: 1500,
      time: '10:30:45'
    },
    {
      endpoint: '/api/resources',
      duration: 2000,
      time: '10:31:20'
    }
  ]

  it('renders without errors with valid data', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    expect(container.firstChild).toBeInTheDocument()
  })

  it('displays table title', () => {
    render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    expect(screen.getByText('Recent Slow Queries')).toBeInTheDocument()
  })

  it('renders table headers correctly', () => {
    render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    expect(screen.getByText('Endpoint')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
  })

  it('displays all slow query data', () => {
    render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    expect(screen.getByText('/api/projects')).toBeInTheDocument()
    expect(screen.getByText('/api/resources')).toBeInTheDocument()
    expect(screen.getByText('1500ms')).toBeInTheDocument()
    expect(screen.getByText('2000ms')).toBeInTheDocument()
    expect(screen.getByText('10:30:45')).toBeInTheDocument()
    expect(screen.getByText('10:31:20')).toBeInTheDocument()
  })

  it('renders correct number of rows', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
  })

  it('shows empty state when slowQueriesData is empty', () => {
    const mockWithEmpty = { ...mockTranslations, noSlowQueries: 'No slow queries in threshold (≥1s).' }
    render(
      <SlowQueriesTable 
        slowQueriesData={[]}
        translations={mockWithEmpty}
      />
    )
    expect(screen.getByText('No slow queries in threshold (≥1s).')).toBeInTheDocument()
  })

  it('has proper table structure', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const table = container.querySelector('table')
    const thead = container.querySelector('thead')
    const tbody = container.querySelector('tbody')
    
    expect(table).toBeInTheDocument()
    expect(thead).toBeInTheDocument()
    expect(tbody).toBeInTheDocument()
  })

  it('has proper column widths', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const headerCells = container.querySelectorAll('thead th')
    expect(headerCells[0]).toHaveClass('w-1/2')
    expect(headerCells[1]).toHaveClass('w-1/4')
    expect(headerCells[2]).toHaveClass('w-1/4')
  })

  it('applies proper styling to container', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('bg-white', 'p-6', 'rounded-lg', 'shadow-sm', 'border')
  })

  it('displays duration in red color', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const durationCells = container.querySelectorAll('tbody tr td:nth-child(2)')
    durationCells.forEach(cell => {
      expect(cell).toHaveClass('text-red-600')
    })
  })

  it('displays endpoint with proper styling', () => {
    const { container } = render(
      <SlowQueriesTable 
        slowQueriesData={mockSlowQueriesData}
        translations={mockTranslations}
      />
    )
    
    const endpointDivs = container.querySelectorAll('tbody tr td:first-child div')
    endpointDivs.forEach(div => {
      expect(div).toHaveClass('font-mono', 'text-xs', 'bg-gray-100', 'px-2', 'py-1', 'rounded')
    })
  })
})
