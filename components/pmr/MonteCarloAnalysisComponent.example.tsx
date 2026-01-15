/**
 * Example usage of MonteCarloAnalysisComponent
 * 
 * This file demonstrates how to integrate the Monte Carlo Analysis Component
 * into a PMR report page with proper API integration and state management.
 */

'use client'

import React, { useState, useCallback } from 'react'
import { MonteCarloAnalysisComponent } from './index'
import { MonteCarloResults } from './types'
import { getApiUrl } from '@/lib/api/client'

interface MonteCarloParams {
  iterations: number
  confidence_level: number
  analysis_types: ('budget' | 'schedule' | 'resource')[]
  budget_uncertainty?: number
  schedule_uncertainty?: number
  resource_availability?: number
}

interface MonteCarloExampleProps {
  reportId: string
  projectId: string
  session: any
}

export default function MonteCarloAnalysisExample({
  reportId,
  projectId,
  session
}: MonteCarloExampleProps) {
  const [simulationResults, setSimulationResults] = useState<MonteCarloResults>()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock project data - in real implementation, fetch from API
  const projectData = {
    baseline_budget: 1000000,
    current_spend: 450000,
    baseline_duration: 180,
    elapsed_time: 90,
    resource_allocations: []
  }

  /**
   * Run Monte Carlo simulation via API
   */
  const handleRunSimulation = useCallback(async (params: MonteCarloParams): Promise<MonteCarloResults> => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch(
        getApiUrl(`/reports/pmr/${reportId}/monte-carlo`),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project_id: projectId,
            ...params
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Simulation failed: ${response.status}`)
      }

      const results = await response.json()
      setSimulationResults(results)
      return results

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run simulation'
      setError(errorMessage)
      throw err
    } finally {
      setIsRunning(false)
    }
  }, [reportId, projectId, session])

  /**
   * Export simulation results
   */
  const handleExportResults = useCallback(async (format: 'csv' | 'json' | 'pdf') => {
    if (!simulationResults) return

    try {
      const response = await fetch(
        getApiUrl(`/reports/pmr/${reportId}/monte-carlo/export`),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            format,
            results: simulationResults
          })
        }
      )

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`)
      }

      // Handle file download
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `monte-carlo-results-${reportId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Failed to export results')
    }
  }, [reportId, simulationResults, session])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Monte Carlo Risk Analysis</h1>
        <p className="text-gray-600 mt-2">
          Project: {projectId} | Report: {reportId}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <MonteCarloAnalysisComponent
        reportId={reportId}
        projectId={projectId}
        projectData={projectData}
        onRunSimulation={handleRunSimulation}
        onExportResults={handleExportResults}
        simulationResults={simulationResults}
        isRunning={isRunning}
        session={session}
      />

      {/* Additional context or help */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">About Monte Carlo Analysis</h3>
        <p className="text-blue-800 text-sm">
          Monte Carlo simulation uses random sampling to model the probability of different outcomes
          in a process that cannot easily be predicted due to the intervention of random variables.
          This analysis helps quantify project risks and provides probabilistic forecasts for budget,
          schedule, and resource outcomes.
        </p>
      </div>
    </div>
  )
}

/**
 * Alternative: Simplified usage with minimal configuration
 */
export function SimpleMonteCarloExample({
  reportId,
  projectId,
  session
}: MonteCarloExampleProps) {
  const [results, setResults] = useState<MonteCarloResults>()

  const runSimulation = async (params: MonteCarloParams) => {
    // Simplified API call
    const response = await fetch(`/api/monte-carlo/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(params)
    })
    const data = await response.json()
    setResults(data)
    return data
  }

  return (
    <MonteCarloAnalysisComponent
      reportId={reportId}
      projectId={projectId}
      projectData={{
        baseline_budget: 1000000,
        current_spend: 450000,
        baseline_duration: 180,
        elapsed_time: 90
      }}
      onRunSimulation={runSimulation}
      simulationResults={results}
      session={session}
    />
  )
}

/**
 * Advanced: With scenario management and comparison
 */
export function AdvancedMonteCarloExample({
  reportId,
  projectId,
  session
}: MonteCarloExampleProps) {
  const [results, setResults] = useState<MonteCarloResults>()
  const [savedScenarios, setSavedScenarios] = useState<any[]>([])

  const runSimulation = async (params: MonteCarloParams) => {
    const response = await fetch(`/api/monte-carlo/${projectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })
    const data = await response.json()
    setResults(data)
    return data
  }

  const exportResults = async (format: 'csv' | 'json' | 'pdf') => {
    // Custom export with additional metadata
    const exportData = {
      results,
      scenarios: savedScenarios,
      metadata: {
        reportId,
        projectId,
        exportedAt: new Date().toISOString(),
        exportedBy: session?.user?.email
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `monte-carlo-export-${Date.now()}.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <MonteCarloAnalysisComponent
        reportId={reportId}
        projectId={projectId}
        projectData={{
          baseline_budget: 1000000,
          current_spend: 450000,
          baseline_duration: 180,
          elapsed_time: 90
        }}
        onRunSimulation={runSimulation}
        onExportResults={exportResults}
        simulationResults={results}
        session={session}
      />

      {/* Additional analysis tools */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Scenario History</h3>
        <div className="space-y-2">
          {savedScenarios.map((scenario, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">{scenario.name}</span>
              <span className="text-xs text-gray-500">
                {new Date(scenario.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
