import React from 'react'
import { cn } from '@/lib/design-system'
import { AlertCircle, HelpCircle } from 'lucide-react'
import { Input, Textarea } from './Input'
import { Select } from './Select'

interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'textarea' | 'select'
  value: string | number
  onChange: (value: string | number) => void
  error?: string
  helpText?: string
  tooltip?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  options?: Array<{ value: string | number; label: string }>
  rows?: number
  className?: string
}

/**
 * Consistent form field component with label, help text, and error handling
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  helpText,
  tooltip,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  rows = 3,
  className
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false)

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <Textarea
            value={value as string}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            rows={rows}
          />
        )
      
      case 'select':
        return (
          <Select
            value={value as string}
            onChange={onChange}
            disabled={disabled}
            error={error}
          >
            <option value="">Select {label}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )
      
      default:
        return (
          <Input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
          />
        )
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            
            {showTooltip && (
              <div className="absolute right-0 top-6 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                {tooltip}
                <div className="absolute -top-1 right-2 w-2 h-2 bg-gray-900 transform rotate-45" />
              </div>
            )}
          </div>
        )}
      </div>
      
      {renderInput()}
      
      {helpText && !error && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Form section component for grouping related fields
 */
export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

interface CheckboxFieldProps {
  label: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
  className?: string
}

/**
 * Checkbox field component with consistent styling
 */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  label,
  name,
  checked,
  onChange,
  description,
  disabled = false,
  className
}) => {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex-1">
        <label
          htmlFor={name}
          className={cn(
            'text-sm font-medium text-gray-700 cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  )
}

export default FormField
