import React, { useRef, useState, useCallback, useEffect } from 'react'
import { cn, componentVariants, a11y } from '@/lib/design-system'
import type { CardProps } from '@/types'

/**
 * SwipeableCard Component - Touch-optimized card with swipe actions
 * 
 * Features:
 * - Configurable swipe actions (left and right)
 * - Smooth animations and visual feedback
 * - Accessibility support with keyboard navigation
 * - Customizable action thresholds and animations
 * - Support for both touch and mouse interactions
 */

export interface SwipeAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  backgroundColor: string
  action: () => void
  threshold?: number // Distance in pixels to trigger action
}

interface SwipeableCardProps extends Omit<CardProps, 'onClick'> {
  /** Left swipe action configuration */
  leftAction?: SwipeAction
  /** Right swipe action configuration */
  rightAction?: SwipeAction
  /** Swipe threshold as percentage of card width (0-1) */
  swipeThreshold?: number
  /** Animation duration in milliseconds */
  animationDuration?: number
  /** Enable haptic feedback on swipe */
  hapticFeedback?: boolean
  /** Callback when swipe starts */
  onSwipeStart?: (direction: 'left' | 'right') => void
  /** Callback when swipe ends */
  onSwipeEnd?: (direction: 'left' | 'right' | null, action?: SwipeAction) => void
  /** Disable swipe functionality */
  swipeDisabled?: boolean
  /** Custom card click handler (when not swiping) */
  onCardClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export type { SwipeableCardProps }

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  shadow = 'sm',
  rounded = 'lg',
  className,
  leftAction,
  rightAction,
  swipeThreshold = 0.3,
  animationDuration = 200,
  hapticFeedback = true,
  onSwipeStart,
  onSwipeEnd,
  swipeDisabled = false,
  onCardClick,
  'data-testid': dataTestId,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [isVerticalScroll, setIsVerticalScroll] = useState(false)
  const [activeAction, setActiveAction] = useState<SwipeAction | null>(null)

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false)

  // Calculate action thresholds
  const getActionThreshold = useCallback((action?: SwipeAction) => {
    if (!cardRef.current) return 0
    const cardWidth = cardRef.current.offsetWidth
    return action?.threshold || cardWidth * swipeThreshold
  }, [swipeThreshold])

  // Haptic feedback simulation
  const triggerHapticFeedback = useCallback(() => {
    if (!hapticFeedback) return

    if ('vibrator' in navigator || 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(10)
      } catch (error) {
        // Silently fail
      }
    }
  }, [hapticFeedback])

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (swipeDisabled || isAnimating) return

    const touch = e.touches[0]
    setStartX(touch.clientX)
    setStartY(touch.clientY)
    setIsDragging(true)
    setIsVerticalScroll(false)
    onSwipeStart?.(touch.clientX > (cardRef.current?.offsetWidth || 0) / 2 ? 'right' : 'left')
  }, [swipeDisabled, isAnimating, onSwipeStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || swipeDisabled || isAnimating) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    // Detect if this is a vertical scroll gesture
    if (!isVerticalScroll && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      setIsVerticalScroll(true)
      setIsDragging(false)
      setSwipeOffset(0)
      return
    }

    // Prevent vertical scrolling during horizontal swipe
    if (Math.abs(deltaX) > 10 && !isVerticalScroll) {
      e.preventDefault()
    }

    if (isVerticalScroll) return

    // Calculate swipe offset with resistance
    let offset = deltaX
    const maxOffset = cardRef.current?.offsetWidth || 0

    // Add resistance when swiping beyond available actions
    if (offset > 0 && !rightAction) {
      offset = Math.min(offset * 0.3, maxOffset * 0.2)
    } else if (offset < 0 && !leftAction) {
      offset = Math.max(offset * 0.3, -maxOffset * 0.2)
    } else {
      // Limit offset to card width
      offset = Math.max(-maxOffset, Math.min(maxOffset, offset))
    }

    setSwipeOffset(offset)

    // Determine active action
    const leftThreshold = getActionThreshold(leftAction)
    const rightThreshold = getActionThreshold(rightAction)

    let newActiveAction: SwipeAction | null = null
    if (offset < -leftThreshold && leftAction) {
      newActiveAction = leftAction
    } else if (offset > rightThreshold && rightAction) {
      newActiveAction = rightAction
    }

    if (newActiveAction !== activeAction) {
      setActiveAction(newActiveAction)
      if (newActiveAction) {
        triggerHapticFeedback()
      }
    }
  }, [
    isDragging,
    swipeDisabled,
    isAnimating,
    startX,
    startY,
    isVerticalScroll,
    leftAction,
    rightAction,
    getActionThreshold,
    activeAction,
    triggerHapticFeedback,
  ])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || swipeDisabled || isAnimating || isVerticalScroll) {
      setIsDragging(false)
      setIsVerticalScroll(false)
      return
    }

    setIsDragging(false)
    setIsAnimating(true)

    const leftThreshold = getActionThreshold(leftAction)
    const rightThreshold = getActionThreshold(rightAction)

    let actionTriggered: SwipeAction | null = null
    let direction: 'left' | 'right' | null = null

    // Check if action should be triggered
    if (swipeOffset < -leftThreshold && leftAction) {
      actionTriggered = leftAction
      direction = 'left'
    } else if (swipeOffset > rightThreshold && rightAction) {
      actionTriggered = rightAction
      direction = 'right'
    }

    // Animate back to center or execute action
    setTimeout(() => {
      setSwipeOffset(0)
      setActiveAction(null)
      setIsAnimating(false)

      if (actionTriggered) {
        actionTriggered.action()
      }

      onSwipeEnd?.(direction, actionTriggered || undefined)
    }, animationDuration)
  }, [
    isDragging,
    swipeDisabled,
    isAnimating,
    isVerticalScroll,
    swipeOffset,
    leftAction,
    rightAction,
    getActionThreshold,
    animationDuration,
    onSwipeEnd,
  ])

  // Mouse event handlers for desktop support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (swipeDisabled || isAnimating) return

    setStartX(e.clientX)
    setStartY(e.clientY)
    setIsDragging(true)
    setIsVerticalScroll(false)

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      if (!isVerticalScroll && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        setIsVerticalScroll(true)
        setIsDragging(false)
        setSwipeOffset(0)
        return
      }

      if (isVerticalScroll) return

      let offset = deltaX
      const maxOffset = cardRef.current?.offsetWidth || 0

      if (offset > 0 && !rightAction) {
        offset = Math.min(offset * 0.3, maxOffset * 0.2)
      } else if (offset < 0 && !leftAction) {
        offset = Math.max(offset * 0.3, -maxOffset * 0.2)
      } else {
        offset = Math.max(-maxOffset, Math.min(maxOffset, offset))
      }

      setSwipeOffset(offset)
    }

    const handleMouseUp = () => {
      handleTouchEnd()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [swipeDisabled, isAnimating, startX, startY, isDragging, isVerticalScroll, rightAction, leftAction, handleTouchEnd])

  // Handle card click when not swiping
  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (Math.abs(swipeOffset) < 5 && !isDragging) {
      onCardClick?.(e)
    }
  }, [swipeOffset, isDragging, onCardClick])

  // Keyboard navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (swipeDisabled) return

    if (e.key === 'ArrowLeft' && leftAction) {
      e.preventDefault()
      leftAction.action()
      onSwipeEnd?.('left', leftAction)
    } else if (e.key === 'ArrowRight' && rightAction) {
      e.preventDefault()
      rightAction.action()
      onSwipeEnd?.('right', rightAction)
    }
  }, [swipeDisabled, leftAction, rightAction, onSwipeEnd])

  // Base card classes
  const cardClasses = cn(
    'relative overflow-hidden cursor-pointer select-none',
    componentVariants.card[variant],
    className
  )

  // Transform style for swipe animation
  const transformStyle = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isDragging ? 'none' : `transform ${animationDuration}ms ease-out`,
  }

  // Action background styles
  const getActionBackgroundStyle = (action: SwipeAction, side: 'left' | 'right') => {
    const isActive = activeAction === action
    const opacity = Math.min(Math.abs(swipeOffset) / getActionThreshold(action), 1)
    
    return {
      backgroundColor: action.backgroundColor,
      opacity: opacity * 0.9,
      transform: side === 'left' 
        ? `translateX(${swipeOffset < -20 ? 0 : '-100%'})` 
        : `translateX(${swipeOffset > 20 ? 0 : '100%'})`,
      transition: isDragging ? 'none' : `all ${animationDuration}ms ease-out`,
    }
  }

  return (
    <div
      className="relative"
      data-testid={dataTestId || 'swipeable-card'}
    >
      {/* Left Action Background */}
      {leftAction && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 z-10"
          style={getActionBackgroundStyle(leftAction, 'left')}
        >
          <leftAction.icon className={cn("h-6 w-6 mr-2", leftAction.color)} />
          <span className={cn("font-medium", leftAction.color)}>
            {leftAction.label}
          </span>
        </div>
      )}

      {/* Right Action Background */}
      {rightAction && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 z-10"
          style={getActionBackgroundStyle(rightAction, 'right')}
        >
          <span className={cn("font-medium", rightAction.color)}>
            {rightAction.label}
          </span>
          <rightAction.icon className={cn("h-6 w-6 ml-2", rightAction.color)} />
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={cardClasses}
        style={transformStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={onCardClick || leftAction || rightAction ? 0 : -1}
        role={onCardClick ? 'button' : 'article'}
        aria-label={
          leftAction || rightAction
            ? `Swipeable card. ${leftAction ? `Swipe left for ${leftAction.label}.` : ''} ${rightAction ? `Swipe right for ${rightAction.label}.` : ''}`
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeableCard