'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Calendar, TrendingUp, Sparkles, AlertCircle } from 'lucide-react'
import { DistributionSettings, DistributionProfile, Currency } from '@/types/costbook'
import { calculateDistribution, validateCustomDistribution } from '@/lib/costbook/distribution-engine'
import { DistributionPreview } from './DistributionPreview'

export interface DistributionSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  onApply: (settings: DistributionSettings) => void
  projectBudget: number
  projectStartDate: string
  projectEndDate: string
  currentSpend?: number
  currency: Currency
  initialSettings?: DistributionSettings
}

/**
 * DistributionSettingsDialog Component
 * Modal dialog for configuring distribution settings
 * Phase 2: Distribution Settings for Cash Out Forecast
 */
export function DistributionSettingsDialog({
  isOpen,
  onClose,
  onApply,
  projectBudget,
  projectStartDate,
  projectEndDate,
  currentSpend = 0,
  currency,
  initialSettings
}: DistributionSettingsDialogProps) {
  // State
  const [activeTab, setActiveTab] = useState<DistributionProfile>('linear')
  const [durationStart, setDurationStart] = useState(projectStartDate)
  const [durationEnd, setDurationEnd] = useState(projectEndDate)
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [customPercentages, setCustomPercentages] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  // Initialize from initial settings if provided
  useEffect(() => {
    if (initialSettings) {
      setActiveTab(initialSettings.profile)
      setDurationStart(initialSettings.duration_start)
      setDurationEnd(initialSettings.duration_end)
      setGranularity(initialSettings.granularity)
      if (initialSettings.customDistribution) {
        setCustomPercentages(initialSettings.customDistribution)
      }
    }
  }, [initialSettings])

  // Calculate distribution preview
  const distribution = useMemo(() => {
    const settings: DistributionSettings = {
      profile: activeTab,
      duration_start: durationStart,
      duration_end: durationEnd,
      granularity,
      customDistribution: activeTab === 'custom' ? customPercentages : undefined
    }

    return calculateDistribution(projectBudget, settings, currentSpend)
  }, [activeTab, durationStart, durationEnd, granularity, customPercentages, projectBudget, currentSpend])

  // Initialize custom percentages when switching to custom tab
  useEffect(() => {
    if (activeTab === 'custom' && distribution.periods.length > 0 && customPercentages.length !== distribution.periods.length) {
      // Initialize with equal distribution
      const equal = 100 / distribution.periods.length
      setCustomPercentages(Array(distribution.periods.length).fill(equal))
    }
  }, [activeTab, distribution.periods.length, customPercentages.length])

  const handleApply = () => {
    // Validate
    if (activeTab === 'custom') {
      const validation = validateCustomDistribution(customPercentages)
      if (!validation.valid) {
        setError(validation.error || 'Invalid custom distribution')
        return
      }
    }

    if (distribution.error) {
      setError(distribution.error)
      return
    }

    const settings: DistributionSettings = {
      profile: activeTab,
      duration_start: durationStart,
      duration_end: durationEnd,
      granularity,
      customDistribution: activeTab === 'custom' ? customPercentages : undefined
    }

    onApply(settings)
    onClose()
  }

  const handleCustomPercentageChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0
    const newPercentages = [...customPercentages]
    newPercentages[index] = numValue
    setCustomPercentages(newPercentages)
    setError(null)
  }

  const handleAutoBalance = () => {
    const sum = customPercentages.reduce((a, b) => a + b, 0)
    if (sum === 0) return

    // Normalize to 100%
    const balanced = customPercentages.map(p => (p / sum) * 100)
    setCustomPercentages(balanced)
    setError(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Distribution Settings</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure cash out forecast distribution for this project
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Duration and Granularity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={durationStart}
                onChange={(e) => setDurationStart(e.target.value)}
                min={projectStartDate}
                max={projectEndDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={durationEnd}
                onChange={(e) => setDurationEnd(e.target.value)}
                min={durationStart}
                max={projectEndDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Granularity
              </label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as 'week' | 'month')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>

          {/* Profile Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('linear')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'linear'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Linear</span>
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'custom'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Custom</span>
              </button>
              <button
                onClick={() => setActiveTab('ai_generated')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'ai_generated'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Generated</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50 rounded-lg p-4">
            {activeTab === 'linear' && (
              <div>
                <p className="text-sm text-gray-700">
                  <strong>Linear Distribution:</strong> Budget is distributed evenly across all time periods.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  This is the simplest distribution method, ideal for projects with consistent spending patterns.
                </p>
              </div>
            )}

            {activeTab === 'custom' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    <strong>Custom Distribution:</strong> Manually specify the percentage for each period.
                  </p>
                  <button
                    onClick={handleAutoBalance}
                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    Auto Balance to 100%
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {distribution.periods.map((period, idx) => (
                    <div key={period.id} className="bg-white rounded border border-gray-200 p-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {period.label}
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={customPercentages[idx]?.toFixed(2) || '0'}
                          onChange={(e) => handleCustomPercentageChange(idx, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="ml-1 text-xs text-gray-500">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {customPercentages.length > 0 && (
                  <div className="bg-blue-50 rounded p-3 border border-blue-200">
                    <p className="text-sm font-medium text-blue-900">
                      Total: {customPercentages.reduce((a, b) => a + b, 0).toFixed(2)}%
                      {Math.abs(customPercentages.reduce((a, b) => a + b, 0) - 100) > 0.01 && (
                        <span className="ml-2 text-red-600">(Must equal 100%)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai_generated' && (
              <div>
                <p className="text-sm text-gray-700">
                  <strong>AI Generated Distribution:</strong> Machine learning predicts optimal distribution based on historical patterns.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  The AI model analyzes similar projects, seasonal trends, and spending patterns to create an S-curve distribution
                  that typically matches real-world project spending.
                </p>
                <div className="mt-3 bg-blue-50 rounded p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> AI distribution uses historical data and project characteristics.
                    For new project types, the model may default to a standard S-curve pattern.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Validation Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution Preview</h3>
            <DistributionPreview
              distribution={distribution}
              currency={currency}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!!distribution.error || (activeTab === 'custom' && !validateCustomDistribution(customPercentages).valid)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Apply Distribution
          </button>
        </div>
      </div>
    </div>
  )
}
