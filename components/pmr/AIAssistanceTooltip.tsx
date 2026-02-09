'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, X } from 'lucide-react'

export interface AITooltipContent {
  type: 'suggestion' | 'tip' | 'insight' | 'warning' | 'success'
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
}

export interface AIAssistanceTooltipProps {
  content: AITooltipContent
  isVisible: boolean
  onDismiss?: () => void
  position?: 'top' | 'bottom' | 'left' | 'right'
  autoHide?: boolean
  autoHideDelay?: number
  className?: string
}

export const AIAssistanceTooltip: React.FC<AIAssistanceTooltipProps> = ({
  content,
  isVisible,
  onDismiss,
  position = 'top',
  autoHide = false,
  autoHideDelay = 5000,
  className = ''
}) => {
  const [show, setShow] = useState(isVisible)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    setShow(isVisible)

    if (isVisible && autoHide) {
      timeoutRef.current = setTimeout(() => {
        handleDismiss()
      }, autoHideDelay)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isVisible, autoHide, autoHideDelay])

  const handleDismiss = () => {
    setShow(false)
    onDismiss?.()
  }

  const getIcon = () => {
    switch (content.type) {
      case 'suggestion':
        return <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
      case 'tip':
        return <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      case 'insight':
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    }
  }

  const getColorClasses = () => {
    switch (content.type) {
      case 'suggestion':
        return 'bg-purple-50 border-purple-200'
      case 'tip':
        return 'bg-yellow-50 border-yellow-200 dark:border-yellow-800'
      case 'insight':
        return 'bg-blue-50 border-blue-200 dark:border-blue-800'
      case 'warning':
        return 'bg-orange-50 border-orange-200'
      case 'success':
        return 'bg-green-50 border-green-200 dark:border-green-800'
    }
  }

  const getTextColorClasses = () => {
    switch (content.type) {
      case 'suggestion':
        return 'text-purple-900'
      case 'tip':
        return 'text-yellow-900'
      case 'insight':
        return 'text-blue-900'
      case 'warning':
        return 'text-orange-900'
      case 'success':
        return 'text-green-900'
    }
  }

  const getButtonColorClasses = () => {
    switch (content.type) {
      case 'suggestion':
        return 'bg-purple-600 hover:bg-purple-700'
      case 'tip':
        return 'bg-yellow-600 hover:bg-yellow-700'
      case 'insight':
        return 'bg-blue-600 hover:bg-blue-700'
      case 'warning':
        return 'bg-orange-600 hover:bg-orange-700'
      case 'success':
        return 'bg-green-600 hover:bg-green-700'
    }
  }

  if (!show) return null

  return (
    <div
      className={`
        relative rounded-lg border-2 shadow-lg p-4 max-w-sm
        ${getColorClasses()}
        ${className}
        animate-in fade-in slide-in-from-top-2 duration-300
      `}
      role="alert"
    >
      {/* Dismiss button */}
      {content.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Content */}
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${getTextColorClasses()} mb-1`}>
            {content.title}
          </h4>
          <p className={`text-sm ${getTextColorClasses()} opacity-90`}>
            {content.message}
          </p>

          {/* Action button */}
          {content.action && (
            <button
              onClick={content.action.onClick}
              className={`
                mt-3 px-3 py-1.5 text-xs font-medium text-white rounded-md
                transition-colors
                ${getButtonColorClasses()}
              `}
            >
              {content.action.label}
            </button>
          )}
        </div>
      </div>

      {/* Arrow indicator based on position */}
      <div
        className={`
          absolute w-3 h-3 transform rotate-45
          ${getColorClasses()}
          ${position === 'top' ? 'bottom-[-7px] left-1/2 -translate-x-1/2' : ''}
          ${position === 'bottom' ? 'top-[-7px] left-1/2 -translate-x-1/2' : ''}
          ${position === 'left' ? 'right-[-7px] top-1/2 -translate-y-1/2' : ''}
          ${position === 'right' ? 'left-[-7px] top-1/2 -translate-y-1/2' : ''}
        `}
      />
    </div>
  )
}

// Predefined AI assistance tooltips for common scenarios
export const PMR_AI_TOOLTIPS = {
  emptySection: {
    type: 'suggestion' as const,
    title: 'AI Can Help!',
    message: 'This section is empty. Would you like AI to generate initial content based on your project data?',
    action: {
      label: 'Generate Content',
      onClick: () => console.log('Generate content')
    }
  },
  lowConfidence: {
    type: 'warning' as const,
    title: 'Low Confidence Score',
    message: 'This AI-generated content has a low confidence score. Please review and verify the information.',
    dismissible: true
  },
  insightAvailable: {
    type: 'insight' as const,
    title: 'New Insights Available',
    message: 'AI has detected important patterns in your project data. Check the Insights panel for details.',
    action: {
      label: 'View Insights',
      onClick: () => console.log('View insights')
    }
  },
  collaborationConflict: {
    type: 'warning' as const,
    title: 'Editing Conflict',
    message: 'Another user is editing this section. Your changes may conflict with theirs.',
    dismissible: true
  },
  saveSuccess: {
    type: 'success' as const,
    title: 'Saved Successfully',
    message: 'Your changes have been saved and synced with all collaborators.',
    dismissible: true
  },
  exportReady: {
    type: 'success' as const,
    title: 'Export Ready',
    message: 'Your report export is ready for download.',
    action: {
      label: 'Download',
      onClick: () => console.log('Download export')
    }
  },
  dataStale: {
    type: 'tip' as const,
    title: 'Data May Be Outdated',
    message: 'Project data hasn\'t been updated in 7 days. Consider refreshing metrics for more accurate insights.',
    action: {
      label: 'Refresh Data',
      onClick: () => console.log('Refresh data')
    }
  },
  templateSuggestion: {
    type: 'suggestion' as const,
    title: 'Better Template Available',
    message: 'Based on your project type, we recommend using the "Construction PMR" template for better structure.',
    action: {
      label: 'Switch Template',
      onClick: () => console.log('Switch template')
    }
  }
}

// Hook to manage AI tooltip state
export const useAITooltip = () => {
  const [activeTooltip, setActiveTooltip] = useState<AITooltipContent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const showTooltip = (content: AITooltipContent) => {
    setActiveTooltip(content)
    setIsVisible(true)
  }

  const hideTooltip = () => {
    setIsVisible(false)
    // Delay clearing content to allow fade-out animation
    setTimeout(() => setActiveTooltip(null), 300)
  }

  const showPredefinedTooltip = (key: keyof typeof PMR_AI_TOOLTIPS) => {
    showTooltip(PMR_AI_TOOLTIPS[key])
  }

  return {
    activeTooltip,
    isVisible,
    showTooltip,
    hideTooltip,
    showPredefinedTooltip
  }
}

export default AIAssistanceTooltip
