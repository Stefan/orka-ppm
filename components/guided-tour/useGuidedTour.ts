'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'tour-completed'

/**
 * Hook for guided tours. Completion is stored per tourId (include version, e.g. "dashboard-v1").
 * - Does NOT auto-start: user must click "Tour starten" to avoid showing every time.
 * - When you change steps/functionality, bump version in tourId (e.g. "dashboard-v2") so
 *   "completed" state is separate and users can run the updated tour.
 */
export function useGuidedTour(tourId: string, options?: { autoStart?: boolean }) {
  const autoStart = options?.autoStart ?? false
  const [isOpen, setIsOpen] = useState(false)
  const [hasCompletedTour, setHasCompletedTour] = useState(false)

  useEffect(() => {
    const completed = typeof window !== 'undefined' && localStorage.getItem(`${STORAGE_KEY}-${tourId}`) === 'true'
    setHasCompletedTour(!!completed)
    if (autoStart && !completed) {
      const timer = setTimeout(() => setIsOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [tourId, autoStart])

  const startTour = useCallback(() => setIsOpen(true), [])
  const closeTour = useCallback(() => setIsOpen(false), [])
  const completeTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY}-${tourId}`, 'true')
    }
    setHasCompletedTour(true)
    setIsOpen(false)
  }, [tourId])

  /** Restart tour (clear completion and open). User can always "Tour erneut starten". */
  const resetAndStartTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_KEY}-${tourId}`)
    }
    setHasCompletedTour(false)
    setIsOpen(true)
  }, [tourId])

  return {
    isOpen,
    hasCompletedTour,
    startTour,
    closeTour,
    completeTour,
    resetAndStartTour,
  }
}
