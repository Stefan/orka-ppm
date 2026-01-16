'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check,
  Sparkles,
  FileText,
  Users,
  Download,
  Eye,
  MessageSquare
} from 'lucide-react'

export interface TourStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export interface OnboardingTourProps {
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  tourId: string // Unique ID to track completion
  className?: string
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  tourId,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  // Calculate positions for tooltip and highlight
  const updatePositions = useCallback(() => {
    if (!step || !isOpen) return

    const targetElement = document.querySelector(step.target)
    if (!targetElement || !tooltipRef.current) return

    const targetRect = targetElement.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const padding = 16

    setHighlightRect(targetRect)

    let top = 0
    let left = 0

    const position = step.position || 'bottom'

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - padding
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
        break
      case 'bottom':
        top = targetRect.bottom + padding
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
        break
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
        left = targetRect.left - tooltipRect.width - padding
        break
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
        left = targetRect.right + padding
        break
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2
        left = window.innerWidth / 2 - tooltipRect.width / 2
        break
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < padding) left = padding
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding
    }

    setTooltipPosition({ top, left })
  }, [step, isOpen])

  // Update positions on mount, step change, and window resize
  useEffect(() => {
    if (!isOpen) return

    updatePositions()

    const handleResize = () => updatePositions()
    const handleScroll = () => updatePositions()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, currentStep, updatePositions])

  // Scroll target element into view
  useEffect(() => {
    if (!step || !isOpen) return

    const targetElement = document.querySelector(step.target)
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })
    }
  }, [step, isOpen])

  const handleNext = () => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  const handleComplete = () => {
    // Mark tour as completed in localStorage
    localStorage.setItem(`tour-completed-${tourId}`, 'true')
    onComplete()
    onClose()
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleSkip()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  if (!isOpen || !step) return null

  const overlay = (
    <>
      {/* Overlay with spotlight effect */}
      <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'none' }}>
        {/* Dark overlay */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.left - 4}
                  y={highlightRect.top - 4}
                  width={highlightRect.width + 8}
                  height={highlightRect.height + 8}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Highlight border */}
        {highlightRect && (
          <div
            className="absolute border-2 border-blue-500 rounded-lg shadow-lg"
            style={{
              top: `${highlightRect.top - 4}px`,
              left: `${highlightRect.left - 4}px`,
              width: `${highlightRect.width + 8}px`,
              height: `${highlightRect.height + 8}px`,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`fixed z-[9999] w-96 bg-white rounded-lg shadow-2xl border border-gray-200 ${className}`}
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div className="flex items-start space-x-3 flex-1">
            {step.icon && (
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-100 rounded-lg">
                {step.icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
              <p className="text-xs text-gray-500 mt-1">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-700">{step.description}</p>

          {/* Action button if provided */}
          {step.action && (
            <button
              onClick={step.action.onClick}
              className="mt-3 w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              {step.action.label}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          {/* Progress dots */}
          <div className="flex items-center space-x-1">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-600'
                    : index < currentStep
                    ? 'bg-blue-300'
                    : 'bg-gray-300'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <span>{isLastStep ? 'Finish' : 'Next'}</span>
              {isLastStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return typeof window !== 'undefined' ? createPortal(overlay, document.body) : null
}

// Predefined tour for Enhanced PMR
export const enhancedPMRTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Enhanced PMR!',
    description: 'Let\'s take a quick tour of the key features that make Enhanced PMR 3x better than traditional reporting tools. This will only take a minute.',
    target: 'body',
    position: 'center',
    icon: <Sparkles className="h-6 w-6 text-blue-600" />
  },
  {
    id: 'editor',
    title: 'Rich Text Editor',
    description: 'Create and edit your report sections with our powerful rich text editor. Use the toolbar for formatting, and content auto-saves as you type.',
    target: '[data-tour="editor"]',
    position: 'right',
    icon: <FileText className="h-6 w-6 text-blue-600" />
  },
  {
    id: 'ai-insights',
    title: 'AI-Powered Insights',
    description: 'Get intelligent insights, predictions, and recommendations based on your project data. Click "Generate Insights" to see AI analysis of budget, schedule, resources, and risks.',
    target: '[data-tour="ai-insights"]',
    position: 'left',
    icon: <Sparkles className="h-6 w-6 text-purple-600" />
  },
  {
    id: 'collaboration',
    title: 'Real-Time Collaboration',
    description: 'Work together with your team in real-time. See who\'s online, view their cursors, add comments, and resolve conflicts seamlessly.',
    target: '[data-tour="collaboration"]',
    position: 'left',
    icon: <Users className="h-6 w-6 text-green-600" />
  },
  {
    id: 'export',
    title: 'Multi-Format Export',
    description: 'Export your reports in PDF, Excel, PowerPoint, or Word format with professional templates and branding. Perfect for stakeholder distribution.',
    target: '[data-tour="export"]',
    position: 'bottom',
    icon: <Download className="h-6 w-6 text-orange-600" />
  },
  {
    id: 'preview',
    title: 'Preview Mode',
    description: 'Switch between Edit and Preview modes to see how your report will look to stakeholders. Preview mode is read-only and perfect for review.',
    target: '[data-tour="preview"]',
    position: 'bottom',
    icon: <Eye className="h-6 w-6 text-indigo-600" />
  },
  {
    id: 'help',
    title: 'Need Help?',
    description: 'Click the help icon anytime to get contextual assistance, or use the AI chat to ask questions. We\'re here to help you create amazing reports!',
    target: '[data-tour="help"]',
    position: 'bottom',
    icon: <MessageSquare className="h-6 w-6 text-blue-600" />
  }
]

// Hook to manage tour state
export const useOnboardingTour = (tourId: string) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasCompletedTour, setHasCompletedTour] = useState(false)

  useEffect(() => {
    // Check if tour has been completed
    const completed = localStorage.getItem(`tour-completed-${tourId}`) === 'true'
    setHasCompletedTour(completed)

    // Auto-start tour for new users (optional)
    if (!completed) {
      // Delay to allow page to render
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [tourId])

  const startTour = () => setIsOpen(true)
  const closeTour = () => setIsOpen(false)
  const resetTour = () => {
    localStorage.removeItem(`tour-completed-${tourId}`)
    setHasCompletedTour(false)
    setIsOpen(true)
  }

  return {
    isOpen,
    hasCompletedTour,
    startTour,
    closeTour,
    resetTour
  }
}

export default OnboardingTour
