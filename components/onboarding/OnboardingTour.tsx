'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Play, Pause, SkipForward } from 'lucide-react'
import { cn } from '../../lib/utils/design-system'

// Types for onboarding tour system
export interface OnboardingStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: 'click' | 'hover' | 'input' | 'scroll'
  actionDescription?: string
  optional?: boolean
  duration?: number // Auto-advance duration in ms
}

export interface OnboardingTour {
  id: string
  title: string
  description: string
  category: 'first-time' | 'feature' | 'workflow' | 'advanced'
  userRole?: string[]
  estimatedTime: number
  steps: OnboardingStep[]
  prerequisites?: string[]
  completionReward?: string
}

interface OnboardingTourProps {
  tour: OnboardingTour
  isActive: boolean
  onComplete: () => void
  onSkip: () => void
  onStepChange?: (stepIndex: number) => void
  className?: string
}

interface SpotlightOverlayProps {
  targetElement: Element | null
  isVisible: boolean
}

const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({ targetElement, isVisible }) => {
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!targetElement || !isVisible) {
      setSpotlightStyle({})
      return
    }

    const updateSpotlight = () => {
      const rect = targetElement.getBoundingClientRect()
      const padding = 8
      
      setSpotlightStyle({
        clipPath: `polygon(
          0% 0%, 
          0% 100%, 
          ${rect.left - padding}px 100%, 
          ${rect.left - padding}px ${rect.top - padding}px, 
          ${rect.right + padding}px ${rect.top - padding}px, 
          ${rect.right + padding}px ${rect.bottom + padding}px, 
          ${rect.left - padding}px ${rect.bottom + padding}px, 
          ${rect.left - padding}px 100%, 
          100% 100%, 
          100% 0%
        )`
      })
    }

    updateSpotlight()
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight)

    return () => {
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight)
    }
  }, [targetElement, isVisible])

  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-40 transition-all duration-300"
      style={spotlightStyle}
    />
  )
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  tour,
  isActive,
  onComplete,
  onSkip,
  onStepChange,
  className
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const currentStep = tour.steps[currentStepIndex]

  // Find and highlight target element
  useEffect(() => {
    if (!isActive || !currentStep?.target) {
      setTargetElement(null)
      return
    }

    const findTarget = () => {
      const element = document.querySelector(currentStep.target)
      if (element) {
        setTargetElement(element)
        
        // Scroll element into view
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        })

        // Calculate tooltip position
        const rect = element.getBoundingClientRect()
        const tooltipRect = tooltipRef.current?.getBoundingClientRect()
        
        let x = rect.left + rect.width / 2
        let y = rect.top

        if (tooltipRect) {
          // Adjust position based on step position preference
          switch (currentStep.position) {
            case 'top':
              y = rect.top - tooltipRect.height - 16
              break
            case 'bottom':
              y = rect.bottom + 16
              break
            case 'left':
              x = rect.left - tooltipRect.width - 16
              y = rect.top + rect.height / 2 - tooltipRect.height / 2
              break
            case 'right':
              x = rect.right + 16
              y = rect.top + rect.height / 2 - tooltipRect.height / 2
              break
            case 'center':
              x = window.innerWidth / 2 - tooltipRect.width / 2
              y = window.innerHeight / 2 - tooltipRect.height / 2
              break
          }

          // Keep tooltip within viewport
          x = Math.max(16, Math.min(x, window.innerWidth - tooltipRect.width - 16))
          y = Math.max(16, Math.min(y, window.innerHeight - tooltipRect.height - 16))
        }

        setTooltipPosition({ x, y })
      }
    }

    // Try to find element immediately
    findTarget()

    // If not found, retry with a delay (element might not be rendered yet)
    const retryTimeout = setTimeout(findTarget, 100)

    return () => clearTimeout(retryTimeout)
  }, [currentStep, isActive])

  // Auto-advance functionality
  useEffect(() => {
    if (!isPlaying || !currentStep?.duration) return

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      nextStep()
    }, currentStep.duration)

    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
      }
    }
  }, [currentStepIndex, isPlaying, currentStep])

  const nextStep = useCallback(() => {
    if (currentStepIndex < tour.steps.length - 1) {
      const newIndex = currentStepIndex + 1
      setCurrentStepIndex(newIndex)
      setCompletedSteps(prev => new Set([...prev, currentStepIndex]))
      onStepChange?.(newIndex)
    } else {
      // Tour completed
      setCompletedSteps(prev => new Set([...prev, currentStepIndex]))
      onComplete()
    }
  }, [currentStepIndex, tour.steps.length, onStepChange, onComplete])

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1
      setCurrentStepIndex(newIndex)
      onStepChange?.(newIndex)
    }
  }, [currentStepIndex, onStepChange])

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tour.steps.length) {
      setCurrentStepIndex(stepIndex)
      onStepChange?.(stepIndex)
    }
  }, [tour.steps.length, onStepChange])

  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => !prev)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          previousStep()
          break
        case 'Escape':
          e.preventDefault()
          onSkip()
          break
        case 'p':
        case 'P':
          e.preventDefault()
          togglePlayback()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isActive, nextStep, previousStep, onSkip, togglePlayback])

  if (!isActive) return null

  const progress = ((currentStepIndex + 1) / tour.steps.length) * 100

  return (
    <>
      {/* Spotlight Overlay */}
      <SpotlightOverlay targetElement={targetElement} isVisible={isActive} />

      {/* Tour Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm",
          "transform transition-all duration-300",
          className
        )}
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{tour.title}</h3>
            <p className="text-sm text-gray-600">
              Step {currentStepIndex + 1} of {tour.steps.length}
              {tour.estimatedTime && (
                <span className="ml-2">• ~{tour.estimatedTime} min</span>
              )}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="text-base font-medium text-gray-900 mb-2">
            {currentStep.title}
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            {currentStep.description}
          </p>

          {currentStep.actionDescription && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Try it:</strong> {currentStep.actionDescription}
              </p>
            </div>
          )}

          {currentStep.optional && (
            <div className="text-xs text-gray-500 mb-4">
              This step is optional and can be skipped.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={previousStep}
              disabled={currentStepIndex === 0}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlayback}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              aria-label={isPlaying ? "Pause tour" : "Play tour"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={nextStep}
              disabled={currentStepIndex === tour.steps.length - 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next step"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onSkip}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Skip Tour
            </button>

            <button
              onClick={nextStep}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {currentStepIndex === tour.steps.length - 1 ? (
                <>
                  Complete
                  {tour.completionReward && (
                    <span className="ml-1">🎉</span>
                  )}
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step Overview (collapsible) */}
        <details className="border-t border-gray-200">
          <summary className="px-4 py-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
            View all steps ({completedSteps.size}/{tour.steps.length} completed)
          </summary>
          <div className="px-4 pb-4 max-h-32 overflow-y-auto">
            <div className="space-y-1">
              {tour.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(index)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-xs transition-colors",
                    index === currentStepIndex
                      ? "bg-blue-100 text-blue-800"
                      : completedSteps.has(index)
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center">
                    <span className="w-4 text-center mr-2">
                      {completedSteps.has(index) ? "✓" : index + 1}
                    </span>
                    {step.title}
                    {step.optional && (
                      <span className="ml-1 text-gray-400">(optional)</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>
    </>
  )
}

export default OnboardingTour