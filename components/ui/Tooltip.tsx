import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/design-system'

interface TooltipProps {
  content: string | React.ReactNode
  children: React.ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  maxWidth?: number
}

/**
 * Tooltip component for contextual help
 * Provides hover-based information display
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className,
  maxWidth = 300
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timeoutRef = useRef<NodeJS.Timeout>()
  const triggerRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

        let top = 0
        let left = 0

        switch (position) {
          case 'top':
            top = rect.top + scrollTop - 8
            left = rect.left + scrollLeft + rect.width / 2
            break
          case 'bottom':
            top = rect.bottom + scrollTop + 8
            left = rect.left + scrollLeft + rect.width / 2
            break
          case 'left':
            top = rect.top + scrollTop + rect.height / 2
            left = rect.left + scrollLeft - 8
            break
          case 'right':
            top = rect.top + scrollTop + rect.height / 2
            left = rect.right + scrollLeft + 8
            break
        }

        setCoords({ top, left })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2'
  }

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
    left: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rotate-45',
    right: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45'
  }

  const tooltipContent = isVisible && (
    <div
      className={cn(
        'fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none',
        positionClasses[position],
        className
      )}
      style={{
        top: coords.top,
        left: coords.left,
        maxWidth: `${maxWidth}px`
      }}
    >
      {content}
      <div className={cn('absolute w-2 h-2 bg-gray-900', arrowClasses[position])} />
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  )
}

interface InfoTooltipProps {
  content: string | React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/**
 * Info icon with tooltip for inline help
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  position = 'top',
  className
}) => {
  return (
    <Tooltip content={content} position={position}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors',
          className
        )}
      >
        <svg
          className="w-full h-full"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </Tooltip>
  )
}

export default Tooltip
