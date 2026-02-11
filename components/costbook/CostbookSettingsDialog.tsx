'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, Settings, List, LayoutGrid, Calendar, Layers, Sparkles, Hash } from 'lucide-react'
import {
  getCostbookSettings,
  setCostbookSettings,
  type CostbookSettings,
  type CostbookViewMode,
  type CostbookProjectsPerPage,
  type CostbookForecastMonths,
  COSTBOOK_PROJECTS_PAGE_SIZE_OPTIONS,
  COSTBOOK_FORECAST_MONTHS_OPTIONS
} from '@/lib/costbook/costbook-settings'
import { Select } from '@/components/ui/Select'

export interface CostbookSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Called after saving so parent can apply new settings */
  onSave?: (settings: CostbookSettings) => void
  'data-testid'?: string
}

export function CostbookSettingsDialog({
  isOpen,
  onClose,
  onSave,
  'data-testid': testId = 'costbook-settings-dialog'
}: CostbookSettingsDialogProps) {
  const [form, setForm] = useState<CostbookSettings>(() => getCostbookSettings())

  useEffect(() => {
    if (isOpen) {
      setForm(getCostbookSettings())
    }
  }, [isOpen])

  const handleSave = () => {
    setCostbookSettings(form)
    onSave?.(form)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const projectsPerPageOptions = useMemo(
    () => COSTBOOK_PROJECTS_PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) })),
    []
  )
  const forecastMonthsOptions = useMemo(
    () => COSTBOOK_FORECAST_MONTHS_OPTIONS.map(({ value, label }) => ({ value: String(value), label })),
    []
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="costbook-settings-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        data-testid={testId}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 id="costbook-settings-title" className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Budget & Cost Management – Settings
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Preferences for this page only (saved in this browser)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Default view */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <LayoutGrid className="w-4 h-4" />
              Default project view
            </label>
            <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 p-1 bg-gray-50 dark:bg-slate-700/50">
              {(['list', 'grid'] as CostbookViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, defaultView: mode }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    form.defaultView === mode
                      ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'list' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                  {mode === 'list' ? 'List' : 'Grid'}
                </button>
              ))}
            </div>
          </div>

          {/* Projects per page */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Hash className="w-4 h-4" />
              Projects per page
            </label>
            <Select
              options={projectsPerPageOptions}
              value={String(form.projectsPerPage)}
              onChange={(v) => setForm((f) => ({ ...f, projectsPerPage: Number(v) as CostbookProjectsPerPage }))}
              placeholder="Select…"
            />
          </div>

          {/* Forecast timeline */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              <Calendar className="w-4 h-4" />
              Forecast timeline
            </label>
            <Select
              options={forecastMonthsOptions}
              value={String(form.forecastMonthsAhead)}
              onChange={(v) => setForm((f) => ({ ...f, forecastMonthsAhead: Number(v) as CostbookForecastMonths }))}
              placeholder="Select…"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              How far ahead the Forecast Gantt shows (from current month)
            </p>
          </div>

          {/* Hierarchy panel default */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Open &quot;Cost Structure (CES/WBS)&quot; by default
                </span>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  When unchecked, the panel starts collapsed
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.hierarchyPanelDefaultOpen}
              onClick={() => setForm((f) => ({ ...f, hierarchyPanelDefaultOpen: !f.hierarchyPanelDefaultOpen }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.hierarchyPanelDefaultOpen ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  form.hierarchyPanelDefaultOpen ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Show recommendations */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Show Recommendations panel
                </span>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  In the Forecast column (can be collapsed)
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.showRecommendationsPanel}
              onClick={() => setForm((f) => ({ ...f, showRecommendationsPanel: !f.showRecommendationsPanel }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.showRecommendationsPanel ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  form.showRecommendationsPanel ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Compact numbers */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Compact numbers
                </span>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  e.g. 1.2M instead of 1,234,567 in cards and list
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.compactNumbers}
              onClick={() => setForm((f) => ({ ...f, compactNumbers: !f.compactNumbers }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.compactNumbers ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  form.compactNumbers ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default CostbookSettingsDialog
