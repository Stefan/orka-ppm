import React from 'react'
import { cn, atomicPatterns } from '@/lib/design-system'
import type { ComponentProps } from '@/types'

export interface InputGroupProps extends ComponentProps {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  spacing?: 'sm' | 'md' | 'lg'
}

/**
 * InputGroup - Molecule component for form input grouping
 * Combines label, input, error, and helper text with consistent spacing
 */
export const InputGroup: React.FC<InputGroupProps> = ({
  children,
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  spacing = 'md',
  className,
  ...props
}) => {
  const spacingClasses = {
    sm: 'space-y-1',
    md: 'space-y-2',
    lg: 'space-y-3',
  }

  const inputId = `input-group-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div
      className={cn(
        atomicPatterns.molecules.inputGroup,
        spacingClasses[spacing],
        disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium',
            error ? 'text-error-700' : 'text-gray-700',
            disabled && 'cursor-not-allowed'
          )}
        >
          {label}
          {required && (
            <span className="text-error-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </label>
      )}
      
      <div className="relative">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              id: inputId,
              disabled: disabled || (child.props as any)?.disabled,
              error: error || (child.props as any)?.error,
              'aria-describedby': [
                (child.props as any)?.['aria-describedby'],
                error ? `${inputId}-error` : undefined,
                helperText ? `${inputId}-helper` : undefined,
              ].filter(Boolean).join(' ') || undefined,
              'aria-invalid': error ? 'true' : (child.props as any)?.['aria-invalid'],
              'aria-required': required || (child.props as any)?.['aria-required'],
            } as any)
          }
          return child
        })}
      </div>
      
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-error-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}
    </div>
  )
}

export default InputGroup