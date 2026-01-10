/**
 * AI Resource Optimization Tests
 * Tests for ML-powered resource allocation analysis with confidence scores
 * Requirements: 6.1, 6.2, 6.3
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import AIResourceOptimizer from '../components/ai/AIResourceOptimizer'
import { AIResourceOptimizer as AIResourceOptimizerClass } from '../lib/ai/resource-optimizer'

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock the AI Resource Optimizer class
const mockAnalyzeResourceAllocation = jest.fn()
const mockSuggestTeamComposition = jest.fn()
const mockDetectConflicts = jest.fn()
const mockApplyOptimization = jest.fn()
const mockGetOptimizationMetrics = jest.fn()

jest.mock('../lib/ai-resource-optimizer', () => ({
  AIResourceOptimizer: jest.fn().mockImplementation(() => ({
    analyzeResourceAllocation: mockAnalyzeResourceAllocation,
    suggestTeamComposition: mockSuggestTeamComposition,
    detectConflicts: mockDetectConflicts,
    applyOptimization: mockApplyOptimization,
    getOptimizationMetrics: mockGetOptimizationMetrics
  })),
  createAIResourceOptimizer: jest.fn().mockImplementation(() => ({
    analyzeResourceAllocation: mockAnalyzeResourceAllocation,
    suggestTeamComposition: mockSuggestTeamComposition,
    detectConflicts: mockDetectConflicts,
    applyOptimization: mockApplyOptimization,
    getOptimizationMetrics: mockGetOptimizationMetrics
  }))
}))

const mockOptimizationAnalysis = {
  analysis_id: 'test_analysis_123',
  request_timestamp: '2024-01-10T10:00:00Z',
  analysis_duration_ms: 2500,
  
  suggestions: [
    {
      id: 'opt_123',
      type: 'resource_reallocation',
      resource_id: 'res_1',
      resource_name: 'John Doe',
      project_id: 'proj_1',
      project_name: 'Test Project',
      
      confidence_score: 0.85,
      impact_score: 0.7,
      effort_required: 'medium',
      
      current_allocation: 60,
      suggested_allocation: 80,
      skill_match_score: 0.9,
      utilization_improvement: 20,
      
      conflicts_detected: [],
      alternative_strategies: [
        {
          strategy_id: 'alt_1',
          name: 'Gradual Increase',
          description: 'Gradually increase allocation over 2 weeks',
          confidence_score: 0.8,
          implementation_complexity: 'simple',
          estimated_timeline: '2 weeks',
          resource_requirements: ['Project Manager'],
          expected_outcomes: ['Improved utilization']
        }
      ],
      
      reasoning: 'Resource has available capacity and excellent skill match',
      benefits: ['Increase utilization by 20%', 'Excellent skill match'],
      risks: ['Minimal risk with proper implementation'],
      implementation_steps: [
        'Review current allocation',
        'Communicate changes to stakeholders',
        'Update project assignments'
      ],
      
      analysis_timestamp: '2024-01-10T10:00:00Z',
      expires_at: '2024-01-11T10:00:00Z'
    }
  ],
  
  conflicts: [],
  
  total_resources_analyzed: 10,
  optimization_opportunities: 1,
  potential_utilization_improvement: 15.5,
  estimated_cost_savings: 5000,
  
  overall_confidence: 0.85,
  data_quality_score: 0.9,
  recommendation_reliability: 'high',
  
  recommended_actions: ['Prioritize 1 high-impact optimization'],
  follow_up_analysis_suggested: false
}

const mockMetrics = {
  period: '2024-01-03 to 2024-01-10',
  total_optimizations_applied: 5,
  average_utilization_improvement: 12.3,
  conflicts_resolved: 2,
  cost_savings_estimated: 15000,
  user_satisfaction_score: 0.87,
  performance_trends: [
    { date: '2024-01-03', utilization_avg: 75, conflicts_count: 3, optimizations_applied: 1 },
    { date: '2024-01-04', utilization_avg: 77, conflicts_count: 2, optimizations_applied: 1 }
  ],
  top_performing_optimizations: [
    { type: 'resource_reallocation', success_rate: 0.92, avg_improvement: 15.3, user_adoption_rate: 0.78 }
  ]
}

describe('AI Resource Optimizer Component', () => {
  let mockOptimizer: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    mockAnalyzeResourceAllocation.mockClear()
    mockSuggestTeamComposition.mockClear()
    mockDetectConflicts.mockClear()
    mockApplyOptimization.mockClear()
    mockGetOptimizationMetrics.mockClear()
    
    // Create mock optimizer instance
    mockOptimizer = {
      analyzeResourceAllocation: mockAnalyzeResourceAllocation,
      suggestTeamComposition: mockSuggestTeamComposition,
      detectConflicts: mockDetectConflicts,
      applyOptimization: mockApplyOptimization,
      getOptimizationMetrics: mockGetOptimizationMetrics
    }
  })

  test('renders empty state initially', () => {
    render(<AIResourceOptimizer />)
    
    expect(screen.getByText('AI Resource Optimization')).toBeInTheDocument()
    expect(screen.getByText('ML-powered resource allocation analysis')).toBeInTheDocument()
    expect(screen.getByText('Start Analysis')).toBeInTheDocument()
  })

  test('runs analysis and displays results - Requirement 6.1', async () => {
    mockAnalyzeResourceAllocation.mockResolvedValue(mockOptimizationAnalysis)
    
    render(<AIResourceOptimizer />)
    
    // Click run analysis
    fireEvent.click(screen.getByText('Start Analysis'))
    
    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Verify analysis results are displayed
    expect(screen.getByText('1')).toBeInTheDocument() // Opportunities count
    expect(screen.getByText('15.5%')).toBeInTheDocument() // Potential improvement
    expect(screen.getByText('$5,000')).toBeInTheDocument() // Cost savings
    expect(screen.getByText('85%')).toBeInTheDocument() // Confidence
    
    // Verify suggestion details
    expect(screen.getByText('Resource has available capacity and excellent skill match')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument() // Confidence score
    expect(screen.getByText('70%')).toBeInTheDocument() // Impact score
    expect(screen.getByText('medium')).toBeInTheDocument() // Effort required
  })

  test('displays confidence scores with proper color coding - Requirement 6.1', async () => {
    mockAnalyzeResourceAllocation.mockResolvedValue(mockOptimizationAnalysis)
    
    render(<AIResourceOptimizer />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Check confidence score display
    const confidenceElements = screen.getAllByText('85%')
    expect(confidenceElements.length).toBeGreaterThan(0)
    
    // Verify high confidence gets appropriate styling (would need to check CSS classes)
    const confidenceContainer = confidenceElements[0].closest('div')
    expect(confidenceContainer).toHaveClass('text-green-600', 'bg-green-50')
  })

  test('shows alternative strategies for conflicts - Requirement 6.2', async () => {
    const analysisWithConflicts = {
      ...mockOptimizationAnalysis,
      suggestions: [
        {
          ...mockOptimizationAnalysis.suggestions[0],
          conflicts_detected: [
            {
              type: 'over_allocation',
              severity: 'medium',
              description: 'Resource allocation conflict detected',
              affected_projects: ['proj_1', 'proj_2'],
              resolution_priority: 2
            }
          ]
        }
      ]
    }
    
    mockAnalyzeResourceAllocation.mockResolvedValue(analysisWithConflicts)
    
    render(<AIResourceOptimizer />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Verify conflict is displayed
    expect(screen.getByText('1 Conflict(s)')).toBeInTheDocument()
    
    // Expand details to see alternative strategies
    fireEvent.click(screen.getByText('More'))
    
    await waitFor(() => {
      expect(screen.getByText('Alternative Strategies')).toBeInTheDocument()
      expect(screen.getByText('Gradual Increase')).toBeInTheDocument()
      expect(screen.getByText('Gradually increase allocation over 2 weeks')).toBeInTheDocument()
    })
  })

  test('applies optimization and tracks outcomes - Requirement 6.3', async () => {
    mockAnalyzeResourceAllocation.mockResolvedValue(mockOptimizationAnalysis)
    mockApplyOptimization.mockResolvedValue({
      application_id: 'app_123',
      status: 'applied',
      affected_resources: ['res_1'],
      notifications_sent: ['user_1', 'user_2'],
      tracking_metrics: {
        baseline_utilization: 60,
        target_utilization: 80,
        estimated_improvement: 20
      }
    })
    
    const mockOnOptimizationApplied = jest.fn()
    
    render(<AIResourceOptimizer onOptimizationApplied={mockOnOptimizationApplied} />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Apply the optimization
    fireEvent.click(screen.getByText('Apply'))
    
    await waitFor(() => {
      expect(mockApplyOptimization).toHaveBeenCalledWith('opt_123', {
        notify_stakeholders: true,
        implementation_notes: 'Applied AI optimization suggestion: Resource has available capacity and excellent skill match'
      })
    })
    
    // Verify callback is called
    expect(mockOnOptimizationApplied).toHaveBeenCalledWith('opt_123')
  })

  test('displays performance metrics when requested', async () => {
    mockGetOptimizationMetrics.mockResolvedValue(mockMetrics)
    
    render(<AIResourceOptimizer />)
    
    // Click metrics button
    fireEvent.click(screen.getByText('Metrics'))
    
    await waitFor(() => {
      expect(screen.getByText('Performance Metrics (7 days)')).toBeInTheDocument()
    })
    
    // Verify metrics are displayed
    expect(screen.getByText('5')).toBeInTheDocument() // Optimizations applied
    expect(screen.getByText('12.3%')).toBeInTheDocument() // Avg improvement
    expect(screen.getByText('2')).toBeInTheDocument() // Conflicts resolved
    expect(screen.getByText('87%')).toBeInTheDocument() // Satisfaction score
  })

  test('filters suggestions by confidence threshold', async () => {
    const analysisWithMultipleSuggestions = {
      ...mockOptimizationAnalysis,
      suggestions: [
        mockOptimizationAnalysis.suggestions[0], // 85% confidence
        {
          ...mockOptimizationAnalysis.suggestions[0],
          id: 'opt_124',
          resource_name: 'Jane Smith',
          confidence_score: 0.5 // 50% confidence
        }
      ]
    }
    
    mockAnalyzeResourceAllocation.mockResolvedValue(analysisWithMultipleSuggestions)
    
    render(<AIResourceOptimizer />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
    
    // Set confidence filter to 70%
    const confidenceSlider = screen.getByRole('slider')
    fireEvent.change(confidenceSlider, { target: { value: '0.7' } })
    
    // Only John Doe (85% confidence) should be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })

  test('handles analysis errors gracefully', async () => {
    mockAnalyzeResourceAllocation.mockRejectedValue(new Error('Analysis failed'))
    
    render(<AIResourceOptimizer />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText('Failed to analyze resource allocation: Analysis failed')).toBeInTheDocument()
    })
  })

  test('validates analysis performance requirements - Requirement 6.1', async () => {
    // Mock analysis that takes longer than 30 seconds
    const slowAnalysis = {
      ...mockOptimizationAnalysis,
      analysis_duration_ms: 35000 // 35 seconds
    }
    
    mockAnalyzeResourceAllocation.mockResolvedValue(slowAnalysis)
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    
    render(<AIResourceOptimizer />)
    
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Verify performance warning is logged
    expect(consoleSpy).toHaveBeenCalledWith('Analysis took 35000ms - exceeds 30 second requirement')
    
    consoleSpy.mockRestore()
  })

  test('auto-refreshes analysis every 5 minutes', async () => {
    jest.useFakeTimers()
    
    mockAnalyzeResourceAllocation.mockResolvedValue(mockOptimizationAnalysis)
    
    render(<AIResourceOptimizer />)
    
    // Initial analysis
    fireEvent.click(screen.getByText('Start Analysis'))
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    expect(mockAnalyzeResourceAllocation).toHaveBeenCalledTimes(1)
    
    // Fast-forward 5 minutes
    jest.advanceTimersByTime(5 * 60 * 1000)
    
    await waitFor(() => {
      expect(mockAnalyzeResourceAllocation).toHaveBeenCalledTimes(2)
    })
    
    jest.useRealTimers()
  })
})

describe('AI Resource Optimizer Library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  test('analyzes resource allocation with proper API call', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        ...mockOptimizationAnalysis,
        analysis_id: 'test_analysis_123' // Ensure consistent ID
      })
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
    
    const optimizer = new AIResourceOptimizerClass('test-token')
    
    const result = await optimizer.analyzeResourceAllocation({
      optimization_goals: {
        maximize_utilization: true,
        minimize_conflicts: true
      }
    })
    
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/resource-optimizer'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('maximize_utilization')
      })
    )
    
    expect(result.analysis_id).toBe('test_analysis_123')
    expect(result.suggestions).toHaveLength(1)
    expect(result.overall_confidence).toBe(0.85)
  })

  test('suggests team composition with skill matching', async () => {
    const mockTeamComposition = {
      recommended_team: [
        {
          resource_id: 'res_1',
          resource_name: 'John Doe',
          role: 'Developer',
          allocation_percentage: 80,
          skill_match_score: 0.9,
          availability_score: 0.8,
          cost_per_hour: 75
        }
      ],
      alternative_compositions: [],
      composition_confidence: 0.85,
      estimated_timeline: '8 weeks',
      total_cost_estimate: 24000,
      risk_factors: ['Tight timeline']
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTeamComposition)
    })
    
    const optimizer = new AIResourceOptimizerClass('test-token')
    
    const result = await optimizer.suggestTeamComposition({
      required_skills: ['React', 'TypeScript'],
      estimated_effort_hours: 320,
      timeline_weeks: 8,
      priority: 'high'
    })
    
    expect(result.recommended_team).toHaveLength(1)
    expect(result.recommended_team[0].skill_match_score).toBe(0.9)
    expect(result.composition_confidence).toBe(0.85)
  })

  test('detects and resolves conflicts', async () => {
    const mockConflicts = {
      conflicts: [
        {
          type: 'over_allocation',
          severity: 'high',
          description: 'Resource over-allocated by 20%',
          affected_projects: ['proj_1', 'proj_2'],
          resolution_priority: 1
        }
      ],
      resolution_strategies: [
        {
          strategy_id: 'strategy_1',
          name: 'Redistribute Workload',
          description: 'Move some tasks to other team members',
          confidence_score: 0.8,
          implementation_complexity: 'moderate',
          estimated_timeline: '1 week',
          resource_requirements: ['Project Manager'],
          expected_outcomes: ['Balanced allocation']
        }
      ],
      priority_matrix: [
        {
          conflict_id: 'conflict_0',
          urgency: 8,
          impact: 7,
          resolution_complexity: 5
        }
      ],
      automated_resolutions: []
    }
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockConflicts)
    })
    
    const optimizer = new AIResourceOptimizerClass('test-token')
    
    const result = await optimizer.detectConflicts()
    
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].severity).toBe('high')
    expect(result.resolution_strategies).toHaveLength(1)
    expect(result.priority_matrix[0].urgency).toBe(8)
  })

  test('handles API errors appropriately', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })
    
    const optimizer = new AIResourceOptimizerClass('test-token')
    
    await expect(optimizer.analyzeResourceAllocation()).rejects.toThrow(
      'Failed to analyze resource allocation: Analysis failed: 500 Internal Server Error'
    )
  })
})