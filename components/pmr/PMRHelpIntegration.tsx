'use client'

import React, { useState, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import ContextualHelp from './ContextualHelp'
import OnboardingTour, { useOnboardingTour, enhancedPMRTourSteps } from './OnboardingTour'
import AIAssistanceTooltip, { useAITooltip, PMR_AI_TOOLTIPS } from './AIAssistanceTooltip'
import { getPMRHelpContent } from '../../lib/pmr-help-content'

export interface PMRHelpIntegrationProps {
  // Control which help features are enabled
  enableOnboarding?: boolean
  enableContextualHelp?: boolean
  enableAITooltips?: boolean
  
  // Callbacks for help interactions
  onHelpInteraction?: (type: string, action: string) => void
  
  // Custom tour steps (optional)
  customTourSteps?: typeof enhancedPMRTourSteps
  
  className?: string
}

export const PMRHelpIntegration: React.FC<PMRHelpIntegrationProps> = ({
  enableOnboarding = true,
  enableContextualHelp = true,
  enableAITooltips = true,
  onHelpInteraction,
  customTourSteps,
  className = ''
}) => {
  // Onboarding tour state
  const {
    isOpen: isTourOpen,
    hasCompletedTour,
    startTour,
    closeTour,
    resetTour
  } = useOnboardingTour('enhanced-pmr-v1')

  // AI tooltip state
  const {
    activeTooltip,
    isVisible: isTooltipVisible,
    showTooltip,
    hideTooltip,
    showPredefinedTooltip
  } = useAITooltip()

  // Track help interactions
  const trackInteraction = (type: string, action: string) => {
    onHelpInteraction?.(type, action)
    
    // Log to analytics (if available)
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('PMR Help Interaction', {
        type,
        action,
        timestamp: new Date().toISOString()
      })
    }
  }

  // Show AI tooltips based on context
  useEffect(() => {
    if (!enableAITooltips) return

    // Example: Show tooltip when user hasn't saved in a while
    const checkUnsavedChanges = () => {
      const lastSave = localStorage.getItem('pmr-last-save')
      if (lastSave) {
        const timeSinceLastSave = Date.now() - parseInt(lastSave)
        const fiveMinutes = 5 * 60 * 1000
        
        if (timeSinceLastSave > fiveMinutes) {
          showPredefinedTooltip('dataStale')
          trackInteraction('ai-tooltip', 'data-stale-shown')
        }
      }
    }

    const interval = setInterval(checkUnsavedChanges, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [enableAITooltips, showPredefinedTooltip])

  // Handle tour completion
  const handleTourComplete = () => {
    trackInteraction('onboarding-tour', 'completed')
    closeTour()
  }

  // Handle tour skip
  const handleTourClose = () => {
    trackInteraction('onboarding-tour', 'skipped')
    closeTour()
  }

  return (
    <div className={className}>
      {/* Onboarding Tour */}
      {enableOnboarding && (
        <OnboardingTour
          steps={customTourSteps || enhancedPMRTourSteps}
          isOpen={isTourOpen}
          onClose={handleTourClose}
          onComplete={handleTourComplete}
          tourId="enhanced-pmr-v1"
        />
      )}

      {/* AI Assistance Tooltip */}
      {enableAITooltips && activeTooltip && (
        <div className="fixed top-20 right-4 z-50">
          <AIAssistanceTooltip
            content={activeTooltip}
            isVisible={isTooltipVisible}
            onDismiss={() => {
              hideTooltip()
              trackInteraction('ai-tooltip', 'dismissed')
            }}
            autoHide={true}
            autoHideDelay={8000}
          />
        </div>
      )}

      {/* Help Menu Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="relative">
          {/* Main help button */}
          <button
            onClick={() => {
              // Toggle help menu
              trackInteraction('help-menu', 'opened')
            }}
            className="flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="Help"
            data-tour="help"
          >
            <HelpCircle className="h-6 w-6" />
          </button>

          {/* Quick help actions */}
          <div className="absolute bottom-16 right-0 space-y-2">
            {/* Restart tour button */}
            {enableOnboarding && hasCompletedTour && (
              <button
                onClick={() => {
                  resetTour()
                  trackInteraction('onboarding-tour', 'restarted')
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm whitespace-nowrap"
              >
                <span>🎯</span>
                <span>Restart Tour</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Export helper hooks for use in other components
export { useOnboardingTour, useAITooltip }

// Export help content getter
export { getPMRHelpContent }

export default PMRHelpIntegration
