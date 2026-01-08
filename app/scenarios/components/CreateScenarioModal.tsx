'use client'

import React, { useState } from 'react'
import { X, Calendar, DollarSign, Users, Target, AlertTriangle } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  start_date?: string | null
  end_date?: string | null
}

interface CreateScenarioModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  session: any
  onScenarioCreated: () => void
}

interface ScenarioFormData {
  name: string
  description: string
  parameter_changes: {
    start_date?: string
    end_date?: string
    budget?: number
    resource_allocations?: Record<string, number>
  }
  analysis_scope: string[]
}

export default function CreateScenarioModal({
  isOpen,
  onClose,
  project,
  session,
  onScenarioCreated
}: CreateScenarioModalProps) {
  const [formData, setFormData] = useState<ScenarioFormData>({
    name: '',
    description: '',
    parameter_changes: {},
    analysis_scope: ['timeline', 'cost', 'resources']
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session?.access_token) {
      setError('Authentication required')
      return
    }

    if (!formData.name.trim()) {
      setError('Scenario name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const scenarioData = {
        project_id: project.id,
        config: {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          parameter_changes: formData.parameter_changes,
          analysis_scope: formData.analysis_scope
        }
      }

      const response = await fetch(getApiUrl('/simulations/what-if'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scenarioData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to create scenario: ${response.status}`)
      }

      // Success - close modal and refresh scenarios
      onScenarioCreated()
      onClose()
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        parameter_changes: {},
        analysis_scope: ['timeline', 'cost', 'resources']
      })

    } catch (err) {
      console.error('Error creating scenario:', err)
      setError(err instanceof Error ? err.message : 'Failed to create scenario')
    } finally {
      setLoading(false)
    }
  }

  const handleParameterChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameter_changes: {
        ...prev.parameter_changes,
        [key]: value
      }
    }))
  }

  const handleResourceAllocationChange = (resource: string, allocation: number) => {
    setFormData(prev => ({
      ...prev,
      parameter_changes: {
        ...prev.parameter_changes,
        resource_allocations: {
          ...prev.parameter_changes.resource_allocations,
          [resource]: allocation / 100 // Convert percentage to decimal
        }
      }
    }))
  }

  const toggleAnalysisScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      analysis_scope: prev.analysis_scope.includes(scope)
        ? prev.analysis_scope.filter(s => s !== scope)
        : [...prev.analysis_scope, scope]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Create New Scenario</h3>
            <p className="text-sm text-gray-600">Project: {project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900 flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Basic Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scenario Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Budget Increase 20%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Parameter Changes */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900">Parameter Changes</h4>
            
            {/* Timeline Changes */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Timeline Changes
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.parameter_changes.start_date || ''}
                    onChange={(e) => handleParameterChange('start_date', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {project.start_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {new Date(project.start_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New End Date
                  </label>
                  <input
                    type="date"
                    value={formData.parameter_changes.end_date || ''}
                    onChange={(e) => handleParameterChange('end_date', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {project.end_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {new Date(project.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Budget Changes */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Budget Changes
              </h5>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Budget ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.parameter_changes.budget || ''}
                  onChange={(e) => handleParameterChange('budget', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Enter new budget amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {project.budget && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current: ${project.budget.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Resource Allocation Changes */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Resource Allocation Changes
              </h5>
              <div className="space-y-3">
                {['Developer', 'Designer', 'QA Engineer', 'Project Manager'].map((resource) => (
                  <div key={resource} className="flex items-center space-x-4">
                    <label className="w-32 text-sm font-medium text-gray-700">
                      {resource}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={((formData.parameter_changes.resource_allocations?.[resource] || 0) * 100)}
                      onChange={(e) => handleResourceAllocationChange(resource, parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm text-gray-600">
                      {Math.round((formData.parameter_changes.resource_allocations?.[resource] || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis Scope */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-900">Analysis Scope</h4>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'timeline', label: 'Timeline Impact', icon: Calendar },
                { key: 'cost', label: 'Cost Impact', icon: DollarSign },
                { key: 'resources', label: 'Resource Impact', icon: Users }
              ].map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.analysis_scope.includes(key)}
                    onChange={() => toggleAnalysisScope(key)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Scenario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}