import React, { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/design-system'
import { useTouchGestures } from '@/hooks/useTouchGestures'

/**
 * PullToRefresh Component
 * 
 * Provides pull-to-refresh functionality for data lists and content
 * Features:
 * - Visual feedback during pull gesture
 * - Customizable refresh threshold
 * - Loading state management
 * - Smooth animations
 * - Accessibility support
 */

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void> | void
  className?: string
  /** Refresh threshold in pixels */
  threshold?: number
  /** Loading state (controlled) */
  isLoading?: boolean
  /** Custom loading indicator */
  loadingIndicator?: React.ReactNode
  /** Custom pull indicator */
  pullIndicator?: React.ReactNode
  /** Disable pull to refresh */
  disabled?: boolean
  /** Callback when pull starts */
  onPullStart?: () => void
  /** Callback when pull ends */
  onPullEnd?: () => void
  'data-testid'?: string
}

export type { PullToRefreshProps }

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className,
  threshold = 80,
  isLoading = false,
  loadingIndicator,
  pullIndicator,
  disabled = false,
  onPullStart,
  onPullEnd,
  'data-testid': dataTestId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Handle pull gesture
  const handlePullToRefresh = useCallback((distance: number) => {
    if (disabled || isRefreshing) return

    setPullDistance(Math.min(distance, threshold * 1.5))
    
    if (!isPulling && distance > 10) {
      setIsPulling(true)
      onPullStart?.()
    }
  }, [disabled, isRefreshing, threshold, isPulling, onPullStart])

  // Handle refresh trigger
  const handleRefreshTrigger = useCallback(async () => {
    if (disabled || isRefreshing) return

    setIsRefreshing(true)
    setIsPulling(false)
    
    try {
      await onRefresh()
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      // Smooth animation back to normal state
      setTimeout(() => {
        setPullDistance(0)
        setIsRefreshing(false)
        onPullEnd?.()
      }, 300)
    }
  }, [disabled, isRefreshing, onRefresh, onPullEnd])

  // Handle pull end without refresh
  const handleTouchEnd = useCallback(() => {
    if (pullDistance < threshold) {
      setIsPulling(false)
      setPullDistance(0)
      onPullEnd?.()
    }
  }, [pullDistance, threshold, onPullEnd])

  // Touch gesture setup
  const { elementRef } = useTouchGestures({
    onPullToRefresh: handlePullToRefresh,
    onPullToRefreshTrigger: handleRefreshTrigger,
  }, {
    pullToRefreshThreshold: threshold,
    hapticFeedback: true,
  })

  // Combine refs
  const setRefs = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
    if (elementRef) {
      elementRef.current = element
    }
  }, [elementRef])

  // Calculate pull progress
  const pullProgress = Math.min(pullDistance / threshold, 1)
  const isReadyToRefresh = pullDistance >= threshold

  // Default loading indicator
  const defaultLoadingIndicator = (
    <div className="flex items-center justify-center space-x-2">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
      <span className="text-sm text-gray-600">Refreshing...</span>
    </div>
  )

  // Default pull indicator
  const defaultPullIndicator = (
    <div className="flex flex-col items-center space-y-2">
      <div 
        className={cn(
          'w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center transition-all duration-200',
          isReadyToRefresh && 'border-blue-500 bg-blue-50 rotate-180'
        )}
      >
        <svg
          className={cn(
            'w-4 h-4 text-gray-400 transition-all duration-200',
            isReadyToRefresh && 'text-blue-500'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
      <span className={cn(
        'text-xs text-gray-500 transition-colors duration-200',
        isReadyToRefresh && 'text-blue-600'
      )}>
        {isReadyToRefresh ? 'Release to refresh' : 'Pull to refresh'}
      </span>
    </div>
  )

  // Transform style for pull animation
  const transformStyle = {
    transform: `translateY(${Math.min(pullDistance * 0.5, threshold * 0.5)}px)`,
    transition: isPulling ? 'none' : 'transform 300ms ease-out',
  }

  // Indicator container style
  const indicatorStyle = {
    height: `${Math.min(pullDistance * 0.8, threshold)}px`,
    opacity: pullProgress,
    transition: isPulling ? 'none' : 'all 300ms ease-out',
  }

  return (
    <div
      ref={setRefs}
      className={cn('relative overflow-hidden', className)}
      data-testid={dataTestId || 'pull-to-refresh'}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-end justify-center pb-4 bg-gray-50"
        style={indicatorStyle}
      >
        {(isPulling || isRefreshing) && (
          <div className="transform transition-transform duration-200">
            {isRefreshing || isLoading
              ? (loadingIndicator || defaultLoadingIndicator)
              : (pullIndicator || defaultPullIndicator)
            }
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={transformStyle}
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleTouchEnd}
      >
        {children}
      </div>

      {/* Accessibility announcement */}
      <div className="sr-only" aria-live="polite">
        {isRefreshing && 'Refreshing content'}
        {isReadyToRefresh && !isRefreshing && 'Ready to refresh, release to refresh'}
      </div>
    </div>
  )
}

export default PullToRefresh