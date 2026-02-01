// Earned Value Management (EVM) Type Definitions
// Phase 3: Advanced project performance metrics

import { ProjectWithFinancials, ProjectStatus, Currency } from './costbook'

/**
 * Core EVM metrics calculated from project data
 */
export interface EarnedValueMetrics {
  /** Budgeted Cost of Work Scheduled (Planned Value) */
  bcws: number
  /** Budgeted Cost of Work Performed (Earned Value) */
  bcwp: number
  /** Actual Cost of Work Performed */
  acwp: number
  /** Cost Performance Index (BCWP / ACWP) */
  cpi: number
  /** Schedule Performance Index (BCWP / BCWS) */
  spi: number
  /** Cost Variance (BCWP - ACWP) */
  cv: number
  /** Schedule Variance (BCWP - BCWS) */
  sv: number
  /** To-Complete Performance Index */
  tcpi: number
  /** Estimate at Completion */
  eac: number
  /** Estimate to Complete */
  etc: number
  /** Variance at Completion (BAC - EAC) */
  vac: number
  /** Budget at Completion (original budget) */
  bac: number
}

/**
 * Extended EVM metrics with derived values
 */
export interface ExtendedEVMMetrics extends EarnedValueMetrics {
  /** Cost Performance Index percentage */
  cpiPercent: number
  /** Schedule Performance Index percentage */
  spiPercent: number
  /** Cost Variance percentage of BAC */
  cvPercent: number
  /** Schedule Variance percentage of BAC */
  svPercent: number
  /** VAC as percentage of BAC */
  vacPercent: number
  /** Composite Performance Index (CPI * SPI) */
  compositeIndex: number
}

/**
 * EVM status based on CPI and SPI thresholds
 */
export type EVMStatus = 'excellent' | 'good' | 'caution' | 'warning' | 'critical'

/**
 * EVM color configuration for UI
 */
export interface EVMStatusConfig {
  status: EVMStatus
  label: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}

/**
 * Historical EVM data point for trend analysis
 */
export interface EVMHistoryPoint {
  date: string
  bcws: number
  bcwp: number
  acwp: number
  cpi: number
  spi: number
  eac: number
}

/**
 * Project with full EVM data
 */
export interface EVMProject extends ProjectWithFinancials {
  /** Core EVM metrics */
  evmMetrics: EarnedValueMetrics
  /** Extended EVM metrics */
  extendedMetrics?: ExtendedEVMMetrics
  /** Historical EVM data for trend charts */
  evmHistory?: EVMHistoryPoint[]
  /** Overall EVM status */
  evmStatus: EVMStatus
  /** Planned progress percentage (0-100) */
  plannedProgress: number
  /** Earned progress percentage (0-100) */
  earnedProgress: number
}

/**
 * EVM thresholds for status determination
 */
export interface EVMThresholds {
  excellent: { min: number }
  good: { min: number; max: number }
  caution: { min: number; max: number }
  warning: { min: number; max: number }
  critical: { max: number }
}

/**
 * Default EVM thresholds
 */
export const DEFAULT_EVM_THRESHOLDS: EVMThresholds = {
  excellent: { min: 1.1 },
  good: { min: 1.0, max: 1.1 },
  caution: { min: 0.9, max: 1.0 },
  warning: { min: 0.8, max: 0.9 },
  critical: { max: 0.8 }
}

/**
 * EVM status configurations for UI rendering
 */
export const EVM_STATUS_CONFIG: Record<EVMStatus, EVMStatusConfig> = {
  excellent: {
    status: 'excellent',
    label: 'Excellent',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
    description: 'Performing above expectations'
  },
  good: {
    status: 'good',
    label: 'On Track',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    description: 'Meeting performance targets'
  },
  caution: {
    status: 'caution',
    label: 'Caution',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    description: 'Slight deviation from plan'
  },
  warning: {
    status: 'warning',
    label: 'Warning',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    description: 'Significant deviation requiring attention'
  },
  critical: {
    status: 'critical',
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    description: 'Major issues requiring immediate action'
  }
}

/**
 * EVM calculation options
 */
export interface EVMCalculationOptions {
  /** Use typical EAC formula (BAC / CPI) */
  useTypicalEAC?: boolean
  /** Use atypical EAC formula (ACWP + (BAC - BCWP)) */
  useAtypicalEAC?: boolean
  /** Use combined EAC formula (ACWP + (BAC - BCWP) / (CPI * SPI)) */
  useCombinedEAC?: boolean
  /** Custom thresholds for status */
  thresholds?: EVMThresholds
}

/**
 * EVM trend analysis result
 */
export interface EVMTrendAnalysis {
  /** CPI trend direction */
  cpiTrend: 'improving' | 'stable' | 'declining'
  /** SPI trend direction */
  spiTrend: 'improving' | 'stable' | 'declining'
  /** Projected completion date based on SPI */
  projectedCompletionDate?: string
  /** Projected final cost based on EAC */
  projectedFinalCost: number
  /** Risk assessment based on trends */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  /** Recommendations based on analysis */
  recommendations: string[]
}

/**
 * Input data for EVM calculations
 */
export interface EVMInputData {
  /** Original budget (BAC) */
  budget: number
  /** Planned progress (0-1) based on schedule */
  plannedProgress: number
  /** Actual progress earned (0-1) based on deliverables */
  earnedProgress: number
  /** Actual cost spent */
  actualCost: number
  /** Project start date */
  startDate: string
  /** Project end date */
  endDate: string
  /** Current date for calculations */
  asOfDate?: string
}
