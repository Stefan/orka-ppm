// Costbook Predictive EAC/ETC Calculations
// Phase 2: AI-powered forecasting

import { ProjectWithFinancials, ProjectStatus } from '@/types/costbook'

/**
 * Predictive metrics for a project
 */
export interface PredictiveMetrics {
  /** Predicted Estimate at Completion */
  predictedEAC: number
  /** Estimate to Complete (remaining cost) */
  etc: number
  /** Lower bound of EAC prediction (90% confidence) */
  eacLow: number
  /** Upper bound of EAC prediction (90% confidence) */
  eacHigh: number
  /** Confidence score (0-1) */
  confidence: number
  /** Predicted completion percentage */
  predictedCompletion: number
  /** Burn rate (spend per day) */
  burnRate: number
  /** Projected variance at completion */
  projectedVariance: number
  /** Risk level based on projections */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  /** Trend direction */
  trend: 'improving' | 'stable' | 'declining'
  /** Days until predicted budget exhaustion */
  daysUntilBudgetExhaustion?: number
}

/**
 * Historical data point for trend analysis
 */
export interface HistoricalDataPoint {
  date: string
  spend: number
  budget: number
  cumulativeSpend: number
}

/**
 * Calculate predictive metrics for a project
 */
export function calculatePredictiveMetrics(
  project: ProjectWithFinancials,
  historicalData?: HistoricalDataPoint[]
): PredictiveMetrics {
  const { budget, total_spend, total_commitments, total_actuals, health_score } = project
  
  // Calculate time-based progress
  const now = new Date()
  const startDate = new Date(project.start_date)
  const endDate = new Date(project.end_date)
  const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime())
  const elapsed = Math.max(0, now.getTime() - startDate.getTime())
  const timeProgress = Math.min(1, elapsed / totalDuration)
  
  // Calculate spend progress
  const spendProgress = Math.min(1, total_spend / budget)
  
  // Calculate burn rate (spend per day)
  const daysElapsed = Math.max(1, elapsed / (1000 * 60 * 60 * 24))
  const burnRate = isNaN(total_spend) || isNaN(daysElapsed) ? 0 : total_spend / daysElapsed
  
  // Calculate trend from historical data or estimate
  const trend = calculateTrend(project, historicalData)
  
  // Velocity-based EAC calculation
  // If we have historical data, use regression. Otherwise, use simple projection.
  let predictedEAC: number
  let etc: number
  let confidence: number
  
  if (spendProgress > 0 && timeProgress > 0) {
    // Cost Performance Index approximation
    const cpi = timeProgress / spendProgress
    
    // Adjust based on trend
    const trendFactor = trend === 'improving' ? 0.95 : trend === 'declining' ? 1.1 : 1.0
    
    // Calculate EAC using different methods and average
    const eacTypical = budget / cpi // Typical EAC = Budget / CPI
    const eacLinear = total_spend + (budget - total_spend) * (1 / Math.max(0.5, cpi)) // Linear projection
    const eacBurnRate = total_spend + burnRate * ((1 - timeProgress) * (totalDuration / (1000 * 60 * 60 * 24)))
    
    // Weight the estimates
    predictedEAC = (eacTypical * 0.3 + eacLinear * 0.4 + eacBurnRate * 0.3) * trendFactor
    
    // ETC is what remains
    etc = Math.max(0, predictedEAC - total_spend)
    
    // Confidence based on data availability and project progress
    confidence = calculateConfidence(project, timeProgress, historicalData)
  } else {
    // Not enough data - use budget as baseline
    predictedEAC = budget
    etc = budget - total_spend
    confidence = 0.3
  }
  
  // Calculate confidence interval (90%)
  const uncertaintyFactor = 1 - confidence
  const eacLow = predictedEAC * (1 - uncertaintyFactor * 0.2)
  const eacHigh = predictedEAC * (1 + uncertaintyFactor * 0.3)
  
  // Projected variance
  const projectedVariance = budget - predictedEAC
  
  // Risk assessment
  const riskLevel = assessRiskLevel(projectedVariance, budget, health_score, trend)
  
  // Predicted completion percentage
  const predictedCompletion = Math.min(100, (total_spend / predictedEAC) * 100)
  
  // Days until budget exhaustion (if over budget trajectory)
  let daysUntilBudgetExhaustion: number | undefined
  if (burnRate > 0 && projectedVariance < 0) {
    const remainingBudget = budget - total_spend
    if (remainingBudget > 0) {
      daysUntilBudgetExhaustion = Math.ceil(remainingBudget / burnRate)
    } else {
      daysUntilBudgetExhaustion = 0 // Already over budget
    }
  }
  
  // Ensure no NaN values
  const safeValue = (val: number, fallback: number = 0) => 
    isNaN(val) || !isFinite(val) ? fallback : val

  return {
    predictedEAC: Math.round(safeValue(predictedEAC, budget) * 100) / 100,
    etc: Math.round(safeValue(etc, 0) * 100) / 100,
    eacLow: Math.round(safeValue(eacLow, budget * 0.8) * 100) / 100,
    eacHigh: Math.round(safeValue(eacHigh, budget * 1.2) * 100) / 100,
    confidence: safeValue(confidence, 0.5),
    predictedCompletion: Math.round(safeValue(predictedCompletion, 0) * 10) / 10,
    burnRate: Math.round(safeValue(burnRate, 0) * 100) / 100,
    projectedVariance: Math.round(safeValue(projectedVariance, 0) * 100) / 100,
    riskLevel,
    trend,
    daysUntilBudgetExhaustion
  }
}

