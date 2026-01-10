import React from 'react'
import { cn, responsive } from '@/lib/design-system'
import type { LayoutProps } from '@/types'

/**
 * ResponsiveContainer - Molecule component for flexible container system
 * Mobile-first responsive container with intelligent spacing
 */
export const ResponsiveContainer: React.FC<LayoutProps> = ({
  children,
  maxWidth = 'full',
  padding = 'md',
  margin,
  centered = false,
  className,
  ...props
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'w-full',
  }

  const paddingClasses = {
    xs: 'p-1 sm:p-2',
    sm: 'p-2 sm:p-3 lg:p-4',
    md: 'p-4 sm:p-6 lg:p-8',
    lg: 'p-6 sm:p-8 lg:p-12',
    xl: 'p-8 sm:p-12 lg:p-16',
    '2xl': 'p-12 sm:p-16 lg:p-20',
    '3xl': 'p-16 sm:p-20 lg:p-24',
    '4xl': 'p-20 sm:p-24 lg:p-32',
    '5xl': 'p-24 sm:p-32 lg:p-40',
  }

  const marginClasses = margin ? {
    xs: 'm-1 sm:m-2',
    sm: 'm-2 sm:m-3 lg:m-4',
    md: 'm-4 sm:m-6 lg:m-8',
    lg: 'm-6 sm:m-8 lg:m-12',
    xl: 'm-8 sm:m-12 lg:m-16',
    '2xl': 'm-12 sm:m-16 lg:m-20',
    '3xl': 'm-16 sm:m-20 lg:m-24',
    '4xl': 'm-20 sm:m-24 lg:m-32',
    '5xl': 'm-24 sm:m-32 lg:m-40',
  }[margin] : ''

  return (
    <div
      className={cn(
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        marginClasses,
        centered && 'mx-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default ResponsiveContainer