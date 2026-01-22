'use client'

import { useState, useEffect, memo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'
import { useTranslations } from '../../../lib/i18n/context'
import { resilientFetch } from '@/lib/api/resilient-fetch'
import { usePermissions } from '@/hooks/usePermissions'

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
      fetchVarianceKPIs()
    }
  }, [session, selectedCurrency])

  const fetchVarianceKPIs = async () => {
    if (!session?.access_token) {
      console.log('No session token, skipping variance fetch')
      return
    }
    
    setLoading(true)
    setError(null)
    
    const result = await resilientFetch<{ variances: any[] }>(
      getApiUrl('/csv-import/variances'),
      {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        retries: 1,
        fallbackData: { variances: [] },
        silentFail: true,
      }
    )
    
    if (!result.data || result.data.variances.length === 0) {
      setVarianceData(null)
      setLoading(false)
      return
    }
    
    const variances = result.data.variances
    
    // Calculate KPIs from variance data
    const totalCommitments = variances?.reduce((sum: number, v: any) => sum + (v?.total_commitment || 0), 0) || 0
    const totalActuals = variances?.reduce((sum: number, v: any) => sum + (v?.total_actual || 0), 0) || 0
    const totalVariance = totalActuals - totalCommitments
    const variancePercentage = totalCommitments > 0 ? (totalVariance / totalCommitments * 100) : 0
    
    const projectsOverBudget = variances?.filter((v: any) => v?.status === 'over')?.length || 0
    const projectsUnderBudget = variances?.filter((v: any) => v?.status === 'under')?.length || 0
    
    setVarianceData({
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      projects_over_budget: projectsOverBudget,
      projects_under_budget: projectsUnderBudget,
      total_commitments: totalCommitments,
      total_actuals: totalActuals,
      currency: selectedCurrency
    })
    
    setLoading(false)
  }

  if (loading || permissionsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !varianceData) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <Target className="h-5 w-5 text-blue-600 mr-2" />
          <span className="text-sm text-blue-800">
            {error ? `Variance data unavailable: ${error}` : 'No variance data available. Import CSV files to see variance analysis.'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 h-full flex flex-col">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[8px] font-semibold text-gray-900 uppercase tracking-wide">{t('variance.kpis')}</h3>
        {varianceData.projects_over_budget > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded-full">
            <AlertTriangle className="h-2 w-2 text-red-600" />
            <span className="text-[8px] font-medium text-red-800">
              {varianceData.projects_over_budget} {t('financials.overBudget')}
            </span>
          </div>
        )}
      </div>

      {/* Ultra-Compact KPI Grid - 4 columns, 2 rows, readable text */}
      <div className="grid grid-cols-4 gap-1 flex-1">
        {/* Show detailed metrics only if user has financial_read permission */}
        {canViewFinancials ? (
          <>
            <div className="bg-gray-50 p-1 rounded">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-medium text-gray-600 leading-tight">{t('variance.netVariance')}</p>
                {varianceData.total_variance >= 0 ? 
                  <TrendingUp className="h-2 w-2 text-red-600" /> : 
                  <TrendingDown className="h-2 w-2 text-green-600" />
                }
              </div>
              <p className={`text-xs font-bold leading-tight ${
                varianceData.total_variance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {varianceData.total_variance >= 0 ? '+' : ''}
                {(varianceData.total_variance / 1000).toFixed(0)}k
              </p>
            </div>
            
            <div className="bg-gray-50 p-1 rounded">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-medium text-gray-600 leading-tight">{t('financials.variance')} %</p>
                <Target className="h-2 w-2 text-gray-600" />
              </div>
              <p className={`text-xs font-bold leading-tight ${
                varianceData.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {varianceData.variance_percentage >= 0 ? '+' : ''}
                {varianceData.variance_percentage.toFixed(1)}%
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-gray-50 p-1 rounded flex items-center justify-center">
            <p className="text-xs text-gray-500">Financial details restricted</p>
          </div>
        )}
        
        <div className="bg-gray-50 p-1 rounded">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-medium text-gray-600 leading-tight">{t('financials.overBudget')}</p>
            <AlertTriangle className="h-2 w-2 text-red-600" />
          </div>
          <p className="text-xs font-bold leading-tight text-red-600">
            {varianceData.projects_over_budget}
          </p>
        </div>
        
        <div className="bg-gray-50 p-1 rounded">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-medium text-gray-600 leading-tight">{t('financials.underBudget')}</p>
            <TrendingDown className="h-2 w-2 text-green-600" />
          </div>
          <p className="text-xs font-bold leading-tight text-green-600">
            {varianceData.projects_under_budget}
          </p>
        </div>

        {canViewFinancials ? (
          <>
            <div className="bg-gray-50 p-1 rounded">
              <p className="text-xs font-medium text-gray-600 mb-0.5 leading-tight">{t('variance.totalCommitments')}</p>
              <p className="text-xs font-bold leading-tight text-blue-600">
                {(varianceData.total_commitments / 1000).toFixed(0)}k
              </p>
            </div>

            <div className="bg-gray-50 p-1 rounded">
              <p className="text-xs font-medium text-gray-600 mb-0.5 leading-tight">{t('variance.totalActuals')}</p>
              <p className="text-xs font-bold leading-tight text-purple-600">
                {(varianceData.total_actuals / 1000).toFixed(0)}k
              </p>
            </div>

            <div className="bg-gray-50 p-1 rounded">
              <p className="text-xs font-medium text-gray-600 mb-0.5 leading-tight">{t('variance.netVariance')}</p>
              <p className={`text-xs font-bold leading-tight ${
                varianceData.total_variance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {varianceData.total_variance >= 0 ? '+' : ''}
                {(varianceData.total_variance / 1000).toFixed(0)}k
              </p>
            </div>

            <div className="bg-gray-50 p-1 rounded">
              <p className="text-xs font-medium text-gray-600 mb-0.5 leading-tight">{t('financials.utilization')}</p>
              <p className="text-xs font-bold leading-tight text-gray-900">
                {((varianceData.total_actuals / Math.max(varianceData.total_commitments, 1)) * 100).toFixed(0)}%
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-4 bg-gray-50 p-2 rounded flex items-center justify-center">
            <p className="text-xs text-gray-500">Detailed financial metrics require financial_read permission</p>
          </div>
        )}
      </div>
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