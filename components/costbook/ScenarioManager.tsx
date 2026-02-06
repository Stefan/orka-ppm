'use client'

import React, { useState, useCallback } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  X,
  BarChart3,
  Percent,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Settings,
  Layers
} from 'lucide-react'
import { RundownScenario, AdjustmentType } from '@/types/rundown'

export interface ScenarioManagerProps {
  /** Project ID for scenarios */
  projectId: string
  /** Available scenarios */
  scenarios: RundownScenario[]
  /** Currently selected scenario */
  selectedScenario: string
  /** Handler for scenario selection */
  onSelect: (scenarioName: string) => void
  /** Handler for creating a new scenario */
  onCreate: (scenario: Omit<RundownScenario, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  /** Handler for updating a scenario */
  onUpdate: (scenarioId: string, updates: Partial<RundownScenario>) => Promise<void>
  /** Handler for deleting a scenario */
  onDelete: (scenarioId: string) => Promise<void>
  /** Handler for duplicating a scenario */
  onDuplicate: (scenarioId: string, newName: string) => Promise<void>
  /** Whether component is in loading state */
  loading?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Adjustment type selector
 */
function AdjustmentTypeSelector({
  value,
  onChange
}: {
  value: AdjustmentType
  onChange: (type: AdjustmentType) => void
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('percentage')}
        className={`
          flex items-center gap-1 px-3 py-1.5 text-sm
          ${value === 'percentage' 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' 
            : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }
        `}
      >
        <Percent className="w-3 h-3" />
        %
      </button>
      <button
        type="button"
        onClick={() => onChange('absolute')}
        className={`
          flex items-center gap-1 px-3 py-1.5 text-sm border-l border-gray-200 dark:border-slate-700
          ${value === 'absolute' 
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' 
            : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
          }
        `}
      >
        <DollarSign className="w-3 h-3" />
        $
      </button>
    </div>
  )
}

/**
 * Scenario form for create/edit
 */
interface ScenarioFormData {
  name: string
  description: string
  adjustment_type: AdjustmentType
  adjustment_value: number
}

function ScenarioForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save'
}: {
  initialData?: Partial<ScenarioFormData>
  onSubmit: (data: ScenarioFormData) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [data, setData] = useState<ScenarioFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    adjustment_type: initialData?.adjustment_type || 'percentage',
    adjustment_value: initialData?.adjustment_value || 0
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!data.name.trim()) return
    onSubmit(data)
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Scenario Name
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          placeholder="e.g., Optimistic Budget"
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Description
        </label>
        <textarea
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Adjustment
        </label>
        <div className="flex gap-3 items-center">
          <AdjustmentTypeSelector
            value={data.adjustment_type}
            onChange={(type) => setData({ ...data, adjustment_type: type })}
          />
          <input
            type="number"
            value={data.adjustment_value}
            onChange={(e) => setData({ ...data, adjustment_value: parseFloat(e.target.value) || 0 })}
            step={data.adjustment_type === 'percentage' ? 0.1 : 1000}
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          {data.adjustment_type === 'percentage' 
            ? 'Adjust all values by this percentage (positive = increase, negative = decrease)'
            : 'Adjust all values by this fixed amount'
          }
        </p>
      </div>
      
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

/**
 * Scenario Manager Component
 */
