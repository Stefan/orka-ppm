/**
 * E2E Tests for Anomaly Dashboard Component
 * 
 * Tests false positive marking and real-time notification display
 * Requirements: 1.8, 10.7
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import AnomalyDashboard, { AnomalyDetection } from '../../components/audit/AnomalyDashboard'

// Mock WebSocket for real-time testing
class MockWebSocket {
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  onclose: (() => void) | null = null

  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      if (this.onopen) this.onopen()
    }, 100)
  }

  send(data: string) {
    // Mock send
  }

  close() {
    if (this.onclose) this.onclose()
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) })
    }
  }
}

// Replace global WebSocket with mock
let mockWs: MockWebSocket | null = null
const originalWebSocket = global.WebSocket
beforeAll(() => {
  ;(global as any).WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url)
      mockWs = this
    }
  }
})

afterAll(() => {
  global.WebSocket = originalWebSocket
})

// Test data
const mockAnomalies: AnomalyDetection[] = [
  {
    id: 'anomaly-1',
    audit_event_id: 'event-1',
    audit_event: {
      id: 'event-1',
      event_type: 'budget_change',
      user_name: 'Jane Smith',
      entity_type: 'project',
      entity_id: 'project-456',
      action_details: { old_budget: 100000, new_budget: 150000, change_percent: 50 },
      severity: 'critical',
      timestamp: new Date('2024-01-15T11:00:00Z').toISOString(),
      anomaly_score: 0.85,
      is_anomaly: true,
      category: 'Financial Impact',
      risk_level: 'Critical',
      tags: { 'budget_impact': 'high' },
      ai_insights: { 
        explanation: 'Unusual budget increase detected',
        impact: 'High financial impact requiring immediate review'
      },
      tenant_id: 'tenant-1'
    },
    anomaly_score: 0.85,
    detection_timestamp: new Date('2024-01-15T11:05:00Z').toISOString(),
    features_used: {
      budget_change_percent: 50,
      time_of_day: 11,
      user_activity_score: 0.3
    },
    model_version: 'v1.2.0',
    is_false_positive: false,
    alert_sent: true,
    tenant_id: 'tenant-1'
  },
  {
    id: 'anomaly-2',
    audit_event_id: 'event-2',
    audit_event: {
      id: 'event-2',
      event_type: 'permission_change',
      user_name: 'Bob Johnson',
      entity_type: 'user',
      entity_id: 'user-789',
      action_details: { permission: 'admin', action: 'granted' },
      severity: 'error',
      timestamp: new Date('2024-01-15T12:00:00Z').toISOString(),
      anomaly_score: 0.75,
      is_anomaly: true,
      category: 'Security Change',
      risk_level: 'High',
      tags: { 'security_risk': 'elevated' },
      tenant_id: 'tenant-1'
    },
    anomaly_score: 0.75,
    detection_timestamp: new Date('2024-01-15T12:05:00Z').toISOString(),
    features_used: {
      permission_level: 'admin',
      user_role: 'standard',
      time_since_last_change: 30
    },
    model_version: 'v1.2.0',
    is_false_positive: false,
    alert_sent: true,
    tenant_id: 'tenant-1'
  }
]

describe('AnomalyDashboard - Feedback Functionality', () => {
  test('should display anomalies with correct information', () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)

    // Check that anomalies are displayed
    expect(screen.getByTestId('anomaly-dashboard')).toBeInTheDocument()
    expect(screen.getByText('budget_change')).toBeInTheDocument()
    expect(screen.getByText('permission_change')).toBeInTheDocument()

    // Check anomaly scores
    expect(screen.getByText('85.0% Anomaly')).toBeInTheDocument()
    expect(screen.getByText('75.0% Anomaly')).toBeInTheDocument()
  })

  test('should open feedback form when "Mark as False Positive" is clicked', async () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)

    // Find and click the "Mark as False Positive" button for the first anomaly
    const feedbackButtons = screen.getAllByText('Mark as False Positive')
    fireEvent.click(feedbackButtons[0])

    // Check that feedback form appears
    await waitFor(() => {
      expect(screen.getByText('Feedback Form')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Explain why this is a false positive...')).toBeInTheDocument()
    })
  })

  test('should submit feedback with notes', async () => {
    const mockOnFeedback = jest.fn().mockResolvedValue(undefined)
    render(<AnomalyDashboard anomalies={mockAnomalies} onFeedback={mockOnFeedback} />)

    // Open feedback form
    const feedbackButtons = screen.getAllByText('Mark as False Positive')
    fireEvent.click(feedbackButtons[0])

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Explain why this is a false positive...')).toBeInTheDocument()
    })

    // Enter feedback notes
    const notesInput = screen.getByPlaceholderText('Explain why this is a false positive...')
    fireEvent.change(notesInput, { 
      target: { value: 'This budget change was pre-approved by management' } 
    })

    // Submit feedback
    const submitButton = screen.getByText('Submit Feedback')
    fireEvent.click(submitButton)

    // Verify feedback was submitted with correct parameters
    await waitFor(() => {
      expect(mockOnFeedback).toHaveBeenCalledWith(
        'anomaly-1',
        true,
        'This budget change was pre-approved by management'
      )
    })
  })

  test('should submit feedback without notes', async () => {
    const mockOnFeedback = jest.fn().mockResolvedValue(undefined)
    render(<AnomalyDashboard anomalies={mockAnomalies} onFeedback={mockOnFeedback} />)

    // Open feedback form
    const feedbackButtons = screen.getAllByText('Mark as False Positive')
    fireEvent.click(feedbackButtons[0])

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByText('Submit Feedback')).toBeInTheDocument()
    })

    // Submit without entering notes
    const submitButton = screen.getByText('Submit Feedback')
    fireEvent.click(submitButton)

    // Verify feedback was submitted
    await waitFor(() => {
      expect(mockOnFeedback).toHaveBeenCalledWith('anomaly-1', true, '')
    })
  })

  test('should close feedback form when cancel is clicked', async () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)

    // Open feedback form
    const feedbackButtons = screen.getAllByText('Mark as False Positive')
    fireEvent.click(feedbackButtons[0])

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Explain why this is a false positive...')).toBeInTheDocument()
    })

    // Click cancel
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    // Verify form is closed
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Explain why this is a false positive...')).not.toBeInTheDocument()
    })
  })

  test('should disable form during submission', async () => {
    const mockOnFeedback = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
    render(<AnomalyDashboard anomalies={mockAnomalies} onFeedback={mockOnFeedback} />)

    // Open feedback form
    const feedbackButtons = screen.getAllByText('Mark as False Positive')
    fireEvent.click(feedbackButtons[0])

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByText('Submit Feedback')).toBeInTheDocument()
    })

    // Submit feedback
    const submitButton = screen.getByText('Submit Feedback')
    fireEvent.click(submitButton)

    // Check that button shows loading state
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument()
    })

    // Check that form elements are disabled
    const notesInput = screen.getByPlaceholderText('Explain why this is a false positive...')
    expect(notesInput).toBeDisabled()
  })

  test('should expand and collapse anomaly details', async () => {
    render(<AnomalyDashboard anomalies={mockAnomalies} />)

    // Find expand button for first anomaly
    const expandButtons = screen.getAllByLabelText('Expand')
    fireEvent.click(expandButtons[0])

    // Check that details are shown
    await waitFor(() => {
      expect(screen.getByText('Affected Entity')).toBeInTheDocument()
      expect(screen.getByText('Detection Metadata')).toBeInTheDocument()
      expect(screen.getByText('Suggested Actions')).toBeInTheDocument()
    })

    // Collapse
    const collapseButton = screen.getByLabelText('Collapse')
    fireEvent.click(collapseButton)

    // Check that details are hidden
    await waitFor(() => {
      expect(screen.queryByText('Affected Entity')).not.toBeInTheDocument()
    })
  })
})

describe('AnomalyDashboard - Real-time Notifications', () => {
  beforeEach(() => {
    mockWs = null
  })

  test('should establish WebSocket connection when enabled', async () => {
    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
      />
    )

    // Wait for WebSocket to connect
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
      expect(mockWs?.url).toBe('ws://localhost:8000/ws/anomalies')
    })

    // Check connection status indicator
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument()
    })
  })

  test('should display toast notification for critical anomaly', async () => {
    const mockOnNewAnomaly = jest.fn()
    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
        onNewAnomaly={mockOnNewAnomaly}
      />
    )

    // Wait for WebSocket to connect
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
    }, { timeout: 3000 })

    // Simulate receiving a critical anomaly notification
    const criticalAnomaly: AnomalyDetection = {
      id: 'anomaly-new',
      audit_event_id: 'event-new',
      audit_event: {
        id: 'event-new',
        event_type: 'security_breach',
        user_name: 'Unknown',
        entity_type: 'system',
        entity_id: 'system-1',
        action_details: { threat_level: 'critical' },
        severity: 'critical',
        timestamp: new Date().toISOString(),
        anomaly_score: 0.95,
        is_anomaly: true,
        category: 'Security Change',
        risk_level: 'Critical',
        tenant_id: 'tenant-1'
      },
      anomaly_score: 0.95,
      detection_timestamp: new Date().toISOString(),
      features_used: {},
      model_version: 'v1.2.0',
      is_false_positive: false,
      alert_sent: true,
      tenant_id: 'tenant-1'
    }

    await act(async () => {
      mockWs?.simulateMessage({
        type: 'anomaly_detected',
        anomaly: criticalAnomaly
      })
      // Give React time to process the state update
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Check that toast notification appears
    await waitFor(() => {
      expect(screen.getByText('Critical Anomaly Detected')).toBeInTheDocument()
    }, { timeout: 3000 })
    
    expect(screen.getByText('security_breach')).toBeInTheDocument()
    expect(screen.getByText(/95\.0%/)).toBeInTheDocument()

    // Verify callback was called
    expect(mockOnNewAnomaly).toHaveBeenCalledWith(criticalAnomaly)
  })

  test('should dismiss toast notification when X is clicked', async () => {
    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
      />
    )

    // Wait for WebSocket to connect
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
    }, { timeout: 3000 })

    // Simulate receiving a critical anomaly
    await act(async () => {
      mockWs?.simulateMessage({
        type: 'anomaly_detected',
        anomaly: {
          ...mockAnomalies[0],
          id: 'anomaly-toast',
          audit_event: {
            ...mockAnomalies[0].audit_event,
            risk_level: 'Critical'
          }
        }
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Critical Anomaly Detected')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Click dismiss button
    const dismissButton = screen.getByLabelText('Dismiss notification')
    fireEvent.click(dismissButton)

    // Verify notification is removed
    await waitFor(() => {
      expect(screen.queryByText('Critical Anomaly Detected')).not.toBeInTheDocument()
    })
  })

  test('should auto-dismiss toast notification after 10 seconds', async () => {
    jest.useFakeTimers()

    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
      />
    )

    // Wait for WebSocket to connect (use real timers for this)
    jest.useRealTimers()
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
    }, { timeout: 3000 })
    jest.useFakeTimers()

    // Simulate receiving a critical anomaly
    await act(async () => {
      mockWs?.simulateMessage({
        type: 'anomaly_detected',
        anomaly: {
          ...mockAnomalies[0],
          id: 'anomaly-auto-dismiss',
          audit_event: {
            ...mockAnomalies[0].audit_event,
            risk_level: 'Critical'
          }
        }
      })
    })

    // Wait for notification to appear (use real timers briefly)
    jest.useRealTimers()
    await waitFor(() => {
      expect(screen.getByText('Critical Anomaly Detected')).toBeInTheDocument()
    }, { timeout: 3000 })
    jest.useFakeTimers()

    // Fast-forward 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000)
    })

    // Verify notification is removed
    jest.useRealTimers()
    await waitFor(() => {
      expect(screen.queryByText('Critical Anomaly Detected')).not.toBeInTheDocument()
    })
  })

  test('should not show toast for non-critical anomalies', async () => {
    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
      />
    )

    // Wait for WebSocket to connect
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
    }, { timeout: 3000 })

    // Simulate receiving a non-critical anomaly
    await act(async () => {
      mockWs?.simulateMessage({
        type: 'anomaly_detected',
        anomaly: {
          ...mockAnomalies[1],
          audit_event: {
            ...mockAnomalies[1].audit_event,
            risk_level: 'Medium'
          }
        }
      })
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    // Verify no toast notification appears
    expect(screen.queryByText('Critical Anomaly Detected')).not.toBeInTheDocument()
  })

  test('should show offline status when WebSocket disconnects', async () => {
    render(
      <AnomalyDashboard 
        anomalies={[]} 
        enableRealtime={true}
        websocketUrl="ws://localhost:8000/ws/anomalies"
      />
    )

    // Wait for WebSocket to connect
    await waitFor(() => {
      expect(mockWs).not.toBeNull()
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    // Simulate disconnection
    mockWs?.close()

    // Check offline status
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })
  })
})

describe('AnomalyDashboard - Display and Sorting', () => {
  test('should display stats correctly', () => {
    const anomaliesWithVariedScores: AnomalyDetection[] = [
      { ...mockAnomalies[0], anomaly_score: 0.95 }, // Critical
      { ...mockAnomalies[0], id: 'a2', anomaly_score: 0.85 }, // High
      { ...mockAnomalies[0], id: 'a3', anomaly_score: 0.75 }, // Medium
      { ...mockAnomalies[0], id: 'a4', anomaly_score: 0.72, is_false_positive: true } // False positive
    ]

    render(<AnomalyDashboard anomalies={anomaliesWithVariedScores} />)

    // Check that stats section exists
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('False Positives')).toBeInTheDocument()
    
    // Verify anomalies are displayed
    expect(screen.getByTestId('anomaly-dashboard')).toBeInTheDocument()
  })

  test('should sort anomalies by score and timestamp', () => {
    const unsortedAnomalies: AnomalyDetection[] = [
      { ...mockAnomalies[0], id: 'a1', anomaly_score: 0.75, detection_timestamp: '2024-01-15T10:00:00Z' },
      { ...mockAnomalies[0], id: 'a2', anomaly_score: 0.95, detection_timestamp: '2024-01-15T11:00:00Z' },
      { ...mockAnomalies[0], id: 'a3', anomaly_score: 0.85, detection_timestamp: '2024-01-15T12:00:00Z' }
    ]

    const { container } = render(<AnomalyDashboard anomalies={unsortedAnomalies} />)

    // Get all anomaly elements by their test IDs (excluding the dashboard itself)
    const allAnomalies = container.querySelectorAll('[data-testid^="anomaly-"]:not([data-testid="anomaly-dashboard"])')
    const positions = Array.from(allAnomalies).map(el => el.getAttribute('data-testid'))
    
    // Verify order: highest score first (a2), then a3, then a1
    expect(positions[0]).toBe('anomaly-a2')
    expect(positions[1]).toBe('anomaly-a3')
    expect(positions[2]).toBe('anomaly-a1')
  })

  test('should show empty state when no anomalies', () => {
    render(<AnomalyDashboard anomalies={[]} />)

    expect(screen.getByText('No Anomalies Detected')).toBeInTheDocument()
    expect(screen.getByText('All audit events appear normal')).toBeInTheDocument()
  })

  test('should show loading state', () => {
    render(<AnomalyDashboard anomalies={[]} loading={true} />)

    expect(screen.getByText('Loading anomalies...')).toBeInTheDocument()
  })
})
