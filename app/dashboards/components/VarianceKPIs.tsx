'use client'

import { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle, Target, Upload } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'
import { useTranslations } from '../../../lib/i18n/context'
import { resilientFetch } from '@/lib/api/resilient-fetch'
import { usePermissions } from '@/app/providers/EnhancedAuthProvider'

interface VarianceKPIs {
  total_variance: number
  variance_percentage: number
  projects_over_budget: number
  projects_under_budget: number
  total_commitments: number
  total_actuals: number
  currency: string
}

interface VarianceKPIsProps {
  session: any
  selectedCurrency?: string
  showDetailedMetrics?: boolean
  allowEdit?: boolean
}

/** Format a currency value compactly: M for millions, k for thousands (e.g. -31.96M, 123k). */
function formatCompactCurrency(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = n / 1_000_000
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)) + 'M'
  }
  if (abs >= 1_000) {
    const k = n / 1_000
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k'
  }
  return String(Math.round(n))
}

function VarianceKPIs({ session, selectedCurrency = 'USD', showDetailedMetrics, allowEdit }: VarianceKPIsProps) {
  const { t } = useTranslations()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const [varianceData, setVarianceData] = useState<VarianceKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Determine permissions - use props if provided, otherwise check permissions
  const canViewFinancials = showDetailedMetrics !== undefined 
    ? showDetailedMetrics 
    : hasPermission('financial_read')
  
  const canEditFinancials = allowEdit !== undefined 
    ? allowEdit 
    : hasPermission('financial_update')

  useEffect(() => {
    console.log('VarianceKPIs useEffect - session:', session?.access_token ? 'present' : 'missing')
    if (session) {
      // Defer to avoid blocking main thread during initial render
      const timeoutId = setTimeout(() => {
        fetchVarianceKPIs()
      }, 50)
      
      return () => clearTimeout(timeoutId)
    }
  }, [session, selectedCurrency])

  const fetchVarianceKPIs = async () => {
    if (!session?.access_token) {
      console.log('No session token, skipping variance fetch')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Fetch commitments and actuals directly instead of pre-calculated variances
      const [commitmentsRes, actualsRes] = await Promise.all([
        resilientFetch<{ commitments: any[] }>(
          getApiUrl('/csv-import/commitments?limit=10000&count_exact=false'),
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
            retries: 1,
            fallbackData: { commitments: [] },
            silentFail: true,
          }
        ),
        resilientFetch<{ actuals: any[] }>(
          getApiUrl('/csv-import/actuals?limit=10000&count_exact=false'),
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
            retries: 1,
            fallbackData: { actuals: [] },
            silentFail: true,
          }
        )
      ])
      
      const commitments = commitmentsRes.data?.commitments || []
      const actuals = actualsRes.data?.actuals || []
      
      if (commitments.length === 0 && actuals.length === 0) {
        setVarianceData(null)
        setLoading(false)
        return
      }
      
      // Calculate totals
      const totalCommitments = commitments.reduce((sum: number, c: any) => 
        sum + (c.total_amount || 0), 0
      )
      
      const totalActuals = actuals.reduce((sum: number, a: any) => 
        sum + (a.invoice_amount || a.amount || 0), 0
      )
      
      // Group by project to calculate over/under budget
      const projectSpend = new Map<string, { commitments: number; actuals: number }>()
      
      commitments.forEach((c: any) => {
        const projectKey = c.project_nr || c.project || 'Unknown'
        const existing = projectSpend.get(projectKey) || { commitments: 0, actuals: 0 }
        existing.commitments += c.total_amount || 0
        projectSpend.set(projectKey, existing)
      })
      
      actuals.forEach((a: any) => {
        const projectKey = a.project_nr || a.project || 'Unknown'
        const existing = projectSpend.get(projectKey) || { commitments: 0, actuals: 0 }
        existing.actuals += a.invoice_amount || a.amount || 0
        projectSpend.set(projectKey, existing)
      })
      
      // Count projects over/under budget
      let projectsOverBudget = 0
      let projectsUnderBudget = 0
      
      projectSpend.forEach((data) => {
        if (data.actuals > data.commitments) {
          projectsOverBudget++
        } else if (data.actuals < data.commitments) {
          projectsUnderBudget++
        }
      })
      
      const totalVariance = totalActuals - totalCommitments
      const variancePercentage = totalCommitments > 0 ? (totalVariance / totalCommitments * 100) : 0
      
      setVarianceData({
        total_variance: totalVariance,
        variance_percentage: variancePercentage,
        projects_over_budget: projectsOverBudget,
        projects_under_budget: projectsUnderBudget,
        total_commitments: totalCommitments,
        total_actuals: totalActuals,
        currency: selectedCurrency
      })
    } catch (err) {
      console.error('Error calculating variance KPIs:', err)
      setVarianceData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading || permissionsLoading) {
    return (
      <div data-testid="variance-kpis-skeleton" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 h-full flex flex-col" style={{ minHeight: '240px' }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded w-3/4 mb-3"></div>
                <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !varianceData) {
    return (
      <div data-testid="variance-kpis-error" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 h-full flex flex-col" style={{ minHeight: '240px' }}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 uppercase tracking-wide">{t('variance.kpis')}</h3>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3 w-full">
            <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {error
                  ? t('variance.dataUnavailable', { error })
                  : `${t('variance.noData')} ${t('variance.importCsvToSee')}`}
              </p>
              <Link
                href="/financials?tab=csv-import"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {t('variance.importCsv')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="variance-kpis" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 h-full flex flex-col" style={{ minHeight: '240px' }}>
      {/* Header */}
      <div data-testid="variance-kpis-header" className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide">{t('variance.kpis')}</h3>
        {varianceData.projects_over_budget > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-full">
            <AlertTriangle className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
            <span className="text-xs font-medium text-gray-900 dark:text-red-300">
              {varianceData.projects_over_budget} {t('financials.overBudget')}
            </span>
          </div>
        )}
      </div>

      {/* KPI Grid - 2x2 layout */}
      <div data-testid="variance-kpis-grid" className="grid grid-cols-2 gap-2 flex-1">
        {canViewFinancials ? (
          <>
            <div data-testid="variance-kpis-net-variance" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 p-2 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{t('variance.netVariance')}</p>
                {varianceData.total_variance >= 0 ?
                  <TrendingUp className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> :
                  <TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                }
              </div>
              <p className={`text-lg font-bold ${
                varianceData.total_variance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {varianceData.total_variance >= 0 ? '+' : ''}
                {formatCompactCurrency(varianceData.total_variance)}
              </p>
            </div>
            
            <div data-testid="variance-kpis-variance-percent" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 p-2 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{t('financials.variance')} %</p>
                <Target className="h-3.5 w-3.5 text-gray-700 dark:text-slate-300" />
              </div>
              <p className={`text-lg font-bold ${
                varianceData.variance_percentage >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {varianceData.variance_percentage >= 0 ? '+' : ''}
                {varianceData.variance_percentage.toFixed(1)}%
              </p>
            </div>
            
            <div data-testid="variance-kpis-over-budget" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 p-2 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{t('financials.overBudget')}</p>
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {varianceData.projects_over_budget}
              </p>
            </div>
            
            <div data-testid="variance-kpis-under-budget" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 p-2 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{t('financials.underBudget')}</p>
                <TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {varianceData.projects_under_budget}
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 p-4 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-700 dark:text-slate-300">Financial details restricted</p>
          </div>
        )}
      </div>

      {/* Commitments vs Actuals - Compact */}
      {canViewFinancials && (
        <div data-testid="variance-kpis-commitments-actuals" className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-700 dark:text-slate-200">{t('variance.totalCommitments')}: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCompactCurrency(varianceData.total_commitments)}</span></span>
            <span className="text-gray-700 dark:text-slate-200">{t('variance.totalActuals')}: <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCompactCurrency(varianceData.total_actuals)}</span></span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${
                varianceData.total_actuals > varianceData.total_commitments ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min(100, (varianceData.total_actuals / Math.max(varianceData.total_commitments, 1)) * 100)}%`
              }}
            />
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-gray-700 dark:text-slate-300">
              {((varianceData.total_actuals / Math.max(varianceData.total_commitments, 1)) * 100).toFixed(0)}% spent
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if session token or currency changes
const arePropsEqual = (prevProps: VarianceKPIsProps, nextProps: VarianceKPIsProps) => {
  return (
    prevProps.session?.access_token === nextProps.session?.access_token &&
    prevProps.selectedCurrency === nextProps.selectedCurrency
  )
}

export default memo(VarianceKPIs, arePropsEqual)