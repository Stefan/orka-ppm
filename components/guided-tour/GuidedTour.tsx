'use client'

import React from 'react'
import OnboardingTour from '../pmr/OnboardingTour'
import type { TourStep } from '../pmr/OnboardingTour'

export type { TourStep }

export interface GuidedTourProps {
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  tourId: string
  className?: string
}

/**
 * Wrapper around PMR OnboardingTour for use across the app.
 * Use with useGuidedTour; onComplete should call completeTour() to persist completion.
 */
export function GuidedTour({ steps, isOpen, onClose, onComplete, tourId, className }: GuidedTourProps) {
  return (
    <OnboardingTour
      steps={steps}
      isOpen={isOpen}
      onClose={onClose}
      onComplete={onComplete}
      tourId={tourId}
      className={className}
    />
  )
}

export default GuidedTour
