/**
 * Utility functions for PMR chart data generation and transformation
 */

import { PMRChartDataPoint, PMRChartType } from './PMRChart'
import { AIInsight } from './types'

/**
 * Generate budget variance chart data
 */
export function generateBudgetVarianceData(
  budgetData: Array<{
    category: string
    planned: number
    actual: number
    forecast?: number
  }>,
  insights?: AIInsight[]
): PMRChartDataPoint[] {
  return budgetData.map((item) => {
    const variance = ((item.actual - item.planned) / item.planned) * 100
    const status = 
      Math.abs(variance) > 10 ? 'critical' :
      Math.abs(variance) > 5 ? 'at-risk' :
      'on-track'

    // Find relevant insights for this category
    const categoryInsights = insights?.filter(
      insight => 
        insight.category === 'budget' &&
        insight.supporting_data?.category === item.category
    ) || []

    return {
      name: item.category,
      value: item.actual,
      baseline: item.planned,
      forecast: item.forecast,
      variance,
      status,
      aiInsights: categoryInsights,
      metadata: {
        planned: item.planned,
        actual: item.actual,
        difference: item.actual - item.planned
      }
    }
  })
}

/**
 * Generate schedule performance chart data
 */
export function generateSchedulePerformanceData(
  scheduleData: Array<{
    period: string
    plannedProgress: number
    actualProgress: number
    spi?: number // Schedule Performance Index
  }>,
  insights?: AIInsight[]
): PMRChartDataPoint[] {
  return scheduleData.map((item) => {
    const spi = item.spi || (item.actualProgress / item.plannedProgress)
    const variance = ((item.actualProgress - item.plannedProgress) / item.plannedProgress) * 100
    const status = 
      spi < 0.8 ? 'critical' :
      spi < 0.95 ? 'at-risk' :
      'on-track'

    // Find relevant insights for this period
    const periodInsights = insights?.filter(
      insight => 
        insight.category === 'schedule' &&
        insight.supporting_data?.period === item.period
    ) || []

    return {
      name: item.period,
      value: spi,
      baseline: 1.0, // SPI baseline is 1.0
      variance,
      status,
      aiInsights: periodInsights,
      metadata: {
        plannedProgress: item.plannedProgress,
        actualProgress: item.actualProgress,
        spi
      }
    }
  })
}

/**
 * Generate risk heatmap chart data
 */
export function generateRiskHeatmapData(
  riskData: Array<{
    riskCategory: string
    probability: number // 0-100
    impact: number // 0-100
    mitigationStatus?: 'none' | 'planned' | 'in-progress' | 'completed'
  }>,
  insights?: AIInsight[]
): PMRChartDataPoint[] {
  return riskData.map((item) => {
    // Risk score = probability * impact / 100
    const riskScore = (item.probability * item.impact) / 100
    const status = 
      riskScore >= 80 ? 'critical' :
      riskScore >= 60 ? 'at-risk' :
      'on-track'

    // Find relevant insights for this risk category
    const riskInsights = insights?.filter(
      insight => 
        insight.category === 'risk' &&
        insight.supporting_data?.riskCategory === item.riskCategory
    ) || []

    return {
      name: item.riskCategory,
      value: riskScore,
      status,
      aiInsights: riskInsights,
      metadata: {
        probability: item.probability,
        impact: item.impact,
        mitigationStatus: item.mitigationStatus,
        riskScore
      }
    }
  })
}

/**
 * Generate resource utilization chart data
 */
export function generateResourceUtilizationData(
  resourceData: Array<{
    resourceName: string
    allocated: number
    utilized: number
    capacity: number
  }>,
  insights?: AIInsight[]
): PMRChartDataPoint[] {
  return resourceData.map((item) => {
    const utilizationRate = (item.utilized / item.capacity) * 100
    const variance = ((item.utilized - item.allocated) / item.allocated) * 100
    const status = 
      utilizationRate > 95 ? 'critical' :
      utilizationRate > 85 ? 'at-risk' :
      'on-track'

    // Find relevant insights for this resource
    const resourceInsights = insights?.filter(
      insight => 
        insight.category === 'resource' &&
        insight.supporting_data?.resourceName === item.resourceName
    ) || []

    return {
      name: item.resourceName,
      value: utilizationRate,
      baseline: (item.allocated / item.capacity) * 100,
      variance,
      status,
      aiInsights: resourceInsights,
      metadata: {
        allocated: item.allocated,
        utilized: item.utilized,
        capacity: item.capacity,
        utilizationRate
      }
    }
  })
}

/**
 * Generate cost performance chart data
 */
export function generateCostPerformanceData(
  costData: Array<{
    period: string
    budgetedCost: number
    actualCost: number
    earnedValue: number
  }>,
  insights?: AIInsight[]
): PMRChartDataPoint[] {
  return costData.map((item) => {
    // CPI = Earned Value / Actual Cost
    const cpi = item.earnedValue / item.actualCost
    const variance = ((item.actualCost - item.budgetedCost) / item.budgetedCost) * 100
    const status = 
      cpi < 0.8 ? 'critical' :
      cpi < 0.95 ? 'at-risk' :
      'on-track'

    // Find relevant insights for this period
    const periodInsights = insights?.filter(
      insight => 
        insight.category === 'budget' &&
        insight.supporting_data?.period === item.period
    ) || []

    return {
      name: item.period,
      value: cpi,
      baseline: 1.0, // CPI baseline is 1.0
      variance,
      status,
      aiInsights: periodInsights,
      metadata: {
        budgetedCost: item.budgetedCost,
        actualCost: item.actualCost,
        earnedValue: item.earnedValue,
        cpi
      }
    }
  })
}

