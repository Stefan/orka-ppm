// Costbook Core Calculation Functions
// All calculations handle null/undefined values gracefully (treat as zero)

import {
  ProjectWithFinancials,
  KPIMetrics,
  Commitment,
  Actual,
  ProjectStatus,
  Currency
} from '@/types/costbook'

/**
 * Safely converts a value to a number, treating null/undefined/NaN as zero
 */
export function safeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0
  }
  return value
}

/**
 * Rounds a number to specified decimal places (default: 2 for currency)
 */
export function roundToDecimal(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Calculates total spend from commitments and actuals
 * Total Spend = Sum of Commitments + Sum of Actuals
 * 
 * @param commitments - Total value of commitments
 * @param actuals - Total value of actuals
 * @returns Total spend rounded to 2 decimal places
 */
export function calculateTotalSpend(
  commitments: number | null | undefined,
  actuals: number | null | undefined
): number {
  const safeCommitments = safeNumber(commitments)
  const safeActuals = safeNumber(actuals)
  return roundToDecimal(safeCommitments + safeActuals)
}

/**
 * Calculates total spend from arrays of commitment/actual objects
 * 
 * @param commitments - Array of commitment objects
 * @param actuals - Array of actual objects
 * @returns Total spend rounded to 2 decimal places
 */
export function calculateTotalSpendFromArrays(
  commitments: Commitment[] | null | undefined,
  actuals: Actual[] | null | undefined
): number {
  const commitmentsSum = (commitments || []).reduce(
    (sum, c) => sum + safeNumber(c?.amount),
    0
  )
  const actualsSum = (actuals || []).reduce(
    (sum, a) => sum + safeNumber(a?.amount),
    0
  )
  return roundToDecimal(commitmentsSum + actualsSum)
}

/**
 * Calculates variance between budget and total spend
 * Positive variance = under budget (good)
 * Negative variance = over budget (bad)
 * 
 * @param budget - Total budget amount
 * @param totalSpend - Total spend amount
 * @returns Variance rounded to 2 decimal places
 */
export function calculateVariance(
  budget: number | null | undefined,
  totalSpend: number | null | undefined
): number {
  const safeBudget = safeNumber(budget)
  const safeTotalSpend = safeNumber(totalSpend)
  return roundToDecimal(safeBudget - safeTotalSpend)
}

/**
 * Calculates spend percentage relative to budget
 * Returns 0 if budget is 0 to avoid division by zero
 * 
 * @param totalSpend - Total spend amount
 * @param budget - Total budget amount
 * @returns Percentage (0-100+) rounded to 2 decimal places
 */
export function calculateSpendPercentage(
  totalSpend: number | null | undefined,
  budget: number | null | undefined
): number {
  const safeTotalSpend = safeNumber(totalSpend)
  const safeBudget = safeNumber(budget)
  
  if (safeBudget === 0) {
    return safeTotalSpend > 0 ? 100 : 0
  }
  
  return roundToDecimal((safeTotalSpend / safeBudget) * 100)
}

/**
 * Calculates a health score for a project (0-100)
 * Based on variance percentage and project status
 * 
 * @param project - Project with financial data
 * @returns Health score 0-100
 */
export function calculateHealthScore(
  project: Partial<ProjectWithFinancials>
): number {
  const budget = safeNumber(project.budget)
  const totalSpend = safeNumber(project.total_spend)
  
  if (budget === 0) {
    return totalSpend === 0 ? 100 : 0
  }
  
  const spendPercentage = (totalSpend / budget) * 100
  
  // Health score calculation:
  // - 100% if spend is at or below 80% of budget
  // - Linear decrease from 100 to 50 between 80% and 100% of budget
  // - Linear decrease from 50 to 0 between 100% and 120% of budget
  // - 0 if spend exceeds 120% of budget
  
  if (spendPercentage <= 80) {
    return 100
  } else if (spendPercentage <= 100) {
    // Linear from 100 to 50 over 80-100%
    return roundToDecimal(100 - ((spendPercentage - 80) / 20) * 50)
  } else if (spendPercentage <= 120) {
    // Linear from 50 to 0 over 100-120%
    return roundToDecimal(50 - ((spendPercentage - 100) / 20) * 50)
  } else {
    return 0
  }
}

/**
 * Calculates KPI metrics for an array of projects
 * 
 * @param projects - Array of projects with financial data
 * @returns Aggregated KPI metrics
 */
export function calculateKPIs(
  projects: ProjectWithFinancials[] | null | undefined
): KPIMetrics {
  const safeProjects = projects || []
  
  const totalBudget = safeProjects.reduce(
    (sum, p) => sum + safeNumber(p?.budget),
    0
  )
  
  const totalCommitments = safeProjects.reduce(
    (sum, p) => sum + safeNumber(p?.total_commitments),
    0
  )
  
  const totalActuals = safeProjects.reduce(
    (sum, p) => sum + safeNumber(p?.total_actuals),
    0
  )
  
  const totalSpend = safeProjects.reduce(
    (sum, p) => sum + safeNumber(p?.total_spend),
    0
  )
  
  const netVariance = totalBudget - totalSpend
  
  const overBudgetCount = safeProjects.filter(p => {
    const variance = safeNumber(p?.variance)
    return variance < 0
  }).length
  
  const underBudgetCount = safeProjects.filter(p => {
    const variance = safeNumber(p?.variance)
    return variance > 0
  }).length
  
  return {
    total_budget: roundToDecimal(totalBudget),
    total_commitments: roundToDecimal(totalCommitments),
    total_actuals: roundToDecimal(totalActuals),
    total_spend: roundToDecimal(totalSpend),
    net_variance: roundToDecimal(netVariance),
    over_budget_count: overBudgetCount,
    under_budget_count: underBudgetCount
  }
}

/**
 * Calculates Estimate at Completion (EAC) for a project
 * Phase 1: Simple calculation using current performance
 * Phase 2: Will incorporate trend-based prediction
 * 
 * EAC = Actual Cost + (Budget at Completion - Earned Value) / CPI
 * For Phase 1, we use a simplified formula:
 * EAC = Budget + (Total Spend - Budget) if over budget, otherwise Budget
 * 
 * @param project - Project with financial data
 * @returns Estimated cost at completion
 */
export function calculateEAC(
  project: Partial<ProjectWithFinancials>
): number {
  const budget = safeNumber(project.budget)
  const totalSpend = safeNumber(project.total_spend)
  const spendPercentage = safeNumber(project.spend_percentage)
  
  if (budget === 0) {
    return totalSpend
  }
  
  // If project is over budget, estimate final cost based on current trend
  if (spendPercentage > 100) {
    // Project is over budget - estimate continued overage
    const overageRate = totalSpend / budget
    return roundToDecimal(budget * overageRate)
  }
  
  // If spending is on track or under, assume budget will be met
  return roundToDecimal(budget)
}

/**
 * Calculates Estimate to Complete (ETC) for a project
 * ETC = EAC - Actual Cost (Total Spend)
 * 
 * @param project - Project with financial data
 * @returns Estimated remaining cost to complete
 */
export function calculateETC(
  project: Partial<ProjectWithFinancials>
): number {
  const eac = calculateEAC(project)
  const totalSpend = safeNumber(project.total_spend)
  return roundToDecimal(Math.max(0, eac - totalSpend))
}

/**
 * Enriches a project with calculated financial metrics
 * 
 * @param project - Base project data
 * @param commitments - Array of commitments for the project
 * @param actuals - Array of actuals for the project
 * @returns Project with calculated financial fields
 */
export function enrichProjectWithFinancials(
  project: {
    id: string
    name: string
    description?: string
    status: string
    budget: number
    currency: string
    start_date: string
    end_date: string
    project_manager?: string
    client_id?: string
    created_at: string
    updated_at: string
  },
  commitments: Commitment[] | null | undefined,
  actuals: Actual[] | null | undefined
): ProjectWithFinancials {
  const totalCommitments = (commitments || []).reduce(
    (sum, c) => sum + safeNumber(c?.amount),
    0
  )
  
  const totalActuals = (actuals || []).reduce(
    (sum, a) => sum + safeNumber(a?.amount),
    0
  )
  
  const totalSpend = totalCommitments + totalActuals
  const budget = safeNumber(project.budget)
  const variance = budget - totalSpend
  const spendPercentage = budget > 0 ? (totalSpend / budget) * 100 : (totalSpend > 0 ? 100 : 0)
  
  const enrichedProject: ProjectWithFinancials = {
    ...project,
    status: project.status as ProjectStatus,
    currency: project.currency as Currency,
    total_commitments: roundToDecimal(totalCommitments),
    total_actuals: roundToDecimal(totalActuals),
    total_spend: roundToDecimal(totalSpend),
    variance: roundToDecimal(variance),
    spend_percentage: roundToDecimal(spendPercentage),
    health_score: 0 // Will be calculated below
  }
  
  enrichedProject.health_score = calculateHealthScore(enrichedProject)
  enrichedProject.eac = calculateEAC(enrichedProject)
  
  return enrichedProject
}

/**
 * Validates that a project has all required financial fields
 * 
 * @param project - Project to validate
 * @returns True if all required fields are present and valid
 */
export function validateProjectFinancials(
  project: Partial<ProjectWithFinancials>
): boolean {
  const requiredFields = [
    'id',
    'name',
    'budget',
    'total_commitments',
    'total_actuals',
    'total_spend',
    'variance',
    'spend_percentage'
  ]
  
  for (const field of requiredFields) {
    if (project[field as keyof ProjectWithFinancials] === undefined) {
      return false
    }
  }
  
  // Verify numeric fields are valid numbers
  const numericFields = [
    'budget',
    'total_commitments',
    'total_actuals',
    'total_spend',
    'variance',
    'spend_percentage'
  ]
  
  for (const field of numericFields) {
    const value = project[field as keyof ProjectWithFinancials]
    if (typeof value !== 'number' || isNaN(value)) {
      return false
    }
  }
  
  return true
}

/**
 * Calculates the sum of amounts from an array of commitments or actuals
 * 
 * @param items - Array of items with amount field
 * @returns Sum of all amounts
 */
export function sumAmounts<T extends { amount?: number | null }>(
  items: T[] | null | undefined
): number {
  return roundToDecimal(
    (items || []).reduce((sum, item) => sum + safeNumber(item?.amount), 0)
  )
}

/**
 * Groups projects by their budget status
 * 
 * @param projects - Array of projects with financial data
 * @returns Object with categorized projects
 */
export function categorizeProjectsByBudgetStatus(
  projects: ProjectWithFinancials[] | null | undefined
): {
  onTrack: ProjectWithFinancials[]
  atRisk: ProjectWithFinancials[]
  overBudget: ProjectWithFinancials[]
} {
  const safeProjects = projects || []
  
  return {
    onTrack: safeProjects.filter(p => p.spend_percentage <= 80),
    atRisk: safeProjects.filter(p => p.spend_percentage > 80 && p.spend_percentage <= 100),
    overBudget: safeProjects.filter(p => p.spend_percentage > 100)
  }
}