export function ScenarioManager({
  projectId,
  scenarios,
  selectedScenario,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  loading = false,
  className = ''
}: ScenarioManagerProps) {
  const [expanded, setExpanded] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  
  const handleCreate = async (data: ScenarioFormData) => {
    await onCreate({
      project_id: projectId,
      name: data.name,
      description: data.description,
      adjustment_type: data.adjustment_type,
      adjustment_value: data.adjustment_value,
      is_active: true
    })
    setShowCreateForm(false)
  }
  
  const handleUpdate = async (scenarioId: string, data: ScenarioFormData) => {
    await onUpdate(scenarioId, {
      name: data.name,
      description: data.description,
      adjustment_type: data.adjustment_type,
      adjustment_value: data.adjustment_value
    })
    setEditingId(null)
  }
  
  const handleDuplicate = async () => {
    if (!duplicatingId || !newName.trim()) return
    await onDuplicate(duplicatingId, newName)
    setDuplicatingId(null)
    setNewName('')
  }
  
  const handleDelete = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return
    await onDelete(scenarioId)
  }
  
  // Find the selected scenario details
  const selectedDetails = scenarios.find(s => s.name === selectedScenario)
  
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 ${className}`}>
      {/* Header - Compact selector */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Scenario</span>
        </div>
        
        {/* Dropdown selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedScenario}
            onChange={(e) => onSelect(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="baseline">Baseline</option>
            {scenarios
              .filter(s => s.name !== 'baseline')
              .map(scenario => (
                <option key={scenario.id} value={scenario.name}>
                  {scenario.name}
                </option>
              ))
            }
          </select>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded transition-colors"
            title={expanded ? 'Collapse' : 'Manage scenarios'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Expanded management panel */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-slate-700">
          {/* Selected scenario details */}
          {selectedDetails && selectedDetails.name !== 'baseline' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">{selectedDetails.name}</div>
                  {selectedDetails.description && (
                    <div className="text-xs text-blue-700 mt-0.5">{selectedDetails.description}</div>
                  )}
                </div>
                <div className="text-sm text-blue-700">
                  {selectedDetails.adjustment_type === 'percentage' 
                    ? `${selectedDetails.adjustment_value > 0 ? '+' : ''}${selectedDetails.adjustment_value}%`
                    : `${selectedDetails.adjustment_value > 0 ? '+' : ''}$${selectedDetails.adjustment_value.toLocaleString()}`
                  }
                </div>
              </div>
            </div>
          )}
          
          {/* Scenarios list */}
          <div className="max-h-48 overflow-y-auto">
            {scenarios
              .filter(s => s.name !== 'baseline')
              .map(scenario => (
                <div
                  key={scenario.id}
                  className={`
                    flex items-center justify-between p-3 border-b border-gray-100 dark:border-slate-700 last:border-0
                    ${scenario.name === selectedScenario ? 'bg-gray-50 dark:bg-slate-800/50' : ''}
                  `}
                >
                  {editingId === scenario.id ? (
                    <ScenarioForm
                      initialData={scenario}
                      onSubmit={(data) => handleUpdate(scenario.id, data)}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Update"
                    />
                  ) : duplicatingId === scenario.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New scenario name..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded"
                        autoFocus
                      />
                      <button
                        onClick={handleDuplicate}
                        className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setDuplicatingId(null); setNewName(''); }}
                        className="p-1 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelect(scenario.name)}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{scenario.name}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {scenario.adjustment_type === 'percentage'
                            ? `${scenario.adjustment_value > 0 ? '+' : ''}${scenario.adjustment_value}%`
                            : `${scenario.adjustment_value > 0 ? '+' : ''}$${scenario.adjustment_value.toLocaleString()}`
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(scenario.id)}
                          className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDuplicatingId(scenario.id)}
                          className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(scenario.id)}
                          className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            }
            
            {scenarios.filter(s => s.name !== 'baseline').length === 0 && !showCreateForm && (
              <div className="p-4 text-center text-gray-400 dark:text-slate-500 text-sm">
                No custom scenarios yet
              </div>
            )}
          </div>
          
          {/* Create form */}
          {showCreateForm ? (
            <div className="border-t border-gray-200 dark:border-slate-700">
              <ScenarioForm
                onSubmit={handleCreate}
                onCancel={() => setShowCreateForm(false)}
                submitLabel="Create Scenario"
              />
            </div>
          ) : (
            <div className="p-3 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Scenario
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Simple scenario dropdown for compact views
 */
export interface ScenarioDropdownProps {
  scenarios: RundownScenario[]
  selectedScenario: string
  onSelect: (scenarioName: string) => void
  className?: string
}

export function ScenarioDropdown({
  scenarios,
  selectedScenario,
  onSelect,
  className = ''
}: ScenarioDropdownProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Layers className="w-4 h-4 text-gray-400 dark:text-slate-500" />
      <select
        value={selectedScenario}
        onChange={(e) => onSelect(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="baseline">Baseline</option>
        {scenarios
          .filter(s => s.name !== 'baseline')
          .map(scenario => (
            <option key={scenario.id} value={scenario.name}>
              {scenario.name}
            </option>
          ))
        }
      </select>
    </div>
  )
}

export default ScenarioManager
