'use client'

/**
 * AI Suggestion Panel - Popular column combinations
 * Requirements: 2.6
 */

import React, { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ItemType, AISuggestion } from './types'
import { generateColumnSuggestions } from '@/lib/register-nested-grids/ai-suggestions'

interface AISuggestionPanelProps {
  itemType: ItemType
  onApply?: (columns: string[]) => void
}

export default function AISuggestionPanel({ itemType, onApply }: AISuggestionPanelProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateColumnSuggestions(itemType).then(setSuggestions).finally(() => setLoading(false))
  }, [itemType])

  if (loading || !suggestions.length) return null

  return (
    <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100" data-testid="ai-suggestion-panel">
      <h4 className="text-xs font-medium text-indigo-800 flex items-center gap-1 mb-2">
        <Sparkles className="w-3 h-3" /> AI Suggestions
      </h4>
      <div className="space-y-1">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-700 truncate flex-1">{s.suggestion.reason}</span>
            <span className="text-gray-500 ml-1">{(s.confidence * 100).toFixed(0)}%</span>
            {onApply && s.suggestion.columns && (
              <button
                type="button"
                onClick={() => onApply(s.suggestion.columns!)}
                className="ml-2 px-2 py-0.5 text-indigo-600 hover:bg-indigo-100 rounded text-xs"
              >
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
