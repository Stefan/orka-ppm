'use client'

import { useState, useEffect, memo, useRef } from 'react'
import { Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart } from 'recharts'
import { Calendar, Filter } from 'lucide-react'
import { useTranslations } from '../../../lib/i18n/context'
import { ChartSkeleton } from '../../../components/ui/Skeleton'

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

  useEffect(() => {
    if (session) {
      // Defer non-critical data fetching to avoid blocking main thread
      const timeoutId = setTimeout(() => {
        fetchVarianceTrends()
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [session, timeRange])

  const fetchVarianceTrends = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      // Generate data in smaller batches to avoid blocking main thread
      const mockTrendData: VarianceTrend[] = []
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const batchSize = 10
      
      for (let batch = 0; batch < Math.ceil(days / batchSize); batch++) {
        // Yield to main thread between batches
        await new Promise(resolve => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(undefined))
          } else {
            setTimeout(() => resolve(undefined), 0)
          }
        })
        
        const startIdx = batch * batchSize
        const endIdx = Math.min(startIdx + batchSize, days)
        
        for (let i = days - 1 - startIdx; i >= days - endIdx; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          
          // Simulate variance trends with some randomness
          const baseVariance = -5000 + (Math.random() - 0.5) * 20000
          const variancePercentage = (Math.random() - 0.5) * 20
          
          mockTrendData.push({
            date: date.toISOString().split('T')[0]!,
            total_variance: baseVariance,
            variance_percentage: variancePercentage,
            projects_over_budget: Math.floor(Math.random() * 5),
            projects_under_budget: Math.floor(Math.random() * 8)
          })
        }
      }
      
      setTrendData(mockTrendData)
      
    } catch (error: unknown) {
      console.error('Error fetching variance trends:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch variance trends')
    } finally {
      setLoading(false)
    }
  }

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