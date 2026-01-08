import React from 'react'
import { cn, componentVariants } from '@/lib/design-system'
import type { ButtonProps } from '@/types'

/**
 * Enhanced Button component with design system integration
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm touch-target',
    md: 'px-4 py-3 text-base touch-target-comfortable',
    lg: 'px-6 py-4 text-lg touch-target-large',
  }

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick()
    }
  }

  return (
    <button
      type={type}
      className={cn(
        'btn-base',
        componentVariants.button[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      )}
      {children}
    </button>
  )
}

export default Button