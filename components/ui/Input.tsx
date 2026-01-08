import React, { forwardRef } from 'react'
import { cn, componentVariants } from '@/lib/design-system'
import type { InputProps } from '@/types'

/**
 * Enhanced Input component with design system integration
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  value,
  placeholder,
  disabled = false,
  error,
  onChange,
  onBlur,
  onFocus,
  className,
  children,
  ...props
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          ref={ref}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          className={cn(
            'input-base',
            error ? componentVariants.input.error : componentVariants.input.default,
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          {...props}
        />
        {children && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {children}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

/**
 * Textarea component with similar styling
 */
export const Textarea = forwardRef<HTMLTextAreaElement, Omit<InputProps, 'type'> & {
  rows?: number
}>(({
  value,
  placeholder,
  disabled = false,
  error,
  onChange,
  onBlur,
  onFocus,
  className,
  rows = 3,
  ...props
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  return (
    <div className="w-full">
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        className={cn(
          'textarea-base',
          error ? componentVariants.input.error : componentVariants.input.default,
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Input