/**
 * Single derivation layer for commitments/actuals raw data.
 * Used by FinancialsDataContext so one fetch produces summary, analytics, cost analysis, and trends.
 */

import type { CostAnalysis } from '../types'
import type {
  CommitmentsActualsSummary,
  CommitmentsActualsAnalytics
} from '../hooks/useCommitmentsActualsData'
import type { MonthlyTrendData, TrendsSummary } from '../hooks/useCommitmentsActualsTrends'

const OVERVIEW_TOP_PROJECTS = 100

export interface CommitmentsActualsDerivations {
  summary: CommitmentsActualsSummary
  analytics: CommitmentsActualsAnalytics
  costAnalysis: CostAnalysis[]
  monthlyTrends: MonthlyTrendData[]
  trendsSummary: TrendsSummary | null
}

function amountFromCommitment(c: Record<string, unknown>): number {
  return amountFromCommitmentExported(c)
}

/** Actuals amount: prefer Invoice Amount Legal Entity currency, then Value in document currency, then legacy invoice_amount. Exported for portfolio-scoped aggregation. */
export function amountFromActual(a: Record<string, unknown>): number {
  const row = a as {
    amount?: number | null
    invoice_amount?: number | null
    value_in_document_currency?: number | null
  }
  const v = row.amount ?? row.invoice_amount ?? row.value_in_document_currency
  return Number(v ?? 0)
}

/** Project identifier for an actuals row (project_nr or project). Used to match to portfolio projects by name. */
export function projectKeyFromActual(a: Record<string, unknown>): string {
  const r = a as { project_nr?: string; project?: string }
  return String(r.project_nr ?? r.project ?? '')
}

/** Project identifier for a commitments row (project_nr or project). Used to match to portfolio projects. */
export function projectKeyFromCommitment(c: Record<string, unknown>): string {
  const r = c as { project_nr?: string; project?: string }
  return String(r.project_nr ?? r.project ?? '')
}

export function amountFromCommitmentExported(c: Record<string, unknown>): number {
  return Number((c as { total_amount?: number }).total_amount ?? 0)
}

function projectKey(row: Record<string, unknown>): string {
  const r = row as { project_nr?: string; project?: string }
  return String(r.project_nr ?? r.project ?? 'Unknown')
}

function categoryKey(row: Record<string, unknown>): string {
  const r = row as { wbs_element?: string; wbs?: string; cost_center?: string }
  return String(r.wbs_element ?? r.wbs ?? r.cost_center ?? 'Uncategorized')
}

/**
 * Compute summary, analytics, cost analysis and trends from raw commitments and actuals.
 * One source of truth for all commitments/actuals-derived UI.
 */
