'use client'

import React from 'react'
import { Currency } from '@/types/costbook'
import { 
  getAllCurrencies, 
  getCurrencyDisplayName, 
  getCurrencySymbol 
} from '@/lib/currency-utils'
import { ChevronDown } from 'lucide-react'

export interface CurrencySelectorProps {
  /** Currently selected currency */
  value: Currency
  /** Callback when currency changes */
  onChange: (currency: Currency) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Show full display name or just code */
  showFullName?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Currency selector dropdown component for Costbook
 * Allows users to select a currency for displaying financial data
 */
export function CurrencySelector({
  value,
  onChange,
  disabled = false,
  className = '',
  showFullName = false,
  size = 'md',
  'data-testid': testId = 'currency-selector'
}: CurrencySelectorProps) {
  const currencies = getAllCurrencies()

  const sizeClasses = {
    sm: 'h-8 text-sm px-2',
    md: 'h-10 text-base px-3',
    lg: 'h-12 text-lg px-4'
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value as Currency
    onChange(newCurrency)
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        data-testid={testId}
        className={`
          appearance-none
          ${sizeClasses[size]}
          pr-8
          bg-white dark:bg-slate-800
          border border-gray-300 dark:border-slate-600
          rounded-md
          shadow-sm
          font-medium
          text-gray-700 dark:text-slate-200
          hover:border-gray-400 dark:hover:border-slate-500
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-blue-500
          disabled:bg-gray-100 dark:disabled:bg-slate-700
          disabled:text-gray-500 dark:disabled:text-slate-400
          disabled:cursor-not-allowed
          cursor-pointer
          transition-colors
        `}
        aria-label="Select currency"
      >
        {currencies.map((currency) => (
          <option 
            key={currency} 
            value={currency}
            data-testid={`currency-option-${currency}`}
          >
            {showFullName 
              ? getCurrencyDisplayName(currency)
              : `${getCurrencySymbol(currency)} ${currency}`
            }
          </option>
        ))}
      </select>
      
      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <ChevronDown 
          className={`
            w-4 h-4 
            ${disabled ? 'text-gray-400 dark:text-slate-500' : 'text-gray-600 dark:text-slate-400'}
          `} 
        />
      </div>
    </div>
  )
}

/**
 * Compact currency badge for display purposes
 */
export function CurrencyBadge({ 
  currency,
  className = ''
}: { 
  currency: Currency
  className?: string
}) {
  return (
    <span 
      className={`
        inline-flex items-center
        px-2 py-1
        text-xs font-semibold
        text-gray-700 dark:text-slate-200
        bg-gray-100 dark:bg-slate-700
        rounded-full
        ${className}
      `}
      data-testid={`currency-badge-${currency}`}
    >
      {getCurrencySymbol(currency)} {currency}
    </span>
  )
}

export default CurrencySelector