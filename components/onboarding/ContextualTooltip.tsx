'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { HelpCircle, X, Lightbulb, Info, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils/design-system'

export interface TooltipContent {
  id: string
  title: string
  description: string
  type: 'info' | 'tip' | 'warning' | 'help'
  actionable?: {
    label: string
    action: () => void
  }
  learnMore?: {
    label: string
    url: string
  }
  dismissible?: boolean
  persistent?: boolean
}

interface ContextualTooltipProps {
  content: TooltipContent
  target: string // CSS selector for the target element
  trigger: 'hover' | 'click' | 'focus' | 'manual'
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  delay?: number
  isVisible?: boolean
  onVisibilityChange?: (visible: boolean) => void
  onDismiss?: () => void
  className?: string
}

const getIconForType = (type: TooltipContent['type']) => {
  switch (type) {
    case 'info':
      return Info
    case 'tip':
      return Lightbulb
    case 'warning':
      return AlertCircle
    case 'help':
    default:
      return HelpCircle
  }
}

const getColorClassesForType = (type: TooltipContent['type']) => {
  switch (type) {
    case 'info':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        title: 'text-blue-900',
        text: 'text-blue-800'
      }
    case 'tip':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        title: 'text-green-900',
        text: 'text-green-800'
      }
    case 'warning':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600',
        title: 'text-amber-900',
        text: 'text-amber-800'
      }
    case 'help':
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        icon: 'text-gray-600',
        title: 'text-gray-900',
        text: 'text-gray-700'
      }
  }
}

export const ContextualTooltip: React.FC<ContextualTooltipProps> = ({
  content,
  target,
  trigger,
  position = 'auto',
  delay = 0,
  isVisible: controlledVisible,
  onVisibilityChange,
  onDismiss,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [targetElement, setTargetElement] = useState<Element | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const visible = controlledVisible !== undefined ? controlledVisible : isVisible

  // Find target element
  useEffect(() => {
    const element = document.querySelector(target)
    setTargetElement(element)
  }, [target])

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!targetElement || !tooltipRef.current) return

    const targetRect = targetElement.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let x = 0
    let y = 0
    let finalPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

    // Auto-position logic
    if (position === 'auto') {
      const spaceTop = targetRect.top
      const spaceBottom = viewport.height - targetRect.bottom
      const spaceLeft = targetRect.left
      const spaceRight = viewport.width - targetRect.right

      // Choose position with most space
      if (spaceBottom >= tooltipRect.height + 16) {
        finalPosition = 'bottom'
      } else if (spaceTop >= tooltipRect.height + 16) {
        finalPosition = 'top'
      } else if (spaceRight >= tooltipRect.width + 16) {
        finalPosition = 'right'
      } else {
        finalPosition = 'left'
      }
    } else {
      finalPosition = position
    }

    // Calculate position based on final position
    switch (finalPosition) {
      case 'top':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
        y = targetRect.top - tooltipRect.height - 8
        break
      case 'bottom':
        x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
        y = targetRect.bottom + 8
        break
      case 'left':
        x = targetRect.left - tooltipRect.width - 8
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
        break
      case 'right':
        x = targetRect.right + 8
        y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
        break
    }

    // Keep tooltip within viewport
    x = Math.max(8, Math.min(x, viewport.width - tooltipRect.width - 8))
    y = Math.max(8, Math.min(y, viewport.height - tooltipRect.height - 8))

    setTooltipPosition({ x, y })
    setActualPosition(finalPosition)
  }, [targetElement, position])

  // Update position when visible
  useEffect(() => {
    if (!visible) return

    calculatePosition()
    
    const handleResize = () => calculatePosition()
    const handleScroll = () => calculatePosition()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [visible, calculatePosition])

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true)
        onVisibilityChange?.(true)
      }, delay)
    } else {
      setIsVisible(true)
      onVisibilityChange?.(true)
    }
  }, [delay, onVisibilityChange])

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
    onVisibilityChange?.(false)
  }, [onVisibilityChange])

  const handleDismiss = useCallback(() => {
    hideTooltip()
    onDismiss?.()
  }, [hideTooltip, onDismiss])

  // Set up event listeners on target element
  useEffect(() => {
    if (!targetElement || trigger === 'manual') return

    const handleMouseEnter = () => {
      if (trigger === 'hover') showTooltip()
    }

    const handleMouseLeave = () => {
      if (trigger === 'hover') hideTooltip()
    }

    const handleClick = () => {
      if (trigger === 'click') {
        visible ? hideTooltip() : showTooltip()
      }
    }

    const handleFocus = () => {
      if (trigger === 'focus') showTooltip()
    }

    const handleBlur = () => {
      if (trigger === 'focus') hideTooltip()
    }

    targetElement.addEventListener('mouseenter', handleMouseEnter)
    targetElement.addEventListener('mouseleave', handleMouseLeave)
    targetElement.addEventListener('click', handleClick)
    targetElement.addEventListener('focus', handleFocus)
    targetElement.addEventListener('blur', handleBlur)

    return () => {
      targetElement.removeEventListener('mouseenter', handleMouseEnter)
      targetElement.removeEventListener('mouseleave', handleMouseLeave)
      targetElement.removeEventListener('click', handleClick)
      targetElement.removeEventListener('focus', handleFocus)
      targetElement.removeEventListener('blur', handleBlur)
    }
  }, [targetElement, trigger, visible, showTooltip, hideTooltip])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!visible || !targetElement) return null

  const Icon = getIconForType(content.type)
  const colors = getColorClassesForType(content.type)

  return (
    <>
      {/* Backdrop for click-outside to close */}
      {trigger === 'click' && (
        <div
          className="fixed inset-0 z-40"
          onClick={hideTooltip}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-50 max-w-xs rounded-lg shadow-lg border transition-all duration-200",
          colors.bg,
          colors.border,
          className
        )}
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
        }}
        role="tooltip"
        aria-live="polite"
      >
        {/* Arrow */}
        <div
          className={cn(
            "absolute w-2 h-2 transform rotate-45",
            colors.bg,
            colors.border,
            actualPosition === 'top' && 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-l-0',
            actualPosition === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-b-0 border-r-0',
            actualPosition === 'left' && 'top-1/2 left-full -translate-y-1/2 -translate-x-1/2 border-t-0 border-r-0',
            actualPosition === 'right' && 'top-1/2 right-full -translate-y-1/2 translate-x-1/2 border-b-0 border-l-0'
          )}
        />

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start space-x-3">
            <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", colors.icon)} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <h4 className={cn("text-sm font-medium", colors.title)}>
                  {content.title}
                </h4>
                
                {content.dismissible && (
                  <button
                    onClick={handleDismiss}
                    className="ml-2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss tooltip"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <p className={cn("text-sm mt-1", colors.text)}>
                {content.description}
              </p>

              {/* Actions */}
              {(content.actionable || content.learnMore) && (
                <div className="flex items-center space-x-3 mt-3">
                  {content.actionable && (
                    <button
                      onClick={content.actionable.action}
                      className={cn(
                        "text-sm font-medium underline hover:no-underline transition-all",
                        colors.title
                      )}
                    >
                      {content.actionable.label}
                    </button>
                  )}
                  
                  {content.learnMore && (
                    <a
                      href={content.learnMore.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-sm font-medium underline hover:no-underline transition-all",
                        colors.title
                      )}
                    >
                      {content.learnMore.label}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ContextualTooltip