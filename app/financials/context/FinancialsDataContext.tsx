'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { getApiUrl } from '../../../lib/api'
import { useFinancialData } from '../hooks/useFinancialData'
import {
  amountFromActual,
  amountFromCommitmentExported,
  computeCommitmentsActualsDerivations,
  projectKeyFromActual,
  projectKeyFromCommitment
} from '../utils/commitmentsActualsDerivations'
import type { FinancialMetrics, AnalyticsData } from '../types'
import type { CommitmentsActualsSummary, CommitmentsActualsAnalytics } from '../hooks/useCommitmentsActualsData'
import type { MonthlyTrendData, TrendsSummary } from '../hooks/useCommitmentsActualsTrends'
import type { CostAnalysis } from '../types'

const COMMITMENTS_ACTUALS_LIMIT = 2000
const DEFER_MS = 150

/** Zero metrics when no commitments/actuals data. Project table is not used for amounts. */
function zeroMetrics(currency: string): FinancialMetrics {
  return {
    total_budget: 0,
    total_actual: 0,
    total_variance: 0,
    variance_percentage: 0,
    projects_over_budget: 0,
    projects_under_budget: 0,
    average_budget_utilization: 0,
    currency_distribution: { [currency]: 0 }
  }
}

/** Empty analytics when no commitments/actuals data. Project table is not used for amounts. */
function emptyAnalyticsData(): AnalyticsData {
  return {
    budgetStatusData: [
      { name: 'Under Budget', value: 0, color: '#10B981' },
      { name: 'Over Budget', value: 0, color: '#EF4444' },
      { name: 'On Budget', value: 0, color: '#3B82F6' }
    ],
    categoryData: [],
    projectPerformanceData: [],
    totalProjects: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    totalSavings: 0,
    totalOverruns: 0,
    avgEfficiency: 0,
    netVariance: 0
  }
}

/** Build AnalyticsData from commitments/actuals only (no project budget/actual_cost). */
function analyticsDataFromCommitments(
  portfolioId: string | null | undefined,
  commitmentsAnalytics: CommitmentsActualsSummary | null,
  commitmentsAnalyticsFull: CommitmentsActualsAnalytics | null,
  portfolioProjectSpend: Map<string, { commitments: number; actuals: number }>
): AnalyticsData {
  if (portfolioId && portfolioProjectSpend.size > 0) {
    const projectPerformanceData: AnalyticsData['projectPerformanceData'] = []
    let over = 0
    let under = 0
    let onTrack = 0
    portfolioProjectSpend.forEach(({ commitments, actuals }, name) => {
      const variance = actuals - commitments
      const variance_percentage = commitments > 0 ? (variance / commitments) * 100 : 0
      const spend_percentage = commitments > 0 ? (actuals / commitments) * 100 : 0
      const health = spend_percentage > 100 ? 'red' : spend_percentage > 80 ? 'yellow' : 'green'
      let efficiency_score = 0
      if (spend_percentage >= 80 && spend_percentage <= 100) efficiency_score = 100
      else if (spend_percentage > 100) efficiency_score = Math.max(0, 100 - (spend_percentage - 100))
      else efficiency_score = (spend_percentage / 80) * 100
      projectPerformanceData.push({
        name: name.length > 15 ? name.substring(0, 15) + '…' : name,
        budget: commitments,
        actual: actuals,
        variance,
        variance_percentage,
        health,
        efficiency_score: Math.min(100, Math.max(0, efficiency_score))
      })
      if (spend_percentage > 100) over += 1
      else if (spend_percentage < 100) under += 1
      else onTrack += 1
    })
    projectPerformanceData.sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))
    return {
      budgetStatusData: [
        { name: 'Under Budget', value: under, color: '#10B981' },
        { name: 'Over Budget', value: over, color: '#EF4444' },
        { name: 'On Budget', value: onTrack, color: '#3B82F6' }
      ],
      categoryData: [],
      projectPerformanceData,
      totalProjects: projectPerformanceData.length,
      criticalAlerts: 0,
      warningAlerts: 0,
      totalSavings: 0,
      totalOverruns: 0,
      avgEfficiency: projectPerformanceData.length ? projectPerformanceData.reduce((s, p) => s + p.efficiency_score, 0) / projectPerformanceData.length : 0,
      netVariance: 0
    }
  }
  if (!commitmentsAnalyticsFull || !commitmentsAnalytics) return emptyAnalyticsData()
  const categoryData = commitmentsAnalyticsFull.categoryData.map((c) => ({
    name: c.name,
    planned: c.commitments,
    actual: c.actuals,
    variance: c.variance,
    variance_percentage: c.variance_percentage,
    efficiency: c.commitments > 0 ? Math.min(100, Math.max(0, 100 - Math.abs(c.variance_percentage))) : 0
  }))
  const projectPerformanceData = commitmentsAnalyticsFull.projectPerformanceData.map((p) => {
    const health = p.spend_percentage > 100 ? 'red' : p.spend_percentage > 80 ? 'yellow' : 'green'
    let efficiency_score = 0
    if (p.spend_percentage >= 80 && p.spend_percentage <= 100) efficiency_score = 100
    else if (p.spend_percentage > 100) efficiency_score = Math.max(0, 100 - (p.spend_percentage - 100))
    else efficiency_score = (p.spend_percentage / 80) * 100
    return {
      name: p.name,
      budget: p.commitments,
      actual: p.actuals,
      variance: p.variance,
      variance_percentage: p.variance_percentage,
      health,
      efficiency_score: Math.min(100, Math.max(0, efficiency_score))
    }
  })
  const budgetStatusData = commitmentsAnalyticsFull.statusDistribution.map((s) => ({
    name: s.name,
    value: s.value,
    color: s.color
  }))
  const totalSavings = projectPerformanceData.filter((p) => p.variance < 0).reduce((s, p) => s + Math.abs(p.variance), 0)
  const totalOverruns = projectPerformanceData.filter((p) => p.variance > 0).reduce((s, p) => s + p.variance, 0)
  return {
    budgetStatusData,
    categoryData,
    projectPerformanceData,
    totalProjects: projectPerformanceData.length,
    criticalAlerts: 0,
    warningAlerts: 0,
    totalSavings,
    totalOverruns,
    avgEfficiency: projectPerformanceData.length ? projectPerformanceData.reduce((s, p) => s + p.efficiency_score, 0) / projectPerformanceData.length : 0,
    netVariance: totalOverruns - totalSavings
  }
}

