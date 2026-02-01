// Earned Value Management (EVM) Calculations
// Phase 3: Advanced project performance metrics

import {
  EarnedValueMetrics,
  ExtendedEVMMetrics,
  EVMStatus,
  EVMHistoryPoint,
  EVMProject,
  EVMThresholds,
  EVMTrendAnalysis,
  EVMInputData,
  EVMCalculationOptions,
  DEFAULT_EVM_THRESHOLDS,
  EVM_STATUS_CONFIG
} from '@/types/evm'
import { ProjectWithFinancials } from '@/types/costbook'

/**
 * Calculate Budgeted Cost of Work Scheduled (Planned Value)
 * BCWS = BAC × Planned % Complete
 */
export function calculateBCWS(budget: number, plannedProgress: number): number {
  if (budget <= 0 || isNaN(budget)) return 0
  const progress = Math.max(0, Math.min(1, plannedProgress))
  return Math.round(budget * progress * 100) / 100
}

/**
 * Calculate Budgeted Cost of Work Performed (Earned Value)
 * BCWP = BAC × Actual % Complete
 */
export function calculateBCWP(budget: number, earnedProgress: number): number {
  if (budget <= 0 || isNaN(budget)) return 0
  const progress = Math.max(0, Math.min(1, earnedProgress))
  return Math.round(budget * progress * 100) / 100
}

/**
 * Calculate Actual Cost of Work Performed
 * ACWP = Actual cost spent on work performed
 */
export function calculateACWP(actualCost: number): number {
  if (isNaN(actualCost)) return 0
  return Math.round(Math.max(0, actualCost) * 100) / 100
}

/**
 * Calculate Cost Performance Index
 * CPI = BCWP / ACWP
 * CPI > 1: Under budget, CPI < 1: Over budget
 */
export function calculateCPI(bcwp: number, acwp: number): number {
  if (acwp <= 0 || isNaN(acwp) || isNaN(bcwp)) return 1.0
  const cpi = bcwp / acwp
  return Math.round(cpi * 1000) / 1000
}

/**
 * Calculate Schedule Performance Index
 * SPI = BCWP / BCWS
 * SPI > 1: Ahead of schedule, SPI < 1: Behind schedule
 */
export function calculateSPI(bcwp: number, bcws: number): number {
  if (bcws <= 0 || isNaN(bcws) || isNaN(bcwp)) return 1.0
  const spi = bcwp / bcws
  return Math.round(spi * 1000) / 1000
}

/**
 * Calculate Cost Variance
 * CV = BCWP - ACWP
 * Positive = Under budget, Negative = Over budget
 */
export function calculateCV(bcwp: number, acwp: number): number {
  if (isNaN(bcwp) || isNaN(acwp)) return 0
  return Math.round((bcwp - acwp) * 100) / 100
}

/**
 * Calculate Schedule Variance
 * SV = BCWP - BCWS
 * Positive = Ahead of schedule, Negative = Behind schedule
 */
export function calculateSV(bcwp: number, bcws: number): number {
  if (isNaN(bcwp) || isNaN(bcws)) return 0
  return Math.round((bcwp - bcws) * 100) / 100
}

/**
 * Calculate Estimate at Completion (Typical formula)
 * EAC = BAC / CPI
 * Assumes future work will be performed at the same CPI
 */
export function calculateEACTypical(bac: number, cpi: number): number {
  if (cpi <= 0 || isNaN(cpi) || bac <= 0 || isNaN(bac)) return bac
  return Math.round((bac / cpi) * 100) / 100
}

/**
 * Calculate Estimate at Completion (Atypical formula)
 * EAC = ACWP + (BAC - BCWP)
 * Assumes future work will be performed at budget rate
 */
export function calculateEACAtypical(acwp: number, bac: number, bcwp: number): number {
  if (isNaN(acwp) || isNaN(bac) || isNaN(bcwp)) return bac
  return Math.round((acwp + (bac - bcwp)) * 100) / 100
}

/**
 * Calculate Estimate at Completion (Combined formula)
 * EAC = ACWP + (BAC - BCWP) / (CPI × SPI)
 * Considers both cost and schedule performance
 */
export function calculateEACCombined(
  acwp: number,
  bac: number,
  bcwp: number,
  cpi: number,
  spi: number
): number {
  const combinedIndex = cpi * spi
  if (combinedIndex <= 0 || isNaN(combinedIndex)) return bac
  const remainingWork = bac - bcwp
  return Math.round((acwp + remainingWork / combinedIndex) * 100) / 100
}

/**
 * Calculate Estimate to Complete
 * ETC = EAC - ACWP
 * How much more will be spent to complete the project
 */
export function calculateETC(eac: number, acwp: number): number {
  if (isNaN(eac) || isNaN(acwp)) return 0
  return Math.round(Math.max(0, eac - acwp) * 100) / 100
}

