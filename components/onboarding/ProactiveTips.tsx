'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  X, 
  Lightbulb, 
  ChevronRight,
  Clock,
  Star,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { useHelpChat } from '../../hooks/useHelpChat'
import { cn } from '../../lib/design-system'
import type { ProactiveTip, QuickAction } from '../../types/help-chat'

// Accessibility constants
const TIP_ARIA_LABELS = {
  tipContainer: 'Proactive help tips',
  minimizeTip: 'Minimize tip',
  maximizeTip: 'Maximize tip',
  dismissTip: 'Dismiss tip',
  expandTip: 'Expand tip content',
  collapseTip: 'Collapse tip content',
  tipActions: 'Tip action buttons',
  minimizeContainer: 'Minimize all tips',
  maximizeContainer: 'Show all tips'
} as const

interface ProactiveTipsProps {
  className?: string
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  maxVisible?: number
  autoHide?: boolean
  autoHideDelay?: number
}

interface TipDisplayProps {
  tip: ProactiveTip
  onDismiss: (tipId: string) => void
  onAction: (action: QuickAction) => void
  isMinimized: boolean
  onToggleMinimize: () => void
  tipIndex: number
  totalTips: number
}

/**
 * Individual tip display component with WCAG 2.1 AA accessibility
 */
function TipDisplay({ 
  tip, 
  onDismiss, 
  onAction, 
  isMinimized, 
  onToggleMinimize,
  tipIndex,
  totalTips
}: TipDisplayProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [announceMessage, setAnnounceMessage] = useState('')
  
  const tipRef = useRef<HTMLDivElement>(null)
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    setAnnounceMessage(message)
    setTimeout(() => setAnnounceMessage(''), 1000)
  }, [])

  useEffect(() => {
    // Animate in after mount
    const timer = setTimeout(() => {
      setIsVisible(true)
      announceToScreenReader(`New ${tip.type.replace('_', ' ')} tip available`)
    }, 100)
    return () => clearTimeout(timer)
  }, [tip.type, announceToScreenReader])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    announceToScreenReader('Tip dismissed')
    setTimeout(() => onDismiss(tip.id), 300) // Wait for animation
  }, [tip.id, onDismiss, announceToScreenReader])

  const handleAction = useCallback((action: QuickAction) => {
    announceToScreenReader(`Executing action: ${action.label}`)
    onAction(action)
    if (action.id === 'dismiss') {
      handleDismiss()
    }
  }, [onAction, handleDismiss, announceToScreenReader])

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded)
    announceToScreenReader(isExpanded ? 'Tip content collapsed' : 'Tip content expanded')
  }, [isExpanded, announceToScreenReader])

  const handleToggleMinimize = useCallback(() => {
    onToggleMinimize()
    announceToScreenReader(isMinimized ? 'Tip expanded' : 'Tip minimized')
  }, [onToggleMinimize, isMinimized, announceToScreenReader])

  // Enhanced keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDismiss()
    }
  }, [handleDismiss])

  const getPriorityIcon = () => {
    switch (tip.priority) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
      case 'medium':
        return <Star className="h-4 w-4 text-yellow-500" aria-hidden="true" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
      default:
        return <Lightbulb className="h-4 w-4 text-blue-500" aria-hidden="true" />
    }
  }

  const getPriorityColor = () => {
    switch (tip.priority) {
      case 'high':
        return 'border-red-200 bg-red-50'
      case 'medium':
        return 'border-yellow-200 bg-yellow-50'
      case 'low':
        return 'border-green-200 bg-green-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  const getTipTypeLabel = () => {
    switch (tip.type) {
      case 'welcome':
        return 'Welcome'
      case 'feature_discovery':
        return 'New Feature'
      case 'optimization':
        return 'Optimization'
      case 'best_practice':
        return 'Best Practice'
      default:
        return 'Tip'
    }
  }

  const getPriorityLabel = () => {
    switch (tip.priority) {
      case 'high':
        return 'High priority'
      case 'medium':
        return 'Medium priority'
      case 'low':
        return 'Low priority'
      default:
        return 'Normal priority'
    }
  }

  if (isMinimized) {
    return (
      <>
        {/* Screen reader announcements */}
        <div
          ref={announceRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announceMessage}
        </div>

        <div 
          className={cn(
            'flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all duration-300',
            'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
            getPriorityColor(),
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
          onClick={handleToggleMinimize}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`${getTipTypeLabel()} tip: ${tip.title}. ${getPriorityLabel()}. Click to expand.`}
          aria-expanded={false}
        >
          {getPriorityIcon()}
          <span className="text-sm font-medium truncate flex-1">{tip.title}</span>
          <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Screen reader announcements */}
      <div
        ref={announceRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceMessage}
      </div>

      <article 
        ref={tipRef}
        className={cn(
          'rounded-lg border-2 shadow-lg bg-white transition-all duration-300 max-w-sm',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
          getPriorityColor(),
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        )}
        role="article"
        aria-labelledby={`tip-${tip.id}-title`}
        aria-describedby={`tip-${tip.id}-content`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Header with enhanced accessibility */}
        <header className="flex items-start justify-between p-4 pb-2">
          <div className="flex items-start space-x-3 flex-1">
            <div role="img" aria-label={getPriorityLabel()}>
              {getPriorityIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  {getTipTypeLabel()}
                </span>
                {tip.priority === 'high' && (
                  <span 
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"
                    role="status"
                    aria-label="Important tip"
                  >
                    Important
                  </span>
                )}
              </div>
              <h3 
                id={`tip-${tip.id}-title`}
                className="text-sm font-semibold text-gray-900 leading-tight"
              >
                {tip.title}
              </h3>
              <div className="sr-only">
                Tip {tipIndex} of {totalTips}. {getPriorityLabel()}.
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 ml-2" role="group" aria-label="Tip controls">
            <button
              onClick={handleToggleMinimize}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={TIP_ARIA_LABELS.minimizeTip}
              title={TIP_ARIA_LABELS.minimizeTip}
            >
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            </button>
            {tip.dismissible && (
              <button
                onClick={handleDismiss}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={TIP_ARIA_LABELS.dismissTip}
                title={TIP_ARIA_LABELS.dismissTip}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {/* Content with enhanced accessibility */}
        <div className="px-4 pb-2">
          <div 
            id={`tip-${tip.id}-content`}
            className={cn(
              'text-sm text-gray-800 leading-relaxed',
              !isExpanded && tip.content.length > 120 && 'line-clamp-3'
            )}
            role="region"
            aria-label="Tip content"
          >
            {tip.content}
          </div>
          
          {tip.content.length > 120 && (
            <button
              onClick={handleToggleExpanded}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              aria-expanded={isExpanded}
              aria-controls={`tip-${tip.id}-content`}
              aria-label={isExpanded ? TIP_ARIA_LABELS.collapseTip : TIP_ARIA_LABELS.expandTip}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Actions with enhanced accessibility */}
        {tip.actions && tip.actions.length > 0 && (
          <section className="px-4 pb-4">
            <h4 className="sr-only">Available actions</h4>
            <div 
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={TIP_ARIA_LABELS.tipActions}
            >
              {tip.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[32px]',
                    action.variant === 'primary' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border-2 border-blue-600'
                      : action.variant === 'ghost'
                      ? 'text-gray-700 hover:text-gray-800 hover:bg-gray-100 focus:ring-gray-500 border-2 border-transparent'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-500 border-2 border-gray-200'
                  )}
                  aria-label={action.label}
                  title={action.label}
                >
                  {action.label}
                  {action.id === 'navigate' && (
                    <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Footer with timestamp and metadata */}
        <footer className="px-4 py-2 border-t-2 border-gray-100 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <time dateTime={new Date().toISOString()}>
                Just now
              </time>
            </div>
            {tip.showOnce && (
              <span className="text-xs text-gray-500" role="status">
                One-time tip
              </span>
            )}
          </div>
        </footer>
      </article>
    </>
  )
}

/**
 * Main ProactiveTips component that manages and displays contextual tips
 * with WCAG 2.1 AA accessibility compliance
 */
export function ProactiveTips({ 
  className,
  position = 'bottom-right',
  maxVisible = 3,
  autoHide = false,
  autoHideDelay = 10000
}: ProactiveTipsProps) {
  const { state, dismissTip } = useHelpChat()
  const [visibleTips, setVisibleTips] = useState<ProactiveTip[]>([])
  const [minimizedTips, setMinimizedTips] = useState<Set<string>>(new Set())
  const [isContainerMinimized, setIsContainerMinimized] = useState(false)
  const [announceMessage, setAnnounceMessage] = useState('')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    setAnnounceMessage(message)
    setTimeout(() => setAnnounceMessage(''), 1000)
  }, [])

  // Extract proactive tips from messages
  useEffect(() => {
    const tipMessages = state.messages
      .filter(msg => msg.type === 'tip')
      .slice(-maxVisible) // Limit to maxVisible tips
      .map(msg => {
        // Parse tip data from message content
        const tipMatch = msg.content.match(/💡 \*\*(.*?)\*\*\n\n(.*)/s)
        if (tipMatch) {
          return {
            id: msg.id,
            type: 'feature_discovery' as const,
            title: tipMatch[1],
            content: tipMatch[2],
            priority: 'medium' as const,
            triggerContext: [],
            actions: msg.actions || [],
            dismissible: true,
            showOnce: false,
            isRead: false
          } as ProactiveTip
        }
        return null
      })
      .filter(Boolean) as ProactiveTip[]

    setVisibleTips(tipMessages)
    
    // Announce new tips
    if (tipMessages.length > visibleTips.length) {
      const newTipsCount = tipMessages.length - visibleTips.length
      announceToScreenReader(`${newTipsCount} new tip${newTipsCount > 1 ? 's' : ''} available`)
    }
  }, [state.messages, maxVisible, visibleTips.length, announceToScreenReader])

  // Auto-hide tips if enabled
  useEffect(() => {
    if (autoHide && visibleTips.length > 0) {
      const timer = setTimeout(() => {
        setIsContainerMinimized(true)
        announceToScreenReader('Tips minimized automatically')
      }, autoHideDelay)

      return () => clearTimeout(timer)
    }
    
    // Return cleanup function for when condition is not met
    return () => {}
  }, [autoHide, autoHideDelay, visibleTips.length, announceToScreenReader])

  const handleDismissTip = useCallback((tipId: string) => {
    dismissTip(tipId)
    setVisibleTips(prev => prev.filter(tip => tip.id !== tipId))
    setMinimizedTips(prev => {
      const newSet = new Set(prev)
      newSet.delete(tipId)
      return newSet
    })
    announceToScreenReader('Tip dismissed')
  }, [dismissTip, announceToScreenReader])

  const handleTipAction = useCallback((action: QuickAction) => {
    announceToScreenReader(`Executing action: ${action.label}`)
    
    // Execute the action function
    action.action()
  }, [announceToScreenReader])

  const handleToggleMinimize = useCallback((tipId: string) => {
    setMinimizedTips(prev => {
      const newSet = new Set(prev)
      const wasMinimized = newSet.has(tipId)
      if (wasMinimized) {
        newSet.delete(tipId)
        announceToScreenReader('Tip expanded')
      } else {
        newSet.add(tipId)
        announceToScreenReader('Tip minimized')
      }
      return newSet
    })
  }, [announceToScreenReader])

  const handleToggleContainer = useCallback(() => {
    setIsContainerMinimized(prev => {
      const newState = !prev
      announceToScreenReader(newState ? 'All tips minimized' : 'All tips shown')
      return newState
    })
  }, [announceToScreenReader])

  // Enhanced keyboard navigation for container
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsContainerMinimized(true)
      announceToScreenReader('Tips minimized')
    }
  }, [announceToScreenReader])

  // Don't render if no tips
  if (visibleTips.length === 0) {
    return null
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4'
      case 'top-left':
        return 'top-4 left-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
      default:
        return 'bottom-4 right-4'
    }
  }

  // Container minimized view
  if (isContainerMinimized) {
    return (
      <>
        {/* Screen reader announcements */}
        <div
          ref={announceRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announceMessage}
        </div>

        <div className={cn(
          'fixed z-50 pointer-events-auto',
          getPositionClasses(),
          className
        )}>
          <button
            onClick={handleToggleContainer}
            onKeyDown={handleContainerKeyDown}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
            aria-label={`${TIP_ARIA_LABELS.maximizeContainer}. ${visibleTips.length} tip${visibleTips.length !== 1 ? 's' : ''} available`}
            aria-expanded={false}
            title={`Show ${visibleTips.length} tip${visibleTips.length !== 1 ? 's' : ''}`}
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">
              {visibleTips.length} tip{visibleTips.length !== 1 ? 's' : ''}
            </span>
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Screen reader announcements */}
      <div
        ref={announceRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceMessage}
      </div>

      <section 
        ref={containerRef}
        className={cn(
          'fixed z-50 pointer-events-auto',
          getPositionClasses(),
          className
        )}
        role="region"
        aria-labelledby="tips-container-title"
        aria-describedby="tips-container-description"
        onKeyDown={handleContainerKeyDown}
      >
        <div className="space-y-3 max-w-sm">
          {/* Container header with enhanced accessibility */}
          {visibleTips.length > 1 && (
            <header className="flex items-center justify-between px-3 py-2 bg-white rounded-lg shadow-sm border-2 border-gray-200">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-4 w-4 text-blue-500" aria-hidden="true" />
                <h2 
                  id="tips-container-title"
                  className="text-sm font-medium text-gray-800"
                >
                  Helpful Tips ({visibleTips.length})
                </h2>
              </div>
              <button
                onClick={handleToggleContainer}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={TIP_ARIA_LABELS.minimizeContainer}
                title={TIP_ARIA_LABELS.minimizeContainer}
              >
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
          )}

          {/* Hidden description for screen readers */}
          <div id="tips-container-description" className="sr-only">
            Container with {visibleTips.length} proactive help tip{visibleTips.length !== 1 ? 's' : ''}. 
            Use arrow keys to navigate between tips, Escape to minimize all tips.
          </div>

          {/* Tips list with enhanced accessibility */}
          <div 
            role="list" 
            aria-label={`${visibleTips.length} proactive tip${visibleTips.length !== 1 ? 's' : ''}`}
          >
            {visibleTips.map((tip, index) => (
              <div key={tip.id} role="listitem">
                <TipDisplay
                  tip={tip}
                  onDismiss={handleDismissTip}
                  onAction={handleTipAction}
                  isMinimized={minimizedTips.has(tip.id)}
                  onToggleMinimize={() => handleToggleMinimize(tip.id)}
                  tipIndex={index + 1}
                  totalTips={visibleTips.length}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default ProactiveTips