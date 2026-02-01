'use client'

import React, { useCallback, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'

export interface FeatureSearchBarProps {
  value: string
  onChange: (value: string) => void
  onAISuggest?: (query: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const DEBOUNCE_MS = 200

export function FeatureSearchBar({
  value,
  onChange,
  onAISuggest,
  placeholder = 'Search features…',
  className = '',
  disabled = false,
}: FeatureSearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const syncUp = useCallback(
    (v: string) => {
      if (timer) clearTimeout(timer)
      setTimer(
        setTimeout(() => {
          onChange(v)
          setTimer(null)
        }, DEBOUNCE_MS)
      )
    },
    [onChange, timer]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalValue(v)
    syncUp(v)
  }

  const handleAIClick = () => {
    if (onAISuggest && localValue.trim()) {
      onAISuggest(localValue.trim())
    }
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${className}`}
      data-testid="feature-search-bar"
    >
      <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 bg-transparent text-gray-900 placeholder-gray-500 outline-none text-sm"
        aria-label="Search features"
      />
      {onAISuggest && (
        <button
          type="button"
          onClick={handleAIClick}
          disabled={disabled || !localValue.trim()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="AI suggestions"
          data-testid="feature-search-ai-suggest"
        >
          <Sparkles className="h-4 w-4" />
          Suggest
        </button>
      )}
    </div>
  )
}
