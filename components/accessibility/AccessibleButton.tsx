'use client'

import React, { forwardRef } from 'react'
import { ScreenReaderOnly } from './ScreenReaderSupport'

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  loadingText?: string
  icon?: React.ComponentType<{ className?: string }>
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  children: React.ReactNode
}

/**
 * AccessibleButton component with proper ARIA attributes and touch targets
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-95 transform
    touch-manipulation
  `

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:hover:bg-gray-200',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:hover:bg-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:hover:bg-red-600'
  }

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]', // Minimum 36px for accessibility
    md: 'px-4 py-3 text-base min-h-[44px]', // Standard 44px touch target
    lg: 'px-6 py-4 text-lg min-h-[52px]'   // Larger for primary actions
  }

  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-describedby={loading ? `${props.id || 'button'}-loading` : undefined}
      {...props}
    >
      {loading && (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
          <ScreenReaderOnly>
            {loadingText}
          </ScreenReaderOnly>
        </>
      )}
      
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
      )}
      
      <span className={loading ? 'sr-only' : ''}>
        {children}
      </span>
      
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="h-4 w-4 ml-2 flex-shrink-0" />
      )}
    </button>
  )
})

AccessibleButton.displayName = 'AccessibleButton'

interface IconButtonProps extends Omit<AccessibleButtonProps, 'children'> {
  icon: React.ComponentType<{ className?: string }>
  label: string
  showLabel?: boolean
}

/**
 * IconButton component for icon-only buttons with proper accessibility
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
  icon: Icon,
  label,
  showLabel = false,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  return (
    <AccessibleButton
      ref={ref}
      size={size}
      className={`${showLabel ? '' : 'aspect-square'} ${className}`}
      aria-label={label}
      {...props}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {showLabel ? (
        <span className="ml-2">{label}</span>
      ) : (
        <ScreenReaderOnly>{label}</ScreenReaderOnly>
      )}
    </AccessibleButton>
  )
})

IconButton.displayName = 'IconButton'

interface ToggleButtonProps extends Omit<AccessibleButtonProps, 'children'> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  children: React.ReactNode
  pressedLabel?: string
  unpressedLabel?: string
}

/**
 * ToggleButton component with proper ARIA pressed state
 */
export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(({
  pressed,
  onPressedChange,
  children,
  pressedLabel,
  unpressedLabel,
  onClick,
  ...props
}, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onPressedChange(!pressed)
    onClick?.(e)
  }

  return (
    <AccessibleButton
      ref={ref}
      onClick={handleClick}
      aria-pressed={pressed}
      aria-label={pressed ? pressedLabel : unpressedLabel}
      {...props}
    >
      {children}
      {(pressedLabel || unpressedLabel) && (
        <ScreenReaderOnly>
          {pressed ? pressedLabel : unpressedLabel}
        </ScreenReaderOnly>
      )}
    </AccessibleButton>
  )
})

ToggleButton.displayName = 'ToggleButton'

export default AccessibleButton