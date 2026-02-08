/**
 * SlowQueriesTable Component
 * 
 * Displays recent slow queries in a table format.
 * Wrapped in React.memo() to prevent unnecessary re-renders.
 * 
 * Requirements: 3.4, 8.2
 */

import { memo } from 'react'

interface SlowQueryData {
  endpoint: string
  duration: number
  time: string
}

interface SlowQueriesTableProps {
  slowQueriesData: SlowQueryData[]
  translations: {
    recentSlowQueries: string
    endpoint: string
    duration: string
    time: string
    noSlowQueries?: string
  }
}

function SlowQueriesTable({ slowQueriesData, translations }: SlowQueriesTableProps) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
        {translations.recentSlowQueries}
      </h3>
      {slowQueriesData.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-4">
          {translations.noSlowQueries ?? 'No slow queries in threshold (≥1s).'}
        </p>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider w-1/2">
                {translations.endpoint}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                {translations.duration}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                {translations.time}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {slowQueriesData.map((query, index) => (
              <tr key={index}>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-slate-100 break-words max-w-0">
                  <div 
                    className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded cursor-help" 
                    title={query.endpoint}
                  >
                    {query.endpoint}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 font-medium">
                  {query.duration}ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                  {query.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

// Wrap in React.memo() to prevent unnecessary re-renders
export default memo(SlowQueriesTable)
