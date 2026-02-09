'use client'

import { Fragment, useState } from 'react'
import type { RegisterEntry, RegisterType } from '@/types/registers'
import { REGISTER_TYPE_SCHEMAS } from '@/types/registers'
import { ChevronRight, ChevronDown, Sparkles, Pencil, Trash2 } from 'lucide-react'
import RegisterInlinePanel from './RegisterInlinePanel'
import RegisterNestedGrid from './RegisterNestedGrid'

export interface RegisterGridProps {
  registerType: RegisterType
  entries: RegisterEntry[]
  loading?: boolean
  onAISuggest?: (entry: RegisterEntry) => void
  onEdit?: (entry: RegisterEntry) => void
  onDelete?: (entry: RegisterEntry) => void
  onExpand?: (entry: RegisterEntry) => void
  /** Save from inline panel in expanded row. Spec: Inline-Panels für Detail/Edit */
  onSaveEntry?: (entry: RegisterEntry, data: Record<string, unknown>, status: string) => void | Promise<void>
  saveEntryPending?: boolean
  projectNameById?: Record<string, string>
}

function statusDot(status: string): string {
  const s = status.toLowerCase()
  if (s === 'closed' || s === 'resolved') return 'bg-emerald-500'
  if (s === 'in_progress' || s === 'mitigating') return 'bg-amber-500'
  return 'bg-slate-400'
}

export default function RegisterGrid({
  registerType,
  entries,
  loading,
  onAISuggest,
  onEdit,
  onDelete,
  onExpand,
  onSaveEntry,
  saveEntryPending = false,
  projectNameById,
}: RegisterGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const schema = REGISTER_TYPE_SCHEMAS[registerType]

  const toggleExpand = (entry: RegisterEntry) => {
    setExpandedId((id) => (id === entry.id ? null : entry.id))
    if (expandedId !== entry.id) onExpand?.(entry)
  }

  const getTitle = (e: RegisterEntry) =>
    (e.data?.title as string) || (e.data?.name as string) || 'Untitled'

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
        <div className="animate-pulse space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded bg-gray-100 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="w-8 px-3 py-2" scope="col" aria-label="Expand" />
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Title
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Project
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Updated
              </th>
              <th className="w-24 px-3 py-2" scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-600 dark:bg-slate-900">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
                  No entries yet. Add one or use AI Suggest.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry)}
                        className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-slate-600"
                        aria-expanded={expandedId === entry.id}
                        aria-label={expandedId === entry.id ? 'Collapse' : 'Expand'}
                      >
                        {expandedId === entry.id ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {getTitle(entry)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-slate-400">
                      {entry.project_id ? (projectNameById?.[entry.project_id] ?? entry.project_id) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${statusDot(entry.status)}`} />
                      <span className="ml-1.5 text-xs text-gray-600 dark:text-slate-300">
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400">
                      {new Date(entry.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {onAISuggest && (
                          <button
                            type="button"
                            onClick={() => onAISuggest(entry)}
                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-slate-600"
                            title="AI suggest"
                          >
                            <Sparkles className="h-4 w-4 text-indigo-500" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(entry)}
                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-slate-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-gray-500" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(entry)}
                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-slate-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="bg-gray-50 dark:bg-slate-800/50">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="space-y-3">
                          {onSaveEntry ? (
                            <RegisterInlinePanel
                              type={registerType}
                              entry={entry}
                              onSave={(data, status) => {
                                const p = onSaveEntry(entry, data, status)
                                if (p && typeof (p as Promise<unknown>).then === 'function') (p as Promise<void>).then(() => setExpandedId(null))
                              }}
                              onCancel={() => setExpandedId(null)}
                              isPending={saveEntryPending}
                            />
                          ) : (
                            <div className="rounded border border-gray-200 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900">
                              <pre className="max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-slate-800">
                                {JSON.stringify(entry.data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {schema.nested && Array.isArray(entry.data?.[schema.nested.key]) && (
                            <RegisterNestedGrid
                              schema={schema.nested}
                              items={entry.data[schema.nested.key] as Record<string, unknown>[]}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