/**
 * Calculate Variance at Completion
 * VAC = BAC - EAC
 * Positive = Under budget at completion, Negative = Over budget
 */
export function calculateVAC(bac: number, eac: number): number {
  if (isNaN(bac) || isNaN(eac)) return 0
  return Math.round((bac - eac) * 100) / 100
}

/**
 * Calculate To-Complete Performance Index
 * TCPI = (BAC - BCWP) / (BAC - ACWP)
 * Required CPI to complete within budget
 */
export function calculateTCPI(bac: number, bcwp: number, acwp: number): number {
  const remainingBudget = bac - acwp
  const remainingWork = bac - bcwp
  
  if (remainingBudget <= 0 || isNaN(remainingBudget) || isNaN(remainingWork)) return 1.0
  
  const tcpi = remainingWork / remainingBudget
  return Math.round(tcpi * 1000) / 1000
}

/**
 * Determine EVM status based on CPI and SPI
 */
export function getEVMStatus(
  cpi: number,
  spi: number,
  thresholds: EVMThresholds = DEFAULT_EVM_THRESHOLDS
): EVMStatus {
  // Use the lower of CPI and SPI to determine status
  const compositeIndex = Math.min(cpi, spi)
  
  if (compositeIndex >= thresholds.excellent.min) {
    return 'excellent'
  }
  if (compositeIndex >= thresholds.good.min) {
    return 'good'
  }
  if (compositeIndex >= thresholds.caution.min) {
    return 'caution'
  }
  if (compositeIndex >= thresholds.warning.min) {
    return 'warning'
  }
  return 'critical'
}

/**
 * Get status configuration for a given status
 */
export function getEVMStatusConfig(status: EVMStatus) {
  return EVM_STATUS_CONFIG[status]
}

/**
 * Get color classes for CPI/SPI value display
 */
