import React, { useRef, useCallback, useState } from 'react'
import { cn, componentVariants, touchTargets, a11y } from '@/lib/design-system'
import type { ButtonProps } from '@/types'

/**
 * TouchButton Component - Enhanced button with accessibility and touch optimization
 * 
 * Features:
 * - Minimum 44px touch targets (WCAG 2.1 AA compliance)
 * - Haptic feedback simulation through visual/audio cues
 * - Enhanced focus management and keyboard navigation
 * - Proper ARIA labels and accessibility support
 * - Visual press states with smooth animations
 */

interface TouchButtonProps extends ButtonProps {
  /** Enable haptic feedback simulation */
  hapticFeedback?: boolean
  /** Custom press animation duration in ms */
  pressAnimationDuration?: number
  /** Enable sound feedback (requires user interaction first) */
  soundFeedback?: boolean
  /** Custom touch target size override */
  touchTarget?: 'minimum' | 'comfortable' | 'large' | 'xlarge'
}

export type { TouchButtonProps }

export const TouchButton: React.FC<TouchButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  onFocus,
  onBlur,
  type = 'button',
  className,
  hapticFeedback = true,
  pressAnimationDuration = 150,
  soundFeedback = false,
  touchTarget = 'comfortable',
  fullWidth = false,
  leftIcon,
  rightIcon,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'data-testid': dataTestId,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isPressed, setIsPressed] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  // Base classes for the button
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    select-none touch-manipulation
    ${a11y.focusVisible}
    ${a11y.reducedMotion}
  `

  // Size classes with proper touch targets
  const sizeClasses = {
    sm: `px-3 py-2 text-sm`,
    md: `px-4 py-3 text-base`,
    lg: `px-6 py-4 text-lg`,
    xl: `px-8 py-5 text-xl`,
  }

  // Touch target override
  const touchTargetClasses = {
    minimum: touchTargets.minimum,
    comfortable: touchTargets.comfortable,
    large: touchTargets.large,
    xlarge: touchTargets.xlarge,
  }

  // Press animation classes
  const pressClasses = isPressed && hapticFeedback ? 'transform scale-95' : ''
  
  // Focus classes
  const focusClasses = isFocused ? 'ring-2 ring-offset-2' : ''

  // Full width classes
  const widthClasses = fullWidth ? 'w-full' : ''

  // Haptic feedback simulation
  const simulateHapticFeedback = useCallback(() => {
    if (!hapticFeedback) return

    // Visual feedback through scale animation
    setIsPressed(true)
    setTimeout(() => setIsPressed(false), pressAnimationDuration)

    // Vibration API for supported devices
    if ('vibrator' in navigator || 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(10) // Short vibration
      } catch (error) {
        // Silently fail if vibration is not supported
      }
    }

    // Sound feedback (requires user interaction)
    if (soundFeedback && typeof window !== 'undefined') {
      try {
        // Create a subtle click sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
      } catch (error) {
        // Silently fail if audio is not supported
      }
    }
  }, [hapticFeedback, pressAnimationDuration, soundFeedback])

  // Enhanced click handler
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return

    simulateHapticFeedback()
    onClick?.(event)
  }, [disabled, loading, onClick, simulateHapticFeedback])

  // Enhanced focus handler
  const handleFocus = useCallback((event: React.FocusEvent<HTMLButtonElement>) => {
    setIsFocused(true)
    onFocus?.(event)
  }, [onFocus])

  // Enhanced blur handler
  const handleBlur = useCallback((event: React.FocusEvent<HTMLButtonElement>) => {
    setIsFocused(false)
    onBlur?.(event)
  }, [onBlur])

  // Touch event handlers for enhanced mobile experience
  const handleTouchStart = useCallback(() => {
    if (disabled || loading) return
    simulateHapticFeedback()
  }, [disabled, loading, simulateHapticFeedback])

  // Keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      simulateHapticFeedback()
    }
  }, [simulateHapticFeedback])

  // Helper function to render icon safely
  const renderIcon = (icon: React.ReactNode) => {
    if (!icon) return null
    
    // If it's a React component constructor (function), render it as JSX
    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<any>
      return <IconComponent className="h-4 w-4" />
    }
    
    // If it's a React component object (like Lucide React icons with $$typeof and render)
    if (typeof icon === 'object' && icon !== null && '$$typeof' in icon && 'render' in icon) {
      const IconComponent = icon as unknown as React.ComponentType<any>
      return <IconComponent className="h-4 w-4" />
    }
    
    // If it's already a React element or other valid ReactNode, render it directly
    return icon
  }

  // Loading spinner component
  const LoadingSpinner = () => (
    <div 
      className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"
      aria-hidden="true"
    />
  )

  return (
    <button
      ref={buttonRef}
      type={type}
      className={cn(
        baseClasses,
        componentVariants.button[variant],
        sizeClasses[size],
        touchTargetClasses[touchTarget],
        pressClasses,
        focusClasses,
        widthClasses,
        className
      )}
      disabled={disabled || loading}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled || loading}
      aria-pressed={isPressed}
      data-testid={dataTestId || 'touch-button'}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {leftIcon && (
        <span className="mr-2 flex-shrink-0" aria-hidden="true">
          {renderIcon(leftIcon)}
        </span>
      )}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
      {rightIcon && (
        <span className="ml-2 flex-shrink-0" aria-hidden="true">
          {renderIcon(rightIcon)}
        </span>
      )}
    </button>
  )
}

export default TouchButton