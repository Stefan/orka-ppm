'use client'

import { useState, useEffect } from 'react'
import { changeOrdersApi, type CostImpactAnalysis, type CostScenario } from '@/lib/change-orders-api'
import CostBreakdownChart from './CostBreakdownChart'
import ScenarioComparison from './ScenarioComparison'

interface CostImpactCalculatorProps {
  changeOrderId: string
  onAnalysisComplete?: (analysis: CostImpactAnalysis) => void
}

export default function CostImpactCalculator({ changeOrderId, onAnalysisComplete }: CostImpactCalculatorProps) {
  const [analysis, setAnalysis] = useState<CostImpactAnalysis | null>(null)
  const [scenarios, setScenarios] = useState<CostScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [a, s] = await Promise.all([
          changeOrdersApi.getCostAnalysis(changeOrderId).catch(() => null),
          changeOrdersApi.getCostScenarios(changeOrderId).catch(() => []),
        ])
        setAnalysis(a)
        setScenarios(s)
        if (a) onAnalysisComplete?.(a)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load cost analysis')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [changeOrderId, onAnalysisComplete])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
  }

  if (!analysis && scenarios.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm rounded-lg border">
        No cost analysis available. Create one via the cost analysis API.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {analysis && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Breakdown</h4>
          <CostBreakdownChart
            directCosts={analysis.direct_costs || {}}
            indirectCosts={analysis.indirect_costs}
            total={analysis.total_cost_impact}
          />
          <p className="text-xs text-gray-500 mt-2">
            Pricing: {analysis.pricing_method} • Confidence: {(analysis.confidence_level * 100).toFixed(0)}%
          </p>
        </div>
      )}
      {scenarios.length > 0 && <ScenarioComparison scenarios={scenarios} />}
    </div>
  )
}
