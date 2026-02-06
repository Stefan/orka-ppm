'use client'

import React, { useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  ChevronDown,
  BarChart3
} from 'lucide-react'

/**
 * Forecast scenario definition
 */
export interface ForecastScenario {
  id: string
  name: string
  description?: string
  isBaseline?: boolean
  createdAt: string
  updatedAt: string
  /** Forecast data points - month to amount mapping */
  forecastData: Map<string, number>
}

export interface ScenarioSelectorProps {
  /** Available scenarios */
  scenarios: ForecastScenario[]
  /** Currently selected scenario ID */
  selectedScenarioId: string | null
  /** Called when a scenario is selected */
  onSelect: (scenarioId: string) => void
  /** Called when a new scenario is created */
  onCreate: (scenario: Omit<ForecastScenario, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** Called when a scenario is updated */
  onUpdate: (scenarioId: string, updates: Partial<ForecastScenario>) => void
  /** Called when a scenario is deleted */
  onDelete: (scenarioId: string) => void
  /** Called when a scenario is duplicated */
  onDuplicate: (scenarioId: string) => void
  /** Whether actions are disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Scenario card component
 */
function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  disabled
}: {
  scenario: ForecastScenario
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={`
        p-3 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 bg-white dark:bg-slate-800'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={disabled ? undefined : onSelect}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
          <span className="font-medium text-gray-900 dark:text-slate-100 text-sm">{scenario.name}</span>
        </div>
        {scenario.isBaseline && (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 rounded-full">
            Baseline
          </span>
        )}
      </div>
      
      {scenario.description && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 line-clamp-1">
          {scenario.description}
        </p>
      )}
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-slate-500">
          {new Date(scenario.updatedAt).toLocaleDateString()}
        </span>
        
        {!disabled && (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3 h-3" />
            </button>
            {!scenario.isBaseline && (
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Scenario Selector component
 */
export function ScenarioSelector({
  scenarios,
  selectedScenarioId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  disabled = false,
  className = '',
  'data-testid': testId = 'scenario-selector'
}: ScenarioSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [newScenarioDescription, setNewScenarioDescription] = useState('')
  
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)
  
  const handleCreate = useCallback(() => {
    if (!newScenarioName.trim()) return
    
    onCreate({
      name: newScenarioName.trim(),
      description: newScenarioDescription.trim() || undefined,
      forecastData: new Map()
    })
    
    setNewScenarioName('')
    setNewScenarioDescription('')
    setShowCreateForm(false)
  }, [newScenarioName, newScenarioDescription, onCreate])
  
  const handleEdit = useCallback((scenarioId: string, name: string) => {
    onUpdate(scenarioId, { name })
    setEditingScenarioId(null)
  }, [onUpdate])
  
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 ${className}`} data-testid={testId}>
      {/* Header - Dropdown style */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {selectedScenario?.name || 'Select Scenario'}
          </span>
          {selectedScenario?.isBaseline && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 rounded-full">
              Baseline
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-slate-700 p-3">
          {/* Scenario list */}
          <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
            {scenarios.map(scenario => (
              <div key={scenario.id}>
                {editingScenarioId === scenario.id ? (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                    <input
                      type="text"
                      defaultValue={scenario.name}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEdit(scenario.id, e.currentTarget.value)
                        } else if (e.key === 'Escape') {
                          setEditingScenarioId(null)
                        }
                      }}
                    />
                    <button
                      onClick={() => setEditingScenarioId(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <ScenarioCard
                    scenario={scenario}
                    isSelected={scenario.id === selectedScenarioId}
                    onSelect={() => {
                      onSelect(scenario.id)
                      setIsExpanded(false)
                    }}
                    onEdit={() => setEditingScenarioId(scenario.id)}
                    onDuplicate={() => onDuplicate(scenario.id)}
                    onDelete={() => onDelete(scenario.id)}
                    disabled={disabled}
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Create new scenario */}
          {showCreateForm ? (
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg space-y-2">
              <input
                type="text"
                value={newScenarioName}
                onChange={e => setNewScenarioName(e.target.value)}
                placeholder="Scenario name"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <input
                type="text"
                value={newScenarioDescription}
                onChange={e => setNewScenarioDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewScenarioName('')
                    setNewScenarioDescription('')
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newScenarioName.trim()}
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-3 h-3" />
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={disabled}
              className="w-full flex items-center justify-center gap-2 p-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 border border-dashed border-blue-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              New Scenario
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Create a default baseline scenario
 */
export function createBaselineScenario(projectId: string): ForecastScenario {
  const now = new Date().toISOString()
  return {
    id: `baseline-${projectId}`,
    name: 'Baseline',
    description: 'Original forecast based on current commitments',
    isBaseline: true,
    createdAt: now,
    updatedAt: now,
    forecastData: new Map()
  }
}

/**
 * Duplicate a scenario with a new ID
 */
export function duplicateScenario(
  scenario: ForecastScenario,
  newName?: string
): Omit<ForecastScenario, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: newName || `${scenario.name} (Copy)`,
    description: scenario.description,
    isBaseline: false,
    forecastData: new Map(scenario.forecastData)
  }
}

export default ScenarioSelector
