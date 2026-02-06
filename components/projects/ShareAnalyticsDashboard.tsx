'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import {
  TrendingUp,
  Users,
  Globe,
  Eye,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  Filter
} from 'lucide-react'

interface ShareAnalytics {
  total_accesses: number
  unique_visitors: number
  unique_countries: number
  access_by_day: Array<{
    date: string
    count: number
  }>
  geographic_distribution: Array<{
    country: string
    count: number
    percentage: number
  }>
  most_viewed_sections: Array<{
    section: string
    views: number
    percentage: number
  }>
  average_session_duration: number | null
  suspicious_activity_count: number
}

interface ShareAnalyticsDashboardProps {
  shareId: string
  projectId?: string
  onRefresh?: () => void
  onExport?: (data: ShareAnalytics) => void
}

export default function ShareAnalyticsDashboard({
  shareId,
  projectId,
  onRefresh,
  onExport
}: ShareAnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<ShareAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dateRange, setDateRange] = useState<{
    start_date: string | null
    end_date: string | null
  }>({
    start_date: null,
    end_date: null
  })
  const [showFilters, setShowFilters] = useState(false)

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      setIsError(false)

      const params = new URLSearchParams()
      if (dateRange.start_date) params.append('start_date', dateRange.start_date)
      if (dateRange.end_date) params.append('end_date', dateRange.end_date)

      const response = await fetch(
        `/api/shares/${shareId}/analytics?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalyticsData(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [shareId, dateRange])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchAnalytics()
      onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }

  const handleExport = () => {
    if (!analyticsData) return

    if (onExport) {
      onExport(analyticsData)
    } else {
      // Export to CSV format for better usability
      const csvData = generateCSVExport(analyticsData)
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `share-analytics-${shareId}-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const generateCSVExport = (data: ShareAnalytics): string => {
    const lines: string[] = []
    
    // Summary section
    lines.push('Share Link Analytics Summary')
    lines.push(`Share ID,${shareId}`)
    lines.push(`Export Date,${new Date().toISOString()}`)
    lines.push('')
    lines.push('Metric,Value')
    lines.push(`Total Accesses,${data.total_accesses}`)
    lines.push(`Unique Visitors,${data.unique_visitors}`)
    lines.push(`Unique Countries,${data.unique_countries}`)
    lines.push(`Average Session Duration,${data.average_session_duration || 'N/A'}`)
    lines.push(`Suspicious Activities,${data.suspicious_activity_count}`)
    lines.push('')
    
    // Access by day
    lines.push('Daily Access Trends')
    lines.push('Date,Count')
    data.access_by_day.forEach(item => {
      lines.push(`${item.date},${item.count}`)
    })
    lines.push('')
    
    // Geographic distribution
    lines.push('Geographic Distribution')
    lines.push('Country,Count,Percentage')
    data.geographic_distribution.forEach(item => {
      lines.push(`${item.country},${item.count},${item.percentage.toFixed(2)}%`)
    })
    lines.push('')
    
    // Most viewed sections
    lines.push('Most Viewed Sections')
    lines.push('Section,Views,Percentage')
    data.most_viewed_sections.forEach(item => {
      lines.push(`${item.section},${item.views},${item.percentage.toFixed(2)}%`)
    })
    
    return lines.join('\n')
  }

  const handleDateRangeChange = (start: string | null, end: string | null) => {
    setDateRange({ start_date: start, end_date: end })
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">Failed to load analytics data</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return 'N/A'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Share Link Analytics</h2>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Track engagement and usage patterns for your shared project
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Date Range:</label>
              </div>
              <input
                type="date"
                value={dateRange.start_date || ''}
                onChange={(e) => handleDateRangeChange(e.target.value || null, dateRange.end_date)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
              />
              <span className="text-gray-500 dark:text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.end_date || ''}
                onChange={(e) => handleDateRangeChange(dateRange.start_date, e.target.value || null)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
              />
              <button
                onClick={() => handleDateRangeChange(null, null)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Accesses</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-2">
                {analyticsData.total_accesses.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Eye className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Unique Visitors</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-2">
                {analyticsData.unique_visitors.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Countries</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-2">
                {analyticsData.unique_countries}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Avg. Session</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-2">
                {formatDuration(analyticsData.average_session_duration)}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Suspicious Activity Alert */}
      {analyticsData.suspicious_activity_count > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-900">
                {analyticsData.suspicious_activity_count} suspicious {analyticsData.suspicious_activity_count === 1 ? 'activity' : 'activities'} detected
              </p>
              <p className="text-sm text-red-700 mt-1">
                Review access logs for unusual patterns or geographic anomalies
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Access Trends Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Access Trends</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Daily access patterns over time</p>
          </div>
          <TrendingUp className="h-5 w-5 text-gray-400 dark:text-slate-500" />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={analyticsData.access_by_day}>
            <defs>
              <linearGradient id="colorAccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6B7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorAccess)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Geographic Distribution and Most Viewed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Geographic Distribution</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Access by country</p>
            </div>
            <Globe className="h-5 w-5 text-gray-400 dark:text-slate-500" />
          </div>
          {analyticsData.geographic_distribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analyticsData.geographic_distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ country, percentage }) => `${country} (${percentage.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analyticsData.geographic_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {analyticsData.geographic_distribution.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 dark:text-slate-300">{item.country}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-slate-100">
                      {item.count} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">
              No geographic data available
            </div>
          )}
        </div>

        {/* Most Viewed Sections */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Most Viewed Sections</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Popular content areas</p>
            </div>
            <Eye className="h-5 w-5 text-gray-400 dark:text-slate-500" />
          </div>
          {analyticsData.most_viewed_sections.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.most_viewed_sections} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#6B7280" style={{ fontSize: '12px' }} />
                <YAxis
                  dataKey="section"
                  type="category"
                  stroke="#6B7280"
                  style={{ fontSize: '12px' }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="views" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">
              No section view data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
