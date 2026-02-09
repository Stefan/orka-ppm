'use client'

import { useState, useCallback } from 'react'
import {
  REGISTER_TYPE_LABELS,
  REGISTER_TYPE_SCHEMAS,
  type RegisterType,
  type RegisterEntry,
} from '@/types/registers'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'identified', label: 'Identified' },
  { value: 'mitigating', label: 'Mitigating' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
]

export interface RegisterInlinePanelProps {
  type: RegisterType
  /** null = create new; set = edit existing */
  entry: RegisterEntry | null
  onSave: (data: Record<string, unknown>, status: string, project_id?: string | null, task_id?: string | null) => void | Promise<void>
  onCancel: () => void
  isPending?: boolean
  /** Optional project list for project selector */
  projects?: { id: string; name: string }[]
  /** When set, new entries will be linked to this task (e.g. from schedule task context) */
  initialTaskId?: string | null
}

export default function RegisterInlinePanel({
  type,
  entry,
  onSave,
  onCancel,
  isPending = false,
  projects,
  initialTaskId,
}: RegisterInlinePanelProps) {
  const schema = REGISTER_TYPE_SCHEMAS[type]
  const isEdit = entry !== null && entry.id !== ''
  const [data, setData] = useState<Record<string, unknown>>(() => entry?.data ?? {})
  const [status, setStatus] = useState<string>(() => entry?.status ?? 'open')
  const [projectId, setProjectId] = useState<string>(() => entry?.project_id ?? '')

  const updateField = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSave(data, status, projectId || null, entry?.task_id ?? initialTaskId ?? null)
    },
    [data, status, projectId, entry?.task_id, initialTaskId, onSave]
  )

  const label = isEdit
    ? `Edit ${REGISTER_TYPE_LABELS[type]}`
    : `New ${REGISTER_TYPE_LABELS[type]} entry`

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-slate-100">{label}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {schema.fields.map((field) => {
          const value = data[field.key]
          const id = `reg-field-${type}-${field.key}`
          if (field.type === 'textarea') {
            return (
              <div key={field.key}>
                <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                  {field.label}
                  {!field.optional && ' *'}
                </label>
                <textarea
                  id={id}
                  value={(value as string) ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )
          }
          if (field.type === 'select') {
            return (
              <div key={field.key}>
                <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                  {field.label}
                  {!field.optional && ' *'}
                </label>
                <select
                  id={id}
                  value={(value as string) ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">—</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
          if (field.type === 'number') {
            return (
              <div key={field.key}>
                <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                  {field.label}
                  {!field.optional && ' *'}
                </label>
                <input
                  id={id}
                  type="number"
                  value={value !== undefined && value !== null ? String(value) : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    updateField(field.key, v === '' ? undefined : Number(v))
                  }}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )
          }
          return (
            <div key={field.key}>
              <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
                {field.label}
                {!field.optional && ' *'}
              </label>
              <input
                id={id}
                type="text"
                value={(value as string) ?? ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )
        })}
        {projects && projects.length > 0 && (
          <div>
            <label htmlFor={`reg-project-${type}`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              Project
            </label>
            <select
              id={`reg-project-${type}`}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor={`reg-status-${type}`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
            Status
          </label>
          <select
            id={`reg-status-${type}`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
