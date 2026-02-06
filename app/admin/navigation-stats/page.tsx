'use client'

import { useState, useEffect } from 'react'
import { usePredictivePrefetch } from '../../../hooks/usePredictivePrefetch'
import AppLayout from '../../../components/shared/AppLayout'
import { TrendingUp, RefreshCw, Trash2, BarChart3 } from 'lucide-react'

export default function NavigationStatsPage() {
  const { getNavigationStats, clearPatterns, predictNextRoutes } = usePredictivePrefetch()
  const [stats, setStats] = useState<ReturnType<typeof getNavigationStats> | null>(null)
  const [predictions, setPredictions] = useState<string[]>([])

  const loadStats = () => {
    const currentStats = getNavigationStats()
    setStats(currentStats)
    
    // Get predictions for current page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      const predicted = predictNextRoutes(currentPath)
      setPredictions(predicted)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleClearPatterns = () => {
    if (confirm('Are you sure you want to clear all navigation patterns? This cannot be undone.')) {
      clearPatterns()
      loadStats()
    }
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Navigation Statistics</h1>
            <p className="text-gray-600 dark:text-slate-400 mt-2">
              Predictive prefetching analytics and navigation patterns
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={loadStats}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            
            <button
              onClick={handleClearPatterns}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Patterns
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Patterns</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.totalPatterns || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Navigations</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.totalNavigations || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Unique Routes</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.uniqueRoutes || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Predictions</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{predictions.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Current Page Predictions */}
        {predictions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Predicted Next Routes (Current Page)
            </h3>
            <div className="space-y-2">
              {predictions.map((route, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                >
                  <span className="font-medium text-blue-900">{route}</span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">Rank #{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Navigation Patterns */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Top Navigation Patterns</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Last Visited
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {stats?.topPatterns && stats.topPatterns.length > 0 ? (
                  stats.topPatterns.map((pattern, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                        {pattern.from}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        {pattern.to}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                          {pattern.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                        {pattern.lastVisited}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                      No navigation patterns recorded yet. Navigate between pages to build patterns.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How Predictive Prefetching Works</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>• Tracks your navigation patterns across the application</li>
            <li>• Learns which pages you typically visit after each page</li>
            <li>• Prefetches likely next pages in the background for instant navigation</li>
            <li>• Uses a confidence threshold of 30% to avoid unnecessary prefetching</li>
            <li>• Patterns decay over time to adapt to changing behavior</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  )
}
