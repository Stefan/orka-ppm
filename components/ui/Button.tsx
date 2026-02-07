/**
 * Button Component
 * 
 * A professional button component with multiple variants and sizes.
 * Features smooth transitions, proper focus states, and accessible design.
 */

import React from 'react'
import { cn } from '@/lib/design-system'
import type { ButtonVariant, ComponentSize } from '@/types/components'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ComponentSize
  disabled?: boolean
  /** When true, button is disabled and can show loading state; never passed to DOM */
  loading?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Professional button variant styles
 */
const buttonVariants: Record<ButtonVariant, string> = {
  primary: [
    'bg-blue-600 text-white',
    'hover:bg-blue-700',
    'active:bg-blue-800',
    'shadow-sm hover:shadow-md',
  ].join(' '),
  
  secondary: [
    'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100',
    'hover:bg-gray-200 dark:hover:bg-slate-600',
    'active:bg-gray-300',
    'border border-gray-200 dark:border-slate-700',
  ].join(' '),
  
  outline: [
    'bg-transparent text-blue-600 dark:text-blue-400',
    'border-2 border-blue-600',
    'hover:bg-blue-50',
    'active:bg-blue-100 dark:bg-blue-900/30',
  ].join(' '),
  
  ghost: [
    'bg-transparent text-gray-700 dark:text-slate-300',
    'hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700',
    'active:bg-gray-200',
  ].join(' '),
  
  danger: [
    'bg-red-600 text-white',
    'hover:bg-red-700',
    'active:bg-red-800',
    'shadow-sm hover:shadow-md',
  ].join(' '),
}

/**
 * Button size styles with proper touch targets
 */
const buttonSizes: Record<ComponentSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-6 py-3 text-base min-h-[48px]',
}

/**
 * Base styles for all buttons
 */
const buttonBaseStyles = [
  // Layout
  'inline-flex items-center justify-center gap-2',
  // Typography
  'font-medium',
  // Shape
  'rounded-lg',
  // Transitions
  'transition-all duration-150 ease-in-out',
  // Focus
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  // Disabled
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
].join(' ')

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading,
    className,
    children,
    ...rest
  } = props
  // Ensure loading is never passed to DOM (invalid on <button>)
  const domProps = { ...rest }
  if ('loading' in domProps) delete domProps.loading
  return (
    <button
      className={cn(
        buttonBaseStyles,
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...domProps}
    >
      {children}
    </button>
  )
}

export default Button
