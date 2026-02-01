// Costbook 4.0 Anomaly Detection
// Statistical analysis for detecting spending pattern anomalies

import { ProjectWithFinancials } from '@/types/costbook'
import { roundToDecimal } from './costbook-calculations'

export interface AnomalyResult {
  projectId: string
  anomalyType: AnomalyType
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number // 0-1
  description: string
  details: {
    expectedValue?: number
    actualValue: number
    deviation?: number
    zScore?: number
    threshold?: number
  }
  recommendation?: string
}

export enum AnomalyType {
  VARIANCE_OUTLIER = 'variance_outlier',
  SPEND_VELOCITY = 'spend_velocity',
  BUDGET_UTILIZATION_SPIKE = 'budget_utilization_spike',
  VENDOR_CONCENTRATION = 'vendor_concentration',
  UNUSUAL_COMMITMENT_PATTERN = 'unusual_commitment_pattern'
}

/**
 * Calculate z-score for a value in a dataset
 * Z-score = (value - mean) / standard_deviation
 */
function calculateZScore(value: number, values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  return (value - mean) / stdDev
}

/**
 * Calculate modified z-score using median absolute deviation (MAD)
 * More robust against outliers than standard z-score
 */
function calculateModifiedZScore(value: number, values: number[]): number {
  if (values.length < 3) return 0

  // Sort values to find median
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  // Calculate MAD (Median Absolute Deviation)
  const deviations = sorted.map(v => Math.abs(v - median))
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)]

  if (mad === 0) return 0

  // Modified z-score = 0.6745 * (value - median) / MAD
  return 0.6745 * (value - median) / mad
}

/**
 * Detect variance outliers using statistical analysis
 */
function detectVarianceOutliers(projects: ProjectWithFinancials[]): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []
  const variances = projects.map(p => Math.abs(p.variance))

  if (variances.length < 3) return anomalies

  const meanVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length
  const threshold = meanVariance * 2.5 // 2.5x average variance as outlier threshold

  projects.forEach(project => {
    const absVariance = Math.abs(project.variance)

    if (absVariance > threshold) {
      const zScore = calculateZScore(absVariance, variances)
      const severity = Math.abs(zScore) > 3 ? 'critical' :
                      Math.abs(zScore) > 2 ? 'high' :
                      Math.abs(zScore) > 1.5 ? 'medium' : 'low'

      anomalies.push({
        projectId: project.id,
        anomalyType: AnomalyType.VARIANCE_OUTLIER,
        severity,
        confidence: Math.min(Math.abs(zScore) / 3, 0.95),
        description: `Unusual variance of ${formatCurrency(absVariance)} compared to project average`,
        details: {
          expectedValue: meanVariance,
          actualValue: absVariance,
          deviation: absVariance - meanVariance,
          zScore,
          threshold
        },
        recommendation: project.variance > 0
          ? 'Consider reallocating budget to projects with higher utilization'
          : 'Review project scope or identify cost overruns'
      })
    }
  })

  return anomalies
}

/**
 * Detect unusual spending velocity (spend percentage relative to time)
 */
function detectSpendVelocityAnomalies(projects: ProjectWithFinancials[]): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  projects.forEach(project => {
    // Calculate expected spend velocity based on project duration
    // This is a simplified heuristic - in production, you'd use historical data
    const spendPercentage = project.spend_percentage

    // Flag projects with very high spend percentage (>90%) as potential velocity issues
    if (spendPercentage > 90) {
      const severity = spendPercentage > 110 ? 'critical' :
                      spendPercentage > 100 ? 'high' : 'medium'

      anomalies.push({
        projectId: project.id,
        anomalyType: AnomalyType.SPEND_VELOCITY,
        severity,
        confidence: Math.min(spendPercentage / 120, 0.9),
        description: `High spend velocity: ${spendPercentage.toFixed(1)}% of budget utilized`,
        details: {
          actualValue: spendPercentage,
          threshold: 90
        },
        recommendation: 'Monitor closely for budget overruns or accelerate project delivery'
      })
    }
  })

  return anomalies
}

/**
 * Detect budget utilization spikes (sudden increases)
 */
function detectBudgetUtilizationSpikes(projects: ProjectWithFinancials[]): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  // Group projects by status to compare utilization within categories
  const activeProjects = projects.filter(p => p.status === 'active')
  const utilizationRates = activeProjects.map(p => p.spend_percentage)

  if (utilizationRates.length < 3) return anomalies

  activeProjects.forEach(project => {
    const zScore = calculateModifiedZScore(project.spend_percentage, utilizationRates)

    if (Math.abs(zScore) > 2.5) {
      const severity = Math.abs(zScore) > 3.5 ? 'high' : 'medium'

      anomalies.push({
        projectId: project.id,
        anomalyType: AnomalyType.BUDGET_UTILIZATION_SPIKE,
        severity,
        confidence: Math.min(Math.abs(zScore) / 4, 0.85),
        description: `Unusual budget utilization compared to active projects`,
        details: {
          actualValue: project.spend_percentage,
          zScore,
          threshold: 2.5
        },
        recommendation: 'Review project progress and resource allocation'
      })
    }
  })

  return anomalies
}

