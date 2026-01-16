'use client'

import React, { useState } from 'react'
import PMRChart, { PMRChartDataPoint } from './PMRChart'
import { AIInsight } from './types'
import {
  generateBudgetVarianceData,
  generateSchedulePerformanceData,
  generateRiskHeatmapData,
  generateResourceUtilizationData,
  generateCostPerformanceData,
  formatForPMRReport
} from './pmr-chart-utils'

/**
 * Example component demonstrating PMR Chart usage
 */
const PMRChartExample: React.FC = () => {
  const [selectedChart, setSelectedChart] = useState<'budget' | 'schedule' | 'risk' | 'resource' | 'cost'>('budget')

  // Sample AI Insights
  const sampleInsights: AIInsight[] = [
    {
      id: '1',
      type: 'alert',
      category: 'budget',
      title: 'Budget Overrun Alert',
      content: 'Labor costs are trending 12% over budget. Recommend reviewing resource allocation.',
      confidence_score: 0.89,
      supporting_data: { category: 'Labor' },
      recommended_actions: [
        'Review current resource assignments',
        'Consider hiring freeze for non-critical positions',
        'Negotiate better rates with contractors'
      ],
      priority: 'high',
      generated_at: new Date().toISOString(),
      validated: false
    },
    {
      id: '2',
      type: 'prediction',
      category: 'schedule',
      title: 'Schedule Delay Prediction',
      content: 'Based on current velocity, Q2 deliverables are at risk of 2-week delay.',
      confidence_score: 0.85,
      supporting_data: { period: 'Q2 2024' },
      predicted_impact: 'Potential 2-week delay in project completion',
      recommended_actions: [
        'Add additional resources to critical path',
        'Review and optimize task dependencies',
        'Consider scope reduction for non-critical features'
      ],
      priority: 'critical',
      generated_at: new Date().toISOString(),
      validated: true
    },
    {
      id: '3',
      type: 'alert',
      category: 'risk',
      title: 'Technical Risk Escalation',
      content: 'Integration complexity risk has increased from medium to high.',
      confidence_score: 0.92,
      supporting_data: { riskCategory: 'Technical' },
      recommended_actions: [
        'Conduct technical spike to assess integration complexity',
        'Allocate senior engineers to integration tasks',
        'Create detailed integration test plan'
      ],
      priority: 'high',
      generated_at: new Date().toISOString(),
      validated: false
    }
  ]

  // Budget Variance Data
  const budgetData = generateBudgetVarianceData(
    [
      { category: 'Labor', planned: 500000, actual: 560000, forecast: 580000 },
      { category: 'Materials', planned: 200000, actual: 195000, forecast: 198000 },
      { category: 'Equipment', planned: 150000, actual: 148000, forecast: 150000 },
      { category: 'Subcontractors', planned: 300000, actual: 285000, forecast: 290000 },
      { category: 'Overhead', planned: 100000, actual: 105000, forecast: 108000 }
    ],
    sampleInsights
  )

  // Schedule Performance Data
  const scheduleData = generateSchedulePerformanceData(
    [
      { period: 'Q1 2024', plannedProgress: 25, actualProgress: 23, spi: 0.92 },
      { period: 'Q2 2024', plannedProgress: 50, actualProgress: 45, spi: 0.90 },
      { period: 'Q3 2024', plannedProgress: 75, actualProgress: 68, spi: 0.91 },
      { period: 'Q4 2024', plannedProgress: 100, actualProgress: 88, spi: 0.88 }
    ],
    sampleInsights
  )

  // Risk Heatmap Data
  const riskData = generateRiskHeatmapData(
    [
      { riskCategory: 'Technical', probability: 70, impact: 85, mitigationStatus: 'in-progress' },
      { riskCategory: 'Schedule', probability: 60, impact: 75, mitigationStatus: 'planned' },
      { riskCategory: 'Budget', probability: 50, impact: 80, mitigationStatus: 'in-progress' },
      { riskCategory: 'Resource', probability: 40, impact: 60, mitigationStatus: 'completed' },
      { riskCategory: 'Quality', probability: 30, impact: 70, mitigationStatus: 'none' }
    ],
    sampleInsights
  )

  // Resource Utilization Data
  const resourceData = generateResourceUtilizationData(
    [
      { resourceName: 'Senior Engineers', allocated: 80, utilized: 92, capacity: 100 },
      { resourceName: 'Junior Engineers', allocated: 70, utilized: 68, capacity: 100 },
      { resourceName: 'Project Managers', allocated: 60, utilized: 75, capacity: 80 },
      { resourceName: 'QA Engineers', allocated: 50, utilized: 48, capacity: 60 },
      { resourceName: 'DevOps', allocated: 40, utilized: 55, capacity: 60 }
    ],
    sampleInsights
  )

  // Cost Performance Data
  const costData = generateCostPerformanceData(
    [
      { period: 'Jan 2024', budgetedCost: 100000, actualCost: 105000, earnedValue: 98000 },
      { period: 'Feb 2024', budgetedCost: 100000, actualCost: 102000, earnedValue: 95000 },
      { period: 'Mar 2024', budgetedCost: 100000, actualCost: 98000, earnedValue: 97000 },
      { period: 'Apr 2024', budgetedCost: 100000, actualCost: 103000, earnedValue: 96000 }
    ],
    sampleInsights
  )

  const handleDataPointClick = (dataPoint: PMRChartDataPoint) => {
    console.log('Data point clicked:', dataPoint)
  }

  const handleExport = (format: 'png' | 'svg' | 'pdf' | 'json' | 'csv') => {
    console.log('Export requested:', format)
  }

  const renderChart = () => {
    switch (selectedChart) {
      case 'budget':
        return (
          <PMRChart
            type="budget-variance"
            data={budgetData}
            title="Budget Variance Analysis"
            showAIInsights={true}
            enableDrillDown={true}
            enableExport={true}
            onDataPointClick={handleDataPointClick}
            onExport={handleExport}
          />
        )
      case 'schedule':
        return (
          <PMRChart
            type="schedule-performance"
            data={scheduleData}
            title="Schedule Performance Index"
            showAIInsights={true}
            enableDrillDown={true}
            enableExport={true}
            onDataPointClick={handleDataPointClick}
            onExport={handleExport}
          />
        )
      case 'risk':
        return (
          <PMRChart
            type="risk-heatmap"
            data={riskData}
            title="Risk Heatmap"
            showAIInsights={true}
            enableDrillDown={true}
            enableExport={true}
            onDataPointClick={handleDataPointClick}
            onExport={handleExport}
          />
        )
      case 'resource':
        return (
          <PMRChart
            type="resource-utilization"
            data={resourceData}
            title="Resource Utilization"
            showAIInsights={true}
            enableDrillDown={true}
            enableExport={true}
            onDataPointClick={handleDataPointClick}
            onExport={handleExport}
          />
        )
      case 'cost':
        return (
          <PMRChart
            type="cost-performance"
            data={costData}
            title="Cost Performance Index"
            showAIInsights={true}
            enableDrillDown={true}
            enableExport={true}
            onDataPointClick={handleDataPointClick}
            onExport={handleExport}
          />
        )
    }
  }

  const getCurrentData = () => {
    switch (selectedChart) {
      case 'budget': return budgetData
      case 'schedule': return scheduleData
      case 'risk': return riskData
      case 'resource': return resourceData
      case 'cost': return costData
    }
  }

  const getCurrentChartType = () => {
    switch (selectedChart) {
      case 'budget': return 'budget-variance'
      case 'schedule': return 'schedule-performance'
      case 'risk': return 'risk-heatmap'
      case 'resource': return 'resource-utilization'
      case 'cost': return 'cost-performance'
    }
  }

  const reportData = formatForPMRReport(getCurrentChartType(), getCurrentData())

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PMR Chart Examples</h1>
          <p className="text-gray-600">
            Interactive charts with AI insights for Project Monthly Reports
          </p>
        </div>

        {/* Chart Type Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChart('budget')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedChart === 'budget'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Budget Variance
            </button>
            <button
              onClick={() => setSelectedChart('schedule')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedChart === 'schedule'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Schedule Performance
            </button>
            <button
              onClick={() => setSelectedChart('risk')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedChart === 'risk'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Risk Heatmap
            </button>
            <button
              onClick={() => setSelectedChart('resource')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedChart === 'resource'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Resource Utilization
            </button>
            <button
              onClick={() => setSelectedChart('cost')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedChart === 'cost'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cost Performance
            </button>
          </div>
        </div>

        {/* Chart Display */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {renderChart()}
        </div>

        {/* Report Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Summary</h2>
          
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h3>
            <p className="text-gray-600">{reportData.summary}</p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Key Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(reportData.keyMetrics).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-lg font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {reportData.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1">
                {reportData.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-gray-600">{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PMRChartExample
