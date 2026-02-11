import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Project, 
  BudgetVariance, 
  FinancialAlert, 
  FinancialMetrics,
  ComprehensiveFinancialReport,
  BudgetPerformanceMetrics
} from '../types'
import { 
  fetchProjects, 
  fetchFinancialAlerts, 
  fetchComprehensiveReport 
} from '../utils/api'
import { 
  calculateFinancialMetrics, 
  calculateBudgetPerformance 
} from '../utils/calculations'

interface UseFinancialDataProps {
  accessToken: string | undefined
  selectedCurrency: string
  portfolioId?: string | null
}

export function useFinancialData({ accessToken, selectedCurrency, portfolioId }: UseFinancialDataProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetVariances, setBudgetVariances] = useState<BudgetVariance[]>([])
  const [financialAlerts, setFinancialAlerts] = useState<FinancialAlert[]>([])
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [comprehensiveReport, setComprehensiveReport] = useState<ComprehensiveFinancialReport | null>(null)
  const [budgetPerformance, setBudgetPerformance] = useState<BudgetPerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** For overview: capped project count so UI does not show "1000 projects" (used in analytics display). */
  const [displayProjectCount, setDisplayProjectCount] = useState<number | null>(null)

  const fetchAllProjects = useCallback(async () => {
    if (!accessToken) {
      setProjects([])
      return []
    }

    try {
      const projectsData = await fetchProjects(accessToken, portfolioId ?? undefined)
      setProjects(projectsData)
      return projectsData
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch projects')
      return []
    }
  }, [accessToken, portfolioId])

  /** Derive variances from project list (budget/actual_cost). Avoids N per-project API calls. */
  const variancesFromProjects = useCallback((projectsList: Project[]): BudgetVariance[] => {
    return projectsList.map((project) => {
      const planned = project.budget ?? 0
      const actual = project.actual_cost ?? 0
      const varianceAmount = actual - planned
      const variancePercentage = planned !== 0 ? (varianceAmount / planned) * 100 : 0
      return {
        project_id: project.id,
        total_planned: planned,
        total_actual: actual,
        variance_amount: varianceAmount,
        variance_percentage: variancePercentage,
        currency: selectedCurrency,
        categories: [],
        status: 'active'
      }
    })
  }, [selectedCurrency])

  const fetchAllFinancialAlerts = useCallback(async () => {
    if (!accessToken) {
      setFinancialAlerts([])
      return
    }

    try {
      const alerts = await fetchFinancialAlerts(accessToken)
      setFinancialAlerts(alerts)
    } catch (error) {
      console.error('Failed to fetch financial alerts:', error)
    }
  }, [accessToken])

  const fetchAllComprehensiveReport = useCallback(async () => {
    if (!accessToken) return
    
    try {
      const report = await fetchComprehensiveReport(selectedCurrency, accessToken)
      setComprehensiveReport(report)
    } catch (error) {
      console.error('Failed to fetch comprehensive financial report:', error)
    }
  }, [accessToken, selectedCurrency])

  const calculateMetrics = useCallback((variances: BudgetVariance[]) => {
    if (!variances.length) return
    
    const metricsData = calculateFinancialMetrics(variances, selectedCurrency)
    setMetrics(metricsData)
  }, [selectedCurrency])

  const calculatePerformance = useCallback((variances: BudgetVariance[]) => {
    const performance = calculateBudgetPerformance(variances)
    setBudgetPerformance(performance)
  }, [])

  /** Max projects to use for overview metrics/variances when many projects (avoids 1000 over/under counts). */
  const OVERVIEW_CAP = 250

  const fetchAllData = useCallback(async (background?: boolean) => {
    if (!background) setLoading(true)
    setError(null)
    
    try {
      const [projectsData] = await Promise.all([
        fetchAllProjects(),
        fetchAllFinancialAlerts()
      ])
      const list = projectsData || []
      // Use top N by budget for overview so metrics (over/under budget) stay readable
      const listForOverview = list.length > OVERVIEW_CAP
        ? [...list].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)).slice(0, OVERVIEW_CAP)
        : list
      setDisplayProjectCount(listForOverview.length)
      const variancesData = variancesFromProjects(listForOverview)
      setBudgetVariances(variancesData)

      if (variancesData.length) {
        calculateMetrics(variancesData)
        calculatePerformance(variancesData)
      } else {
        setMetrics(null)
        setBudgetPerformance(null)
      }

      setLoading(false)

      // Phase 2: load report in background (don't block UI). Cost analysis comes from FinancialsDataContext (single commitments/actuals fetch).
      fetchAllComprehensiveReport().catch((err) => console.error('Financials report load failed:', err))
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [
    accessToken,
    fetchAllProjects,
    fetchAllFinancialAlerts,
    fetchAllComprehensiveReport,
    variancesFromProjects,
    calculateMetrics,
    calculatePerformance
  ])

  // Initial load and when accessToken changes only. Portfolio change is handled by the page via refetch(true).
  const prevAccessTokenRef = useRef<string | undefined>(accessToken)
  const didInitialFetchRef = useRef(false)
  useEffect(() => {
    const tokenChanged = prevAccessTokenRef.current !== accessToken
    prevAccessTokenRef.current = accessToken
    if (!didInitialFetchRef.current || tokenChanged) {
      didInitialFetchRef.current = true
      fetchAllData()
    }
  }, [accessToken, fetchAllData])

  return {
    projects,
    budgetVariances,
    financialAlerts,
    metrics,
    comprehensiveReport,
    budgetPerformance,
    loading,
    error,
    /** Refetch data. Pass true to skip setting loading (e.g. portfolio change) so the UI stays visible. */
    refetch: (background?: boolean) => fetchAllData(background),
    /** Capped project count for overview display (e.g. 250 when there are 1000). Use for "X projects" labels. */
    displayProjectCount: displayProjectCount ?? projects.length
  }
}