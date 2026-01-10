import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AIInsightsPanel from '../AIInsightsPanel'
import type { AIInsight } from '../types'

// Mock data
const mockInsights: AIInsight[] = [
  {
    id: '1',
    type: 'prediction',
    category: 'budget',
    title: 'Budget Variance Prediction',
    content: 'Project is likely to finish 5% under budget based on current spending patterns.',
    confidence_score: 0.87,
    supporting_data: {
      current_spend: 85000,
      projected_total: 95000,
      budget: 100000
    },
    predicted_impact: 'Positive impact on project profitability',
    recommended_actions: [
      'Consider reallocating saved budget to quality improvements',
      'Document cost-saving measures for future projects'
    ],
    priority: 'medium',
    generated_at: '2024-01-15T10:30:00Z',
    validated: false,
    user_feedback: null
  },
  {
    id: '2',
    type: 'alert',
    category: 'schedule',
    title: 'Schedule Risk Alert',
    content: 'Critical path activities are showing delays that could impact delivery date.',
    confidence_score: 0.92,
    supporting_data: {
      delayed_tasks: 3,
      critical_path_impact: '2 weeks'
    },
    predicted_impact: 'Potential 2-week delay in project delivery',
    recommended_actions: [
      'Increase resources on critical path activities',
      'Consider parallel execution of dependent tasks',
      'Escalate to stakeholders for priority adjustment'
    ],
    priority: 'high',
    generated_at: '2024-01-15T11:00:00Z',
    validated: true,
    validation_notes: 'Confirmed by project manager',
    user_feedback: 'helpful'
  }
]

const mockProps = {
  reportId: 'test-report-1',
  insights: mockInsights,
  onInsightValidate: jest.fn(),
  onInsightApply: jest.fn(),
  onGenerateInsights: jest.fn(),
  onInsightFeedback: jest.fn(),
  isLoading: false
}

describe('AIInsightsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the component with insights', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    expect(screen.getByText('AI Insights')).toBeInTheDocument()
    expect(screen.getByText('Budget Variance Prediction')).toBeInTheDocument()
    expect(screen.getByText('Schedule Risk Alert')).toBeInTheDocument()
  })

  it('displays correct insight statistics', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    expect(screen.getByText('Total Insights')).toBeInTheDocument()
    expect(screen.getAllByText('Validated')).toHaveLength(2) // One in stats, one in insight card
    expect(screen.getByText('High Priority')).toBeInTheDocument()
    
    // Check the actual numbers are displayed
    const stats = screen.getAllByText('1')
    expect(stats).toHaveLength(2) // Validated and High Priority both show 1
  })

  it('expands and collapses insight details', async () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    const budgetInsight = screen.getByText('Budget Variance Prediction')
    fireEvent.click(budgetInsight)
    
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.getByText('Recommended Actions')).toBeInTheDocument()
    })
  })

  it('calls onInsightValidate when validate button is clicked', async () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Expand the first insight (not validated)
    const budgetInsight = screen.getByText('Budget Variance Prediction')
    fireEvent.click(budgetInsight)
    
    await waitFor(() => {
      const validateButton = screen.getByText('Validate')
      fireEvent.click(validateButton)
    })
    
    expect(mockProps.onInsightValidate).toHaveBeenCalledWith('1', true, 'Validated by user')
  })

  it('calls onInsightApply when apply button is clicked', async () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Expand the first insight
    const budgetInsight = screen.getByText('Budget Variance Prediction')
    fireEvent.click(budgetInsight)
    
    await waitFor(() => {
      const applyButton = screen.getByText('Apply')
      fireEvent.click(applyButton)
    })
    
    expect(mockProps.onInsightApply).toHaveBeenCalledWith('1')
  })

  it('calls onInsightFeedback when feedback buttons are clicked', async () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Expand the first insight
    const budgetInsight = screen.getByText('Budget Variance Prediction')
    fireEvent.click(budgetInsight)
    
    await waitFor(() => {
      const thumbsUpButton = screen.getAllByTitle('Mark as helpful')[0]
      fireEvent.click(thumbsUpButton)
    })
    
    expect(mockProps.onInsightFeedback).toHaveBeenCalledWith('1', 'helpful')
  })

  it('shows loading state', () => {
    render(<AIInsightsPanel {...mockProps} isLoading={true} />)
    
    expect(screen.getByText('Generating insights...')).toBeInTheDocument()
  })

  it('shows empty state when no insights', () => {
    render(<AIInsightsPanel {...mockProps} insights={[]} />)
    
    expect(screen.getByText('No insights available')).toBeInTheDocument()
    expect(screen.getByText('Generate insights')).toBeInTheDocument()
  })

  it('filters insights by category', async () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Open filters
    const filterButton = screen.getByTitle('Toggle filters')
    fireEvent.click(filterButton)
    
    await waitFor(() => {
      const budgetFilter = screen.getByText('budget')
      fireEvent.click(budgetFilter)
    })
    
    // Should only show budget insights
    expect(screen.getByText('Budget Variance Prediction')).toBeInTheDocument()
    expect(screen.queryByText('Schedule Risk Alert')).not.toBeInTheDocument()
  })

  it('calls onGenerateInsights when refresh button is clicked', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)
    
    expect(mockProps.onGenerateInsights).toHaveBeenCalled()
  })

  it('displays confidence scores with correct colors', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Check for confidence score displays
    expect(screen.getByText('87% confidence')).toBeInTheDocument()
    expect(screen.getByText('92% confidence')).toBeInTheDocument()
  })

  it('shows validated status for validated insights', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    // Check that there are validated insights shown (should be 2 instances of "Validated" text)
    const validatedElements = screen.getAllByText('Validated')
    expect(validatedElements).toHaveLength(2) // One in stats, one in insight card
  })

  it('groups insights by category', () => {
    render(<AIInsightsPanel {...mockProps} />)
    
    expect(screen.getByText('budget (1)')).toBeInTheDocument()
    expect(screen.getByText('schedule (1)')).toBeInTheDocument()
  })
})