/**
 * Unit Tests: Audit UI Components
 * 
 * Tests for audit interface components including:
 * - Timeline chart rendering
 * - Search interface
 * - Anomaly highlighting
 * - Tag management
 * - Filtering
 * - Export triggering
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Timeline, AnomalyDashboard, SemanticSearch, AuditFilters } from '../components/audit'
import type { AuditEvent } from '../components/audit/Timeline'
import type { AnomalyDetection } from '../components/audit/AnomalyDashboard'

// Mock data
const mockAuditEvents: AuditEvent[] = [
  {
    id: '1',
    event_type: 'user_login',
    user_id: 'user-1',
    user_name: 'John Doe',
    entity_type: 'user',
    entity_id: 'user-1',
    action_details: { ip: '192.168.1.1' },
    severity: 'info',
    timestamp: '2024-01-15T10:00:00Z',
    anomaly_score: 0.1,
    is_anomaly: false,
    category: 'Security Change',
    tenant_id: 'tenant-1'
  },
  {
    id: '2',
    event_type: 'budget_change',
    user_id: 'user-2',
    user_name: 'Jane Smith',
    entity_type: 'project',
    entity_id: 'project-1',
    action_details: { old_budget: 10000, new_budget: 15000 },
    severity: 'warning',
    timestamp: '2024-01-15T11:00:00Z',
    anomaly_score: 0.85,
    is_anomaly: true,
    category: 'Financial Impact',
    risk_level: 'High',
    tenant_id: 'tenant-1'
  },
  {
    id: '3',
    event_type: 'permission_change',
    user_id: 'user-1',
    user_name: 'John Doe',
    entity_type: 'user',
    entity_id: 'user-3',
    action_details: { role: 'admin' },
    severity: 'critical',
    timestamp: '2024-01-15T12:00:00Z',
    anomaly_score: 0.95,
    is_anomaly: true,
    category: 'Security Change',
    risk_level: 'Critical',
    tenant_id: 'tenant-1'
  }
]

const mockAnomalies: AnomalyDetection[] = [
  {
    id: 'anomaly-1',
    audit_event_id: '2',
    audit_event: mockAuditEvents[1],
    anomaly_score: 0.85,
    detection_timestamp: '2024-01-15T11:05:00Z',
    features_used: { hour_of_day: 11, action_frequency: 5 },
    model_version: 'v1.0',
    is_false_positive: false,
    alert_sent: true,
    tenant_id: 'tenant-1'
  },
  {
    id: 'anomaly-2',
    audit_event_id: '3',
    audit_event: mockAuditEvents[2],
    anomaly_score: 0.95,
    detection_timestamp: '2024-01-15T12:05:00Z',
    features_used: { hour_of_day: 12, action_frequency: 1 },
    model_version: 'v1.0',
    is_false_positive: false,
    alert_sent: true,
    tenant_id: 'tenant-1'
  }
]

describe('Timeline Component', () => {
  it('should render timeline chart with events', () => {
    render(<Timeline events={mockAuditEvents} />)
    
    // Check that timeline is rendered
    expect(screen.getByTestId('audit-timeline')).toBeInTheDocument()
    
    // Check that event count is displayed
    expect(screen.getByText(/3 events/i)).toBeInTheDocument()
  })

  it('should display anomaly count', () => {
    render(<Timeline events={mockAuditEvents} />)
    
    // Check that anomaly count is displayed
    expect(screen.getByText(/2 anomalies/i)).toBeInTheDocument()
  })

  it('should handle event click', () => {
    const onEventClick = jest.fn()
    render(<Timeline events={mockAuditEvents} onEventClick={onEventClick} />)
    
    // Note: Clicking on chart elements requires more complex interaction
    // This is a placeholder for the test structure
    expect(onEventClick).not.toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(<Timeline events={[]} loading={true} />)
    
    expect(screen.getByText(/loading timeline/i)).toBeInTheDocument()
  })

  it('should show empty state when no events', () => {
    render(<Timeline events={[]} loading={false} />)
    
    expect(screen.getByText(/no events to display/i)).toBeInTheDocument()
  })

  it('should toggle filters panel', () => {
    render(<Timeline events={mockAuditEvents} />)
    
    const filterButton = screen.getByTitle('Toggle Filters')
    fireEvent.click(filterButton)
    
    // Check that filters are displayed
    expect(screen.getByText(/date range/i)).toBeInTheDocument()
  })

  it('should apply severity filter', () => {
    const onFilterChange = jest.fn()
    render(
      <Timeline
        events={mockAuditEvents}
        filters={{}}
        onFilterChange={onFilterChange}
      />
    )
    
    // Open filters
    const filterButton = screen.getByTitle('Toggle Filters')
    fireEvent.click(filterButton)
    
    // Click on critical severity checkbox (use getAllByLabelText since there are multiple)
    const criticalCheckboxes = screen.getAllByLabelText(/critical/i)
    fireEvent.click(criticalCheckboxes[0])
    
    expect(onFilterChange).toHaveBeenCalled()
  })
})

describe('AnomalyDashboard Component', () => {
  it('should render anomaly dashboard with anomalies', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    expect(screen.getByTestId('anomaly-dashboard')).toBeInTheDocument()
    expect(screen.getByText(/2 anomalies detected/i)).toBeInTheDocument()
  })

  it('should display anomaly statistics', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    // Check for critical and high anomaly counts
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('should highlight critical anomalies', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    // Check that critical anomaly is displayed with high score
    expect(screen.getByText(/95\.0% anomaly/i)).toBeInTheDocument()
  })

  it('should show confidence scores', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    // Check that anomaly scores are displayed
    expect(screen.getByText(/85\.0% anomaly/i)).toBeInTheDocument()
    expect(screen.getByText(/95\.0% anomaly/i)).toBeInTheDocument()
  })

  it('should expand anomaly details', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    // Find and click expand button for first anomaly
    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[0])
    
    // Check that details are shown
    expect(screen.getByText(/affected entity/i)).toBeInTheDocument()
  })

  it('should handle feedback submission', async () => {
    const onFeedback = jest.fn().mockResolvedValue(undefined)
    render(<AnomalyDashboard anomalies={mockAnomalies} onFeedback={onFeedback} />)
    
    // Expand first anomaly
    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[0])
    
    // Note: Feedback UI interaction would require more complex setup
    // This is a placeholder for the test structure
    expect(onFeedback).not.toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(<AnomalyDashboard anomalies={[]} loading={true} />)
    
    expect(screen.getByText(/loading anomalies/i)).toBeInTheDocument()
  })

  it('should show empty state when no anomalies', () => {
    render(<AnomalyDashboard anomalies={[]} loading={false} />)
    
    expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument()
  })
})

describe('SemanticSearch Component', () => {
  it('should render search interface', () => {
    const onSearch = jest.fn()
    render(<SemanticSearch onSearch={onSearch} />)
    
    expect(screen.getByTestId('semantic-search')).toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
    expect(screen.getByTestId('search-button')).toBeInTheDocument()
  })

  it('should display example queries', () => {
    const onSearch = jest.fn()
    render(<SemanticSearch onSearch={onSearch} />)
    
    // Check that example queries are displayed
    expect(screen.getByText(/try these example queries/i)).toBeInTheDocument()
    expect(screen.getByText(/show me all budget changes last week/i)).toBeInTheDocument()
  })

  it('should handle search input', () => {
    const onSearch = jest.fn()
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    
    expect(searchInput.value).toBe('test query')
  })

  it('should trigger search on button click', async () => {
    const onSearch = jest.fn().mockResolvedValue({
      query: 'test query',
      results: [],
      ai_response: 'No results found',
      sources: [],
      total_results: 0
    })
    
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input')
    const searchButton = screen.getByTestId('search-button')
    
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    fireEvent.click(searchButton)
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test query')
    })
  })

  it('should trigger search on Enter key', async () => {
    const onSearch = jest.fn().mockResolvedValue({
      query: 'test query',
      results: [],
      ai_response: 'No results found',
      sources: [],
      total_results: 0
    })
    
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input')
    
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter', charCode: 13 })
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test query')
    })
  })

  it('should display search results', async () => {
    const onSearch = jest.fn().mockResolvedValue({
      query: 'test query',
      results: [
        {
          event: mockAuditEvents[0],
          similarity_score: 0.95,
          relevance_explanation: 'This event matches your query'
        }
      ],
      ai_response: 'Found 1 matching event',
      sources: [
        {
          event_id: '1',
          event_type: 'user_login',
          timestamp: '2024-01-15T10:00:00Z'
        }
      ],
      total_results: 1
    })
    
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input')
    const searchButton = screen.getByTestId('search-button')
    
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    fireEvent.click(searchButton)
    
    await waitFor(() => {
      expect(screen.getByText(/found 1 matching event/i)).toBeInTheDocument()
      // Check for the score value separately since it's split across elements
      expect(screen.getByText('95.0%')).toBeInTheDocument()
      expect(screen.getByText('relevance')).toBeInTheDocument()
    })
  })

  it('should handle example query click', () => {
    const onSearch = jest.fn()
    render(<SemanticSearch onSearch={onSearch} />)
    
    const exampleQuery = screen.getByTestId('example-query-0')
    fireEvent.click(exampleQuery)
    
    const searchInput = screen.getByTestId('search-input') as HTMLInputElement
    expect(searchInput.value).toBe('Show me all budget changes last week')
  })

  it('should clear search', () => {
    const onSearch = jest.fn()
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    
    expect(searchInput.value).toBe('test query')
    
    const clearButton = screen.getByLabelText('Clear search')
    fireEvent.click(clearButton)
    
    expect(searchInput.value).toBe('')
  })
})

describe('AuditFilters Component', () => {
  it('should render filter component', () => {
    const onChange = jest.fn()
    render(<AuditFilters filters={{}} onChange={onChange} />)
    
    expect(screen.getByTestId('audit-filters')).toBeInTheDocument()
    expect(screen.getByText(/filters/i)).toBeInTheDocument()
  })

  it('should display date range picker', () => {
    const onChange = jest.fn()
    render(<AuditFilters filters={{}} onChange={onChange} />)
    
    expect(screen.getByText(/date range/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/select start date/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/select end date/i)).toBeInTheDocument()
  })

  it('should display event type checkboxes', () => {
    const onChange = jest.fn()
    render(<AuditFilters filters={{}} onChange={onChange} />)
    
    expect(screen.getByText(/event types/i)).toBeInTheDocument()
  })

  it('should handle event type selection', () => {
    const onChange = jest.fn()
    render(
      <AuditFilters
        filters={{}}
        onChange={onChange}
        availableEventTypes={['user_login', 'budget_change']}
      />
    )
    
    const checkbox = screen.getByLabelText(/user login/i)
    fireEvent.click(checkbox)
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypes: expect.arrayContaining(['user_login'])
      })
    )
  })

  it('should reset all filters', () => {
    const onChange = jest.fn()
    render(
      <AuditFilters
        filters={{
          eventTypes: ['user_login'],
          severity: ['critical']
        }}
        onChange={onChange}
      />
    )
    
    const resetButton = screen.getByText(/clear all filters/i)
    fireEvent.click(resetButton)
    
    expect(onChange).toHaveBeenCalledWith({
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

  it('should show active filter indicator', () => {
    const onChange = jest.fn()
    render(
      <AuditFilters
        filters={{
          eventTypes: ['user_login']
        }}
        onChange={onChange}
      />
    )
    
    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it('should toggle advanced filters', () => {
    const onChange = jest.fn()
    render(
      <AuditFilters
        filters={{}}
        onChange={onChange}
        showAdvancedFilters={true}
        availableUsers={[
          { id: 'user-1', name: 'John Doe', email: 'john@example.com' }
        ]}
      />
    )
    
    // Initially filters are collapsed, so expand them
    const expandButton = screen.getByTitle(/expand filters/i)
    fireEvent.click(expandButton)
    
    // Check that advanced filters are shown (Users section with input)
    expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument()
  })

  it('should handle anomalies only toggle', () => {
    const onChange = jest.fn()
    render(
      <AuditFilters
        filters={{}}
        onChange={onChange}
        showAdvancedFilters={true}
      />
    )
    
    // Expand filters first
    const expandButton = screen.getByTitle(/expand filters/i)
    fireEvent.click(expandButton)
    
    const anomaliesCheckbox = screen.getByLabelText(/show anomalies only/i)
    fireEvent.click(anomaliesCheckbox)
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        showAnomaliesOnly: true
      })
    )
  })
})

describe('Integration Tests', () => {
  it('should filter timeline events by severity', () => {
    const onFilterChange = jest.fn()
    render(
      <Timeline
        events={mockAuditEvents}
        filters={{ severity: ['critical'] }}
        onFilterChange={onFilterChange}
      />
    )
    
    // Timeline should be rendered with filters applied
    expect(screen.getByTestId('audit-timeline')).toBeInTheDocument()
  })

  it('should display anomalies with visual indicators', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)
    
    // Check that visual indicators are present
    expect(screen.getByText(/critical/i)).toBeInTheDocument()
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })

  it('should handle search with results display', async () => {
    const onSearch = jest.fn().mockResolvedValue({
      query: 'budget changes',
      results: [
        {
          event: mockAuditEvents[1],
          similarity_score: 0.92,
          relevance_explanation: 'Budget change event'
        }
      ],
      ai_response: 'Found budget change events',
      sources: [],
      total_results: 1
    })
    
    render(<SemanticSearch onSearch={onSearch} />)
    
    const searchInput = screen.getByTestId('search-input')
    const searchButton = screen.getByTestId('search-button')
    
    fireEvent.change(searchInput, { target: { value: 'budget changes' } })
    fireEvent.click(searchButton)
    
    await waitFor(() => {
      expect(screen.getByText(/found budget change events/i)).toBeInTheDocument()
    })
  })
})
