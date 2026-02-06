/**
 * CacheStatsCard Component
 * 
 * Displays cache statistics including cache type, hit rate, and memory usage.
 * Wrapped in React.memo() to prevent unnecessary re-renders.
 * 
 * Requirements: 3.4, 8.2
 */

import { memo } from 'react'

interface CacheStats {
  type: string
  entries?: number
  timestamps?: number
  connected_clients?: number
  used_memory?: string
  keyspace_hits?: number
  keyspace_misses?: number
  hit_rate?: number
  error?: string
}

interface CacheStatsCardProps {
  cacheStats: CacheStats | null
  translations: {
    cacheStatistics: string
    cacheType: string
    hitRate: string
    memoryUsed: string
    cacheEntries: string
    timestamps: string
  }
}

function CacheStatsCard({ cacheStats, translations }: CacheStatsCardProps) {
  if (!cacheStats) {
    return null
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
        {translations.cacheStatistics}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {cacheStats?.type?.toUpperCase() || 'UNKNOWN'}
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-400">{translations.cacheType}</div>
        </div>
        
        {cacheStats?.type === 'redis' ? (
          <>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {cacheStats?.hit_rate || 0}%
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{translations.hitRate}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {cacheStats?.used_memory || 'N/A'}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{translations.memoryUsed}</div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {cacheStats?.entries || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{translations.cacheEntries}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {cacheStats?.timestamps || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{translations.timestamps}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Wrap in React.memo() to prevent unnecessary re-renders
export default memo(CacheStatsCard)
