import React from 'react'
import { cn, atomicPatterns } from '@/lib/design-system'

export interface SmartIconProps {
  icon: React.ComponentType<{ className?: string }>
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  className?: string
  interactive?: boolean
  onClick?: () => void
  'data-testid'?: string
}

/**
 * SmartIcon - Atomic design component for consistent icon rendering
 * Context-aware icons with responsive sizing
 */
export const SmartIcon: React.FC<SmartIconProps> = ({
  icon: Icon,
  size = 'medium',
  className,
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
        className
      )}
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
          'hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700',
          'touch-target'
        )}
        data-testid={testId ? `${testId}-button` : undefined}
      >
        {iconElement}
      </button>
    )
  }

  return iconElement
}

export default SmartIcon