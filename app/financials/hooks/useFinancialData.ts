import { useState, useEffect, useCallback } from 'react'
import { 
  Project, 
  BudgetVariance, 
  FinancialAlert, 
  FinancialMetrics,
  ComprehensiveFinancialReport,
  CostAnalysis,
  BudgetPerformanceMetrics
} from '../types'
import { 
  fetchProjects, 
  fetchBudgetVariance, 
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
}

export function useFinancialData({ accessToken, selectedCurrency }: UseFinancialDataProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetVariances, setBudgetVariances] = useState<BudgetVariance[]>([])
  const [financialAlerts, setFinancialAlerts] = useState<FinancialAlert[]>([])
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [comprehensiveReport, setComprehensiveReport] = useState<ComprehensiveFinancialReport | null>(null)
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis[]>([])
  const [budgetPerformance, setBudgetPerformance] = useState<BudgetPerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllProjects = useCallback(async () => {
    if (!accessToken) return
    
    try {
      const projectsData = await fetchProjects(accessToken)
      setProjects(projectsData)
      return projectsData
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch projects')
      return []
    }
  }, [accessToken])

  const fetchAllBudgetVariances = useCallback(async (projectsList: Project[]) => {
    if (!accessToken || !projectsList.length) return
    
    const variances: BudgetVariance[] = []
    
    for (const project of projectsList) {
      const variance = await fetchBudgetVariance(project.id, selectedCurrency, accessToken)
      if (variance) {
        variances.push(variance)
      }
    }
    
    setBudgetVariances(variances)
    return variances
  }, [accessToken, selectedCurrency])

  const fetchAllFinancialAlerts = useCallback(async () => {
    if (!accessToken) return
    
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

  const fetchCostAnalysisData = useCallback(async () => {
    // Mock cost analysis data - in real implementation would come from backend
    const mockCostAnalysis: CostAnalysis[] = [
      {
        category: 'Development',
        current_month: 45000,
        previous_month: 42000,
        trend: 'up',
        percentage_change: 7.1
      },
      {
        category: 'Infrastructure',
        current_month: 12000,
        previous_month: 15000,
        trend: 'down',
        percentage_change: -20.0
      },
      {
        category: 'Marketing',
        current_month: 8000,
        previous_month: 8100,
        trend: 'stable',
        percentage_change: -1.2
      },
      {
        category: 'Operations',
        current_month: 18000,
        previous_month: 16500,
        trend: 'up',
        percentage_change: 9.1
      }
    ]
    setCostAnalysis(mockCostAnalysis)
  }, [])

  const calculateMetrics = useCallback((variances: BudgetVariance[]) => {
    if (!variances.length) return
    
    const metricsData = calculateFinancialMetrics(variances, selectedCurrency)
    setMetrics(metricsData)
  }, [selectedCurrency])

  const calculatePerformance = useCallback((variances: BudgetVariance[]) => {
    const performance = calculateBudgetPerformance(variances)
    setBudgetPerformance(performance)
  }, [])

  const fetchAllData = useCallback(async () => {
    if (!accessToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Fetch projects first
      const projectsData = await fetchAllProjects()
      
      // Then fetch budget variances
      const variancesData = await fetchAllBudgetVariances(projectsData || [])
      
      // Calculate metrics and performance
      if (variancesData) {
        calculateMetrics(variancesData)
        calculatePerformance(variancesData)
      }
      
      // Fetch other data in parallel
      await Promise.all([
        fetchAllFinancialAlerts(),
        fetchAllComprehensiveReport(),
        fetchCostAnalysisData()
      ])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [
    accessToken, 
    fetchAllProjects, 
    fetchAllBudgetVariances, 
    fetchAllFinancialAlerts, 
    fetchAllComprehensiveReport, 
    fetchCostAnalysisData,
    calculateMetrics,
    calculatePerformance
  ])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  return {
    projects,
    budgetVariances,
    financialAlerts,
    metrics,
    comprehensiveReport,
    costAnalysis,
    budgetPerformance,
    loading,
    error,
    refetch: fetchAllData
  }
}