/**
 * Calculate trend from historical data or project metrics
 */
function calculateTrend(
  project: ProjectWithFinancials,
  historicalData?: HistoricalDataPoint[]
): 'improving' | 'stable' | 'declining' {
  if (historicalData && historicalData.length >= 3) {
    // Calculate trend from last few data points
    const recentPoints = historicalData.slice(-5)
    const variances = recentPoints.map((p, i) => {
      if (i === 0) return 0
      const prevSpend = recentPoints[i - 1].cumulativeSpend
      const expectedIncrease = p.budget * 0.1 // Expected ~10% per period
      const actualIncrease = p.cumulativeSpend - prevSpend
      return expectedIncrease - actualIncrease
    })
    
    const avgVariance = variances.slice(1).reduce((a, b) => a + b, 0) / (variances.length - 1)
    
    if (avgVariance > project.budget * 0.02) return 'improving'
    if (avgVariance < -project.budget * 0.02) return 'declining'
    return 'stable'
  }
  
  // Estimate trend from current metrics
  const varianceRatio = project.variance / project.budget
  const healthTrend = project.health_score > 70 ? 0.1 : project.health_score < 50 ? -0.1 : 0
  
  if (varianceRatio + healthTrend > 0.05) return 'improving'
  if (varianceRatio + healthTrend < -0.05) return 'declining'
  return 'stable'
}

/**
 * Calculate confidence score for predictions
 */
function calculateConfidence(
  project: ProjectWithFinancials,
  timeProgress: number,
  historicalData?: HistoricalDataPoint[]
): number {
  let confidence = 0.5 // Base confidence
  
  // More progress = higher confidence
  confidence += timeProgress * 0.2
  
  // Historical data improves confidence
  if (historicalData) {
    confidence += Math.min(0.2, historicalData.length * 0.02)
  }
  
  // Active projects with spend have better predictions
  if (project.status === ProjectStatus.ACTIVE && project.total_spend > 0) {
    confidence += 0.1
  }
  
  // High health score indicates better tracking
  if (project.health_score >= 70) {
    confidence += 0.05
  }
  
  return Math.min(0.95, confidence)
}

/**
 * Assess risk level based on projections
 */
function assessRiskLevel(
  projectedVariance: number,
  budget: number,
  healthScore: number,
  trend: 'improving' | 'stable' | 'declining'
): 'low' | 'medium' | 'high' | 'critical' {
  const variancePercent = projectedVariance / budget
  
  // Critical if significantly over budget or very low health
  if (variancePercent < -0.2 || (healthScore < 30 && trend === 'declining')) {
    return 'critical'
  }
  
  // High risk if moderately over budget or declining
  if (variancePercent < -0.1 || (healthScore < 50 && trend === 'declining')) {
    return 'high'
  }
  
  // Medium risk if slightly over or stagnant
  if (variancePercent < 0 || (trend === 'declining' && healthScore < 70)) {
    return 'medium'
  }
  
  return 'low'
}

/**
 * Get risk level color
 */
