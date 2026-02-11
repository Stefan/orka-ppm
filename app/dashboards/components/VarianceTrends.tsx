'use client'

import { useState, useEffect, memo, useRef, useCallback } from 'react'
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, ComposedChart } from 'recharts'
import { Calendar, Filter } from 'lucide-react'
import { useTranslations } from '../../../lib/i18n/context'
import { ChartSkeleton } from '../../../components/ui/Skeleton'
import { getApiUrl } from '../../../lib/api'

interface VarianceTrend {
  date: string
  total_variance: number
  variance_percentage: number
  projects_over_budget: number
  projects_under_budget: number
}

interface VarianceTrendsProps {
  session: any
  selectedCurrency?: string
}

function VarianceTrends({ session, selectedCurrency = 'USD' }: VarianceTrendsProps) {
  const { t } = useTranslations()
  const [trendData, setTrendData] = useState<VarianceTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [isContainerReady, setIsContainerReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Wait for container to have dimensions before rendering chart
  useEffect(() => {
    if (loading || !trendData.length) {
      setIsContainerReady(false)
      return
    }
    
    const checkContainer = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current
        if (offsetWidth >= 400 && offsetHeight >= 200) {
          setIsContainerReady(true)
        }
      }
    }
    
    // Check immediately and after short delays to ensure container is measured
    checkContainer()
    const timer1 = setTimeout(checkContainer, 50)
    const timer2 = setTimeout(checkContainer, 150)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [loading, trendData.length])

  const fetchVarianceTrends = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const limit = 5000
      const [commitmentsRes, actualsRes] = await Promise.all([
        fetch(getApiUrl(`/csv-import/commitments?limit=${limit}&count_exact=false`), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(getApiUrl(`/csv-import/actuals?limit=${limit}&count_exact=false`), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
      ])

      if (!commitmentsRes.ok || !actualsRes.ok) throw new Error('Failed to fetch data')

      const commitmentsData = await commitmentsRes.json()
      const actualsData = await actualsRes.json()
      const commitments = commitmentsData.commitments || []
      const actuals = actualsData.actuals || []

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const byWeek = timeRange === '90d'

      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const bucketKey = (dateStr: string): string => {
        const s = dateStr.substring(0, 10)
        if (!byWeek) return s
        const d = new Date(s)
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
        return toDateStr(start)
      }

      const now = new Date()
      const periodStart = new Date(now)
      periodStart.setDate(periodStart.getDate() - days)

      const buckets = new Map<string, { commitments: number; actuals: number }>()

      commitments.forEach((c: { po_date?: string; total_amount?: number }) => {
        if (!c.po_date) return
        const key = bucketKey(c.po_date)
        const t = new Date(key)
        if (t < periodStart) return
        const b = buckets.get(key) || { commitments: 0, actuals: 0 }
        b.commitments += Number(c.total_amount) || 0
        buckets.set(key, b)
      })

      actuals.forEach((a: { posting_date?: string; amount?: number }) => {
        if (!a.posting_date) return
        const key = bucketKey(a.posting_date)
        const t = new Date(key)
        if (t < periodStart) return
        const b = buckets.get(key) || { commitments: 0, actuals: 0 }
        b.actuals += Number(a.amount) || 0
        buckets.set(key, b)
      })

      // One point per period (unique dates, chronological order)
      const dateKeys: string[] = []
      if (byWeek) {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
        for (let w = 0; w < Math.ceil(days / 7); w++) {
          const d = new Date(weekStart)
          d.setDate(d.getDate() - w * 7)
          if (d < periodStart) break
          dateKeys.push(toDateStr(d))
        }
        dateKeys.reverse()
      } else {
        for (let i = 0; i < days; i++) {
          const d = new Date(now)
          d.setDate(d.getDate() - (days - 1 - i))
          dateKeys.push(toDateStr(d))
        }
      }

      const trendData: VarianceTrend[] = dateKeys.map((key) => {
        const b = buckets.get(key) || { commitments: 0, actuals: 0 }
        const totalVariance = b.actuals - b.commitments
        const variancePct = b.commitments ? (totalVariance / b.commitments) * 100 : 0
        return {
          date: key,
          total_variance: Math.round(totalVariance * 100) / 100,
          variance_percentage: Math.round(variancePct * 10) / 10,
          projects_over_budget: 0,
          projects_under_budget: 0,
        }
      })

      setTrendData(trendData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch variance trends')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, timeRange])

  useEffect(() => {
    if (session) {
      const timeoutId = setTimeout(() => fetchVarianceTrends(), 100)
      return () => clearTimeout(timeoutId)
    }
  }, [session, fetchVarianceTrends])

  if (loading) {
    return (
      <div data-testid="variance-trends-skeleton" className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 h-full flex flex-col" style={{ minHeight: '240px' }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
          <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded" style={{ minHeight: '180px' }}></div>
        </div>
      </div>
    )
  }

  if (error || (trendData?.length || 0) === 0) {
    return (
      <div data-testid="variance-trends-error" className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 h-full flex flex-col" style={{ minHeight: '240px' }}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 uppercase tracking-wide">{t('variance.trends')}</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="h-10 w-10 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {error ? `${t('common.error')}: ${error}` : t('scenarios.noScenarios')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="variance-trends" className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 h-full flex flex-col overflow-visible" style={{ minHeight: '240px' }}>
      <div data-testid="variance-trends-header" className="flex items-center justify-between gap-2 mb-3 min-h-[2rem]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide truncate min-w-0 flex-shrink">{t('variance.trends')}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="h-4 w-4 text-gray-600 dark:text-slate-400 shrink-0" aria-hidden />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1.5 min-w-[6.5rem] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">{t('variance.period7d')}</option>
            <option value="30d">{t('variance.period30d')}</option>
            <option value="90d">{t('variance.period90d')}</option>
          </select>
        </div>
      </div>
      
      <div data-testid="variance-trends-chart" ref={containerRef} className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
        {isContainerReady ? (
          <ResponsiveContainer width="100%" height={300} minWidth={400}>
            <ComposedChart data={trendData}>
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            tick={{ fontSize: 10 }}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
            formatter={(value, name) => [
              name === 'total_variance' ? 
                `${Number(value).toLocaleString()} ${selectedCurrency}` :
                name === 'variance_percentage' ?
                  `${Number(value).toFixed(1)}%` :
                  value,
              name === 'total_variance' ? t('variance.netVariance') :
              name === 'variance_percentage' ? `${t('financials.variance')} %` :
              name === 'projects_over_budget' ? t('financials.overBudget') : t('financials.underBudget')
            ]}
            contentStyle={{ fontSize: '10px' }}
          />
          <Bar 
            yAxisId="left" 
            dataKey="total_variance" 
            fill="#3B82F6" 
            name={t('variance.netVariance')}
            opacity={0.7}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="variance_percentage" 
            stroke="#EF4444" 
            strokeWidth={2}
            name={`${t('financials.variance')} %`}
            dot={false}
          />
        </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ChartSkeleton className="h-full" />
        )}
      </div>
    </div>
  )
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if session token or currency changes
const arePropsEqual = (prevProps: VarianceTrendsProps, nextProps: VarianceTrendsProps) => {
  return (
    prevProps.session?.access_token === nextProps.session?.access_token &&
    prevProps.selectedCurrency === nextProps.selectedCurrency
  )
}

export default memo(VarianceTrends, arePropsEqual)