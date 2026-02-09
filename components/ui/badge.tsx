/**
 * Badge Component
 * 
 * A professional badge/tag component for status indicators and labels.
 */

import React from 'react'
import { cn } from '@/lib/design-system'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'secondary' | 'destructive'
type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-600',
  primary: 'bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
  success: 'bg-green-50 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
  warning: 'bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
  error: 'bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
  info: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
  outline: 'bg-transparent border border-gray-300 dark:border-slate-600 text-gray-800 dark:text-slate-200',
  secondary: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-600',
  destructive: 'bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
}

const badgeDotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-cyan-500',
  outline: 'bg-gray-500',
  secondary: 'bg-gray-500',
  destructive: 'bg-red-500',
}

const badgeSizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', badgeDotColors[variant])} />
      )}
      {children}
    </span>
  )
}

export default Badge
