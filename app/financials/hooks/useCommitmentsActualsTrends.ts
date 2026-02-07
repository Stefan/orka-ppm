import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../../../lib/api'

export interface MonthlyTrendData {
  month: string // YYYY-MM format
  commitments: number
  actuals: number
  cumulativeCommitments: number
  cumulativeActuals: number
  variance: number
  spendRate: number
}

export interface TrendsSummary {
  totalMonths: number
  avgMonthlyCommitments: number
  avgMonthlyActuals: number
  avgSpendRate: number
  projectedAnnualSpend: number
  burnRate: number // Average monthly spend
  forecastCompletion: string // Estimated date when commitments will be fully spent
}

interface UseCommitmentsActualsTrendsProps {
  accessToken: string | undefined
  selectedCurrency: string
  /** Defer initial fetch so tab paints first */
  deferMs?: number
}

export function useCommitmentsActualsTrends({ 
  accessToken, 
  selectedCurrency,
  deferMs = 0
}: UseCommitmentsActualsTrendsProps) {
  const [monthlyData, setMonthlyData] = useState<MonthlyTrendData[]>([])
  const [summary, setSummary] = useState<TrendsSummary | null>(null)
  const [loading, setLoading] = useState(deferMs <= 0)
  const [error, setError] = useState<string | null>(null)

  const fetchTrends = useCallback(async () => {
    if (!accessToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      const limit = 2000
      const [commitmentsRes, actualsRes] = await Promise.all([
        fetch(getApiUrl(`/csv-import/commitments?limit=${limit}`), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }),
        fetch(getApiUrl(`/csv-import/actuals?limit=${limit}`), {
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

      const commitments = commitmentsData.commitments || []
      const actuals = actualsData.actuals || []

      // Group by month
      const monthlyMap = new Map<string, { commitments: number; actuals: number }>()

      // Process commitments (use po_date)
      commitments.forEach((c: any) => {
        if (c.po_date) {
          const month = c.po_date.substring(0, 7) // YYYY-MM
          const existing = monthlyMap.get(month) || { commitments: 0, actuals: 0 }
          existing.commitments += c.total_amount || 0
          monthlyMap.set(month, existing)
        }
      })

      // Process actuals (use posting_date)
      actuals.forEach((a: any) => {
        if (a.posting_date) {
          const month = a.posting_date.substring(0, 7) // YYYY-MM
          const existing = monthlyMap.get(month) || { commitments: 0, actuals: 0 }
          existing.actuals += a.amount || 0
          monthlyMap.set(month, existing)
        }
      })

      // Convert to array and sort by month
      const sortedMonths = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))

      // Calculate cumulative values
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
          spendRate: data.commitments > 0 ? (data.actuals / data.commitments * 100) : 0
        }
      })

      setMonthlyData(monthlyTrends)

      // Calculate summary statistics
      if (monthlyTrends.length > 0) {
        const totalCommitments = monthlyTrends.reduce((sum, m) => sum + m.commitments, 0)
        const totalActuals = monthlyTrends.reduce((sum, m) => sum + m.actuals, 0)
        const avgMonthlyCommitments = totalCommitments / monthlyTrends.length
        const avgMonthlyActuals = totalActuals / monthlyTrends.length
        const avgSpendRate = totalCommitments > 0 ? (totalActuals / totalCommitments * 100) : 0

        // Calculate burn rate (average monthly actuals from last 3 months)
        const recentMonths = monthlyTrends.slice(-3)
        const burnRate = recentMonths.reduce((sum, m) => sum + m.actuals, 0) / recentMonths.length

        // Project annual spend based on burn rate
        const projectedAnnualSpend = burnRate * 12

        // Estimate forecast completion (when will commitments be fully spent?)
        const remainingCommitments = cumulativeCommitments - cumulativeActuals
        const monthsToCompletion = burnRate > 0 ? Math.ceil(remainingCommitments / burnRate) : 0
        const lastMonth = new Date(monthlyTrends[monthlyTrends.length - 1].month + '-01')
        lastMonth.setMonth(lastMonth.getMonth() + monthsToCompletion)
        const forecastCompletion = lastMonth.toISOString().substring(0, 7)

        setSummary({
          totalMonths: monthlyTrends.length,
          avgMonthlyCommitments,
          avgMonthlyActuals,
          avgSpendRate,
          projectedAnnualSpend,
          burnRate,
          forecastCompletion
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trends data')
    } finally {
      setLoading(false)
    }
  }, [accessToken, selectedCurrency])

  useEffect(() => {
    if (deferMs > 0) {
      const t = setTimeout(() => fetchTrends(), deferMs)
      return () => clearTimeout(t)
    }
    fetchTrends()
  }, [fetchTrends, deferMs])

  return {
    monthlyData,
    summary,
    loading,
    error,
    refetch: fetchTrends
  }
}
