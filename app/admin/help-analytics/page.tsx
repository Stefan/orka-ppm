'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import {
  MessageCircle,
  Users,
  Clock,
  ThumbsUp,
  RefreshCw,
  ArrowLeft,
  BarChart3,
  AlertTriangle,
} from 'lucide-react'

interface HelpAnalyticsMetrics {
  period: { start_date: string; end_date: string }
  metrics: {
    total_queries: number
    unique_users: number
    avg_response_time: number
    satisfaction_rate: number
    category_distribution: Record<string, number>
    effectiveness_distribution: Record<string, number>
    top_queries: Array<{ query: string; count: number }>
    common_issues: Array<{
      category: string
      confidence: number
      query_sample: string
    }>
  }
}

export default function AdminHelpAnalyticsPage() {
  const { session } = useAuth()
  const [data, setData] = useState<HelpAnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchMetrics() {
    if (!session?.access_token) return
    setError(null)
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 7)
      const params = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      })
      const res = await fetch(`/api/admin/help-analytics?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || res.statusText || 'Failed to load')
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (session) fetchMetrics()
  }, [session])

  const onRefresh = () => {
    setRefreshing(true)
    fetchMetrics()
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto" data-testid="admin-help-analytics-page">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <MessageCircle className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Help Chat Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Usage and satisfaction metrics for the AI Help Chat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2 text-red-900 dark:text-red-300"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-gray-100 dark:bg-slate-700 animate-pulse"
                data-testid="help-analytics-skeleton"
              />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {data.metrics && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Period: {new Date(data.period.start_date).toLocaleDateString()} –{' '}
                {new Date(data.period.end_date).toLocaleDateString()}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-1">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Total queries</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {data.metrics?.total_queries ?? 0}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Unique users</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {data.metrics?.unique_users ?? 0}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Avg. response (ms)</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {Math.round(data.metrics?.avg_response_time ?? 0)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Satisfaction rate</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {(data.metrics?.satisfaction_rate ?? 0).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  <BarChart3 className="w-5 h-5" />
                  Top queries
                </h2>
                {data.metrics?.top_queries?.length ? (
                  <ul className="space-y-2">
                    {data.metrics.top_queries.slice(0, 10).map((q, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="text-gray-700 dark:text-slate-300 truncate max-w-[75%]" title={q.query}>
                          {q.query}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400 font-medium">{q.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-400">No query data in this period.</p>
                )}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  <AlertTriangle className="w-5 h-5" />
                  Common issues (low confidence)
                </h2>
                {data.metrics?.common_issues?.length ? (
                  <ul className="space-y-2">
                    {data.metrics.common_issues.slice(0, 5).map((issue, i) => (
                      <li
                        key={i}
                        className="text-sm py-2 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="text-gray-700 dark:text-slate-300 block truncate" title={issue.query_sample}>
                          {issue.query_sample}
                        </span>
                        <span className="text-gray-500 dark:text-slate-400 text-xs">
                          {issue.category} · confidence {(issue.confidence * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-400">No issues flagged in this period.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
