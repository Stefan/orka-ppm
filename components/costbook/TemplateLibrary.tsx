'use client'

// Template Library for Costbook (Task 42.4)
// Display and load saved/shared import templates.

import React, { useState, useEffect } from 'react'
import { FileText, Trash2, Share2, Loader2 } from 'lucide-react'
import { listTemplates, getTemplate, deleteTemplate, ImportTemplate } from '@/lib/costbook/import-templates'

export interface TemplateLibraryProps {
  schema: 'commitment' | 'actual'
  onSelectTemplate?: (template: ImportTemplate) => void
  onClose?: () => void
  className?: string
}

export function TemplateLibrary({
  schema,
  onSelectTemplate,
  onClose,
  className = ''
}: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showSharedOnly, setShowSharedOnly] = useState(false)

  useEffect(() => {
    setLoading(true)
    const list = listTemplates({ sharedOnly: showSharedOnly })
    setTemplates(list.filter(t => t.schema === schema))
    setLoading(false)
  }, [schema, showSharedOnly])

  const handleDelete = (id: string) => {
    if (deleteTemplate(id)) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleLoad = (id: string) => {
    const t = getTemplate(id)
    if (t) onSelectTemplate?.(t)
  }

  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">Import Templates</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
            Close
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <input
          type="checkbox"
          checked={showSharedOnly}
          onChange={(e) => setShowSharedOnly(e.target.checked)}
          className="rounded"
        />
        Show shared only
      </label>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No templates saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                {t.isShared && <Share2 className="w-3 h-3 text-blue-500 flex-shrink-0" title="Shared" />}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleLoad(t.id)}
                  className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
