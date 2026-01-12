'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Lightbulb, X, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useHelpChat } from '../hooks/useHelpChat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { cn } from '../lib/utils/design-system'

// Accessibility constants
const TOGGLE_ARIA_LABELS = {
  openChat: 'Open AI Help Chat Assistant',
  closeChat: 'Close AI Help Chat Assistant',
  newTipsAvailable: 'New tips available - click to view',
  helpAssistant: 'AI Help Assistant',
  dismissTipPreview: 'Dismiss tip preview'
} as const

interface HelpChatToggleProps {
  className?: string
}

/**
 * Floating toggle button for help chat with notification indicators
 * Responsive positioning and WCAG 2.1 AA accessibility compliance
 */
export function HelpChatToggle({ className }: HelpChatToggleProps) {
  const {
    state,
    toggleChat,
    hasUnreadTips,
    canShowProactiveTips,
    getToggleButtonText
  } = useHelpChat()

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [announceMessage, setAnnounceMessage] = useState('')
  
  // Refs for accessibility
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const announceRef = useRef<HTMLDivElement>(null)

  // Announce messages to screen readers
  const announceToScreenReader = (message: string) => {
    setAnnounceMessage(message)
    setTimeout(() => setAnnounceMessage(''), 1000)
  }

  // Animate button when new tips arrive
  useEffect(() => {
    if (hasUnreadTips && !state.isOpen) {
      setIsAnimating(true)
      announceToScreenReader('New help tips are available')
      const timer = setTimeout(() => setIsAnimating(false), 2000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [hasUnreadTips, state.isOpen])

  // Handle button click with announcements
  const handleClick = () => {
    const wasOpen = state.isOpen
    toggleChat()
    setShowTooltip(false)
    
    // Announce state change
    if (wasOpen) {
      announceToScreenReader('Help chat closed')
    } else {
      announceToScreenReader('Help chat opened')
    }
  }

  // Enhanced keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    } else if (e.key === 'Escape') {
      if (showTooltip) {
        setShowTooltip(false)
      } else if (state.isOpen) {
        toggleChat()
        announceToScreenReader('Help chat closed')
      }
    }
  }

  // Handle tooltip visibility with proper focus management
  const handleMouseEnter = () => {
    if (!isMobile) {
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  const handleFocus = () => {
    if (!isMobile) {
      setShowTooltip(true)
    }
  }

  const handleBlur = () => {
    // Delay hiding tooltip to allow for tooltip interaction
    setTimeout(() => {
      if (!tooltipRef.current?.matches(':hover')) {
        setShowTooltip(false)
      }
    }, 100)
  }

  // Get appropriate ARIA label
  const getAriaLabel = () => {
    if (state.isOpen) {
      return TOGGLE_ARIA_LABELS.closeChat
    } else if (hasUnreadTips) {
      return TOGGLE_ARIA_LABELS.newTipsAvailable
    } else {
      return TOGGLE_ARIA_LABELS.openChat
    }
  }

  // Don't show toggle when chat is open on mobile
  if (isMobile && state.isOpen) {
    return null
  }

  // Mobile positioning (integrated into header or floating)
  if (isMobile) {
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

        <div className={cn('relative', className)}>
          <button
            ref={buttonRef}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'relative flex items-center justify-center',
              'w-12 h-12 rounded-full shadow-lg',
              'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'min-h-[44px] min-w-[44px]', // Touch target compliance
              isAnimating && 'animate-pulse',
              hasUnreadTips && 'ring-2 ring-blue-300 ring-opacity-75'
            )}
            aria-label={getAriaLabel()}
            aria-expanded={state.isOpen}
            aria-haspopup="dialog"
            aria-describedby={hasUnreadTips ? 'mobile-tips-status' : undefined}
            role="button"
            tabIndex={0}
          >
            {/* Main icon */}
            <div className="relative">
              {hasUnreadTips ? (
                <Lightbulb className="h-6 w-6" aria-hidden="true" />
              ) : (
                <MessageSquare className="h-6 w-6" aria-hidden="true" />
              )}
              
              {/* Notification badge */}
              {hasUnreadTips && (
                <div 
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
                  role="status"
                  aria-label="New tips indicator"
                >
                  <span className="sr-only">New tips available</span>
                </div>
              )}
            </div>

            {/* Pulse animation for new tips */}
            {hasUnreadTips && (
              <div 
                className="absolute inset-0 rounded-full bg-blue-400 opacity-75 animate-ping" 
                aria-hidden="true"
              />
            )}

            {/* Loading indicator */}
            {state.isLoading && (
              <div 
                className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Hidden status for screen readers */}
          {hasUnreadTips && (
            <div id="mobile-tips-status" className="sr-only">
              New help tips are available. Click to view them.
            </div>
          )}

          {/* Tooltip for non-mobile devices */}
          {showTooltip && !isMobile && (
            <div 
              ref={tooltipRef}
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50"
              role="tooltip"
              aria-hidden="true"
            >
              <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                {getToggleButtonText()}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // Desktop positioning (fixed bottom-right)
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
        'fixed bottom-6 right-6 z-30',
        'transition-all duration-300 ease-in-out',
        state.isOpen && 'right-[25rem]', // Adjust position when chat is open
        className
      )}>
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'relative flex items-center justify-center',
              'w-14 h-14 rounded-full shadow-lg',
              'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'hover:scale-105 active:scale-95',
              'min-h-[56px] min-w-[56px]', // Large touch target
              isAnimating && 'animate-bounce',
              hasUnreadTips && 'ring-4 ring-blue-300 ring-opacity-50'
            )}
            aria-label={getAriaLabel()}
            aria-expanded={state.isOpen}
            aria-haspopup="dialog"
            aria-describedby={hasUnreadTips ? 'desktop-tips-status' : undefined}
            role="button"
            tabIndex={0}
          >
            {/* Main icon with rotation animation */}
            <div className={cn(
              'relative transition-transform duration-200'
            )}>
              {state.isOpen ? (
                <PanelRightClose className="h-6 w-6" aria-hidden="true" />
              ) : hasUnreadTips ? (
                <Lightbulb className="h-6 w-6" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-6 w-6" aria-hidden="true" />
              )}
              
              {/* Notification badge */}
              {hasUnreadTips && !state.isOpen && (
                <div 
                  className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center"
                  role="status"
                  aria-label="New tips indicator"
                >
                  <span className="text-xs font-bold text-white" aria-hidden="true">!</span>
                  <span className="sr-only">New tips available</span>
                </div>
              )}
            </div>

            {/* Pulse animation for new tips */}
            {hasUnreadTips && !state.isOpen && (
              <div 
                className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping" 
                aria-hidden="true"
              />
            )}

            {/* Loading indicator */}
            {state.isLoading && (
              <div 
                className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Hidden status for screen readers */}
          {hasUnreadTips && (
            <div id="desktop-tips-status" className="sr-only">
              New help tips are available. Click to view them.
            </div>
          )}

          {/* Enhanced tooltip with arrow */}
          {showTooltip && (
            <div 
              ref={tooltipRef}
              className="absolute bottom-full right-0 mb-3 z-50"
              role="tooltip"
              id="help-toggle-tooltip"
            >
              <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-nowrap shadow-lg max-w-xs">
                {getToggleButtonText()}
                {hasUnreadTips && (
                  <div className="text-xs text-blue-200 mt-1">
                    Click to see new tips!
                  </div>
                )}
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}

          {/* Proactive tip preview with enhanced accessibility */}
          {canShowProactiveTips && hasUnreadTips && !state.isOpen && (
            <div 
              className="absolute bottom-full right-0 mb-16 w-64 z-40"
              role="region"
              aria-labelledby="tip-preview-title"
              aria-describedby="tip-preview-description"
            >
              <div className="bg-white rounded-lg shadow-xl border-2 border-gray-200 p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Lightbulb className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 id="tip-preview-title" className="text-sm font-medium text-gray-900 mb-1">
                      New tip available!
                    </h3>
                    <p id="tip-preview-description" className="text-xs text-gray-600">
                      Click to see helpful suggestions for your current page.
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      announceToScreenReader('Tip preview dismissed')
                    }}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label={TOGGLE_ARIA_LABELS.dismissTipPreview}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
                <div className="absolute top-full right-8 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Compact version for header integration (mobile) with enhanced accessibility
 */
export function HelpChatToggleCompact({ className }: HelpChatToggleProps) {
  const {
    state,
    toggleChat,
    hasUnreadTips,
    getToggleButtonText
  } = useHelpChat()

  const [announceMessage, setAnnounceMessage] = useState('')
  const announceRef = useRef<HTMLDivElement>(null)

  const announceToScreenReader = (message: string) => {
    setAnnounceMessage(message)
    setTimeout(() => setAnnounceMessage(''), 1000)
  }

  const handleClick = () => {
    const wasOpen = state.isOpen
    toggleChat()
    
    if (wasOpen) {
      announceToScreenReader('Help chat closed')
    } else {
      announceToScreenReader('Help chat opened')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    } else if (e.key === 'Escape' && state.isOpen) {
      toggleChat()
      announceToScreenReader('Help chat closed')
    }
  }

  const getAriaLabel = () => {
    if (state.isOpen) {
      return TOGGLE_ARIA_LABELS.closeChat
    } else if (hasUnreadTips) {
      return TOGGLE_ARIA_LABELS.newTipsAvailable
    } else {
      return TOGGLE_ARIA_LABELS.openChat
    }
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

      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex items-center justify-center',
          'w-10 h-10 rounded-lg',
          'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'min-h-[40px] min-w-[40px]', // Touch target compliance
          className
        )}
        aria-label={getAriaLabel()}
        aria-expanded={state.isOpen}
        aria-haspopup="dialog"
        aria-describedby={hasUnreadTips ? 'compact-tips-status' : undefined}
        title={getToggleButtonText()}
      >
        {state.isOpen ? (
          <PanelRightClose className="h-5 w-5" aria-hidden="true" />
        ) : hasUnreadTips ? (
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelRightOpen className="h-5 w-5" aria-hidden="true" />
        )}
        
        {/* Notification dot */}
        {hasUnreadTips && (
          <div 
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
            role="status"
            aria-label="New tips indicator"
          >
            <span className="sr-only">New tips available</span>
          </div>
        )}

        {/* Hidden status for screen readers */}
        {hasUnreadTips && (
          <div id="compact-tips-status" className="sr-only">
            New help tips are available
          </div>
        )}
      </button>
    </>
  )
}

export default HelpChatToggle