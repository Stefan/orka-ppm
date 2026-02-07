'use client'

import React from 'react'
import { KPIMetrics, Currency } from '@/types/costbook'
import { CurrencySelector } from './CurrencySelector'
import { KPIBadges } from './KPIBadges'
import { 
  RefreshCw, 
  Activity, 
  HelpCircle,
  Search,
  Bell,
  Settings,
  LineChart,
} from 'lucide-react'

export interface CostbookHeaderProps {
  /** KPI metrics data */
  kpis: KPIMetrics
  /** Currently selected currency */
  selectedCurrency: Currency
  /** Handler for currency change */
  onCurrencyChange: (currency: Currency) => void
  /** Handler for refresh button */
  onRefresh: () => void
  /** Handler for performance button */
  onPerformance: () => void
  /** Handler for help button */
  onHelp: () => void
  /** Handler for integration sync (ERP/SAP etc.) */
  onSync?: () => void
  /** Whether integration sync is in progress */
  isSyncing?: boolean
  /** Handler for regenerating rundown profiles */
  onRegenerateProfiles?: () => void
  /** Whether rundown profile generation is in progress */
  isRegeneratingProfiles?: boolean
  /** Optional search handler */
  onSearch?: (term: string) => void
  /** Search term */
  searchTerm?: string
  /** Whether data is loading */
  isLoading?: boolean
  /** Last refresh timestamp */
  lastRefreshTime?: Date
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Icon button component with tooltip
 */
function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  className = '',
  testId
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  testId?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={`
        p-2
        rounded-md
        text-gray-600 dark:text-slate-400
        hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-200
        hover:bg-gray-100 dark:hover:bg-slate-700
        disabled:opacity-50
        disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
    >
      {icon}
    </button>
  )
}

/**
 * Search input component
 */
function SearchInput({
  value,
  onChange,
  placeholder = 'Search projects...'
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-48
          pl-9 pr-3 py-2
          text-sm
          border border-gray-300 dark:border-slate-600
          rounded-md
          bg-white dark:bg-slate-800
          text-gray-900 dark:text-slate-100
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-blue-500
          placeholder:text-gray-400 dark:text-slate-500 dark:placeholder:text-slate-500
        "
      />
    </div>
  )
}

/**
 * CostbookHeader component for Costbook
 * Contains title, currency selector, KPI badges, and action buttons
 */
export function CostbookHeader({
  kpis,
  selectedCurrency,
  onCurrencyChange,
  onRefresh,
  onPerformance,
  onHelp,
  onSync,
  isSyncing = false,
  onRegenerateProfiles,
  isRegeneratingProfiles = false,
  onSearch,
  searchTerm = '',
  isLoading = false,
  lastRefreshTime,
  className = '',
  'data-testid': testId = 'costbook-header'
}: CostbookHeaderProps) {
  return (
    <header
      className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-3 ${className}`}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Section: Title and Currency */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Costbook</h1>
            {lastRefreshTime && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Last updated: {lastRefreshTime.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">Currency:</span>
            <CurrencySelector
              value={selectedCurrency}
              onChange={onCurrencyChange}
              disabled={isLoading}
              size="sm"
              data-testid={`${testId}-currency-selector`}
            />
          </div>

          {onSearch && (
            <SearchInput
              value={searchTerm}
              onChange={onSearch}
            />
          )}
        </div>

        {/* Center Section: KPI Badges */}
        <div className="flex-1 flex justify-center">
          <KPIBadges
            kpis={kpis}
            currency={selectedCurrency}
            direction="horizontal"
            size="sm"
            compact={true}
            data-testid={`${testId}-kpi-badges`}
          />
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-1">
          <IconButton
            icon={<RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />}
            label="Refresh data"
            onClick={onRefresh}
            disabled={isLoading}
            testId={`${testId}-refresh-btn`}
          />
          {onSync && (
            <IconButton
              icon={<RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />}
              label="Sync from ERP"
              onClick={onSync}
              disabled={isSyncing || isLoading}
              testId={`${testId}-sync-btn`}
            />
          )}
          {onRegenerateProfiles && (
            <IconButton
              icon={<LineChart className={`w-5 h-5 ${isRegeneratingProfiles ? 'animate-pulse text-blue-500 dark:text-blue-400' : ''}`} />}
              label="Regenerate rundown profiles"
              onClick={onRegenerateProfiles}
              disabled={isRegeneratingProfiles}
              testId={`${testId}-regenerate-profiles-btn`}
            />
          )}
          
          <IconButton
            icon={<Activity className="w-5 h-5" />}
            label="Performance metrics"
            onClick={onPerformance}
            testId={`${testId}-performance-btn`}
          />
          
          <IconButton
            icon={<HelpCircle className="w-5 h-5" />}
            label="Help"
            onClick={onHelp}
            testId={`${testId}-help-btn`}
          />
        </div>
      </div>
    </header>
  )
}

/**
 * Compact header for mobile
 */
export function CompactCostbookHeader({
  kpis,
  selectedCurrency,
  onCurrencyChange,
  onRefresh,
  isLoading = false,
  className = ''
}: {
  kpis: KPIMetrics
  selectedCurrency: Currency
  onCurrencyChange: (currency: Currency) => void
  onRefresh: () => void
  isLoading?: boolean
  className?: string
}) {
  return (
    <header className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Costbook</h1>
        
        <div className="flex items-center gap-2">
          <CurrencySelector
            value={selectedCurrency}
            onChange={onCurrencyChange}
            disabled={isLoading}
            size="sm"
          />
          
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Horizontal scrolling KPI badges */}
      <div className="overflow-x-auto -mx-3 px-3 pb-1">
        <KPIBadges
          kpis={kpis}
          currency={selectedCurrency}
          direction="horizontal"
          size="sm"
          compact={true}
          className="flex-nowrap"
        />
      </div>
    </header>
  )
}

export default CostbookHeader