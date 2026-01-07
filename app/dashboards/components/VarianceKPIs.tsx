'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'

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
}

export default function VarianceKPIs({ session, selectedCurrency = 'USD' }: VarianceKPIsProps) {
  const [varianceData, setVarianceData] = useState<VarianceKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('VarianceKPIs useEffect - session:', session?.access_token ? 'present' : 'missing')
    if (session) {
      fetchVarianceKPIs()
    }
  }, [session, selectedCurrency])

  const fetchVarianceKPIs = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(getApiUrl('/csv-import/variances'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Variance API error:', response.status, errorText)
        throw new Error(`Failed to fetch variance data (${response.status}): ${errorText}`)
      }
      
      const data = await response.json()
      console.log('Variance API response:', data)
      const variances = data.variances || []
      
      if (variances.length === 0) {
        setVarianceData(null)
        return
      }
      
      // Calculate KPIs from variance data
      const totalCommitments = variances.reduce((sum: number, v: any) => sum + v.total_commitment, 0)
      const totalActuals = variances.reduce((sum: number, v: any) => sum + v.total_actual, 0)
      const totalVariance = totalActuals - totalCommitments
      const variancePercentage = totalCommitments > 0 ? (totalVariance / totalCommitments * 100) : 0
      
      const projectsOverBudget = variances.filter((v: any) => v.status === 'over').length
      const projectsUnderBudget = variances.filter((v: any) => v.status === 'under').length
      
      setVarianceData({
        total_variance: totalVariance,
        variance_percentage: variancePercentage,
        projects_over_budget: projectsOverBudget,
        projects_under_budget: projectsUnderBudget,
        total_commitments: totalCommitments,
        total_actuals: totalActuals,
        currency: selectedCurrency
      })
      
    } catch (error: unknown) {
      console.error('Error fetching variance KPIs:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch variance data')
      setVarianceData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
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
    <div className="space-y-4">
      {/* Variance Alert Banner */}
      {varianceData.projects_over_budget > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-sm text-red-800">
              <strong>{varianceData.projects_over_budget}</strong> project{varianceData.projects_over_budget !== 1 ? 's' : ''} over budget
            </span>
          </div>
        </div>
      )}

      {/* Variance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Variance</p>
              <p className={`text-xl sm:text-2xl font-bold ${
                varianceData.total_variance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}
              >
                {varianceData.total_variance >= 0 ? '+' : ''}
                {varianceData.total_variance.toLocaleString()} {varianceData.currency}
              </p>
            </div>
            {varianceData.total_variance >= 0 ? 
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" /> : 
              <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            }
          </div>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Variance %</p>
              <p className={`text-xl sm:text-2xl font-bold ${
                varianceData.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'
              }`}
              >
                {varianceData.variance_percentage >= 0 ? '+' : ''}
                {varianceData.variance_percentage.toFixed(1)}%
              </p>
            </div>
            <Target className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Over Budget</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">
                {varianceData.projects_over_budget}
              </p>
            </div>
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Under Budget</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {varianceData.projects_under_budget}
              </p>
            </div>
            <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Commitments vs Actuals Summary */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Commitments vs Actuals Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {varianceData.total_commitments.toLocaleString()} {varianceData.currency}
            </div>
            <div className="text-sm text-gray-600">Total Commitments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {varianceData.total_actuals.toLocaleString()} {varianceData.currency}
            </div>
            <div className="text-sm text-gray-600">Total Actuals</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              varianceData.total_variance >= 0 ? 'text-red-600' : 'text-green-600'
            }`}
            >
              {varianceData.total_variance >= 0 ? '+' : ''}
              {varianceData.total_variance.toLocaleString()} {varianceData.currency}
            </div>
            <div className="text-sm text-gray-600">Net Variance</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Spending Progress</span>
            <span>{((varianceData.total_actuals / Math.max(varianceData.total_commitments, 1)) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                varianceData.total_actuals > varianceData.total_commitments ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min(100, (varianceData.total_actuals / Math.max(varianceData.total_commitments, 1)) * 100)}%` 
              }}
            >
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}