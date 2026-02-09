'use client'

/**
 * AI Change Highlight - Visual indicators for changed items
 * Requirements: 5.3, 5.4
 */

import React from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { AlertCircle } from 'lucide-react'
import type { ChangeHighlight } from './types'

interface AIChangeHighlightProps {
  changes: ChangeHighlight[]
  newCount?: number
}

export default function AIChangeHighlight({ changes, newCount }: AIChangeHighlightProps) {
  const { t } = useTranslations()
  const added = changes.filter((c) => c.changeType === 'added').length
  const modified = changes.filter((c) => c.changeType === 'modified').length
  const count = newCount ?? added

  if (count === 0 && modified === 0) return null

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"
      data-testid="ai-change-highlight"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {count > 0 && (
        <span className="font-medium">
          {t('common.newItemsSinceLastView', { count })}
        </span>
      )}
      {modified > 0 && (
        <span>
          {count > 0 ? ', ' : ''}
          {modified} modified
        </span>
      )}
    </div>
  )
}
