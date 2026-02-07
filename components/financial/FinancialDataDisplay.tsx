'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import type { PermissionContext } from '@/types/rbac'

/**
 * Props for FinancialDataDisplay component
 */
export interface FinancialDataDisplayProps {
  /**
   * Raw financial data to display
   */
  data: Record<string, any>

  /**
   * Optional context for scoped filtering
   */
  context?: PermissionContext

  /**
   * Whether to show access level indicator
   */
  showAccessIndicator?: boolean

  /**
   * Custom className for styling
   */
  className?: string

  /**
   * Callback when filtered data is loaded
   */
  onDataFiltered?: (filteredData: Record<string, any>, accessLevel: string) => void
}

/**
 * FinancialDataDisplay Component
 * 
 * Automatically filters financial data based on user's access level.
 * 
 * For viewers (summary access):
 * - Shows: totals, aggregates, high-level metrics
 * - Hides: detailed line items, sensitive cost breakdowns
 * 
 * For non-viewers (full access):
 * - Shows: all financial data
 * 
 * Requirements: 6.3 - Financial data access filtering
 * 
 * @example
 * <FinancialDataDisplay 
 *   data={projectFinancials}
 *   context={{ project_id: projectId }}
 *   showAccessIndicator={true}
 * />
 */
export const FinancialDataDisplay: React.FC<FinancialDataDisplayProps> = ({
  data,
  context,
  showAccessIndicator = false,
  className = '',
  onDataFiltered,
}) => {
  const { session, user } = useAuth()
  const [filteredData, setFilteredData] = useState<Record<string, any> | null>(null)
  const [accessLevel, setAccessLevel] = useState<string>('none')
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const filterData = async () => {
      if (!user || !session) {
        setFilteredData({})
        setAccessLevel('none')
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const contextParam = context 
          ? `?context=${encodeURIComponent(JSON.stringify(context))}`
          : ''
        const accessResponse = await fetch(
          getApiUrl(`/api/rbac/financial-access-level${contextParam}`),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!accessResponse.ok) {
          console.warn('Failed to get financial access level:', accessResponse.status)
          setFilteredData({})
          setAccessLevel('none')
          return
        }

        const accessData = await accessResponse.json()
        setAccessLevel(accessData.access_level)

        // If no access, return empty
        if (accessData.access_level === 'none') {
          setFilteredData({})
          return
        }

        // If full access, use original data
        if (accessData.access_level === 'full') {
          setFilteredData(data)
          if (onDataFiltered) {
            onDataFiltered(data, 'full')
          }
          return
        }

        // For summary access, filter the data
        const filterResponse = await fetch(
          `${apiUrl}/api/rbac/filter-financial-data${contextParam}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          }
        )

        if (!filterResponse.ok) {
          console.warn('Failed to filter financial data:', filterResponse.status)
          setFilteredData({})
          return
        }

        const filtered = await filterResponse.json()
        setFilteredData(filtered)

        if (onDataFiltered) {
          onDataFiltered(filtered, accessData.access_level)
        }
      } catch (err) {
        console.error('Error filtering financial data:', err)
        setFilteredData({})
        setAccessLevel('none')
      } finally {
        setLoading(false)
      }
    }

    filterData()
  }, [user, session, data, context, onDataFiltered])

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (accessLevel === 'none' || !filteredData) {
    return (
      <div className={`text-gray-500 dark:text-slate-400 italic ${className}`}>
        You do not have permission to view financial data.
      </div>
    )
  }

  return (
    <div className={className}>
      {showAccessIndicator && accessLevel === 'summary' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 text-blue-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-blue-800 dark:text-blue-300">
              Showing summary financial data. Detailed breakdowns are not available.
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Display filtered financial data */}
        {Object.entries(filteredData).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300 capitalize">
              {key.replace(/_/g, ' ')}:
            </span>
            <span className="text-sm text-gray-900 dark:text-slate-100">
              {typeof value === 'number' 
                ? value.toLocaleString('en-US', { 
                    style: key.includes('currency') ? 'currency' : 'decimal',
                    currency: filteredData.currency || 'USD'
                  })
                : String(value)
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Hook for programmatic financial data filtering
 * 
 * Requirements: 6.3 - Financial data access filtering
 * 
 * @example
 * const { filterData, accessLevel, loading } = useFinancialDataFilter()
 * 
 * const filtered = await filterData(rawFinancialData, { project_id: projectId })
 */
export function useFinancialDataFilter() {
  const { session, user } = useAuth()

  const filterData = async (
    data: Record<string, any>,
    context?: PermissionContext
  ): Promise<{ filtered: Record<string, any>; accessLevel: string }> => {
    if (!user || !session) {
      return { filtered: {}, accessLevel: 'none' }
    }

    try {
      const contextParam = context 
        ? `?context=${encodeURIComponent(JSON.stringify(context))}`
        : ''
      const accessResponse = await fetch(
        getApiUrl(`/api/rbac/financial-access-level${contextParam}`),
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!accessResponse.ok) {
        return { filtered: {}, accessLevel: 'none' }
      }

      const accessData = await accessResponse.json()

      if (accessData.access_level === 'none') {
        return { filtered: {}, accessLevel: 'none' }
      }

      if (accessData.access_level === 'full') {
        return { filtered: data, accessLevel: 'full' }
      }

      // Filter for summary access
      const filterResponse = await fetch(
        `${apiUrl}/api/rbac/filter-financial-data${contextParam}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      )

      if (!filterResponse.ok) {
        return { filtered: {}, accessLevel: 'summary' }
      }

      const filtered = await filterResponse.json()
      return { filtered, accessLevel: 'summary' }
    } catch (err) {
      console.error('Error filtering financial data:', err)
      return { filtered: {}, accessLevel: 'none' }
    }
  }

  return { filterData }
}

export default FinancialDataDisplay
