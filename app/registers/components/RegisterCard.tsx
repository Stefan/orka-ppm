'use client'

import type { RegisterEntry } from '@/types/registers'
import { Sparkles, MoreVertical } from 'lucide-react'
import { useState } from 'react'

export interface RegisterCardProps {
  entry: RegisterEntry
  onAISuggest?: (entry: RegisterEntry) => void
  onEdit?: (entry: RegisterEntry) => void
  onDelete?: (entry: RegisterEntry) => void
  projectName?: string
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'closed' || s === 'resolved') return 'bg-emerald-500'
  if (s === 'in_progress' || s === 'mitigating') return 'bg-amber-500'
  return 'bg-slate-400 dark:bg-slate-500'
}

function progressFromData(data: Record<string, unknown>): number {
  const p = data.progress ?? data.probability
  if (typeof p === 'number') return Math.round(p * 100)
  return 0
}

export default function RegisterCard({
  entry,
  onAISuggest,
  onEdit,
  onDelete,
  projectName,
}: RegisterCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const title = (entry.data?.title as string) || (entry.data?.name as string) || 'Untitled'
  const progress = progressFromData(entry.data)

  return (
    <div
      className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow dark:border-slate-600 dark:bg-slate-800"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => { setShowDetails(false); setMenuOpen(false) }}
    >
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusColor(entry.status)}`}
              title={entry.status}
              aria-hidden
            />
            <span className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
              {title}
            </span>
          </div>
          {progress > 0 && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all dark:bg-indigo-400"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onAISuggest && (
            <button
              type="button"
              onClick={() => onAISuggest(entry)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
              title="AI suggest"
              aria-label="AI suggest"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
              aria-label="Actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                {onEdit && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => { onEdit(entry); setMenuOpen(false) }}
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => { onDelete(entry); setMenuOpen(false) }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showDetails && (
        <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">
          <div>Status: {entry.status}</div>
          <div>Updated: {new Date(entry.updated_at).toLocaleDateString()}</div>
          {entry.project_id && <div>Project: {projectName ?? entry.project_id}</div>}
        </div>
      )}
    </div>
  )
}