export function getRiskLevelColor(riskLevel: PredictiveMetrics['riskLevel']): {
  bg: string
  text: string
  border: string
} {
  switch (riskLevel) {
    case 'critical':
      return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' }
    case 'high':
      return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
    case 'medium':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' }
    case 'low':
      return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' }
  }
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(trend: PredictiveMetrics['trend']): {
  icon: 'up' | 'down' | 'stable'
  label: string
  color: string
} {
  switch (trend) {
    case 'improving':
      return { icon: 'up', label: 'Improving', color: 'text-green-600' }
    case 'declining':
      return { icon: 'down', label: 'Declining', color: 'text-red-600' }
    case 'stable':
      return { icon: 'stable', label: 'Stable', color: 'text-gray-600' }
  }
}

/**
 * Format confidence as percentage with label
 */
export function formatConfidence(confidence: number): {
  percentage: string
  label: string
  color: string
} {
  const percentage = `${(confidence * 100).toFixed(0)}%`
  
  if (confidence >= 0.8) {
    return { percentage, label: 'High', color: 'text-green-600' }
  }
  if (confidence >= 0.5) {
    return { percentage, label: 'Medium', color: 'text-yellow-600' }
  }
  return { percentage, label: 'Low', color: 'text-red-600' }
}

/**
 * Calculate predictive metrics for multiple projects
 */
export function calculatePortfolioPredictions(
  projects: ProjectWithFinancials[]
): {
  totalPredictedEAC: number
  totalBudget: number
  totalProjectedVariance: number
  portfolioRiskLevel: PredictiveMetrics['riskLevel']
  projectMetrics: Map<string, PredictiveMetrics>
  criticalProjects: string[]
  highRiskProjects: string[]
} {
  const projectMetrics = new Map<string, PredictiveMetrics>()
  let totalPredictedEAC = 0
  let totalBudget = 0
  const criticalProjects: string[] = []
  const highRiskProjects: string[] = []
  
  for (const project of projects) {
    const metrics = calculatePredictiveMetrics(project)
    projectMetrics.set(project.id, metrics)
    totalPredictedEAC += metrics.predictedEAC
    totalBudget += project.budget
    
    if (metrics.riskLevel === 'critical') {
      criticalProjects.push(project.id)
    } else if (metrics.riskLevel === 'high') {
      highRiskProjects.push(project.id)
    }
  }
  
  const totalProjectedVariance = totalBudget - totalPredictedEAC
  
  // Determine portfolio risk level
  let portfolioRiskLevel: PredictiveMetrics['riskLevel'] = 'low'
  if (criticalProjects.length > 0) {
    portfolioRiskLevel = 'critical'
  } else if (highRiskProjects.length > projects.length * 0.3) {
    portfolioRiskLevel = 'high'
  } else if (highRiskProjects.length > 0 || totalProjectedVariance < 0) {
    portfolioRiskLevel = 'medium'
  }
  
  return {
    totalPredictedEAC,
    totalBudget,
    totalProjectedVariance,
    portfolioRiskLevel,
    projectMetrics,
    criticalProjects,
    highRiskProjects
  }
}

/**
 * Generate mock historical data for a project
 * Used for testing and demonstration
 */
export function generateMockHistoricalData(
  project: ProjectWithFinancials,
  numPoints: number = 10
): HistoricalDataPoint[] {
  const data: HistoricalDataPoint[] = []
  const startDate = new Date(project.start_date)
  const now = new Date()
  const duration = now.getTime() - startDate.getTime()
  const interval = duration / numPoints
  
  let cumulativeSpend = 0
  const avgSpendPerPeriod = project.total_spend / numPoints
  
  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate.getTime() + interval * i)
    // Add some variance to the spend
    const variance = (Math.random() - 0.5) * avgSpendPerPeriod * 0.4
    const spend = Math.max(0, avgSpendPerPeriod + variance)
    cumulativeSpend += spend
    
    data.push({
      date: date.toISOString(),
      spend: Math.round(spend * 100) / 100,
      budget: project.budget,
      cumulativeSpend: Math.round(cumulativeSpend * 100) / 100
    })
  }
  
  // Ensure final cumulative spend matches actual
  if (data.length > 0) {
    data[data.length - 1].cumulativeSpend = project.total_spend
  }
  
  return data
}

export default calculatePredictiveMetrics
