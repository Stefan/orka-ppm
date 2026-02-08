'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  fetchSavedViews,
  createSavedView,
  deleteSavedView,
  type SavedView,
  type SavedViewDefinition,
} from '@/lib/saved-views-api'
import { Bookmark, Plus, Trash2 } from 'lucide-react'

export interface SavedViewsDropdownProps {
  scope: string
  accessToken: string | undefined
  currentDefinition?: SavedViewDefinition
  /** Called when a view is applied; second arg is the full view (for showing name in UI). */
  onApply?: (definition: SavedViewDefinition, view?: SavedView) => void
  /** Name of the currently applied view (shown on the button). */
  appliedViewName?: string | null
  label?: string
}

export function SavedViewsDropdown({
  scope,
  accessToken,
  currentDefinition,
  onApply,
  appliedViewName,
  label = 'Saved views',
}: SavedViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const list = await fetchSavedViews(accessToken, scope)
      setViews(list)
    } catch {
      setViews([])
    } finally {
      setLoading(false)
    }
  }, [accessToken, scope])

  useEffect(() => {
    if (open && accessToken) load()
  }, [open, accessToken, load])

  const handleSave = async () => {
    if (!accessToken || !currentDefinition || !saveName.trim()) return
    setSaving(true)
    try {
      await createSavedView(accessToken, {
        name: saveName.trim(),
        scope,
        definition: currentDefinition,
      })
      setSaveName('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation()
    if (!accessToken) return
    try {
      await deleteSavedView(accessToken, viewId)
      await load()
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
      >
        <Bookmark className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[12rem]">
          {appliedViewName ? `${label}: ${appliedViewName}` : label}
        </span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-2">
            {loading ? (
              <div className="px-3 py-2 text-sm text-slate-500">Loading…</div>
            ) : (
              <>
                {views.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">No saved views</div>
                )}
                {views.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left text-sm text-slate-900 dark:text-slate-100"
                      onClick={() => {
                        onApply?.(v.definition, v)
                        setOpen(false)
                      }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, v.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                      aria-label={`Delete ${v.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {currentDefinition && (
                  <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2 px-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Save as..."
                        className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving || !saveName.trim()}
                        onClick={handleSave}
                        className="flex items-center gap-1 rounded bg-slate-700 text-white px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
