import React, { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/design-system'
import { useTouchGestures, type TouchPoint } from '@/hooks/useTouchGestures'

/**
 * LongPressMenu Component
 * 
 * Provides contextual menu functionality triggered by long press
 * Features:
 * - Long press detection with visual feedback
 * - Contextual menu positioning
 * - Keyboard navigation support
 * - Customizable menu items
 * - Auto-dismiss on outside click
 */

export interface MenuAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  action: () => void
  disabled?: boolean
  destructive?: boolean
}

interface LongPressMenuProps {
  children: React.ReactNode
  actions: MenuAction[]
  className?: string
  /** Long press duration in ms */
  longPressDuration?: number
  /** Menu positioning */
  menuPosition?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  /** Show visual feedback during long press */
  showFeedback?: boolean
  /** Callback when menu opens */
  onMenuOpen?: (point: TouchPoint) => void
  /** Callback when menu closes */
  onMenuClose?: () => void
  /** Disable long press menu */
  disabled?: boolean
  'data-testid'?: string
}

export type { LongPressMenuProps }

export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  children,
  actions,
  className,
  longPressDuration = 500,
  menuPosition = 'auto',
  showFeedback = true,
  onMenuOpen,
  onMenuClose,
  disabled = false,
  'data-testid': dataTestId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [longPressProgress, setLongPressProgress] = useState(0)
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const progressTimer = useRef<NodeJS.Timeout | null>(null)

  // Calculate optimal menu position
  const calculateMenuPosition = useCallback((point: TouchPoint) => {
    if (!containerRef.current) return { x: point.x, y: point.y }

    const containerRect = containerRef.current.getBoundingClientRect()
    const menuWidth = 200 // Estimated menu width
    const menuHeight = actions.length * 48 + 16 // Estimated menu height

    let x = point.x
    let y = point.y

    // Auto positioning logic
    if (menuPosition === 'auto') {
      // Adjust horizontal position
      if (x + menuWidth > window.innerWidth - 20) {
        x = point.x - menuWidth
      }
      
      // Adjust vertical position
      if (y + menuHeight > window.innerHeight - 20) {
        y = point.y - menuHeight
      }
    } else {
      // Manual positioning
      switch (menuPosition) {
        case 'top':
          y = point.y - menuHeight - 10
          break
        case 'bottom':
          y = point.y + 10
          break
        case 'left':
          x = point.x - menuWidth - 10
          break
        case 'right':
          x = point.x + 10
          break
      }
    }

    return { x: Math.max(10, x), y: Math.max(10, y) }
  }, [actions.length, menuPosition])

  // Handle long press start
  const handleTouchStart = useCallback(() => {
    if (disabled) return

    setIsLongPressing(true)
    setLongPressProgress(0)

    // Progress animation
    const startTime = Date.now()
    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / longPressDuration, 1)
      setLongPressProgress(progress)

      if (progress < 1) {
        progressTimer.current = setTimeout(updateProgress, 16) // ~60fps
      }
    }

    if (showFeedback) {
      updateProgress()
    }
  }, [disabled, longPressDuration, showFeedback])

  // Handle long press completion
  const handleLongPress = useCallback((point: TouchPoint) => {
    if (disabled) return

    const position = calculateMenuPosition(point)
    setMenuPos(position)
    setIsMenuOpen(true)
    setIsLongPressing(false)
    setLongPressProgress(0)
    
    onMenuOpen?.(point)
  }, [disabled, calculateMenuPosition, onMenuOpen])

  // Handle touch end (cancel long press)
  const handleTouchEnd = useCallback(() => {
    setIsLongPressing(false)
    setLongPressProgress(0)
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
    if (progressTimer.current) {
      clearTimeout(progressTimer.current)
    }
  }, [])

  // Close menu
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
    onMenuClose?.()
  }, [onMenuClose])

  // Handle menu action
  const handleMenuAction = useCallback((action: MenuAction) => {
    if (action.disabled) return
    
    action.action()
    closeMenu()
  }, [closeMenu])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isMenuOpen) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        closeMenu()
        break
      case 'ArrowDown':
        e.preventDefault()
        // Focus next menu item
        break
      case 'ArrowUp':
        e.preventDefault()
        // Focus previous menu item
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        // Activate focused menu item
        break
    }
  }, [isMenuOpen, closeMenu])

  // Touch gesture setup
  const { elementRef } = useTouchGestures({
    onLongPress: handleLongPress,
  }, {
    longPressDuration,
    hapticFeedback: true,
  })

  // Combine refs
  const setRefs = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
    if (elementRef) {
      elementRef.current = element
    }
  }, [elementRef])

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen, closeMenu])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
      if (progressTimer.current) {
        clearTimeout(progressTimer.current)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={setRefs}
        className={cn(
          'relative select-none',
          isLongPressing && showFeedback && 'transform scale-95 transition-transform duration-100',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid={dataTestId || 'long-press-menu'}
      >
        {children}
        
        {/* Long press progress indicator */}
        {isLongPressing && showFeedback && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg" />
            <div 
              className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-full transition-all duration-75"
              style={{ width: `${longPressProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeMenu}
        >
          <div
            ref={menuRef}
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-50"
            style={{
              left: menuPos.x,
              top: menuPos.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((action, index) => (
              <button
                key={action.id}
                className={cn(
                  'w-full px-4 py-3 text-left flex items-center space-x-3 hover:bg-gray-50 transition-colors',
                  action.disabled && 'opacity-50 cursor-not-allowed',
                  action.destructive && 'text-red-600 hover:bg-red-50'
                )}
                onClick={() => handleMenuAction(action)}
                disabled={action.disabled}
              >
                {action.icon && (
                  <action.icon className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default LongPressMenu