/**
 * Detect vendor concentration risks
 */
function detectVendorConcentrationRisks(projects: ProjectWithFinancials[]): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  // This is a simplified check - in production, you'd analyze actual vendor data
  projects.forEach(project => {
    const commitmentsCount = project.total_commitments
    const actualsCount = project.total_actuals

    // If a project has many small commitments, it might indicate vendor concentration
    if (commitmentsCount > 0 && actualsCount > 0) {
      const ratio = actualsCount / commitmentsCount

      if (ratio > 3) {
        anomalies.push({
          projectId: project.id,
          anomalyType: AnomalyType.VENDOR_CONCENTRATION,
          severity: 'medium',
          confidence: Math.min(ratio / 5, 0.8),
          description: `High transaction volume may indicate vendor concentration risk`,
          details: {
            actualValue: actualsCount,
            expectedValue: commitmentsCount,
            deviation: actualsCount - commitmentsCount
          },
          recommendation: 'Diversify vendor base or review procurement strategy'
        })
      }
    }
  })

  return anomalies
}

/**
 * Main anomaly detection function
 * Runs all detection algorithms and combines results
 */
export function detectAnomalies(projects: ProjectWithFinancials[]): AnomalyResult[] {
  const allAnomalies: AnomalyResult[] = []

  // Run all detection algorithms
  allAnomalies.push(...detectVarianceOutliers(projects))
  allAnomalies.push(...detectSpendVelocityAnomalies(projects))
  allAnomalies.push(...detectBudgetUtilizationSpikes(projects))
  allAnomalies.push(...detectVendorConcentrationRisks(projects))

  // Remove duplicates and sort by severity/confidence
  const uniqueAnomalies = removeDuplicateAnomalies(allAnomalies)
  return uniqueAnomalies.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    const aScore = severityOrder[a.severity] * a.confidence
    const bScore = severityOrder[b.severity] * b.confidence
    return bScore - aScore
  })
}

/**
 * Remove duplicate anomalies for the same project and type
 */
function removeDuplicateAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
  const seen = new Set<string>()
  return anomalies.filter(anomaly => {
    const key = `${anomaly.projectId}-${anomaly.anomalyType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Get projects with anomalies
 */
export function getProjectsWithAnomalies(
  projects: ProjectWithFinancials[],
  anomalies: AnomalyResult[]
): ProjectWithFinancials[] {
  const anomalyProjectIds = new Set(anomalies.map(a => a.projectId))
  return projects.filter(p => anomalyProjectIds.has(p.id))
}

/**
 * Get anomalies for a specific project
 */
export function getAnomaliesForProject(
  projectId: string,
  anomalies: AnomalyResult[]
): AnomalyResult[] {
  return anomalies.filter(a => a.projectId === projectId)
}

/**
 * Calculate anomaly summary statistics
 */
export function calculateAnomalySummary(anomalies: AnomalyResult[]) {
  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }

  const byType = {
    [AnomalyType.VARIANCE_OUTLIER]: 0,
    [AnomalyType.SPEND_VELOCITY]: 0,
    [AnomalyType.BUDGET_UTILIZATION_SPIKE]: 0,
    [AnomalyType.VENDOR_CONCENTRATION]: 0,
    [AnomalyType.UNUSUAL_COMMITMENT_PATTERN]: 0
  }

  anomalies.forEach(anomaly => {
    bySeverity[anomaly.severity]++
    byType[anomaly.anomalyType]++
  })

  return {
    total: anomalies.length,
    bySeverity,
    byType,
    affectedProjects: new Set(anomalies.map(a => a.projectId)).size,
    averageConfidence: anomalies.length > 0
      ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
      : 0
  }
}

// Helper function for formatting currency in anomaly descriptions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Mock anomalies for development/testing
 */
export function getMockAnomalies(): AnomalyResult[] {
  return [
    {
      projectId: 'proj-003',
      anomalyType: AnomalyType.VARIANCE_OUTLIER,
      severity: 'high',
      confidence: 0.85,
      description: 'Significant budget overrun compared to similar projects',
      details: {
        expectedValue: 15000,
        actualValue: 95000,
        deviation: 80000,
        zScore: 2.8,
        threshold: 37500
      },
      recommendation: 'Review project scope and identify cost drivers'
    },
    {
      projectId: 'proj-001',
      anomalyType: AnomalyType.SPEND_VELOCITY,
      severity: 'medium',
      confidence: 0.75,
      description: 'Rapid budget utilization may indicate rushed implementation',
      details: {
        actualValue: 73.33,
        threshold: 60
      },
      recommendation: 'Monitor progress closely and ensure quality standards'
    }
  ]
}