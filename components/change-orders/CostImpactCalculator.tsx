'use client'

import { useState, useEffect } from 'react'
import { changeOrdersApi, type CostImpactAnalysis, type CostScenario } from '@/lib/change-orders-api'
import CostBreakdownChart from './CostBreakdownChart'
import ScenarioComparison from './ScenarioComparison'
import { Sparkles } from 'lucide-react'

interface CostImpactCalculatorProps {
  changeOrderId: string
  onAnalysisComplete?: (analysis: CostImpactAnalysis) => void
}

export default function CostImpactCalculator({ changeOrderId, onAnalysisComplete }: CostImpactCalculatorProps) {
  const [analysis, setAnalysis] = useState<CostImpactAnalysis | null>(null)
  const [scenarios, setScenarios] = useState<CostScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiEstimate, setAiEstimate] = useState<{
    estimated_min: number
    estimated_max: number
    confidence: number
    notes?: string[]
  } | null>(null)
  const [aiEstimateLoading, setAiEstimateLoading] = useState(false)

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

  const handleGetAIEstimate = async () => {
    setAiEstimateLoading(true)
    setAiEstimate(null)
    try {
      const detail = await changeOrdersApi.get(changeOrderId)
      const res = await changeOrdersApi.aiEstimate({
        description: detail.description,
        line_items: (detail.line_items || []).map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_rate: li.unit_rate,
          cost_category: li.cost_category,
        })),
        change_category: detail.change_category,
      })
      setAiEstimate({
        estimated_min: res.estimated_min,
        estimated_max: res.estimated_max,
        confidence: res.confidence,
        notes: res.notes,
      })
    } catch {
      setAiEstimate(null)
    } finally {
      setAiEstimateLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* AI estimate (rule-based hint) */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          AI cost estimate
        </h4>
        {!aiEstimate ? (
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
            Get a rule-based cost range from this change order&apos;s description and line items.
          </p>
        ) : (
          <div className="mb-2">
            <p className="text-sm text-gray-800 dark:text-slate-200">
              Range: ${aiEstimate.estimated_min.toLocaleString()} – ${aiEstimate.estimated_max.toLocaleString()} (confidence {(aiEstimate.confidence * 100).toFixed(0)}%)
            </p>
            {aiEstimate.notes?.length ? (
              <ul className="text-xs text-gray-500 dark:text-slate-400 mt-1 list-disc list-inside">
                {aiEstimate.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <button
          type="button"
          onClick={handleGetAIEstimate}
          disabled={aiEstimateLoading}
          className="text-sm px-3 py-1.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-50"
        >
          {aiEstimateLoading ? 'Loading…' : aiEstimate ? 'Refresh estimate' : 'Get AI estimate'}
        </button>
      </div>

      {analysis ? (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Cost Breakdown</h4>
          <CostBreakdownChart
            directCosts={analysis.direct_costs || {}}
            indirectCosts={analysis.indirect_costs}
            total={analysis.total_cost_impact}
          />
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            Pricing: {analysis.pricing_method} • Confidence: {(analysis.confidence_level * 100).toFixed(0)}%
          </p>
        </div>
      ) : scenarios.length === 0 ? (
        <p className="p-4 text-gray-500 dark:text-slate-400 text-sm rounded-lg border">
          No cost analysis available. Create one via the cost analysis API.
        </p>
      ) : null}
      {scenarios.length > 0 && <ScenarioComparison scenarios={scenarios} />}
    </div>
  )
}