export function getIndexColorClass(value: number): string {
  if (value >= 1.1) return 'text-emerald-600'
  if (value >= 1.0) return 'text-green-600'
  if (value >= 0.9) return 'text-yellow-600'
  if (value >= 0.8) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get background color classes for CPI/SPI badges
 */
export function getIndexBgColorClass(value: number): string {
  if (value >= 1.1) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (value >= 1.0) return 'bg-green-100 text-green-700 border-green-200'
  if (value >= 0.9) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (value >= 0.8) return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

/**
 * Calculate all core EVM metrics from input data
 */
export function calculateEVMMetrics(
  input: EVMInputData,
  options: EVMCalculationOptions = {}
): EarnedValueMetrics {
  const { budget, plannedProgress, earnedProgress, actualCost } = input
  const bac = budget
  
  // Calculate base metrics
  const bcws = calculateBCWS(bac, plannedProgress)
  const bcwp = calculateBCWP(bac, earnedProgress)
  const acwp = calculateACWP(actualCost)
  
  // Calculate performance indices
  const cpi = calculateCPI(bcwp, acwp)
  const spi = calculateSPI(bcwp, bcws)
  
  // Calculate variances
  const cv = calculateCV(bcwp, acwp)
  const sv = calculateSV(bcwp, bcws)
  
  // Calculate EAC based on options
  let eac: number
  if (options.useCombinedEAC) {
    eac = calculateEACCombined(acwp, bac, bcwp, cpi, spi)
  } else if (options.useAtypicalEAC) {
    eac = calculateEACAtypical(acwp, bac, bcwp)
  } else {
    // Default to typical EAC
    eac = calculateEACTypical(bac, cpi)
  }
  
  // Calculate remaining metrics
  const etc = calculateETC(eac, acwp)
  const vac = calculateVAC(bac, eac)
  const tcpi = calculateTCPI(bac, bcwp, acwp)
  
  return {
    bcws,
    bcwp,
    acwp,
    cpi,
    spi,
    cv,
    sv,
    tcpi,
    eac,
    etc,
    vac,
    bac
  }
}

/**
 * Calculate extended EVM metrics with percentages
 */
export function calculateExtendedEVMMetrics(
  input: EVMInputData,
  options: EVMCalculationOptions = {}
): ExtendedEVMMetrics {
  const core = calculateEVMMetrics(input, options)
  const { budget } = input
  
  return {
    ...core,
    cpiPercent: Math.round(core.cpi * 100),
    spiPercent: Math.round(core.spi * 100),
    cvPercent: budget > 0 ? Math.round((core.cv / budget) * 10000) / 100 : 0,
    svPercent: budget > 0 ? Math.round((core.sv / budget) * 10000) / 100 : 0,
    vacPercent: budget > 0 ? Math.round((core.vac / budget) * 10000) / 100 : 0,
    compositeIndex: Math.round(core.cpi * core.spi * 1000) / 1000
  }
}

/**
 * Convert a ProjectWithFinancials to EVMProject
 */
export function enrichProjectWithEVM(
  project: ProjectWithFinancials,
  options: EVMCalculationOptions = {}
): EVMProject {
  // Calculate progress based on schedule
  const now = new Date()
  const startDate = new Date(project.start_date)
  const endDate = new Date(project.end_date)
  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  
  // Planned progress based on time
  const plannedProgress = Math.max(0, Math.min(1, elapsed / totalDuration))
  
  // Earned progress based on spend (simplified - in reality would be based on deliverables)
  const earnedProgress = project.spend_percentage / 100
  
  const input: EVMInputData = {
    budget: project.budget,
    plannedProgress,
    earnedProgress,
    actualCost: project.total_spend,
    startDate: project.start_date,
    endDate: project.end_date
  }
  
  const evmMetrics = calculateEVMMetrics(input, options)
  const extendedMetrics = calculateExtendedEVMMetrics(input, options)
  const evmStatus = getEVMStatus(evmMetrics.cpi, evmMetrics.spi, options.thresholds)
  
  return {
    ...project,
    evmMetrics,
    extendedMetrics,
    evmStatus,
    plannedProgress: Math.round(plannedProgress * 100),
    earnedProgress: Math.round(earnedProgress * 100)
  }
}

/**
 * Analyze EVM trends from historical data
 */
export function analyzeEVMTrends(
  history: EVMHistoryPoint[],
  currentMetrics: EarnedValueMetrics
): EVMTrendAnalysis {
  if (history.length < 2) {
    return {
      cpiTrend: 'stable',
      spiTrend: 'stable',
      projectedFinalCost: currentMetrics.eac,
      riskLevel: currentMetrics.cpi >= 1.0 && currentMetrics.spi >= 1.0 ? 'low' : 'medium',
      recommendations: []
    }
  }
  
  // Get recent data points (last 3)
  const recent = history.slice(-3)
  
  // Calculate CPI trend
  const cpiValues = recent.map(p => p.cpi)
  const cpiTrend = determineTrend(cpiValues)
  
  // Calculate SPI trend
  const spiValues = recent.map(p => p.spi)
  const spiTrend = determineTrend(spiValues)
  
  // Determine risk level
  let riskLevel: EVMTrendAnalysis['riskLevel'] = 'low'
  if (currentMetrics.cpi < 0.8 || currentMetrics.spi < 0.8) {
    riskLevel = 'critical'
  } else if (currentMetrics.cpi < 0.9 || currentMetrics.spi < 0.9) {
    riskLevel = 'high'
  } else if (currentMetrics.cpi < 1.0 || currentMetrics.spi < 1.0) {
    riskLevel = 'medium'
  }
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (currentMetrics.cpi < 1.0) {
    recommendations.push('Review cost drivers and identify areas for reduction')
  }
  if (currentMetrics.spi < 1.0) {
    recommendations.push('Evaluate schedule and consider fast-tracking activities')
  }
  if (cpiTrend === 'declining') {
    recommendations.push('CPI is declining - investigate root causes immediately')
  }
  if (spiTrend === 'declining') {
    recommendations.push('SPI is declining - reassess resource allocation')
  }
  if (currentMetrics.tcpi > 1.2) {
    recommendations.push('TCPI indicates significant effort needed to meet budget')
  }
  
  return {
    cpiTrend,
    spiTrend,
    projectedFinalCost: currentMetrics.eac,
    riskLevel,
    recommendations
  }
}

/**
 * Determine trend direction from a series of values
 */
function determineTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) return 'stable'
  
  const first = values[0]
  const last = values[values.length - 1]
  const change = last - first
  const percentChange = Math.abs(change / first) * 100
  
  if (percentChange < 2) return 'stable'
  return change > 0 ? 'improving' : 'declining'
}

/**
 * Generate mock EVM history for demonstration
 */
export function generateMockEVMHistory(
  project: ProjectWithFinancials,
  months: number = 6
): EVMHistoryPoint[] {
  const history: EVMHistoryPoint[] = []
  const now = new Date()
  const budget = project.budget
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    
    // Generate realistic-looking EVM data with some variance
    const progressBase = 1 - (i / months)
    const variance = (Math.random() - 0.5) * 0.1
    
    const bcws = budget * progressBase
    const bcwp = budget * (progressBase + variance * 0.5)
    const acwp = budget * (progressBase + variance)
    
    const cpi = bcwp / Math.max(acwp, 1)
    const spi = bcwp / Math.max(bcws, 1)
    const eac = budget / cpi
    
    history.push({
      date: date.toISOString(),
      bcws: Math.round(bcws),
      bcwp: Math.round(bcwp),
      acwp: Math.round(acwp),
      cpi: Math.round(cpi * 1000) / 1000,
      spi: Math.round(spi * 1000) / 1000,
      eac: Math.round(eac)
    })
  }
  
  return history
}

/**
 * Format CPI/SPI for display
 */
export function formatIndex(value: number): string {
  return value.toFixed(2)
}

/**
 * Format currency value for EVM display
 */
export function formatEVMCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

export default calculateEVMMetrics
