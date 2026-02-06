import React, { forwardRef, useState } from 'react'
import { cn, componentVariants } from '@/lib/design-system'
import type { InputProps } from '@/types'

/**
 * ResponsiveInput - Atomic design component with mobile-first responsive design
 * Optimized for touch interactions
 */
export const ResponsiveInput = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  value,
  defaultValue,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  variant = 'default',
  size = 'md',
  error,
  helperText,
  label,
  leftIcon,
  rightIcon,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  autoComplete,
  autoFocus = false,
  maxLength,
  minLength,
  pattern,
  step,
  min,
  max,
  'data-testid': testId,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false)

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[40px]',
    md: 'px-4 py-3 text-base min-h-[44px]',
    lg: 'px-5 py-4 text-lg min-h-[48px]',
    xl: 'px-6 py-5 text-xl min-h-[52px]',
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value, e)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    if (onFocus) {
      onFocus(e)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    if (onBlur) {
      onBlur(e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-2',
            error ? 'text-error-700' : 'text-gray-700 dark:text-slate-300',
            disabled && 'opacity-50'
          )}
        >
          {label}
          {required && (
            <span className="text-error-500 ml-1">
              *
            </span>
          )}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className={cn(
              'text-gray-400 dark:text-slate-500',
              focused && 'text-primary-500',
              error && 'text-error-500'
            )}>
              {leftIcon}
            </span>
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'input-base',
            sizeClasses[size],
            componentVariants.input[variant],
            leftIcon ? 'pl-10' : '',
            rightIcon ? 'pr-10' : '',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-800/50',
            readOnly && 'bg-gray-50 dark:bg-slate-800/50 cursor-default',
            className
          )}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          step={step}
          min={min}
          max={max}
          data-testid={testId}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className={cn(
              'text-gray-400 dark:text-slate-500',
              focused && 'text-primary-500',
              error && 'text-error-500'
            )}>
              {rightIcon}
            </span>
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-error-600">
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  )
})

ResponsiveInput.displayName = 'ResponsiveInput'

export default ResponsiveInput