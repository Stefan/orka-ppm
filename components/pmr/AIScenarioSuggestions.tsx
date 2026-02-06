'use client'

import React, { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { MonteCarloParams } from './MonteCarloAnalysisComponent'

export interface AIScenarioSuggestionItem {
  id: string
  name: string
  description: string
  params: {
    budget_uncertainty?: number
    schedule_uncertainty?: number
    resource_availability?: number
    iterations?: number
    confidence_level?: number
  }
}

export interface AIScenarioSuggestionsProps {
  projectId: string
  onApply: (params: Partial<MonteCarloParams>) => void
  onApplyAndRun: (params: Partial<MonteCarloParams>) => void
  disabled?: boolean
}

export function AIScenarioSuggestions({
  projectId,
  onApply,
  onApplyAndRun,
  disabled = false,
}: AIScenarioSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AIScenarioSuggestionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const fetchSuggestions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/simulations/ai-suggestions`)
      if (!res.ok) throw new Error('Failed to load suggestions')
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading suggestions')
    } finally {
      setLoading(false)
    }
  }

  const toParams = (s: AIScenarioSuggestionItem): Partial<MonteCarloParams> => ({
    budget_uncertainty: s.params.budget_uncertainty,
    schedule_uncertainty: s.params.schedule_uncertainty,
    resource_availability: s.params.resource_availability,
    iterations: s.params.iterations,
    confidence_level: s.params.confidence_level,
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={fetchSuggestions}
        disabled={disabled || loading}
        className="flex items-center px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        AI-Szenarien vorschlagen
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-2 z-10 w-80 max-h-96 overflow-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Vorschläge</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 text-sm"
            >
              Schließen
            </button>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id} className="border border-gray-100 dark:border-slate-700 rounded p-2">
                <div className="font-medium text-gray-900 dark:text-slate-100">{s.name}</div>
                <div className="text-xs text-gray-600 dark:text-slate-400 mb-2">{s.description}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onApply(toParams(s))
                      setOpen(false)
                    }}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
                  >
                    Nur übernehmen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyAndRun(toParams(s))
                      setOpen(false)
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Übernehmen & Simulieren
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
