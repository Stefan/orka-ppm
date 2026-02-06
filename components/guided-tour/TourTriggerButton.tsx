'use client'

import React from 'react'
import { HelpCircle } from 'lucide-react'

export interface TourTriggerButtonProps {
  onStart: () => void
  hasCompletedTour: boolean
  labelStart?: string
  labelRestart?: string
  className?: string
}

/**
 * Button to start or restart the guided tour. Does not auto-show the tour.
 * Place it in the page header or next to the help icon.
 */
export function TourTriggerButton({
  onStart,
  hasCompletedTour,
  labelStart = 'Tour starten',
  labelRestart = 'Tour erneut starten',
  className = '',
}: TourTriggerButtonProps) {
  const label = hasCompletedTour ? labelRestart : labelStart
  return (
    <button
      type="button"
      onClick={onStart}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 ${className}`}
      aria-label={label}
      title={label}
    >
      <HelpCircle className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

export default TourTriggerButton
