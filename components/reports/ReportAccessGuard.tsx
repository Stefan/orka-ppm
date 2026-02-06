'use client'

import React, { useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import type { PermissionContext } from '@/types/rbac'

/**
 * Props for ReportAccessGuard component
 */
export interface ReportAccessGuardProps {
  /**
   * Type of report being accessed
   */
  reportType: string

  /**
   * The scope of the report (what it covers)
   */
  reportScope?: PermissionContext

  /**
   * The user's organizational context
   */
  userContext?: PermissionContext

  /**
   * Content to render if access is granted
   */
  children: ReactNode

  /**
   * Optional fallback content to render if access is denied
   */
  fallback?: ReactNode

  /**
   * Whether to show loading state
   */
  showLoading?: boolean

  /**
   * Custom className for styling
   */
  className?: string

  /**
   * Callback when access check completes
   */
  onAccessChecked?: (canAccess: boolean, accessLevel: string, denialReason?: string) => void
}

/**
 * ReportAccessGuard Component
 * 
 * Guards report access based on user's organizational scope.
 * 
 * For viewers:
 * - Can access reports within their organizational scope
 * - Cannot access reports outside their scope
 * 
 * For non-viewers:
 * - Can access all reports they have permission for
 * 
 * Requirements: 6.4 - Organizational report access control
 * 
 * @example
 * <ReportAccessGuard 
 *   reportType="financial_summary"
 *   reportScope={{ portfolio_id: portfolioId }}
 *   userContext={{ portfolio_id: userPortfolioId }}
 * >
 *   <FinancialReport />
 * </ReportAccessGuard>
 * 
 * @example
 * // With custom fallback
 * <ReportAccessGuard 
 *   reportType="project_status"
 *   reportScope={{ project_id: projectId }}
 *   fallback={<div>You cannot access this report</div>}
 * >
 *   <ProjectStatusReport />
 * </ReportAccessGuard>
 */
export const ReportAccessGuard: React.FC<ReportAccessGuardProps> = ({
  reportType,
  reportScope,
  userContext,
  children,
  fallback,
  showLoading = true,
  className = '',
  onAccessChecked,
}) => {
  const { session, user } = useAuth()
  const [canAccess, setCanAccess] = useState<boolean>(false)
  const [accessLevel, setAccessLevel] = useState<string>('none')
  const [denialReason, setDenialReason] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !session) {
        setCanAccess(false)
        setAccessLevel('none')
        setDenialReason('User not authenticated')
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

        const response = await fetch(
          `${apiUrl}/api/rbac/check-report-access`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              report_type: reportType,
              report_scope: reportScope,
              user_context: userContext,
            }),
          }
        )

        if (!response.ok) {
          console.warn('Failed to check report access:', response.status)
          setCanAccess(false)
          setAccessLevel('none')
          setDenialReason('Failed to check access')
          return
        }

        const data = await response.json()
        setCanAccess(data.can_access)
        setAccessLevel(data.access_level)
        setDenialReason(data.denial_reason)

        if (onAccessChecked) {
          onAccessChecked(data.can_access, data.access_level, data.denial_reason)
        }
      } catch (err) {
        console.error('Error checking report access:', err)
        setCanAccess(false)
        setAccessLevel('none')
        setDenialReason('Error checking access')
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [user, session, reportType, reportScope, userContext, onAccessChecked])

  if (loading && showLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!canAccess) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 dark:border-yellow-800 rounded-md ${className}`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Report Access Denied
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>{denialReason || 'You do not have permission to access this report.'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {accessLevel === 'organizational' && (
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
              Viewing report within your organizational scope
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Hook for programmatic report access checking
 * 
 * Requirements: 6.4 - Organizational report access control
 * 
 * @example
 * const { checkAccess, loading } = useReportAccess()
 * 
 * const canView = await checkAccess('financial_summary', reportScope, userContext)
 */
export function useReportAccess() {
  const { session, user } = useAuth()

  const checkAccess = async (
    reportType: string,
    reportScope?: PermissionContext,
    userContext?: PermissionContext
  ): Promise<{ canAccess: boolean; accessLevel: string; denialReason?: string }> => {
    if (!user || !session) {
      return {
        canAccess: false,
        accessLevel: 'none',
        denialReason: 'User not authenticated',
      }
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

      const response = await fetch(
        `${apiUrl}/api/rbac/check-report-access`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_type: reportType,
            report_scope: reportScope,
            user_context: userContext,
          }),
        }
      )

      if (!response.ok) {
        return {
          canAccess: false,
          accessLevel: 'none',
          denialReason: 'Failed to check access',
        }
      }

      const data = await response.json()
      return {
        canAccess: data.can_access,
        accessLevel: data.access_level,
        denialReason: data.denial_reason,
      }
    } catch (err) {
      console.error('Error checking report access:', err)
      return {
        canAccess: false,
        accessLevel: 'none',
        denialReason: 'Error checking access',
      }
    }
  }

  return { checkAccess }
}

export default ReportAccessGuard