export function computeCommitmentsActualsDerivations(
  commitments: unknown[],
  actuals: unknown[],
  selectedCurrency: string
): CommitmentsActualsDerivations {
  const comm = commitments as Record<string, unknown>[]
  const act = actuals as Record<string, unknown>[]

  const totalCommitments = comm.reduce((sum, c) => sum + amountFromCommitment(c), 0)
  const totalActuals = act.reduce((sum, a) => sum + amountFromActual(a), 0)

  const projectSpend = new Map<string, { commitments: number; actuals: number }>()
  comm.forEach((c) => {
    const key = projectKey(c)
    const existing = projectSpend.get(key) ?? { commitments: 0, actuals: 0 }
    existing.commitments += amountFromCommitment(c)
    projectSpend.set(key, existing)
  })
  act.forEach((a) => {
    const key = projectKey(a)
    const existing = projectSpend.get(key) ?? { commitments: 0, actuals: 0 }
    existing.actuals += amountFromActual(a)
    projectSpend.set(key, existing)
  })

  const totalProjectsWithActivity = projectSpend.size
  const projectEntriesSorted = Array.from(projectSpend.entries())
    .map(([projectNr, data]) => ({
      projectNr,
      ...data,
      total: data.commitments + data.actuals
    }))
    .sort((a, b) => b.total - a.total)
  const topProjectEntries = projectEntriesSorted.slice(0, OVERVIEW_TOP_PROJECTS)
  const projectCount = topProjectEntries.length

  const summary: CommitmentsActualsSummary = {
    totalCommitments,
    totalActuals,
    totalSpend: totalCommitments + totalActuals,
    projectCount,
    totalProjectsWithActivity,
    overBudgetCount: 0,
    underBudgetCount: 0,
    onBudgetCount: projectCount,
    currency: selectedCurrency
  }

  // Category chart: aggregate by WBS/Cost Center across ALL data (no project filter), top 8 by total spend
  const categoryMap = new Map<string, { commitments: number; actuals: number }>()
  comm.forEach((c) => {
    const cat = categoryKey(c)
    const existing = categoryMap.get(cat) ?? { commitments: 0, actuals: 0 }
    existing.commitments += amountFromCommitment(c)
    categoryMap.set(cat, existing)
  })
  act.forEach((a) => {
    const cat = categoryKey(a)
    const existing = categoryMap.get(cat) ?? { commitments: 0, actuals: 0 }
    existing.actuals += amountFromActual(a)
    categoryMap.set(cat, existing)
  })

  const categoryData = Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name: name.length > 12 ? name.substring(0, 12) + '...' : name,
      commitments: data.commitments,
      actuals: data.actuals,
      variance: data.actuals - data.commitments,
      variance_percentage:
        data.commitments > 0 ? ((data.actuals - data.commitments) / data.commitments) * 100 : 0
    }))
    .sort((a, b) => b.commitments + b.actuals - (a.commitments + a.actuals))
    .slice(0, 8)

  const projectPerformanceData = topProjectEntries.map(({ projectNr, commitments, actuals }) => ({
    name: projectNr.length > 15 ? projectNr.substring(0, 15) + '…' : projectNr,
    commitments,
    actuals,
    variance: actuals - commitments,
    variance_percentage: commitments > 0 ? ((actuals - commitments) / commitments) * 100 : 0,
    spend_percentage: commitments > 0 ? (actuals / commitments) * 100 : 0
  }))
  projectPerformanceData.sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))

  const withinBudget = projectPerformanceData.filter(
    (p) => p.spend_percentage > 50 && p.spend_percentage <= 100
  ).length
  const overBudget = projectPerformanceData.filter((p) => p.spend_percentage > 100).length
  const underUtilized = projectPerformanceData.filter((p) => p.spend_percentage <= 50).length

  const analytics: CommitmentsActualsAnalytics = {
    categoryData,
    projectPerformanceData,
    statusDistribution: [
      { name: 'Within Budget', value: withinBudget, color: '#10B981' },
      { name: 'Over Budget', value: overBudget, color: '#EF4444' },
      { name: 'Under-Utilized', value: underUtilized, color: '#3B82F6' }
    ]
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear
  const categoryMapCost = new Map<
    string,
    { currentMonth: number; previousMonth: number; category: string }
  >()
  act.forEach((a) => {
    const cat = categoryKey(a)
    const postingDate = (a as { posting_date?: string }).posting_date
      ? new Date((a as { posting_date: string }).posting_date)
      : null
    const amount = amountFromActual(a)
    if (!postingDate) return
    if (!categoryMapCost.has(cat)) {
      categoryMapCost.set(cat, { currentMonth: 0, previousMonth: 0, category: cat })
    }
    const d = categoryMapCost.get(cat)!
    const month = postingDate.getMonth()
    const year = postingDate.getFullYear()
    if (year === currentYear && month === currentMonth) d.currentMonth += amount
    else if (year === previousYear && month === previousMonth) d.previousMonth += amount
  })
  const costAnalysis: CostAnalysis[] = Array.from(categoryMapCost.entries())
    .map(([category, data]) => {
      const percentageChange =
        data.previousMonth > 0
          ? ((data.currentMonth - data.previousMonth) / data.previousMonth) * 100
          : 0
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (Math.abs(percentageChange) > 5) trend = percentageChange > 0 ? 'up' : 'down'
      return {
        category: category.length > 20 ? category.substring(0, 20) + '...' : category,
        current_month: data.currentMonth,
        previous_month: data.previousMonth,
        trend,
        percentage_change: percentageChange
      }
    })
    .filter((item) => item.current_month > 0 || item.previous_month > 0)
    .sort((a, b) => b.current_month - a.current_month)
    .slice(0, 8)

  const monthlyMap = new Map<string, { commitments: number; actuals: number }>()
  comm.forEach((c) => {
    const poDate = (c as { po_date?: string }).po_date
    if (!poDate) return
    const month = poDate.substring(0, 7)
    const existing = monthlyMap.get(month) ?? { commitments: 0, actuals: 0 }
    existing.commitments += amountFromCommitment(c)
    monthlyMap.set(month, existing)
  })
  act.forEach((a) => {
    const postingDate = (a as { posting_date?: string }).posting_date
    if (!postingDate) return
    const month = postingDate.substring(0, 7)
    const existing = monthlyMap.get(month) ?? { commitments: 0, actuals: 0 }
    existing.actuals += amountFromActual(a)
    monthlyMap.set(month, existing)
  })

  const sortedMonths = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  let cumulativeCommitments = 0
  let cumulativeActuals = 0
  const monthlyTrends: MonthlyTrendData[] = sortedMonths.map(([month, data]) => {
    cumulativeCommitments += data.commitments
    cumulativeActuals += data.actuals
    return {
      month,
      commitments: data.commitments,
      actuals: data.actuals,
      cumulativeCommitments,
      cumulativeActuals,
      variance: data.actuals - data.commitments,
      spendRate: data.commitments > 0 ? (data.actuals / data.commitments) * 100 : 0
    }
  })

  let trendsSummary: TrendsSummary | null = null
  if (monthlyTrends.length > 0) {
    const totalComm = monthlyTrends.reduce((s, m) => s + m.commitments, 0)
    const totalAct = monthlyTrends.reduce((s, m) => s + m.actuals, 0)
    const recentMonths = monthlyTrends.slice(-3)
    const burnRate = recentMonths.reduce((s, m) => s + m.actuals, 0) / recentMonths.length
    const remainingCommitments =
      monthlyTrends[monthlyTrends.length - 1].cumulativeCommitments -
      monthlyTrends[monthlyTrends.length - 1].cumulativeActuals
    const monthsToCompletion = burnRate > 0 ? Math.ceil(remainingCommitments / burnRate) : 0
    const lastMonth = new Date(monthlyTrends[monthlyTrends.length - 1].month + '-01')
    lastMonth.setMonth(lastMonth.getMonth() + monthsToCompletion)
    trendsSummary = {
      totalMonths: monthlyTrends.length,
      avgMonthlyCommitments: totalComm / monthlyTrends.length,
      avgMonthlyActuals: totalAct / monthlyTrends.length,
      avgSpendRate: totalComm > 0 ? (totalAct / totalComm) * 100 : 0,
      projectedAnnualSpend: burnRate * 12,
      burnRate,
      forecastCompletion: lastMonth.toISOString().substring(0, 7)
    }
  }

  return {
    summary,
    analytics,
    costAnalysis,
    monthlyTrends,
    trendsSummary
  }
}
