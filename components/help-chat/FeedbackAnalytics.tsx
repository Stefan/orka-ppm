'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Star,
  Users,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '../../lib/design-system'

interface FeedbackAnalyticsData {
  period_days: number
  total_queries: number
  total_feedback: number
  average_rating: number
  common_topics: Array<{
    topic: string
    count: number
  }>
  user_satisfaction: number
  tip_effectiveness: {
    tips_shown: number
    tips_dismissed: number
    engagement_rate: number
  }
  generated_at: string
}

interface FeedbackAnalyticsProps {
  className?: string
  refreshInterval?: number // in milliseconds
}

/**
 * Feedback analytics component for help chat system
 * Displays usage patterns, satisfaction scores, and improvement areas
 */
export function FeedbackAnalytics({ 
  className, 
  refreshInterval = 300000 // 5 minutes
}: FeedbackAnalyticsProps) {
  const [data, setData] = useState<FeedbackAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/ai/help/analytics?days=${selectedPeriod}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const analyticsData: FeedbackAnalyticsData = await response.json()
      setData(analyticsData)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error fetching help analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod])

  // Initial load and periodic refresh
  useEffect(() => {
    fetchAnalytics()

    if (refreshInterval > 0) {
      const interval = setInterval(fetchAnalytics, refreshInterval)
      return () => clearInterval(interval)
    }
    
    // Return cleanup function for when condition is not met
    return () => {}
  }, [fetchAnalytics, refreshInterval])

  // Handle period change
  const handlePeriodChange = useCallback((days: number) => {
    setSelectedPeriod(days)
  }, [])

  // Manual refresh
  const handleRefresh = useCallback(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Get satisfaction color
  const getSatisfactionColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  // Get rating color
  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600'
    if (rating >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading && !data) {
    return (
      <div className={cn('p-6 bg-white rounded-lg border border-gray-200', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">Loading analytics...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('p-6 bg-white rounded-lg border border-gray-200', className)}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Failed to Load Analytics
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Help Chat Analytics</h2>
          <p className="text-gray-600 mt-1">
            Usage patterns and feedback insights for the AI help system
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Period selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total queries */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Queries</p>
              <p className="text-2xl font-bold text-gray-900">{data.total_queries.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Average rating */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Rating</p>
              <div className="flex items-center space-x-2">
                <p className={cn('text-2xl font-bold', getRatingColor(data.average_rating))}>
                  {data.average_rating.toFixed(1)}
                </p>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= data.average_rating
                          ? 'text-yellow-500 fill-current'
                          : 'text-gray-300'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User satisfaction */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ThumbsUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">User Satisfaction</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(data.user_satisfaction * 100)}%
                </p>
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  getSatisfactionColor(data.user_satisfaction)
                )}>
                  {data.user_satisfaction >= 0.8 ? 'Excellent' :
                   data.user_satisfaction >= 0.6 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total feedback */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Feedback</p>
              <p className="text-2xl font-bold text-gray-900">{data.total_feedback.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {data.total_queries > 0 
                  ? `${Math.round((data.total_feedback / data.total_queries) * 100)}% response rate`
                  : 'No queries yet'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and detailed analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common topics */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Common Topics</h3>
          </div>
          <div className="space-y-3">
            {data.common_topics.map((topic, index) => {
              const maxCount = Math.max(...data.common_topics.map(t => t.count))
              const percentage = (topic.count / maxCount) * 100
              
              return (
                <div key={topic.topic} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
                    <span className="text-sm text-gray-500">{topic.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tip effectiveness */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Tip Effectiveness</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tips Shown</span>
              <span className="text-lg font-semibold text-gray-900">
                {data.tip_effectiveness.tips_shown.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Tips Dismissed</span>
              <span className="text-lg font-semibold text-gray-900">
                {data.tip_effectiveness.tips_dismissed.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Engagement Rate</span>
              <span className="text-lg font-semibold text-green-600">
                {Math.round(data.tip_effectiveness.engagement_rate * 100)}%
              </span>
            </div>
            
            {/* Engagement visualization */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Engagement</span>
                <span>{Math.round(data.tip_effectiveness.engagement_rate * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${data.tip_effectiveness.engagement_rate * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>Last updated: {lastRefresh.toLocaleString()}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Data period: {data.period_days} days</span>
        </div>
      </div>
    </div>
  )
}

export default FeedbackAnalytics