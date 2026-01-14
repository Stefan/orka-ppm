'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Lightbulb, PanelRightOpen, PanelRightClose, HelpCircle, MessageCircleQuestion, PanelRight } from 'lucide-react'
import { useHelpChat } from '../hooks/useHelpChat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { cn } from '../lib/utils/design-system'

interface HelpChatToggleProps {
  className?: string
}

export function HelpChatToggle({ className }: HelpChatToggleProps) {
  const {
    state,
    toggleChat,
    hasUnreadTips,
    getToggleButtonText
  } = useHelpChat()

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasUnreadTips && !state.isOpen) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 2000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [hasUnreadTips, state.isOpen])

  const handleClick = () => {
    toggleChat()
    setShowTooltip(false)
  }

  const handleMouseEnter = () => {
    if (!isMobile) {
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  // Mobile version - Top right corner, stays fixed while scrolling
  if (isMobile) {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={handleClick}
          className={cn(
            'fixed top-4 right-4 z-[9999]',
            'w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white',
            'rounded-lg shadow-lg hover:shadow-xl',
            'flex items-center justify-center',
            'transition-all duration-300 ease-in-out',
            'transform hover:scale-105',
            isAnimating && 'animate-bounce',
            hasUnreadTips && 'ring-2 ring-blue-300 ring-opacity-75',
            className
          )}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 9999
          }}
        >
          <div className="relative">
            {hasUnreadTips ? (
              <Lightbulb className="h-5 w-5" />
            ) : (
              <MessageCircleQuestion className="h-5 w-5" />
            )}
            
            {hasUnreadTips && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white">
              </div>
            )}
          </div>
          
          {isAnimating && (
            <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-75 animate-ping" />
          )}
          
          {state.isLoading && (
            <div className="absolute inset-0 rounded-lg border-2 border-white border-t-transparent animate-spin" />
          )}
        </button>

        {showTooltip && (
          <div
            ref={tooltipRef}
            className="fixed bottom-4 right-20 z-[9999]"
            style={{
              position: 'fixed',
              bottom: '1rem',
              right: '5rem',
              zIndex: 9999
            }}
          >
            <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
              {getToggleButtonText()}
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop version - Top right corner, stays fixed while scrolling
  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'fixed top-4 right-4 z-[9999]',
          'w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white',
          'rounded-lg shadow-lg hover:shadow-xl',
          'flex items-center justify-center',
          'transition-all duration-300 ease-in-out',
          'transform hover:scale-105',
          isAnimating && 'animate-pulse',
          hasUnreadTips && 'ring-4 ring-blue-300 ring-opacity-50',
          className
        )}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999
        }}
      >
        <div className={cn(
          'transition-transform duration-200',
          state.isOpen && 'rotate-180'
        )}>
          {state.isOpen ? (
            <PanelRightClose className="h-5 w-5" />
          ) : hasUnreadTips ? (
            <Lightbulb className="h-5 w-5" />
          ) : (
            <MessageCircleQuestion className="h-5 w-5" />
          )}
          
          {hasUnreadTips && !state.isOpen && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs font-bold text-white">!</span>
            </div>
          )}
        </div>
        
        {isAnimating && (
          <div className="absolute inset-0 rounded-lg bg-blue-400 opacity-30 animate-ping" />
        )}
        
        {state.isLoading && (
          <div className="absolute inset-0 rounded-lg border-2 border-white border-t-transparent animate-spin" />
        )}
      </button>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed top-4 right-20 z-[9999]"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '5rem',
            zIndex: 9999
          }}
        >
          <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
            {getToggleButtonText()}
          </div>
        </div>
      )}
    </>
  )
}

// Compact version for use in other components
export function CompactHelpChatToggle({ className }: HelpChatToggleProps) {
  const {
    state,
    toggleChat,
    hasUnreadTips,
    getToggleButtonText
  } = useHelpChat()

  return (
    <>
      <button
        onClick={toggleChat}
        className={cn(
          'relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors',
          hasUnreadTips && 'text-yellow-600 hover:text-yellow-700',
          className
        )}
        title={getToggleButtonText()}
      >
        {state.isOpen ? (
          <PanelRightClose className="h-5 w-5" />
        ) : hasUnreadTips ? (
          <Lightbulb className="h-5 w-5" />
        ) : (
          <PanelRightOpen className="h-5 w-5" />
        )}
        
        {hasUnreadTips && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white">
          </div>
        )}
      </button>
    </>
  )
}

export default HelpChatToggle