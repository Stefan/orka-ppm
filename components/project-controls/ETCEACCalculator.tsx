'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import CalculationMethodSelector from './CalculationMethodSelector'
import ApprovalWorkflow from './ApprovalWorkflow'

const ETC_OPTIONS = [
  { value: 'bottom_up', label: 'Bottom-up' },
  { value: 'performance_based', label: 'Performance-based' },
  { value: 'parametric', label: 'Parametric' },
]
const EAC_OPTIONS = [
  { value: 'current_performance', label: 'Current Performance' },
  { value: 'budget_performance', label: 'Budget Performance' },
  { value: 'management_forecast', label: 'Management Forecast' },
]

interface ETCEACCalculatorProps {
  projectId: string
}

export default function ETCEACCalculator({ projectId }: ETCEACCalculatorProps) {
  const [etcMethod, setEtcMethod] = useState('bottom_up')
  const [eacMethod, setEacMethod] = useState('current_performance')
  const [etc, setEtc] = useState<Record<string, unknown> | null>(null)
  const [eac, setEac] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [e1, e2] = await Promise.all([
        projectControlsApi.getETC(projectId, etcMethod),
        projectControlsApi.getEAC(projectId, eacMethod),
      ])
      setEtc(e1)
      setEac(e2)
    } catch (e) {
      setEtc(null)
      setEac(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, etcMethod, eacMethod])

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <h3 className="font-semibold">ETC / EAC Calculator</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <CalculationMethodSelector
            label="ETC Method"
            value={etcMethod}
            onChange={setEtcMethod}
            options={ETC_OPTIONS}
            disabled={loading}
          />
          {loading ? (
            <div className="mt-2 text-sm text-gray-500">Loading...</div>
          ) : etc ? (
            <div className="mt-2 p-2 bg-gray-50 rounded">
              <p className="font-medium">ETC: ${(etc.result_value as number)?.toLocaleString() ?? '-'}</p>
              <p className="text-xs text-gray-500">Confidence: {((etc.confidence_level as number) ?? 0) * 100}%</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600">No data</p>
          )}
        </div>
        <div>
          <CalculationMethodSelector
            label="EAC Method"
            value={eacMethod}
            onChange={setEacMethod}
            options={EAC_OPTIONS}
            disabled={loading}
          />
          {loading ? (
            <div className="mt-2 text-sm text-gray-500">Loading...</div>
          ) : eac ? (
            <div className="mt-2 p-2 bg-gray-50 rounded">
              <p className="font-medium">EAC: ${(eac.result_value as number)?.toLocaleString() ?? '-'}</p>
              <p className="text-xs text-gray-500">Confidence: {((eac.confidence_level as number) ?? 0) * 100}%</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600">No data</p>
          )}
        </div>
      </div>
      <ApprovalWorkflow status={eac ? 'Calculated' : undefined} />
    </div>
  )
}
