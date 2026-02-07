'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import type { PermissionContext } from '@/types/rbac'

/**
 * UI indicators for viewer read-only access
 * 
 * Requirements: 6.5 - Read-only UI indication
 */
export interface ViewerUIIndicators {
  is_read_only: boolean
  disabled_features: string[]
  ui_message: string | null
  show_read_only_badge: boolean
  financial_access_level?: string
}

/**
 * Props for ViewerIndicator component
 */
export interface ViewerIndicatorProps {
  /**
   * Optional context for scoped indicator checking
   */
  context?: PermissionContext

  /**
   * Custom className for styling
   */
  className?: string

  /**
   * Whether to show the badge inline or as a banner
   */
  variant?: 'badge' | 'banner'

  /**
   * Callback when indicators are loaded
   */
  onIndicatorsLoaded?: (indicators: ViewerUIIndicators) => void
}

/**
 * ViewerIndicator Component
 * 
 * Displays visual indicators when a user has read-only (viewer) access.
 * Shows a badge or banner to inform users they cannot make modifications.
 * 
 * Features:
 * - Automatic detection of viewer-only access
 * - Customizable display (badge or banner)
 * - Context-aware indicators
 * - Callback for programmatic access to indicators
 * 
 * Requirements: 6.5 - Read-only UI indication
 * 
 * @example
 * // Basic usage - shows badge if user is viewer
 * <ViewerIndicator />
 * 
 * @example
 * // Banner variant
 * <ViewerIndicator variant="banner" />
 * 
 * @example
 * // Context-aware indicator
 * <ViewerIndicator 
 *   context={{ project_id: projectId }}
 *   onIndicatorsLoaded={(indicators) => {
 *     console.log('Financial access:', indicators.financial_access_level)
 *   }}
 * />
 */
export const ViewerIndicator: React.FC<ViewerIndicatorProps> = ({
  context,
  className = '',
  variant = 'badge',
  onIndicatorsLoaded,
}) => {
  const { session, user } = useAuth()
  const [indicators, setIndicators] = useState<ViewerUIIndicators | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchIndicators = async () => {
      if (!user || !session) {
        setIndicators(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const contextParam = context 
          ? `?context=${encodeURIComponent(JSON.stringify(context))}`
          : ''
        const response = await fetch(
          getApiUrl(`/api/rbac/viewer-indicators${contextParam}`),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.warn('Failed to fetch viewer indicators:', response.status)
          setIndicators(null)
          return
        }

        const data: ViewerUIIndicators = await response.json()
        setIndicators(data)

        if (onIndicatorsLoaded) {
          onIndicatorsLoaded(data)
        }
      } catch (err) {
        console.error('Error fetching viewer indicators:', err)
        setIndicators(null)
      } finally {
        setLoading(false)
      }
    }

    fetchIndicators()
  }, [user, session, context, onIndicatorsLoaded])

  // Don't render anything while loading or if not read-only
  if (loading || !indicators || !indicators.show_read_only_badge) {
    return null
  }

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 ${className}`}
        title={indicators.ui_message || 'Read-only access'}
      >
        <svg
          className="mr-1 h-3 w-3 text-gray-500 dark:text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        Read-only
      </span>
    )
  }

  // Banner variant
  return (
    <div
      className={`rounded-md bg-blue-50 border border-blue-200 dark:border-blue-800 p-4 ${className}`}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Read-only Access
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>{indicators.ui_message || 'You have read-only access to this content'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for programmatic access to viewer indicators
 * 
 * Requirements: 6.5 - Read-only UI indication
 * 
 * @example
 * const { indicators, loading } = useViewerIndicators()
 * 
 * if (indicators?.is_read_only) {
 *   // Disable edit buttons
 * }
 */
export function useViewerIndicators(context?: PermissionContext) {
  const { session, user } = useAuth()
  const [indicators, setIndicators] = useState<ViewerUIIndicators | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchIndicators = async () => {
      if (!user || !session) {
        setIndicators(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const contextParam = context 
          ? `?context=${encodeURIComponent(JSON.stringify(context))}`
          : ''
        const response = await fetch(
          getApiUrl(`/api/rbac/viewer-indicators${contextParam}`),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch viewer indicators: ${response.status}`)
        }

        const data: ViewerUIIndicators = await response.json()
        setIndicators(data)
      } catch (err) {
        console.error('Error fetching viewer indicators:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setIndicators(null)
      } finally {
        setLoading(false)
      }
    }

    fetchIndicators()
  }, [user, session, context])

  return {
    indicators,
    loading,
    error,
    isReadOnly: indicators?.is_read_only || false,
    disabledFeatures: indicators?.disabled_features || [],
  }
}

export default ViewerIndicator
