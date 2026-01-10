import React from 'react'
import { cn, atomicPatterns, a11y } from '@/lib/design-system'

export interface SmartIconProps {
  icon: React.ComponentType<{ className?: string }>
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  className?: string
  'aria-label'?: string
  'aria-hidden'?: boolean
  decorative?: boolean
  interactive?: boolean
  onClick?: () => void
  'data-testid'?: string
}

/**
 * SmartIcon - Atomic design component for consistent icon rendering
 * Context-aware icons with accessibility labels and responsive sizing
 */
export const SmartIcon: React.FC<SmartIconProps> = ({
  icon: Icon,
  size = 'medium',
  className,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  decorative = false,
  interactive = false,
  onClick,
  'data-testid': testId,
}) => {
  const sizeClasses = atomicPatterns.atoms.icon

  const iconElement = (
    <Icon
      className={cn(
        sizeClasses[size],
        interactive && 'cursor-pointer hover:opacity-75 transition-opacity',
        a11y.reducedMotion,
        className
      )}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative || ariaHidden}
      data-testid={testId}
    />
  )

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center justify-center rounded-md p-1',
          'hover:bg-gray-100 focus:bg-gray-100',
          a11y.focusVisible,
          'touch-target'
        )}
        aria-label={ariaLabel}
        data-testid={testId ? `${testId}-button` : undefined}
      >
        {iconElement}
      </button>
    )
  }

  return iconElement
}

export default SmartIcon