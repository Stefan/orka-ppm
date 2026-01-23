/**
 * Card Component
 * 
 * A standardized card component that implements the design system specifications.
 * Supports configurable padding, shadow, and border options.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react'
import { cn } from '@/lib/design-system'
import type { ComponentSize, ShadowSize } from '@/types/components'

/**
 * Card component props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding size of the card */
  padding?: ComponentSize
  /** Shadow size of the card */
  shadow?: ShadowSize
  /** Whether to show a border */
  border?: boolean
  /** Card content */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * CardHeader component props
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header content */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * CardContent component props
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content */
  children: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Card padding styles
 * Maps each size to its corresponding padding classes
 * 
 * Requirements:
 * - 3.1: Consistent paddings from design tokens
 */
const cardPadding: Record<ComponentSize, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

/**
 * Card shadow styles
 * Maps each shadow size to its corresponding shadow classes
 * 
 * Requirements:
 * - 3.2: Shadow styles from design tokens
 */
const cardShadow: Record<ShadowSize, string> = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
}

/**
 * Base card styles applied to all cards
 * 
 * Requirements:
 * - 3.3: Border radius from design tokens
 */
const cardBaseStyles = 'bg-white rounded-lg text-gray-900'

/**
 * Card border styles
 * 
 * Requirements:
 * - 3.5: Optional border with consistent color and width
 */
const cardBorderStyles = 'border border-neutral-200'

/**
 * CardHeader styles
 * 
 * Requirements:
 * - 3.4: Consistent header styles with bottom border
 */
const cardHeaderStyles = 'border-b border-neutral-200 pb-4 mb-4'

/**
 * Card Component
 * 
 * @example
 * ```tsx
 * <Card padding="md" shadow="md" border>
 *   <CardHeader>
 *     <h3>Card Title</h3>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card content goes here</p>
 *   </CardContent>
 * </Card>
 * ```
 */
export function Card({ 
  padding = 'md', 
  shadow = 'md',
  border = false,
  className,
  children,
  ...props 
}: CardProps) {
  return (
    <div
      className={cn(
        cardBaseStyles,
        cardPadding[padding],
        cardShadow[shadow],
        border && cardBorderStyles,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * CardHeader Component
 * 
 * @example
 * ```tsx
 * <CardHeader>
 *   <h3>Card Title</h3>
 * </CardHeader>
 * ```
 */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn(cardHeaderStyles, className)} {...props}>
      {children}
    </div>
  )
}

/**
 * CardContent Component
 * 
 * @example
 * ```tsx
 * <CardContent>
 *   <p>Card content goes here</p>
 * </CardContent>
 * ```
 */
export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}

export default Card