export interface FinancialsDataContextValue {
  // Core (portfolio-scoped, from useFinancialData)
  projects: ReturnType<typeof useFinancialData>['projects']
  budgetVariances: ReturnType<typeof useFinancialData>['budgetVariances']
  financialAlerts: ReturnType<typeof useFinancialData>['financialAlerts']
  /** Metrics from commitments/actuals only (Total Budget = commitments, Total Spent = actuals). Project table is not used for amounts. */
  metrics: FinancialMetrics | null
  comprehensiveReport: ReturnType<typeof useFinancialData>['comprehensiveReport']
  budgetPerformance: ReturnType<typeof useFinancialData>['budgetPerformance']
  loading: boolean
  error: string | null
  refetch: (background?: boolean) => void
  displayProjectCount: number

  /** Analytics (charts, project performance) from commitments/actuals only. Project table is not used for amounts. */
  analyticsData: AnalyticsData

  // From single commitments/actuals fetch (shared across Overview, Analysis, Detailed, Trends)
  commitmentsSummary: CommitmentsActualsSummary | null
  commitmentsAnalytics: CommitmentsActualsAnalytics | null
  costAnalysis: CostAnalysis[]
  trendsMonthlyData: MonthlyTrendData[]
  trendsSummary: TrendsSummary | null
  commitmentsLoading: boolean
  refetchCommitmentsActuals: () => Promise<void>
  /** When a portfolio is selected: sum of actuals (from Actuals table) for that portfolio's projects. */
  portfolioActualsTotal: number | null
  /** Metrics derived from commitments/actuals (primary source). Only when no commitments/actuals data do we use project table metrics. */
  effectiveMetrics: FinancialMetrics | null
}

const FinancialsDataContext = createContext<FinancialsDataContextValue | null>(null)

export function useFinancialsData(): FinancialsDataContextValue {
  const ctx = useContext(FinancialsDataContext)
  if (!ctx) {
    throw new Error('useFinancialsData must be used within FinancialsDataProvider')
  }
  return ctx
}

export function useFinancialsDataOptional(): FinancialsDataContextValue | null {
  return useContext(FinancialsDataContext)
}

interface FinancialsDataProviderProps {
  accessToken: string | undefined
  selectedCurrency: string
  portfolioId: string | undefined | null
  children: React.ReactNode
}

