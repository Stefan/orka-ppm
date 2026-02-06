'use client'

import React from 'react'
import type { DistributionSettings, DistributionProfile } from '@/types/costbook'

export interface DistributionParamsBlockProps {
  value: DistributionSettings
  onChange: (settings: DistributionSettings) => void
  /** Optional: project duration start (ISO date). Defaults to today. */
  durationStart?: string
  /** Optional: project duration end (ISO date). Defaults to start + 12 months. */
  durationEnd?: string
  disabled?: boolean
}

const PROFILES: { id: DistributionProfile; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'custom', label: 'Custom' },
  { id: 'ai_generated', label: 'AI-generated' },
]

export function DistributionParamsBlock({
  value,
  onChange,
  durationStart,
  durationEnd,
  disabled = false,
}: DistributionParamsBlockProps) {
  const start = durationStart ?? new Date().toISOString().slice(0, 10)
  const end = durationEnd ?? (() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })()

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
      <h5 className="text-sm font-medium text-gray-700 dark:text-slate-300">Forecast-Profil (Spend-Verlauf)</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label id="dist-profile-label" className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Profil</label>
          <select
            aria-labelledby="dist-profile-label"
            value={value.profile}
            onChange={(e) => onChange({ ...value, profile: e.target.value as DistributionProfile })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label id="dist-granularity-label" className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Granularität</label>
          <select
            aria-labelledby="dist-granularity-label"
            value={value.granularity}
            onChange={(e) => onChange({ ...value, granularity: e.target.value as 'week' | 'month' })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="week">Woche</option>
            <option value="month">Monat</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Duration From</label>
          <input
            type="date"
            value={value.duration_start.slice(0, 10)}
            onChange={(e) => onChange({ ...value, duration_start: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Duration To</label>
          <input
            type="date"
            value={value.duration_end.slice(0, 10)}
            onChange={(e) => onChange({ ...value, duration_end: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      {value.profile === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Custom % per period (comma-separated)</label>
          <input
            type="text"
            value={(value.customDistribution ?? []).join(', ')}
            onChange={(e) => {
              const raw = e.target.value
              const arr = raw.split(',').map((s) => parseFloat(s.trim())).filter((n) => !Number.isNaN(n))
              onChange({ ...value, customDistribution: arr })
            }}
            placeholder="e.g. 10, 20, 30, 40"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
    </div>
  )
}
