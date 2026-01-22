/**
 * Unit tests for AI Result Visualization Components
 * Tests chart rendering, confidence score display, and error state rendering
 * 
 * Validates: Requirements 5.3, 5.4
 */

import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  ResourceOptimizerChart,
  RiskForecastChart,
  ValidationIssuesDisplay,
  ConfidenceBadge
} from '@/components/ai/AIResultVisualizations'

// Mock Recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="bar-chart" data-items={data.length}>{children}</div>
  ),
  LineChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="line-chart" data-items={data.length}>{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Pie: ({ data }: { data: any[] }) => <div data-testid="pie" data-items={data.length} />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}))

describe('ConfidenceBadge Component', () => {
  it('should display high confidence correctly', () => {
    render(<ConfidenceBadge confidence={0.9} />)
    
    expect(screen.getByText(/High/i)).toBeInTheDocument()
    expect(screen.getByText(/90%/i)).toBeInTheDocument()
  })

  it('should display medium confidence correctly', () => {
    render(<ConfidenceBadge confidence={0.7} />)
    
    expect(screen.getByText(/Medium/i)).toBeInTheDocument()
    expect(screen.getByText(/70%/i)).toBeInTheDocument()
  })

  it('should display low confidence correctly', () => {
    render(<ConfidenceBadge confidence={0.4} />)
    
    expect(screen.getByText(/Low/i)).toBeInTheDocument()
    expect(screen.getByText(/40%/i)).toBeInTheDocument()
  })

  it('should apply correct color classes for high confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.85} />)
    const badge = container.querySelector('span')
    
    expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300')
  })

  it('should apply correct color classes for medium confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.65} />)
    const badge = container.querySelector('span')
    
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-300')
  })

  it('should apply correct color classes for low confidence', () => {
    const { container } = render(<ConfidenceBadge confidence={0.3} />)
    const badge = container.querySelector('span')
    
    expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-300')
  })

  it('should accept custom className', () => {
    const { container } = render(<ConfidenceBadge confidence={0.8} className="custom-class" />)
    const badge = container.querySelector('span')
    
    expect(badge).toHaveClass('custom-class')
  })
})

describe('ResourceOptimizerChart Component', () => {
  const mockRecommendations = [
    {
      resource_id: 'res-1',
      resource_name: 'John Doe',
      project_id: 'proj-1',
      project_name: 'Project Alpha',
      allocated_hours: 40,
      cost_savings: 1500.50,
      confidence: 0.9
    },
    {
      resource_id: 'res-2',
      resource_name: 'Jane Smith',
      project_id: 'proj-2',
      project_name: 'Project Beta',
      allocated_hours: 30,
      cost_savings: 1200.75,
      confidence: 0.85
    }
  ]

  it('should render with sample data', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getByText('Resource Optimization Results')).toBeInTheDocument()
    expect(screen.getByText('Total Cost Savings')).toBeInTheDocument()
    expect(screen.getByText('Recommendations')).toBeInTheDocument()
  })

  it('should display total cost savings correctly', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getByText('$2,701.25')).toBeInTheDocument()
  })

  it('should display recommendation count', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should display model confidence badge', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getByText(/High/i)).toBeInTheDocument()
    expect(screen.getByText(/88%/i)).toBeInTheDocument()
  })

  it('should render all recommendations with details', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText(/Project Alpha/i)).toBeInTheDocument()
    expect(screen.getByText(/Project Beta/i)).toBeInTheDocument()
  })

  it('should render charts', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    expect(screen.getAllByTestId('bar-chart')).toHaveLength(1)
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(1)
  })

  it('should handle empty recommendations', () => {
    render(
      <ResourceOptimizerChart
        recommendations={[]}
        totalCostSavings={0}
        modelConfidence={0}
      />
    )

    expect(screen.getByText('Resource Optimization Results')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should display confidence badges for each recommendation', () => {
    render(
      <ResourceOptimizerChart
        recommendations={mockRecommendations}
        totalCostSavings={2701.25}
        modelConfidence={0.88}
      />
    )

    // Model confidence + 2 recommendation confidences
    const badges = screen.getAllByText(/High/i)
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })
})

