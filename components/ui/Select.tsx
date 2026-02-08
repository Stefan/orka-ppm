/**
 * Select Component
 * 
 * A professional select/dropdown component with custom styling.
 */

import React, { useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/design-system'
import { useClickOutside } from '@/hooks'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  options?: SelectOption[]
  value?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange?: (value: string) => void
  className?: string
  multiple?: boolean
  children?: React.ReactNode
}

const selectBaseStyles = [
  'w-full',
  'px-4 py-2.5',
  'text-sm',
  'min-h-[40px]',
  'rounded-lg',
  'border border-gray-300 dark:border-slate-600',
  'bg-white dark:bg-slate-800',
  'text-gray-900 dark:text-slate-100',
  'transition-all duration-150 ease-in-out',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'disabled:bg-gray-50 dark:bg-slate-800/50 disabled:text-gray-500 dark:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400',
].join(' ')

export const Select: React.FC<SelectProps> = ({
  options = [],
  value,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  onChange,
  className,
  multiple = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValues, setSelectedValues] = useState<string[]>(
    multiple ? (value ? value.split(',') : []) : (value ? [value] : [])
  )

  // Sync selectedValues when value prop changes
  useEffect(() => {
    const newValues = multiple ? (value ? value.split(',') : []) : (value ? [value] : [])
    setSelectedValues(newValues)
  }, [value, multiple])

  const selectRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false))

  // If children are provided, render native select
  if (children) {
    return (
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          selectBaseStyles,
          'appearance-none cursor-pointer',
          'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3e%3c/svg%3e")]',
          'bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat',
          'pr-10',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
      >
        {children}
      </select>
    )
  }

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue]
      
      setSelectedValues(newValues)
      onChange?.(newValues.join(','))
    } else {
      setSelectedValues([optionValue])
      onChange?.(optionValue)
      setIsOpen(false)
    }
  }

  const getDisplayValue = () => {
    if (selectedValues.length === 0) return placeholder
    
    if (multiple) {
      if (selectedValues.length === 1) {
        const option = options.find(opt => opt.value === selectedValues[0])
        return option?.label || selectedValues[0]
      }
      return `${selectedValues.length} selected`
    }
    
    const option = options.find(opt => opt.value === selectedValues[0])
    return option?.label || selectedValues[0]
  }

  return (
    <div ref={selectRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          selectBaseStyles,
          'relative cursor-pointer flex items-center',
          error && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn(
          'block truncate flex-1',
          selectedValues.length === 0 && 'text-gray-400 dark:text-slate-500'
        )}>
          {getDisplayValue()}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 dark:text-slate-400 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180'
          )}
          aria-hidden
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 w-full min-w-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">No options available</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between',
                  'transition-colors duration-100',
                  option.disabled
                    ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed'
                    : 'text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700',
                  selectedValues.includes(option.value) && 'bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                )}
                onClick={() => !option.disabled && handleSelect(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {selectedValues.includes(option.value) && (
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

export default Select