export function FinancialsDataProvider({
  accessToken,
  selectedCurrency,
  portfolioId,
  children
}: FinancialsDataProviderProps) {
  const core = useFinancialData({ accessToken, selectedCurrency, portfolioId })

  const [commitmentsSummary, setCommitmentsSummary] = useState<CommitmentsActualsSummary | null>(null)
  const [commitmentsAnalytics, setCommitmentsAnalytics] = useState<CommitmentsActualsAnalytics | null>(null)
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis[]>([])
  const [trendsMonthlyData, setTrendsMonthlyData] = useState<MonthlyTrendData[]>([])
  const [trendsSummary, setTrendsSummary] = useState<TrendsSummary | null>(null)
  const [commitmentsLoading, setCommitmentsLoading] = useState(false)
  /** Raw actuals from the single fetch; used to compute portfolio-scoped actuals total and effective metrics when portfolio is selected. */
  const [actualsList, setActualsList] = useState<Record<string, unknown>[]>([])
  /** Raw commitments from the single fetch; used to compute portfolio-scoped commitments total and effective metrics. */
  const [commitmentsList, setCommitmentsList] = useState<Record<string, unknown>[]>([])

  const fetchCommitmentsActuals = useCallback(async () => {
    if (!accessToken) return
    setCommitmentsLoading(true)
    try {
      const [commitmentsRes, actualsRes] = await Promise.all([
        fetch(
          getApiUrl(`/csv-import/commitments?limit=${COMMITMENTS_ACTUALS_LIMIT}&count_exact=false`),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        fetch(
          getApiUrl(`/csv-import/actuals?limit=${COMMITMENTS_ACTUALS_LIMIT}&count_exact=false`),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      ])
      if (!commitmentsRes.ok || !actualsRes.ok) throw new Error('Failed to fetch data')
      const commitmentsData = await commitmentsRes.json()
      const actualsData = await actualsRes.json()
      const commitments = commitmentsData.commitments || []
      const actuals = actualsData.actuals || []
      const derived = computeCommitmentsActualsDerivations(
        commitments,
        actuals,
        selectedCurrency
      )
      setCommitmentsSummary(derived.summary)
      setCommitmentsAnalytics(derived.analytics)
      setCostAnalysis(derived.costAnalysis)
      setTrendsMonthlyData(derived.monthlyTrends)
      setTrendsSummary(derived.trendsSummary)
      setActualsList(actuals as Record<string, unknown>[])
      setCommitmentsList(commitments as Record<string, unknown>[])
    } catch (err) {
      console.error('Commitments/actuals fetch failed:', err)
      setCommitmentsSummary(null)
      setCommitmentsAnalytics(null)
      setCostAnalysis([])
      setTrendsMonthlyData([])
      setTrendsSummary(null)
      setActualsList([])
      setCommitmentsList([])
    } finally {
      setCommitmentsLoading(false)
    }
  }, [accessToken, selectedCurrency])

  const prevPortfolioIdRef = useRef<string | undefined>(undefined)
  const refetchRef = useRef(core.refetch)
  refetchRef.current = core.refetch
  useEffect(() => {
    const next = portfolioId ?? undefined
    if (prevPortfolioIdRef.current !== next) {
      const isPortfolioChange = prevPortfolioIdRef.current !== undefined
      prevPortfolioIdRef.current = next
      if (isPortfolioChange) refetchRef.current(true)
    }
  }, [portfolioId])

  useEffect(() => {
    if (!accessToken) return
    if (DEFER_MS > 0) {
      const t = setTimeout(() => fetchCommitmentsActuals(), DEFER_MS)
      return () => clearTimeout(t)
    }
    fetchCommitmentsActuals()
  }, [fetchCommitmentsActuals, accessToken])

  /** Set of keys that identify a portfolio project: name and external_id. Commitments/actuals project_nr can match either. */
  const portfolioProjectKeysSet = useMemo(() => {
    const keys = new Set<string>()
    for (const p of core.projects) {
      const name = (p.name ?? '').trim()
      if (name) keys.add(name)
      const extId = (p as { external_id?: string }).external_id
      if (extId && String(extId).trim()) keys.add(String(extId).trim())
    }
    return keys
  }, [core.projects])

  const portfolioActualsTotal = useMemo(() => {
    if (!portfolioId || !actualsList.length || !portfolioProjectKeysSet.size) return null
    let sum = 0
    for (const a of actualsList) {
      const key = projectKeyFromActual(a).trim()
      if (key && portfolioProjectKeysSet.has(key)) sum += amountFromActual(a)
    }
    return sum
  }, [portfolioId, actualsList, portfolioProjectKeysSet])

  const portfolioCommitmentsTotal = useMemo(() => {
    if (!portfolioId || !commitmentsList.length || !portfolioProjectKeysSet.size) return null
    let sum = 0
    for (const c of commitmentsList) {
      const key = projectKeyFromCommitment(c).trim()
      if (key && portfolioProjectKeysSet.has(key)) sum += amountFromCommitmentExported(c)
    }
    return sum
  }, [portfolioId, commitmentsList, portfolioProjectKeysSet])

  /** Per-project commitments/actuals for portfolio projects only; used to compute over/under counts for effective metrics. */
  const portfolioProjectSpend = useMemo(() => {
    if (!portfolioId || !portfolioProjectKeysSet.size) return new Map<string, { commitments: number; actuals: number }>()
    const map = new Map<string, { commitments: number; actuals: number }>()
    for (const c of commitmentsList) {
      const key = projectKeyFromCommitment(c).trim()
      if (!key || !portfolioProjectKeysSet.has(key)) continue
      const existing = map.get(key) ?? { commitments: 0, actuals: 0 }
      existing.commitments += amountFromCommitmentExported(c)
      map.set(key, existing)
    }
    for (const a of actualsList) {
      const key = projectKeyFromActual(a).trim()
      if (!key || !portfolioProjectKeysSet.has(key)) continue
      const existing = map.get(key) ?? { commitments: 0, actuals: 0 }
      existing.actuals += amountFromActual(a)
      map.set(key, existing)
    }
    return map
  }, [portfolioId, portfolioProjectKeysSet, commitmentsList, actualsList])

  /**
   * Metrics from commitments/actuals only. Total Budget = commitments, Total Spent = actuals.
   * With portfolio: scoped to that portfolio's projects. When portfolio has no matching data, fall back to global metrics so KPIs (Avg. Utilization, Over Budget, etc.) show global values instead of 0.
   * Project table is not used for amounts.
   */
  const metricsFromCommitmentsActuals = useMemo((): FinancialMetrics | null => {
    if (portfolioId) {
      const commTotal = portfolioCommitmentsTotal ?? 0
      const actTotal = portfolioActualsTotal ?? 0
      const hasPortfolioData = commTotal > 0 || actTotal > 0 || portfolioProjectSpend.size > 0
      if (hasPortfolioData && (commitmentsList.length > 0 || actualsList.length > 0)) {
        let projectsOver = 0
        let projectsUnder = 0
        let utilizationSum = 0
        let count = 0
        portfolioProjectSpend.forEach(({ commitments, actuals }) => {
          if (commitments > 0) {
            const util = (actuals / commitments) * 100
            utilizationSum += util
            count += 1
            if (actuals > commitments) projectsOver += 1
            else if (actuals < commitments) projectsUnder += 1
          }
        })
        const totalVariance = actTotal - commTotal
        const variancePct = commTotal > 0 ? (totalVariance / commTotal) * 100 : 0
        const avgUtil = count > 0 ? utilizationSum / count : 0
        return {
          total_budget: commTotal,
          total_actual: actTotal,
          total_variance: totalVariance,
          variance_percentage: variancePct,
          projects_over_budget: projectsOver,
          projects_under_budget: projectsUnder,
          average_budget_utilization: avgUtil,
          currency_distribution: { [selectedCurrency]: commTotal }
        }
      }
      if (!commitmentsSummary) return null
      const gComm = commitmentsSummary.totalCommitments
      const gAct = commitmentsSummary.totalActuals
      const gVariance = gAct - gComm
      const gVariancePct = gComm > 0 ? (gVariance / gComm) * 100 : 0
      const gAvgUtil = gComm > 0 ? (gAct / gComm) * 100 : 0
      let gOver = 0
      let gUnder = 0
      if (commitmentsAnalytics?.projectPerformanceData?.length) {
        for (const p of commitmentsAnalytics.projectPerformanceData) {
          if (p.spend_percentage > 100) gOver += 1
          else if (p.spend_percentage < 100) gUnder += 1
        }
      }
      return {
        total_budget: gComm,
        total_actual: gAct,
        total_variance: gVariance,
        variance_percentage: gVariancePct,
        projects_over_budget: gOver,
        projects_under_budget: gUnder,
        average_budget_utilization: gAvgUtil,
        currency_distribution: { [selectedCurrency]: gComm }
      }
    }
    if (!commitmentsSummary) return null
    const commTotal = commitmentsSummary.totalCommitments
    const actTotal = commitmentsSummary.totalActuals
    const totalVariance = actTotal - commTotal
    const variancePct = commTotal > 0 ? (totalVariance / commTotal) * 100 : 0
    const avgUtil = commTotal > 0 ? (actTotal / commTotal) * 100 : 0
    let projectsOver = 0
    let projectsUnder = 0
    if (commitmentsAnalytics?.projectPerformanceData?.length) {
      for (const p of commitmentsAnalytics.projectPerformanceData) {
        if (p.spend_percentage > 100) projectsOver += 1
        else if (p.spend_percentage < 100) projectsUnder += 1
      }
    }
    return {
      total_budget: commTotal,
      total_actual: actTotal,
      total_variance: totalVariance,
      variance_percentage: variancePct,
      projects_over_budget: projectsOver,
      projects_under_budget: projectsUnder,
      average_budget_utilization: avgUtil,
      currency_distribution: { [selectedCurrency]: commTotal }
    }
  }, [
    portfolioId,
    portfolioCommitmentsTotal,
    portfolioActualsTotal,
    portfolioProjectSpend,
    commitmentsList.length,
    actualsList.length,
    commitmentsSummary,
    commitmentsAnalytics,
    selectedCurrency
  ])

  /** Fallback: if we have raw lists but derived metrics show 0 for total_actual/total_budget, recompute from lists (handles API field naming or timing issues). */
  const metrics = useMemo(() => {
    const base = metricsFromCommitmentsActuals ?? zeroMetrics(selectedCurrency)
    if (actualsList.length > 0 || commitmentsList.length > 0) {
      const sumActuals = actualsList.length > 0
        ? actualsList.reduce((s, a) => s + amountFromActual(a), 0)
        : 0
      const sumCommitments = commitmentsList.length > 0
        ? commitmentsList.reduce((s, c) => s + amountFromCommitmentExported(c), 0)
        : 0
      const total_budget = base.total_budget > 0 ? base.total_budget : sumCommitments
      const total_actual = base.total_actual > 0 ? base.total_actual : sumActuals
      if (total_budget !== base.total_budget || total_actual !== base.total_actual) {
        const total_variance = total_actual - total_budget
        const variance_percentage = total_budget > 0 ? (total_variance / total_budget) * 100 : 0
        const average_budget_utilization = total_budget > 0 ? (total_actual / total_budget) * 100 : 0
        return {
          ...base,
          total_budget,
          total_actual,
          total_variance,
          variance_percentage,
          average_budget_utilization,
          currency_distribution: { [selectedCurrency]: total_budget }
        }
      }
    }
    return base
  }, [metricsFromCommitmentsActuals, actualsList, commitmentsList, selectedCurrency])
  const effectiveMetrics = metricsFromCommitmentsActuals

  const analyticsData = useMemo(
    () =>
      analyticsDataFromCommitments(
        portfolioId,
        commitmentsSummary,
        commitmentsAnalytics,
        portfolioProjectSpend
      ),
    [portfolioId, commitmentsSummary, commitmentsAnalytics, portfolioProjectSpend]
  )

  const value = useMemo<FinancialsDataContextValue>(
    () => ({
      ...core,
      metrics,
      analyticsData,
      commitmentsSummary,
      commitmentsAnalytics,
      costAnalysis,
      trendsMonthlyData,
      trendsSummary,
      commitmentsLoading,
      refetchCommitmentsActuals: fetchCommitmentsActuals,
      portfolioActualsTotal,
      effectiveMetrics
    }),
    [
      core.projects,
      core.comprehensiveReport,
      core.budgetPerformance,
      core.loading,
      core.error,
      core.displayProjectCount,
      metrics,
      analyticsData,
      commitmentsSummary,
      commitmentsAnalytics,
      costAnalysis,
      trendsMonthlyData,
      trendsSummary,
      commitmentsLoading,
      fetchCommitmentsActuals,
      portfolioActualsTotal,
      effectiveMetrics
    ]
  )

  return (
    <FinancialsDataContext.Provider value={value}>
      {children}
    </FinancialsDataContext.Provider>
  )
}
