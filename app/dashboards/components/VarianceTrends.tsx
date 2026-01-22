'use client'

import { useState, useEffect, memo, useRef } from 'react'
import { Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart } from 'recharts'
import { Calendar, Filter } from 'lucide-react'
import { useTranslations } from '../../../lib/i18n/context'

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
        if (offsetWidth > 0 && offsetHeight > 0) {
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
      <div className="bg-white p-2 rounded-lg border border-gray-200 h-full flex flex-col" style={{ minHeight: '280px' }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="flex-1 bg-gray-200 rounded" style={{ minHeight: '200px' }}></div>
        </div>
      </div>
    )
  }

  if (error || (trendData?.length || 0) === 0) {
    return (
      <div className="bg-white p-2 rounded-lg border border-gray-200 h-full flex flex-col" style={{ minHeight: '280px' }}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('variance.trends')}</h3>
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {error ? `${t('common.error')}: ${error}` : t('scenarios.noScenarios')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-2 rounded-lg border border-gray-200 h-full flex flex-col" style={{ minHeight: '280px' }}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] font-semibold text-gray-900 uppercase tracking-wide">{t('variance.trends')}</h3>
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 min-h-0" style={{ minHeight: '200px' }}>
        {isContainerReady ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
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
          <div className="flex items-center justify-center h-full bg-gray-50 rounded">
            <div className="text-xs text-gray-500">Loading chart...</div>
          </div>
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