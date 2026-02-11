import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../../../lib/api'

/** Max number of projects to use for overview charts/summary (by total spend). Rest are summarized as "of N total". */
const OVERVIEW_TOP_PROJECTS = 100

export interface CommitmentsActualsSummary {
  totalCommitments: number
  totalActuals: number
  totalSpend: number
  /** Number of projects used in charts (capped to OVERVIEW_TOP_PROJECTS) */
  projectCount: number
  /** Total distinct projects with activity (may be > projectCount) */
  totalProjectsWithActivity: number
  overBudgetCount: number
  underBudgetCount: number
  onBudgetCount: number
  currency: string
}

export interface CommitmentsActualsAnalytics {
  categoryData: Array<{
    name: string
    commitments: number
    actuals: number
    variance: number
    variance_percentage: number
  }>
  projectPerformanceData: Array<{
    name: string
    commitments: number
    actuals: number
    variance: number
    variance_percentage: number
    spend_percentage: number
  }>
  statusDistribution: Array<{
    name: string
    value: number
    color: string
  }>
}

interface UseCommitmentsActualsDataProps {
  accessToken: string | undefined
  selectedCurrency: string
  /** Defer initial fetch by this many ms so the parent can paint first (e.g. Overview) */
  deferMs?: number
}

export function useCommitmentsActualsData({ 
  accessToken, 
  selectedCurrency,
  deferMs = 0
}: UseCommitmentsActualsDataProps) {
  const [summary, setSummary] = useState<CommitmentsActualsSummary | null>(null)
  const [analytics, setAnalytics] = useState<CommitmentsActualsAnalytics | null>(null)
  const [loading, setLoading] = useState(deferMs <= 0)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    if (!accessToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Fetch commitments and actuals (capped for faster overview load)
      const limit = 2000
      const [commitmentsRes, actualsRes] = await Promise.all([
        fetch(getApiUrl(`/csv-import/commitments?limit=${limit}&count_exact=false`), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }),
        fetch(getApiUrl(`/csv-import/actuals?limit=${limit}&count_exact=false`), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        })
      ])

      if (!commitmentsRes.ok || !actualsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const commitmentsData = await commitmentsRes.json()
      const actualsData = await actualsRes.json()

      // Calculate totals
      const commitments = commitmentsData.commitments || []
      const actuals = actualsData.actuals || []

      const totalCommitments = commitments.reduce((sum: number, c: any) => 
        sum + (c.total_amount || 0), 0
      )
      
      const totalActuals = actuals.reduce((sum: number, a: any) => 
        sum + (a.invoice_amount || a.amount || 0), 0
      )

      // Group by project to calculate budget status
      const projectSpend = new Map<string, { commitments: number; actuals: number }>()
      
      commitments.forEach((c: any) => {
        const projectKey = c.project_nr || c.project || 'Unknown'
        const existing = projectSpend.get(projectKey) || { commitments: 0, actuals: 0 }
        existing.commitments += c.total_amount || 0
        projectSpend.set(projectKey, existing)
      })
      
      actuals.forEach((a: any) => {
        const projectKey = a.project_nr || a.project || 'Unknown'
        const existing = projectSpend.get(projectKey) || { commitments: 0, actuals: 0 }
        existing.actuals += a.invoice_amount || a.amount || 0
        projectSpend.set(projectKey, existing)
      })

      const totalProjectsWithActivity = projectSpend.size
      // Use top N projects by spend for overview so charts stay readable
      const projectEntriesSorted = Array.from(projectSpend.entries())
        .map(([projectNr, data]) => ({ projectNr, ...data, total: (data.commitments || 0) + (data.actuals || 0) }))
        .sort((a, b) => b.total - a.total)
      const topProjectEntries = projectEntriesSorted.slice(0, OVERVIEW_TOP_PROJECTS)
      const projectCount = topProjectEntries.length

      setSummary({
        totalCommitments,
        totalActuals,
        totalSpend: totalCommitments + totalActuals,
        projectCount,
        totalProjectsWithActivity,
        overBudgetCount: 0,
        underBudgetCount: 0,
        onBudgetCount: projectCount,
        currency: selectedCurrency
      })

      // Calculate analytics from top projects only
      const categoryMap = new Map<string, { commitments: number; actuals: number }>()
      const topProjectNrs = new Set(topProjectEntries.map(e => e.projectNr))
      
      commitments.forEach((c: any) => {
        if (!topProjectNrs.has(c.project_nr || c.project || 'Unknown')) return
        const category = c.wbs_element || c.wbs || c.cost_center || 'Uncategorized'
        const existing = categoryMap.get(category) || { commitments: 0, actuals: 0 }
        existing.commitments += c.total_amount || 0
        categoryMap.set(category, existing)
      })
      actuals.forEach((a: any) => {
        if (!topProjectNrs.has(a.project_nr || a.project || 'Unknown')) return
        const category = a.wbs_element || a.wbs || a.cost_center || 'Uncategorized'
        const existing = categoryMap.get(category) || { commitments: 0, actuals: 0 }
        existing.actuals += a.invoice_amount || a.amount || 0
        categoryMap.set(category, existing)
      })

      const categoryData = Array.from(categoryMap.entries())
        .map(([name, data]) => ({
          name: name.length > 12 ? name.substring(0, 12) + '...' : name,
          commitments: data.commitments,
          actuals: data.actuals,
          variance: data.actuals - data.commitments,
          variance_percentage: data.commitments > 0 
            ? ((data.actuals - data.commitments) / data.commitments * 100) 
            : 0
        }))
        .sort((a, b) => (b.commitments + b.actuals) - (a.commitments + a.actuals))
        .slice(0, 8)

      const projectPerformanceData = topProjectEntries
        .map(({ projectNr, commitments, actuals }) => ({
          name: projectNr.length > 15 ? projectNr.substring(0, 15) + '…' : projectNr,
          commitments,
          actuals,
          variance: actuals - commitments,
          variance_percentage: commitments > 0 ? ((actuals - commitments) / commitments * 100) : 0,
          spend_percentage: commitments > 0 ? (actuals / commitments * 100) : 0
        }))
        .sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))

      const withinBudget = projectPerformanceData.filter(p => p.spend_percentage > 50 && p.spend_percentage <= 100).length
      const overBudget = projectPerformanceData.filter(p => p.spend_percentage > 100).length
      const underUtilized = projectPerformanceData.filter(p => p.spend_percentage <= 50).length

      const statusDistribution = [
        { name: 'Within Budget', value: withinBudget, color: '#10B981' },
        { name: 'Over Budget', value: overBudget, color: '#EF4444' },
        { name: 'Under-Utilized', value: underUtilized, color: '#3B82F6' }
      ]

      setAnalytics({
        categoryData,
        projectPerformanceData, // all top projects (Overview uses paging)
        statusDistribution
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch commitments & actuals data')
    } finally {
      setLoading(false)
    }
  }, [accessToken, selectedCurrency])

  useEffect(() => {
    if (deferMs > 0) {
      const t = setTimeout(() => {
        setLoading(true)
        fetchSummary()
      }, deferMs)
      return () => clearTimeout(t)
    }
    fetchSummary()
  }, [fetchSummary, deferMs])

  return {
    summary,
    analytics,
    loading,
    error,
    refetch: fetchSummary
  }
}
