'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Calendar, TrendingUp, Sparkles, AlertCircle, Mic, MicOff } from 'lucide-react'
import { DistributionSettings, DistributionProfile, Currency, DurationType } from '@/types/costbook'
import { calculateDistribution, calculatePeriods, validateCustomDistribution, getDistributionVarianceMetric } from '@/lib/costbook/distribution-engine'
import { getApiUrl } from '@/lib/api'
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
  /** Optional project ID for API suggestion (history-based recommendation) */
  projectId?: string
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
  initialSettings,
  projectId
}: DistributionSettingsDialogProps) {
  // State
  const [activeTab, setActiveTab] = useState<DistributionProfile>('linear')
  const [suggestionFromApi, setSuggestionFromApi] = useState<{ profile: DistributionProfile; reason: string } | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [durationType, setDurationType] = useState<DurationType>(initialSettings?.duration_type ?? 'project')
  const [durationStart, setDurationStart] = useState(projectStartDate)
  const [durationEnd, setDurationEnd] = useState(projectEndDate)
  const [granularity, setGranularity] = useState<'week' | 'month'>('month')
  const [customPercentages, setCustomPercentages] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [voiceField, setVoiceField] = useState<'from' | 'to' | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  /** Predictive Rules: show confirmation when variance impact > 0 before applying */
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)

  // Parse spoken date (e.g. "March 15 2025", "15.3.2025", "2025-03-15") to YYYY-MM-DD
  const parseSpokenDate = useCallback((text: string): string | null => {
    const t = text.trim().toLowerCase()
    const months: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    }
    // ISO already
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    // DD.MM.YYYY or DD/MM/YYYY
    const dmy = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
    if (dmy) {
      const [, d, m, y] = dmy
      return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
    }
    // Month name DD YYYY
    for (const [name, month] of Object.entries(months)) {
      const re = new RegExp(`${name}\\s+(\\d{1,2})\\s+(\\d{4})`, 'i')
      const m = t.match(re)
      if (m) {
        const [, d, y] = m
        return `${y}-${String(month).padStart(2, '0')}-${d!.padStart(2, '0')}`
      }
    }
    return null
  }, [])

  const startVoiceInput = useCallback((field: 'from' | 'to') => {
    setVoiceError(null)
    setVoiceField(field)
    const win = typeof window !== 'undefined' ? window : null
    const SpeechRecognition = win
      ? ((win as unknown as { SpeechRecognition?: new () => { start: () => void; stop: () => void; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: (e: { error: string }) => void; onend: () => void } }).SpeechRecognition
          ?? (win as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition)
      : undefined
    if (!SpeechRecognition) {
      setVoiceError('Voice input not supported in this browser')
      setVoiceField(null)
      return
    }
    const rec = new SpeechRecognition() as { start: () => void; stop: () => void; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: (e: { error: string }) => void; onend: () => void }
    rec.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? ''
      const parsed = parseSpokenDate(transcript)
      if (parsed) {
        if (field === 'from') setDurationStart(parsed)
        else setDurationEnd(parsed)
      } else {
        setVoiceError(`Could not parse date: "${transcript}"`)
      }
      setVoiceField(null)
    }
    rec.onerror = (e: { error: string }) => {
      setVoiceError(e.error === 'not-allowed' ? 'Microphone access denied' : e.error)
      setVoiceField(null)
    }
    rec.onend = () => setVoiceField(null)
    try {
      rec.start()
    } catch {
      setVoiceError('Could not start voice recognition')
      setVoiceField(null)
    }
  }, [parseSpokenDate])

  // Sync From/To when duration type is project (use project dates)
  useEffect(() => {
    if (durationType === 'project' && (projectStartDate || projectEndDate)) {
      if (projectStartDate) setDurationStart(projectStartDate.slice(0, 10))
      if (projectEndDate) setDurationEnd(projectEndDate.slice(0, 10))
    }
  }, [durationType, projectStartDate, projectEndDate])

  // Initialize from initial settings if provided
  useEffect(() => {
    if (initialSettings) {
      setActiveTab(initialSettings.profile)
      setDurationType(initialSettings.duration_type ?? 'project')
      setDurationStart(initialSettings.duration_start?.slice(0, 10) ?? projectStartDate?.slice(0, 10) ?? '')
      setDurationEnd(initialSettings.duration_end?.slice(0, 10) ?? projectEndDate?.slice(0, 10) ?? '')
      setGranularity(initialSettings.granularity)
      if (initialSettings.customDistribution) {
        setCustomPercentages(initialSettings.customDistribution)
      }
    }
  }, [initialSettings, projectStartDate, projectEndDate])

  // Fetch distribution suggestion from API (duration/project-based; optional history)
  useEffect(() => {
    if (!isOpen || !durationStart || !durationEnd) {
      setSuggestionFromApi(null)
      return
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      setSuggestionFromApi(null)
      setSuggestionLoading(false)
      return
    }
    let cancelled = false
    const params = new URLSearchParams({
      duration_start: durationStart.slice(0, 10),
      duration_end: durationEnd.slice(0, 10)
    })
    if (projectId) params.set('project_id', projectId)
    setSuggestionLoading(true)
    fetch(getApiUrl(`/v1/distribution/suggestion?${params}`), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: string; reason?: string } | null) => {
        if (cancelled) return
        if (data?.profile && data?.reason) {
          const profile = data.profile as DistributionProfile
          if (['linear', 'custom', 'ai_generated'].includes(profile)) {
            setSuggestionFromApi({ profile, reason: data.reason })
          } else {
            setSuggestionFromApi(null)
          }
        } else {
          setSuggestionFromApi(null)
        }
      })
      .catch(() => { if (!cancelled) setSuggestionFromApi(null) })
      .finally(() => { if (!cancelled) setSuggestionLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, durationStart, durationEnd, projectId])

  // Fallback suggestion when API is not used or fails (project dates only)
  const distributionSuggestionFallback = useMemo(() => {
    const start = projectStartDate ? new Date(projectStartDate) : null
    const end = projectEndDate ? new Date(projectEndDate) : null
    if (!start || !end) return null
    const now = new Date()
    const inRange = now >= start && now <= end
    const monthsLeft = end.getMonth() - now.getMonth() + 12 * (end.getFullYear() - now.getFullYear())
    if (inRange && monthsLeft <= 3) {
      return { profile: 'custom' as const, reason: 'Based on project timeline: Custom distribution recommended for remaining period.' }
    }
    if (inRange && monthsLeft > 6) {
      return { profile: 'linear' as const, reason: 'Based on project timeline: Linear is a good default for long horizons.' }
    }
    return null
  }, [projectStartDate, projectEndDate])

  const distributionSuggestion = suggestionFromApi ?? distributionSuggestionFallback

  // Estimated variance impact: simulate current vs new distribution (predictive rules)
  const estimatedVarianceImpact = useMemo(() => {
    const initialSettingsForVariance: DistributionSettings = initialSettings ?? {
      profile: 'linear',
      duration_start: durationStart,
      duration_end: durationEnd,
      granularity,
      duration_type: durationType
    }
    const initialResult = calculateDistribution(
      projectBudget,
      { ...initialSettingsForVariance, duration_start: initialSettingsForVariance.duration_start ?? durationStart, duration_end: initialSettingsForVariance.duration_end ?? durationEnd },
      currentSpend
    )
    const newResult = calculateDistribution(
      projectBudget,
      {
        profile: activeTab,
        duration_start: durationStart,
        duration_end: durationEnd,
        granularity,
        customDistribution: activeTab === 'custom' ? customPercentages : undefined
      },
      currentSpend
    )
    if (initialResult.error || newResult.error) return null
    const varianceInitial = getDistributionVarianceMetric(initialResult)
    const varianceNew = getDistributionVarianceMetric(newResult)
    if (varianceInitial <= 0) return varianceNew > 0 ? null : 0
    const improvement = Math.round(((varianceInitial - varianceNew) / varianceInitial) * 100)
    return improvement > 0 ? improvement : null
  }, [initialSettings, activeTab, durationStart, durationEnd, granularity, durationType, customPercentages, projectBudget, currentSpend])

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

  // Initialize custom percentages when switching to custom tab (use date range so we get period count even when customDistribution is empty)
  const periodCount = useMemo(() => {
    const periods = calculatePeriods(durationStart, durationEnd, granularity)
    return periods.length
  }, [durationStart, durationEnd, granularity])

  useEffect(() => {
    if (activeTab === 'custom' && periodCount > 0 && customPercentages.length !== periodCount) {
      const equal = 100 / periodCount
      setCustomPercentages(Array(periodCount).fill(equal))
    }
  }, [activeTab, periodCount, customPercentages.length])

  const doApply = useCallback(() => {
    const settings: DistributionSettings = {
      profile: activeTab,
      duration_start: durationStart,
      duration_end: durationEnd,
      granularity,
      duration_type: durationType,
      customDistribution: activeTab === 'custom' ? customPercentages : undefined
    }
    onApply(settings)
    setShowApplyConfirm(false)
    onClose()
  }, [activeTab, durationStart, durationEnd, granularity, durationType, customPercentages, onApply, onClose])

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

    // Predictive Rules: require confirmation when variance improvement is shown
    if (estimatedVarianceImpact != null && estimatedVarianceImpact > 0 && !showApplyConfirm) {
      setShowApplyConfirm(true)
      return
    }

    doApply()
  }

  const applyHint =
    estimatedVarianceImpact != null && estimatedVarianceImpact > 0
      ? `Variance-Reduktion ca. ${estimatedVarianceImpact}%`
      : null

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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Distribution Settings</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Configure cash out forecast distribution for this project
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Auto-suggestion banner (from API or fallback) */}
          {(suggestionLoading || distributionSuggestion) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {suggestionLoading ? 'Loading suggestion…' : distributionSuggestion!.reason}
                {!suggestionLoading && distributionSuggestion && distributionSuggestion.profile !== activeTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(distributionSuggestion.profile)}
                    className="ml-2 font-medium underline hover:no-underline"
                  >
                    Use {distributionSuggestion.profile}
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Duration Type: Project / Task / Custom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="duration-type" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Duration
              </label>
              <select
                id="duration-type"
                value={durationType}
                onChange={(e) => setDurationType(e.target.value as DurationType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="project">Project (use project start/end)</option>
                <option value="task">Task</option>
                <option value="custom">Custom (choose From/To)</option>
              </select>
            </div>
            <div>
              <label htmlFor="granularity" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Granularity
              </label>
              <select
                id="granularity"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as 'week' | 'month')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>

          {/* From / To Dates + Voice input */}
          {voiceError && (
            <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200 rounded p-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {voiceError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="from-date" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                From Date
              </label>
              <div className="flex gap-2">
                <input
                  id="from-date"
                  type="date"
                  aria-label="From Date"
                  value={durationStart.slice(0, 10)}
                  onChange={(e) => setDurationStart(e.target.value)}
                  min={durationType === 'project' ? projectStartDate?.slice(0, 10) : undefined}
                  max={durationEnd?.slice(0, 10)}
                  disabled={durationType === 'project'}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-slate-700 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => startVoiceInput('from')}
                  disabled={durationType === 'project' || voiceField !== null}
                  title="Voice input for From date (e.g. March 15 2025)"
                  className="p-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Voice input From date"
                >
                  {voiceField === 'from' ? <MicOff className="w-5 h-5 text-red-500 dark:text-red-400" /> : <Mic className="w-5 h-5 text-gray-600 dark:text-slate-400" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="to-date" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                To Date
              </label>
              <div className="flex gap-2">
                <input
                  id="to-date"
                  type="date"
                  aria-label="To Date"
                  value={durationEnd.slice(0, 10)}
                  onChange={(e) => setDurationEnd(e.target.value)}
                  min={durationStart?.slice(0, 10)}
                  max={durationType === 'project' ? projectEndDate?.slice(0, 10) : undefined}
                  disabled={durationType === 'project'}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-slate-700 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => startVoiceInput('to')}
                  disabled={durationType === 'project' || voiceField !== null}
                  title="Voice input for To date (e.g. March 15 2025)"
                  className="p-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Voice input To date"
                >
                  {voiceField === 'to' ? <MicOff className="w-5 h-5 text-red-500 dark:text-red-400" /> : <Mic className="w-5 h-5 text-gray-600 dark:text-slate-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* Profile dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Profile
            </label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as DistributionProfile)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="linear">Manual (Linear)</option>
              <option value="custom">Custom</option>
              <option value="ai_generated">AI Generated</option>
            </select>
          </div>

          {/* AI Suggestion buttons */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">AI suggestions</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('linear')
                  setDurationType('project')
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Basierend auf Historie: Linear empfohlen
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ai_generated')
                  setDurationType('project')
                  setError(null)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                S-Curve (typisch für Projekte)
              </button>
            </div>
          </div>

          {/* Profile Tabs (visual alternative) */}
          <div className="border-b border-gray-200 dark:border-slate-700">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('linear')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'linear'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Linear</span>
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'custom'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Custom</span>
              </button>
              <button
                onClick={() => setActiveTab('ai_generated')}
                className={`px-4 py-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${
                  activeTab === 'ai_generated'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Generated</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
            {activeTab === 'linear' && (
              <div>
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  <strong>Linear Distribution:</strong> Budget is distributed evenly across all time periods.
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  This is the simplest distribution method, ideal for projects with consistent spending patterns.
                </p>
              </div>
            )}

            {activeTab === 'custom' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    <strong>Custom Distribution:</strong> Manually specify the percentage for each period.
                  </p>
                  <button
                    onClick={handleAutoBalance}
                    className="px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 rounded-md transition-colors"
                  >
                    Auto Balance to 100%
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {distribution.periods.map((period, idx) => (
                    <div key={period.id} className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="ml-1 text-xs text-gray-500 dark:text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {customPercentages.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900">
                      Total: {customPercentages.reduce((a, b) => a + b, 0).toFixed(2)}%
                      {Math.abs(customPercentages.reduce((a, b) => a + b, 0) - 100) > 0.01 && (
                        <span className="ml-2 text-red-600 dark:text-red-400">(Must equal 100%)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai_generated' && (
              <div>
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  <strong>AI Generated Distribution:</strong> Machine learning predicts optimal distribution based on historical patterns.
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                  The AI model analyzes similar projects, seasonal trends, and spending patterns to create an S-curve distribution
                  that typically matches real-world project spending.
                </p>
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> AI distribution uses historical data and project characteristics.
                    For new project types, the model may default to a standard S-curve pattern.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Validation Error</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Distribution Preview</h3>
            <DistributionPreview
              distribution={distribution}
              currency={currency}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          {showApplyConfirm && applyHint && (
            <p className="text-sm font-medium text-green-700 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
              {applyHint}. Möchten Sie anwenden?
            </p>
          )}
          {applyHint && !showApplyConfirm && (
            <p className="text-sm text-gray-600 dark:text-slate-400">{applyHint} – Apply to use this distribution.</p>
          )}
          <div className="flex items-center justify-end space-x-3">
            {showApplyConfirm ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowApplyConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doApply}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Anwenden
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
