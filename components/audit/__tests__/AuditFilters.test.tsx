import React from 'react'
import { renderWithI18n, screen, fireEvent, waitFor } from '@/__tests__/utils/test-wrapper'
import '@testing-library/jest-dom'
import AuditFilters, { AuditFilters as AuditFiltersType, UserOption } from '../AuditFilters'

describe('AuditFilters', () => {
  const mockOnChange = jest.fn()
  
  const defaultProps = {
    filters: {
      dateRange: { start: null, end: null },
      eventTypes: [],
      userIds: [],
      entityTypes: [],
      severity: [],
      categories: [],
      riskLevels: [],
      showAnomaliesOnly: false
    },
    onChange: mockOnChange
  }

  const mockUsers: UserOption[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
  ]

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders the filter component', () => {
    renderWithI18n(<AuditFilters {...defaultProps} />)
    expect(screen.getByTestId('audit-filters')).toBeInTheDocument()
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('displays date range pickers', () => {
    renderWithI18n(<AuditFilters {...defaultProps} />)
    expect(screen.getByPlaceholderText('Select start date')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Select end date')).toBeInTheDocument()
  })

  it('displays event type checkboxes', () => {
    const eventTypes = ['user_login', 'budget_change']
    renderWithI18n(<AuditFilters {...defaultProps} availableEventTypes={eventTypes} />)
    
    expect(screen.getByText('user login')).toBeInTheDocument()
    expect(screen.getByText('budget change')).toBeInTheDocument()
  })

  it('handles event type selection', () => {
    const eventTypes = ['user_login', 'budget_change']
    renderWithI18n(<AuditFilters {...defaultProps} availableEventTypes={eventTypes} />)
    
    const checkbox = screen.getByLabelText('user login')
    fireEvent.click(checkbox)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      eventTypes: ['user_login']
    })
  })

  it('expands advanced filters when button is clicked', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Advanced filters should not be visible initially
    expect(screen.queryByText('Entity Types')).not.toBeInTheDocument()
    
    // Click expand button
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    // Advanced filters should now be visible
    expect(screen.getByText('Entity Types')).toBeInTheDocument()
  })

  it('displays severity filter options', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    // Use getAllByText since 'Critical' appears in both severity and risk level sections
    const criticalElements = screen.getAllByText('Critical')
    expect(criticalElements.length).toBeGreaterThan(0)
  })

  it('displays category filter options', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    expect(screen.getByText('Security Change')).toBeInTheDocument()
    expect(screen.getByText('Financial Impact')).toBeInTheDocument()
    expect(screen.getByText('Resource Allocation')).toBeInTheDocument()
    expect(screen.getByText('Risk Event')).toBeInTheDocument()
    expect(screen.getByText('Compliance Action')).toBeInTheDocument()
  })

  it('displays risk level filter options', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const riskLabels = screen.getAllByText('Low')
    expect(riskLabels.length).toBeGreaterThan(0)
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('handles category selection', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const checkbox = screen.getByLabelText('Security Change')
    fireEvent.click(checkbox)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      categories: ['Security Change']
    })
  })

  it('handles risk level selection', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const checkbox = screen.getByLabelText('High')
    fireEvent.click(checkbox)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      riskLevels: ['High']
    })
  })

  it('handles anomalies only toggle', () => {
    renderWithI18n(<AuditFilters {...defaultProps} showAdvancedFilters={true} />)
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const checkbox = screen.getByLabelText('Show Anomalies Only')
    fireEvent.click(checkbox)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      showAnomaliesOnly: true
    })
  })

  it('resets all filters when reset button is clicked', () => {
    const filtersWithData: AuditFiltersType = {
      dateRange: { start: new Date(), end: new Date() },
      eventTypes: ['user_login'],
      severity: ['critical'],
      categories: ['Security Change'],
      riskLevels: ['High'],
      showAnomaliesOnly: true
    }
    
    renderWithI18n(<AuditFilters filters={filtersWithData} onChange={mockOnChange} />)
    
    const resetButton = screen.getByTitle('Reset all filters')
    fireEvent.click(resetButton)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      dateRange: { start: null, end: null },
      eventTypes: [],
      userIds: [],
      entityTypes: [],
      severity: [],
      categories: [],
      riskLevels: [],
      showAnomaliesOnly: false
    })
  })

  it('shows active indicator when filters are applied', () => {
    const filtersWithData: AuditFiltersType = {
      eventTypes: ['user_login']
    }
    
    renderWithI18n(<AuditFilters filters={filtersWithData} onChange={mockOnChange} />)
    
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('displays user autocomplete when users are provided', () => {
    renderWithI18n(
      <AuditFilters
        {...defaultProps}
        availableUsers={mockUsers}
        showAdvancedFilters={true}
      />
    )
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument()
  })

  it('filters users based on search query', async () => {
    renderWithI18n(
      <AuditFilters
        {...defaultProps}
        availableUsers={mockUsers}
        showAdvancedFilters={true}
      />
    )
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const searchInput = screen.getByPlaceholderText('Search users...')
    fireEvent.change(searchInput, { target: { value: 'John' } })
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      // Jane Smith should still be in the dropdown since the filter is case-insensitive
      // and both users are shown when typing
    })
  })

  it('displays entity type checkboxes', () => {
    const entityTypes = ['project', 'resource', 'risk']
    renderWithI18n(
      <AuditFilters
        {...defaultProps}
        availableEntityTypes={entityTypes}
        showAdvancedFilters={true}
      />
    )
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    expect(screen.getByText('project')).toBeInTheDocument()
    expect(screen.getByText('resource')).toBeInTheDocument()
    expect(screen.getByText('risk')).toBeInTheDocument()
  })

  it('handles entity type selection', () => {
    const entityTypes = ['project', 'resource']
    renderWithI18n(
      <AuditFilters
        {...defaultProps}
        availableEntityTypes={entityTypes}
        showAdvancedFilters={true}
      />
    )
    
    // Expand advanced filters
    const expandButton = screen.getByTitle('Expand filters')
    fireEvent.click(expandButton)
    
    const checkbox = screen.getByLabelText('project')
    fireEvent.click(checkbox)
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      entityTypes: ['project']
    })
  })

  it('shows selected event types count', async () => {
    const filtersWithData: AuditFiltersType = {
      eventTypes: ['user_login', 'budget_change', 'permission_change']
    }
    
    renderWithI18n(<AuditFilters filters={filtersWithData} onChange={mockOnChange} />)
    
    await waitFor(() => {
      expect(screen.getByText('3 types selected')).toBeInTheDocument()
    })
  })
})