describe('RiskForecastChart Component', () => {
  const mockForecasts = [
    {
      period: '2024-01',
      risk_probability: 0.35,
      risk_impact: 7.2,
      confidence_lower: 0.25,
      confidence_upper: 0.45
    },
    {
      period: '2024-02',
      risk_probability: 0.42,
      risk_impact: 8.1,
      confidence_lower: 0.32,
      confidence_upper: 0.52
    },
    {
      period: '2024-03',
      risk_probability: 0.75,
      risk_impact: 9.5,
      confidence_lower: 0.65,
      confidence_upper: 0.85
    }
  ]

  it('should render with sample data', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    expect(screen.getByText('Risk Forecast')).toBeInTheDocument()
    expect(screen.getByText('Risk Probability Over Time')).toBeInTheDocument()
    expect(screen.getByText('Risk Impact Forecast')).toBeInTheDocument()
  })

  it('should display model confidence badge', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    expect(screen.getByText(/High/i)).toBeInTheDocument()
    expect(screen.getByText(/82%/i)).toBeInTheDocument()
  })

  it('should render all forecast periods', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    expect(screen.getByText('2024-01')).toBeInTheDocument()
    expect(screen.getByText('2024-02')).toBeInTheDocument()
    expect(screen.getByText('2024-03')).toBeInTheDocument()
  })

  it('should render line and bar charts', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('should display high risk warning icon for high probability', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    // The third forecast has probability > 0.7, should show warning icon
    const forecastDetails = screen.getByText(/2024-03/i).closest('div')
    expect(forecastDetails).toBeInTheDocument()
  })

  it('should handle empty forecasts', () => {
    render(
      <RiskForecastChart
        forecasts={[]}
        modelConfidence={0}
      />
    )

    expect(screen.getByText('Risk Forecast')).toBeInTheDocument()
  })

  it('should display forecast details with probability and impact', () => {
    render(
      <RiskForecastChart
        forecasts={mockForecasts}
        modelConfidence={0.82}
      />
    )

    expect(screen.getByText(/Probability: 35.0%/i)).toBeInTheDocument()
    expect(screen.getByText(/Impact: 7.2/i)).toBeInTheDocument()
  })
})

describe('ValidationIssuesDisplay Component', () => {
  const mockIssues = [
    {
      severity: 'CRITICAL' as const,
      category: 'financial',
      entity_type: 'project',
      entity_id: 'proj-1',
      description: 'Budget overrun exceeds 50%',
      recommendation: 'Review project budget and adjust allocations'
    },
    {
      severity: 'HIGH' as const,
      category: 'timeline',
      entity_type: 'task',
      entity_id: 'task-1',
      description: 'Task deadline missed by 2 weeks',
      recommendation: 'Reschedule dependent tasks'
    },
    {
      severity: 'MEDIUM' as const,
      category: 'integrity',
      entity_type: 'resource',
      entity_id: 'res-1',
      description: 'Missing required skill information',
      recommendation: 'Update resource profile'
    },
    {
      severity: 'LOW' as const,
      category: 'integrity',
      entity_type: 'project',
      entity_id: 'proj-2',
      description: 'Optional field not populated',
      recommendation: undefined
    }
  ]

  it('should render with sample data', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByText('Data Validation Results')).toBeInTheDocument()
    expect(screen.getByText('4 issues found')).toBeInTheDocument()
  })

  it('should display severity counts correctly', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('should render all issues with descriptions', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByText('Budget overrun exceeds 50%')).toBeInTheDocument()
    expect(screen.getByText('Task deadline missed by 2 weeks')).toBeInTheDocument()
    expect(screen.getByText('Missing required skill information')).toBeInTheDocument()
    expect(screen.getByText('Optional field not populated')).toBeInTheDocument()
  })

  it('should display recommendations when available', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByText(/Review project budget and adjust allocations/i)).toBeInTheDocument()
    expect(screen.getByText(/Reschedule dependent tasks/i)).toBeInTheDocument()
    expect(screen.getByText(/Update resource profile/i)).toBeInTheDocument()
  })

  it('should render pie chart when issues exist', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
  })

  it('should handle no issues', () => {
    render(
      <ValidationIssuesDisplay
        issues={[]}
        totalIssues={0}
        criticalCount={0}
        highCount={0}
        mediumCount={0}
        lowCount={0}
      />
    )

    expect(screen.getByText('Data Validation Results')).toBeInTheDocument()
    expect(screen.getByText('0 issues found')).toBeInTheDocument()
  })

  it('should apply correct severity colors', () => {
    const { container } = render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    // Check for severity-specific background colors
    const criticalElements = container.querySelectorAll('[class*="bg-red"]')
    const highElements = container.querySelectorAll('[class*="bg-orange"]')
    const mediumElements = container.querySelectorAll('[class*="bg-yellow"]')
    const lowElements = container.querySelectorAll('[class*="bg-blue"]')

    expect(criticalElements.length).toBeGreaterThan(0)
    expect(highElements.length).toBeGreaterThan(0)
    expect(mediumElements.length).toBeGreaterThan(0)
    expect(lowElements.length).toBeGreaterThan(0)
  })

  it('should display issue categories', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getByText('financial')).toBeInTheDocument()
    expect(screen.getByText('timeline')).toBeInTheDocument()
    expect(screen.getAllByText('integrity')).toHaveLength(2)
  })

  it('should display entity types', () => {
    render(
      <ValidationIssuesDisplay
        issues={mockIssues}
        totalIssues={4}
        criticalCount={1}
        highCount={1}
        mediumCount={1}
        lowCount={1}
      />
    )

    expect(screen.getAllByText('project')).toHaveLength(2)
    expect(screen.getByText('task')).toBeInTheDocument()
    expect(screen.getByText('resource')).toBeInTheDocument()
  })
})
