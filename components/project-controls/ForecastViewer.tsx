'use client'

import { useState, useEffect } from 'react'
import { projectControlsApi } from '@/lib/project-controls-api'
import ForecastChart from './ForecastChart'
import ScenarioComparison from './ScenarioComparison'

interface ForecastViewerProps {
  projectId: string
}

export default function ForecastViewer({ projectId }: ForecastViewerProps) {
  const [forecast, setForecast] = useState<Record<string, unknown>[]>([])
  const [scenarios, setScenarios] = useState<Record<string, Array<{ forecast_date: string; forecasted_cost: number }>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [monthly, scen] = await Promise.all([
          projectControlsApi.getMonthlyForecast(projectId),
          projectControlsApi.getScenarioForecasts(projectId).catch(() => ({})),
        ])
        setForecast(Array.isArray(monthly) ? monthly : [])
        setScenarios(typeof scen === 'object' ? scen : {})
      } catch {
        setForecast([])
        setScenarios({})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) return <div className="p-4">Loading...</div>
  if (!forecast.length) return <div className="p-4 text-gray-500">No forecast data</div>

  const chartData = forecast.map((m) => ({
    forecast_date: String(m.forecast_date ?? ''),
    forecasted_cost: (m.forecasted_cost as number) ?? 0,
  }))
  const scenarioItems = Object.entries(scenarios).map(([name, arr]) => ({
    scenario: name,
    total: Array.isArray(arr) ? arr.reduce((s, a) => s + (Number((a as { forecasted_cost?: number }).forecasted_cost) || 0), 0) : 0,
  }))

  return (
    <div className="p-4 bg-white rounded-lg border space-y-4">
      <h3 className="font-semibold">Monthly Forecast</h3>
      <ForecastChart data={chartData} />
      {scenarioItems.length > 0 && (
        <>
          <h4 className="text-sm font-medium text-gray-700">Scenario Comparison</h4>
          <ScenarioComparison scenarios={scenarioItems} />
        </>
      )}
    </div>
  )
}