/**
 * Export chart data to various formats
 */
export function exportChartData(
  chartType: PMRChartType,
  data: PMRChartDataPoint[],
  format: 'json' | 'csv'
): string {
  if (format === 'json') {
    return JSON.stringify({
      chartType,
      generatedAt: new Date().toISOString(),
      data
    }, null, 2)
  }

  // CSV format
  const headers = ['Name', 'Value', 'Baseline', 'Variance', 'Status', 'AI Insights Count']
  const rows = data.map(point => [
    point.name,
    point.value.toFixed(2),
    point.baseline?.toFixed(2) || 'N/A',
    point.variance?.toFixed(2) || 'N/A',
    point.status || 'N/A',
    point.aiInsights?.length || 0
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
}

/**
 * Calculate trend from historical data
 */
export function calculateTrend(
  data: PMRChartDataPoint[]
): 'improving' | 'stable' | 'declining' {
  if (data.length < 2) return 'stable'

  const recentValues = data.slice(-3).map(d => d.value)
  const avgRecent = recentValues.reduce((a, b) => a + b, 0) / recentValues.length

  const olderValues = data.slice(0, -3).map(d => d.value)
  if (olderValues.length === 0) return 'stable'
  
  const avgOlder = olderValues.reduce((a, b) => a + b, 0) / olderValues.length

  const change = ((avgRecent - avgOlder) / avgOlder) * 100

  if (change > 5) return 'improving'
  if (change < -5) return 'declining'
  return 'stable'
}

/**
 * Get chart color scheme based on type
 */
export function getChartColorScheme(chartType: PMRChartType): string[] {
  switch (chartType) {
    case 'budget-variance':
      return ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'] // Green to Red
    case 'schedule-performance':
      return ['#3B82F6', '#10B981', '#8B5CF6'] // Blue, Green, Purple
    case 'risk-heatmap':
      return ['#10B981', '#FBBF24', '#F59E0B', '#EF4444'] // Green to Red
    case 'resource-utilization':
      return ['#8B5CF6', '#06B6D4', '#3B82F6'] // Purple, Cyan, Blue
    case 'cost-performance':
      return ['#3B82F6', '#10B981', '#F59E0B'] // Blue, Green, Orange
    default:
      return ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']
  }
}

/**
 * Format chart data for export to PMR report
 */
export function formatForPMRReport(
  chartType: PMRChartType,
  data: PMRChartDataPoint[]
): {
  summary: string
  keyMetrics: Record<string, any>
  insights: AIInsight[]
  recommendations: string[]
} {
  const allInsights = data.flatMap(d => d.aiInsights || [])
  const criticalPoints = data.filter(d => d.status === 'critical')
  const atRiskPoints = data.filter(d => d.status === 'at-risk')

  const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length
  const trend = calculateTrend(data)

  let summary = ''
  const keyMetrics: Record<string, any> = {}
  const recommendations: string[] = []

  switch (chartType) {
    case 'budget-variance':
      summary = `Budget analysis shows ${criticalPoints.length} critical variance${criticalPoints.length !== 1 ? 's' : ''} and ${atRiskPoints.length} at-risk area${atRiskPoints.length !== 1 ? 's' : ''}. Overall trend is ${trend}.`
      keyMetrics.averageVariance = avgValue.toFixed(2) + '%'
      keyMetrics.criticalAreas = criticalPoints.length
      keyMetrics.trend = trend
      if (criticalPoints.length > 0) {
        recommendations.push('Review budget allocation for critical variance areas')
      }
      break

    case 'schedule-performance':
      summary = `Schedule performance index averaging ${avgValue.toFixed(2)}. ${criticalPoints.length} critical delay${criticalPoints.length !== 1 ? 's' : ''} identified.`
      keyMetrics.averageSPI = avgValue.toFixed(2)
      keyMetrics.delayedTasks = criticalPoints.length
      keyMetrics.trend = trend
      if (avgValue < 1.0) {
        recommendations.push('Implement schedule recovery plan')
      }
      break

    case 'risk-heatmap':
      summary = `Risk assessment identifies ${criticalPoints.length} critical risk${criticalPoints.length !== 1 ? 's' : ''} requiring immediate attention.`
      keyMetrics.averageRiskScore = avgValue.toFixed(2)
      keyMetrics.criticalRisks = criticalPoints.length
      keyMetrics.highRisks = atRiskPoints.length
      if (criticalPoints.length > 0) {
        recommendations.push('Develop mitigation strategies for critical risks')
      }
      break

    case 'resource-utilization':
      summary = `Resource utilization averaging ${avgValue.toFixed(2)}%. ${criticalPoints.length} resource${criticalPoints.length !== 1 ? 's' : ''} over-allocated.`
      keyMetrics.averageUtilization = avgValue.toFixed(2) + '%'
      keyMetrics.overAllocated = criticalPoints.length
      keyMetrics.trend = trend
      if (criticalPoints.length > 0) {
        recommendations.push('Rebalance resource allocation')
      }
      break

    case 'cost-performance':
      summary = `Cost performance index averaging ${avgValue.toFixed(2)}. ${criticalPoints.length} period${criticalPoints.length !== 1 ? 's' : ''} with significant cost overruns.`
      keyMetrics.averageCPI = avgValue.toFixed(2)
      keyMetrics.overrunPeriods = criticalPoints.length
      keyMetrics.trend = trend
      if (avgValue < 1.0) {
        recommendations.push('Implement cost control measures')
      }
      break
  }

  return {
    summary,
    keyMetrics,
    insights: allInsights,
    recommendations
  }
}
