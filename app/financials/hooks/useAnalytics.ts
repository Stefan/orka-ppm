import { useMemo } from 'react'
import { BudgetVariance, Project, FinancialAlert } from '../types'
import { calculateAnalyticsData } from '../utils/calculations'

interface UseAnalyticsProps {
  budgetVariances: BudgetVariance[]
  projects: Project[]
  financialAlerts: FinancialAlert[]
  /** When set, used as totalProjects for overview display (e.g. capped at 250). */
  totalProjectsOverride?: number
}

export function useAnalytics({ budgetVariances, projects, financialAlerts, totalProjectsOverride }: UseAnalyticsProps) {
  const analyticsData = useMemo(() => {
    const data = calculateAnalyticsData(budgetVariances, projects, financialAlerts)
    const totalProjects = totalProjectsOverride ?? data?.totalProjects ?? projects.length

    // Provide default structure if no data is available
    if (!data) {
      return {
        budgetStatusData: [
          { name: 'Under Budget', value: 0, color: '#10B981' },
          { name: 'Over Budget', value: 0, color: '#EF4444' },
          { name: 'On Budget', value: 0, color: '#3B82F6' }
        ],
        categoryData: [],
        projectPerformanceData: [],
        totalProjects,
        criticalAlerts: 0,
        warningAlerts: 0,
        totalSavings: 0,
        totalOverruns: 0,
        avgEfficiency: 0,
        netVariance: 0
      }
    }

    return { ...data, totalProjects }
  }, [budgetVariances, projects, financialAlerts, totalProjectsOverride])

  return analyticsData
}