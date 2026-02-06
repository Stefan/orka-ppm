/**
 * Input Component
 * 
 * A professional input component with clean styling, proper focus states,
 * and support for labels and error messages.
 */

import React from 'react'
import { cn } from '@/lib/design-system'
import type { ComponentSize } from '@/types/components'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: ComponentSize
  error?: boolean
  errorMessage?: string
  label?: string
  className?: string
}

export interface TextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  rows?: number
  className?: string
}

const inputSizes: Record<ComponentSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2.5 text-sm min-h-[40px]',
  lg: 'px-4 py-3 text-base min-h-[48px]',
}

const inputBaseStyles = [
  // Layout
  'w-full',
  // Shape
  'rounded-lg',
  // Border
  'border border-gray-300 dark:border-slate-600',
  // Background
  'bg-white dark:bg-slate-800',
  // Text
  'text-gray-900 dark:text-slate-100',
  // Placeholder
  'placeholder:text-gray-400 dark:text-slate-500',
  // Transitions
  'transition-all duration-150 ease-in-out',
  // Focus
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  // Disabled
  'disabled:bg-gray-50 dark:bg-slate-800/50 disabled:text-gray-500 dark:text-slate-400 disabled:cursor-not-allowed',
].join(' ')

const inputErrorStyles = 'border-red-500 focus:ring-red-500'

/**
 * Input Component
 */
export function Input({ 
  size = 'md', 
  error = false,
  errorMessage,
  label,
  className,
  ...props 
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        className={cn(
          inputBaseStyles,
          inputSizes[size],
          error && inputErrorStyles,
          className
        )}
        {...props}
      />
      {error && errorMessage && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  )
}

/**
 * Textarea Component
 */
export function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  rows = 3,
  className,
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={cn(
        inputBaseStyles,
        'px-4 py-2.5 text-sm resize-y min-h-[80px]',
        error && inputErrorStyles,
        className
      )}
    />
  )
}

export default Input
