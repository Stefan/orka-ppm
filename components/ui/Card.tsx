import React from 'react'
import { cn, componentVariants } from '@/lib/design-system'
import type { CardProps } from '@/types'

/**
 * Enhanced Card component with design system integration
 */
export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) => {
  const paddingClasses = {
    xs: 'p-2',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
    '2xl': 'p-12',
    '3xl': 'p-16',
    '4xl': 'p-20',
    '5xl': 'p-24',
  }

  return (
    <div
      className={cn(
        'card-base',
        componentVariants.card[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Card Header component
 */
export const CardHeader: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn('card-header', className)}>
    {children}
  </div>
)

/**
 * Card Title component
 */
export const CardTitle: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <h3 className={cn('text-lg font-semibold', className)}>
    {children}
  </h3>
)

/**
 * Card Description component
 */
export const CardDescription: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <p className={cn('text-sm text-muted-foreground', className)}>
    {children}
  </p>
)

/**
 * Card Content component
 */
export const CardContent: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn('card-content', className)}>
    {children}
  </div>
)

/**
 * Card Footer component
 */
export const CardFooter: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn('card-footer', className)}>
    {children}
  </div>
)

export default Card