import { BudgetVariance, Project, FinancialAlert, AnalyticsData } from '../types'

export function calculateAnalyticsData(
  budgetVariances: BudgetVariance[],
  projects: Project[],
  financialAlerts: FinancialAlert[]
): AnalyticsData | null {
  if (!budgetVariances.length) return null

  const budgetStatusData = [
    { name: 'Under Budget', value: 0, color: '#10B981' },
    { name: 'Over Budget', value: 0, color: '#EF4444' },
    { name: 'On Budget', value: 0, color: '#3B82F6' }
  ]

  // Calculate budget status
  const projectsOverBudget = budgetVariances.filter(v => v.variance_amount > 0).length
  const projectsUnderBudget = budgetVariances.filter(v => v.variance_amount < 0).length
  const projectsOnBudget = projects.length - projectsOverBudget - projectsUnderBudget

  budgetStatusData[0]!.value = projectsUnderBudget
  budgetStatusData[1]!.value = projectsOverBudget
  budgetStatusData[2]!.value = projectsOnBudget

  // Calculate category spending
  const categorySpending = budgetVariances.reduce((acc, variance) => {
    variance.categories.forEach(cat => {
      if (!acc[cat.category]) {
        acc[cat.category] = { planned: 0, actual: 0, variance: 0 }
      }
      acc[cat.category]!.planned += cat.planned
      acc[cat.category]!.actual += cat.actual
      acc[cat.category]!.variance += cat.variance
    })
    return acc
  }, {} as Record<string, { planned: number, actual: number, variance: number }>)

  const categoryData = Object.entries(categorySpending).map(([category, data]) => ({
    name: category,
    planned: data.planned,
    actual: data.actual,
    variance: data.variance,
    variance_percentage: data.planned > 0 ? (data.variance / data.planned * 100) : 0,
    efficiency: data.planned > 0 ? ((data.planned - data.actual) / data.planned * 100) : 0
  }))

  // Calculate project performance
  const projectPerformanceData = budgetVariances.map(variance => {
    const project = projects.find(p => p.id === variance.project_id)
    return {
      name: project?.name.substring(0, 15) + '...' || 'Unknown',
      budget: variance.total_planned,
      actual: variance.total_actual,
      variance: variance.variance_amount,
      variance_percentage: variance.variance_percentage,
      health: project?.health || 'unknown',
      efficiency_score: variance.total_planned > 0 ? 
        Math.max(0, 100 - Math.abs(variance.variance_percentage)) : 0
    }
  }).sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))

  // Calculate savings and overruns
  const totalSavings = budgetVariances
    .filter(v => v.variance_amount < 0)
    .reduce((sum, v) => sum + Math.abs(v.variance_amount), 0)
  
  const totalOverruns = budgetVariances
    .filter(v => v.variance_amount > 0)
    .reduce((sum, v) => sum + v.variance_amount, 0)

  const avgEfficiency = projectPerformanceData.length > 0 
    ? projectPerformanceData.reduce((sum, p) => sum + p.efficiency_score, 0) / projectPerformanceData.length
    : 0

  return {
    budgetStatusData,
    categoryData,
    projectPerformanceData,
    totalProjects: projects.length,
    criticalAlerts: financialAlerts.filter(a => a.alert_level === 'critical').length,
    warningAlerts: financialAlerts.filter(a => a.alert_level === 'warning').length,
    totalSavings,
    totalOverruns,
    avgEfficiency,
    netVariance: totalOverruns - totalSavings
  }
}

export function calculateFinancialMetrics(budgetVariances: BudgetVariance[], selectedCurrency: string) {
  const totalBudget = budgetVariances.reduce((sum, v) => sum + v.total_planned, 0)
  const totalActual = budgetVariances.reduce((sum, v) => sum + v.total_actual, 0)
  const totalVariance = totalActual - totalBudget
  const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget * 100) : 0
  
  const projectsOverBudget = budgetVariances.filter(v => v.variance_amount > 0).length
  const projectsUnderBudget = budgetVariances.filter(v => v.variance_amount < 0).length
  
  const avgUtilization = budgetVariances.length > 0 
    ? budgetVariances.reduce((sum, v) => sum + (v.total_planned > 0 ? (v.total_actual / v.total_planned * 100) : 0), 0) / budgetVariances.length
    : 0

  return {
    total_budget: totalBudget,
    total_actual: totalActual,
    total_variance: totalVariance,
    variance_percentage: variancePercentage,
    projects_over_budget: projectsOverBudget,
    projects_under_budget: projectsUnderBudget,
    average_budget_utilization: avgUtilization,
    currency_distribution: { [selectedCurrency]: totalBudget }
  }
}

export function calculateBudgetPerformance(budgetVariances: BudgetVariance[]) {
  if (!budgetVariances.length) return null

  const onTrack = budgetVariances.filter(v => Math.abs(v.variance_percentage) <= 5).length
  const atRisk = budgetVariances.filter(v => v.variance_percentage > 5 && v.variance_percentage <= 15).length
  const overBudget = budgetVariances.filter(v => v.variance_percentage > 15).length
  
  const totalSavings = budgetVariances
    .filter(v => v.variance_amount < 0)
    .reduce((sum, v) => sum + Math.abs(v.variance_amount), 0)
  
  const totalOverruns = budgetVariances
    .filter(v => v.variance_amount > 0)
    .reduce((sum, v) => sum + v.variance_amount, 0)

  const efficiencyScore = budgetVariances.length > 0 
    ? budgetVariances.reduce((sum, v) => {
        const efficiency = v.total_planned > 0 ? 
          Math.max(0, 100 - Math.abs(v.variance_percentage)) : 0
        return sum + efficiency
      }, 0) / budgetVariances.length
    : 0

  return {
    on_track_projects: onTrack,
    at_risk_projects: atRisk,
    over_budget_projects: overBudget,
    total_savings: totalSavings,
    total_overruns: totalOverruns,
    efficiency_score: efficiencyScore
  }
}