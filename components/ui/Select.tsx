import React, { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn, componentVariants } from '@/lib/design-system'
import { useClickOutside } from '@/hooks'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange?: (value: string) => void
  className?: string
  multiple?: boolean
}

/**
 * Enhanced Select component with custom styling
 */
export const Select: React.FC<SelectProps> = ({
  options,
  value,
  placeholder = 'Select an option...',
  disabled = false,
  error,
  onChange,
  className,
  multiple = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValues, setSelectedValues] = useState<string[]>(
    multiple ? (value ? value.split(',') : []) : (value ? [value] : [])
  )

  const selectRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false))

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
    <div className="relative w-full">
      <div
        ref={selectRef}
        className={cn(
          'select-base',
          error ? componentVariants.input.error : componentVariants.input.default,
          disabled && 'opacity-50 cursor-not-allowed',
          'cursor-pointer',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn(
          'block truncate',
          selectedValues.length === 0 && 'text-gray-500'
        )}>
          {getDisplayValue()}
        </span>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer flex items-center justify-between',
                  option.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-900 hover:bg-gray-100',
                  selectedValues.includes(option.value) && 'bg-blue-50 text-blue-900'
                )}
                onClick={() => !option.disabled && handleSelect(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {selectedValues.includes(option.value) && (
                  <Check className="h-4 w-4 text-blue-600 flex-shrink-0 ml-2" />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default Select