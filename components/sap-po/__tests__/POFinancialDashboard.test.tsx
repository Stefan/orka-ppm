import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { POFinancialDashboard } from '../POFinancialDashboard'

// Mock fetch
global.fetch = jest.fn()

describe('POFinancialDashboard', () => {
  const mockFinancialSummary = {
    total_planned: 1000000,
    total_committed: 800000,
    total_actual: 750000,
    total_remaining: 250000,
    variance_amount: -250000,
    variance_percentage: -25,
    currency: 'USD',
    by_category: {
      'Construction': { planned: 500000, actual: 400000, variance: -100000 },
      'Equipment': { planned: 300000, actual: 250000, variance: -50000 },
      'Labor': { planned: 200000, actual: 100000, variance: -100000 }
    },
    by_status: {
      'on-track': 2,
      'at-risk': 1,
      'critical': 0
    }
  }

  const mockVarianceData = {
    planned_vs_actual: -25,
    planned_vs_committed: -20,
    committed_vs_actual: -6.25,
    variance_percentage: -25,
    variance_status: 'on_track' as const,
    trend_direction: 'improving' as const
  }

  const mockBudgetAlerts = [
    {
      id: 'alert-1',
      breakdown_id: 'breakdown-1',
      breakdown_name: 'Construction Phase 1',
      alert_type: 'budget_exceeded' as const,
      severity: 'high' as const,
      threshold_exceeded: 15,
      current_variance: 18.5,
      message: 'Budget exceeded by 18.5%',
      recommended_actions: [
        'Review cost allocation',
        'Consider budget reallocation'
      ],
      created_at: '2024-01-15T10:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        warning_threshold: 10,
        critical_threshold: 20,
        enable_notifications: true
      })
    })
  })

  it('renders financial summary cards', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={[]}
      />
    )

    expect(screen.getByText('Total Planned')).toBeInTheDocument()
    expect(screen.getByText('Total Actual')).toBeInTheDocument()
    expect(screen.getByText('Variance')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('displays financial amounts correctly', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={[]}
      />
    )

    expect(screen.getByText('USD 1,000,000')).toBeInTheDocument()
    expect(screen.getByText('USD 750,000')).toBeInTheDocument()
    expect(screen.getByText('-25.0%')).toBeInTheDocument()
  })

  it('shows budget alerts when present', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={mockBudgetAlerts}
      />
    )

    expect(screen.getByText('Budget Alerts')).toBeInTheDocument()
    expect(screen.getByText('Construction Phase 1')).toBeInTheDocument()
    expect(screen.getByText('Budget exceeded by 18.5%')).toBeInTheDocument()
  })

  it('displays variance status correctly', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={[]}
      />
    )

    expect(screen.getByText('on track')).toBeInTheDocument()
  })

  it('shows trend analysis section', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={[]}
      />
    )

    expect(screen.getByText('Trend Analysis')).toBeInTheDocument()
    expect(screen.getByText('Trend Direction')).toBeInTheDocument()
    expect(screen.getByText('improving')).toBeInTheDocument()
  })

  it('opens threshold configuration modal', async () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={mockBudgetAlerts}
      />
    )

    const configButton = screen.getByText('Configure Thresholds')
    fireEvent.click(configButton)

    await waitFor(() => {
      expect(screen.getByText('Configure Budget Alert Thresholds')).toBeInTheDocument()
    })

    expect(screen.getByText('Warning Threshold (%)')).toBeInTheDocument()
    expect(screen.getByText('Critical Threshold (%)')).toBeInTheDocument()
  })

  it('opens alert detail modal when alert is clicked', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={mockBudgetAlerts}
      />
    )

    const alertElement = screen.getByText('Construction Phase 1')
    fireEvent.click(alertElement)

    expect(screen.getByText('Alert Details')).toBeInTheDocument()
    expect(screen.getByText('Recommended Actions')).toBeInTheDocument()
  })

  it('calls onAlertDismiss when dismiss button is clicked', () => {
    const handleDismiss = jest.fn()
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={mockBudgetAlerts}
        onAlertDismiss={handleDismiss}
      />
    )

    // Open alert detail
    const alertElement = screen.getByText('Construction Phase 1')
    fireEvent.click(alertElement)

    // Click dismiss button
    const dismissButton = screen.getByText('Dismiss Alert')
    fireEvent.click(dismissButton)

    expect(handleDismiss).toHaveBeenCalledWith('alert-1')
  })

  it('displays variance charts', () => {
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={[]}
      />
    )

    expect(screen.getByText('Variance by Category')).toBeInTheDocument()
    expect(screen.getByText('Financial Overview')).toBeInTheDocument()
  })

  it('shows critical alert count badge', () => {
    const criticalAlerts = [
      ...mockBudgetAlerts,
      {
        ...mockBudgetAlerts[0],
        id: 'alert-2',
        severity: 'critical' as const
      }
    ]

    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={criticalAlerts}
      />
    )

    expect(screen.getByText('2 Critical')).toBeInTheDocument()
  })

  it('calls onThresholdUpdate when configuration is saved', async () => {
    const handleUpdate = jest.fn()
    render(
      <POFinancialDashboard
        projectId="test-project"
        financialSummary={mockFinancialSummary}
        varianceData={mockVarianceData}
        budgetAlerts={mockBudgetAlerts}
        onThresholdUpdate={handleUpdate}
      />
    )

    // Open configuration modal
    const configButton = screen.getByText('Configure Thresholds')
    fireEvent.click(configButton)

    await waitFor(() => {
      expect(screen.getByText('Configure Budget Alert Thresholds')).toBeInTheDocument()
    })

    // Click save
    const saveButton = screen.getByText('Save Configuration')
    fireEvent.click(saveButton)

    expect(handleUpdate).toHaveBeenCalled()
  })
})
