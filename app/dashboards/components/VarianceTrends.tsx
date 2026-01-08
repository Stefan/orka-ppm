'use client'

import { useState, useEffect } from 'react'
import { Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart } from 'recharts'
import { Calendar, Filter } from 'lucide-react'
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

export default function VarianceTrends({ session, selectedCurrency = 'USD' }: VarianceTrendsProps) {
  const [trendData, setTrendData] = useState<VarianceTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    if (session) {
      fetchVarianceTrends()
    }
  }, [session, timeRange])

  const fetchVarianceTrends = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      // For now, we'll simulate trend data since the backend might not have historical variance data
      // In a real implementation, this would fetch from a trends endpoint
      const mockTrendData: VarianceTrend[] = []
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        
        // Simulate variance trends with some randomness
        const baseVariance = -5000 + (Math.random() - 0.5) * 20000
        const variancePercentage = (Math.random() - 0.5) * 20
        
        mockTrendData.push({
          date: date.toISOString().split('T')[0],
          total_variance: baseVariance,
          variance_percentage: variancePercentage,
          projects_over_budget: Math.floor(Math.random() * 5),
          projects_under_budget: Math.floor(Math.random() * 8)
        })
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
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || trendData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Variance Trends</h3>
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {error ? `Error: ${error}` : 'No trend data available'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Variance Trends</h3>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={trendData}>
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
            formatter={(value, name) => [
              name === 'total_variance' ? 
                `${Number(value).toLocaleString()} ${selectedCurrency}` :
                name === 'variance_percentage' ?
                  `${Number(value).toFixed(1)}%` :
                  value,
              name === 'total_variance' ? 'Total Variance' :
              name === 'variance_percentage' ? 'Variance %' :
              name === 'projects_over_budget' ? 'Over Budget' : 'Under Budget'
            ]}
          />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="total_variance" 
            fill="#3B82F6" 
            name="Total Variance"
            opacity={0.7}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="variance_percentage" 
            stroke="#EF4444" 
            strokeWidth={2}
            name="Variance %"
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Trend Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold text-gray-900">
            {trendData[trendData.length - 1]?.total_variance >= 0 ? '+' : ''}
            {trendData[trendData.length - 1]?.total_variance.toLocaleString()} {selectedCurrency}
          </div>
          <div className="text-gray-600">Latest Variance</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-900">
            {trendData[trendData.length - 1]?.variance_percentage >= 0 ? '+' : ''}
            {trendData[trendData.length - 1]?.variance_percentage.toFixed(1)}%
          </div>
          <div className="text-gray-600">Latest %</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-red-600">
            {trendData[trendData.length - 1]?.projects_over_budget}
          </div>
          <div className="text-gray-600">Over Budget</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-600">
            {trendData[trendData.length - 1]?.projects_under_budget}
          </div>
          <div className="text-gray-600">Under Budget</div>
        </div>
      </div>
    </div>
  )
}