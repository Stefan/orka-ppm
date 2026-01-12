'use client'

import { useId } from 'react'
import { FormFieldDescription, ErrorMessage, ScreenReaderOnly } from './ScreenReaderSupport'

interface AccessibleInputProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  error?: string
  description?: string
  required?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * AccessibleInput component with proper ARIA labels and descriptions
 */
export function AccessibleInput({
  label,
  type = 'text',
  value,
  onChange,
  error,
  description,
  required = false,
  placeholder,
  className = '',
  disabled = false
}: AccessibleInputProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <>
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            <ScreenReaderOnly>required</ScreenReaderOnly>
          </>
        )}
      </label>
      
      {description && (
        <FormFieldDescription id={descriptionId}>
          {description}
        </FormFieldDescription>
      )}
      
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={`
          block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          min-h-[44px]
        `}
      />
      
      {error && (
        <ErrorMessage id={errorId}>
          {error}
        </ErrorMessage>
      )}
    </div>
  )
}

interface AccessibleSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; disabled?: boolean }>
  error?: string
  description?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

/**
 * AccessibleSelect component with proper ARIA labels
 */
export function AccessibleSelect({
  label,
  value,
  onChange,
  options,
  error,
  description,
  required = false,
  className = '',
  disabled = false
}: AccessibleSelectProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <>
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            <ScreenReaderOnly>required</ScreenReaderOnly>
          </>
        )}
      </label>
      
      {description && (
        <FormFieldDescription id={descriptionId}>
          {description}
        </FormFieldDescription>
      )}
      
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={`
          block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          min-h-[44px]
        `}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <ErrorMessage id={errorId}>
          {error}
        </ErrorMessage>
      )}
    </div>
  )
}

interface AccessibleTextareaProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  description?: string
  required?: boolean
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

/**
 * AccessibleTextarea component with proper ARIA labels
 */
export function AccessibleTextarea({
  label,
  value,
  onChange,
  error,
  description,
  required = false,
  placeholder,
  rows = 4,
  className = '',
  disabled = false
}: AccessibleTextareaProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <>
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            <ScreenReaderOnly>required</ScreenReaderOnly>
          </>
        )}
      </label>
      
      {description && (
        <FormFieldDescription id={descriptionId}>
          {description}
        </FormFieldDescription>
      )}
      
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : 'false'}
        className={`
          block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed resize-vertical
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
      />
      
      {error && (
        <ErrorMessage id={errorId}>
          {error}
        </ErrorMessage>
      )}
    </div>
  )
}

interface AccessibleCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  description?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

/**
 * AccessibleCheckbox component with proper ARIA labels
 */
export function AccessibleCheckbox({
  label,
  checked,
  onChange,
  error,
  description,
  required = false,
  className = '',
  disabled = false
}: AccessibleCheckboxProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-start">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          required={required}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? 'true' : 'false'}
          className={`
            h-4 w-4 mt-1 text-blue-600 border-gray-300 rounded
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500' : ''}
          `}
        />
        <label 
          htmlFor={id}
          className="ml-3 block text-sm text-gray-700 cursor-pointer"
        >
          {label}
          {required && (
            <>
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
              <ScreenReaderOnly>required</ScreenReaderOnly>
            </>
          )}
        </label>
      </div>
      
      {description && (
        <FormFieldDescription id={descriptionId}>
          {description}
        </FormFieldDescription>
      )}
      
      {error && (
        <ErrorMessage id={errorId}>
          {error}
        </ErrorMessage>
      )}
    </div>
  )
}

interface AccessibleRadioGroupProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>
  error?: string
  description?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

/**
 * AccessibleRadioGroup component with proper ARIA labels and fieldset
 */
export function AccessibleRadioGroup({
  label,
  value,
  onChange,
  options,
  error,
  description,
  required = false,
  className = '',
  disabled = false
}: AccessibleRadioGroupProps) {
  const groupId = useId()
  const descriptionId = `${groupId}-description`
  const errorId = `${groupId}-error`

  return (
    <fieldset 
      className={`space-y-2 ${className}`}
      aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? 'true' : 'false'}
    >
      <legend className="block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <>
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            <ScreenReaderOnly>required</ScreenReaderOnly>
          </>
        )}
      </legend>
      
      {description && (
        <FormFieldDescription id={descriptionId}>
          {description}
        </FormFieldDescription>
      )}
      
      <div className="space-y-2">
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`
          const optionDescId = option.description ? `${optionId}-desc` : undefined
          
          return (
            <div key={option.value} className="flex items-start">
              <input
                id={optionId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || option.disabled}
                required={required}
                aria-describedby={optionDescId}
                className={`
                  h-4 w-4 mt-1 text-blue-600 border-gray-300
                  focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  disabled:cursor-not-allowed disabled:opacity-50
                `}
              />
              <div className="ml-3">
                <label 
                  htmlFor={optionId}
                  className="block text-sm text-gray-700 cursor-pointer"
                >
                  {option.label}
                </label>
                {option.description && (
                  <div id={optionDescId} className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {error && (
        <ErrorMessage id={errorId}>
          {error}
        </ErrorMessage>
      )}
    </fieldset>
  )
}