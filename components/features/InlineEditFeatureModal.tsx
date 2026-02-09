'use client'

import React, { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import type { Feature } from '@/types/features'

export interface InlineEditFeatureModalProps {
  feature: Feature
  open: boolean
  onClose: () => void
  onSaved: (updated: Feature) => void
}

export function InlineEditFeatureModal({
  feature,
  open,
  onClose,
  onSaved,
}: InlineEditFeatureModalProps) {
  const [name, setName] = useState(feature.name)
  const [description, setDescription] = useState(feature.description ?? '')
  const [link, setLink] = useState(feature.link ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSaving(true)
      try {
        const res = await fetch(`/api/features/${feature.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || feature.name,
            description: description.trim() || null,
            link: link.trim() || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setError((err as { error?: string }).error ?? 'Update failed')
          return
        }
        const updated = (await res.json()) as Feature
        onSaved(updated)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
      } finally {
        setSaving(false)
      }
    },
    [feature.id, feature.name, name, description, link, onSaved, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inline-edit-feature-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-3">
          <h2 id="inline-edit-feature-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Edit feature
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="edit-feature-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Name
            </label>
            <input
              id="edit-feature-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-feature-description" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              id="edit-feature-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm resize-y"
            />
          </div>
          <div>
            <label htmlFor="edit-feature-link" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Link
            </label>
            <input
              id="edit-feature-link"
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/financials"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
