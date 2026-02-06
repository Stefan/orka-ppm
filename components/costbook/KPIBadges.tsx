'use client'

import React from 'react'
import { KPIMetrics, Currency } from '@/types/costbook'
import { formatCurrency, getVarianceColorClass, getVarianceBgColorClass } from '@/lib/currency-utils'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Receipt,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

export interface KPIBadgesProps {
  /** KPI metrics data */
  kpis: KPIMetrics
  /** Currency for formatting */
  currency: Currency
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
  /** Whether to show compact version */
  compact?: boolean
  /** Test ID for testing */
  'data-testid'?: string
}

interface KPIBadgeProps {
  label: string
  value: string
  icon: React.ReactNode
  colorClass?: string
  bgColorClass?: string
  size?: 'sm' | 'md' | 'lg'
  testId?: string
}

/**
 * Individual KPI Badge component
 */
function KPIBadge({ 
  label, 
  value, 
  icon, 
  colorClass = 'text-gray-700 dark:text-slate-300',
  bgColorClass = 'bg-gray-50 dark:bg-slate-800/50',
  size = 'md',
  testId
}: KPIBadgeProps) {
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1.5',
      icon: 'w-3 h-3',
      label: 'text-xs',
      value: 'text-sm'
    },
    md: {
      container: 'px-3 py-2',
      icon: 'w-4 h-4',
      label: 'text-xs',
      value: 'text-base'
    },
    lg: {
      container: 'px-4 py-3',
      icon: 'w-5 h-5',
      label: 'text-sm',
      value: 'text-lg'
    }
  }

  const classes = sizeClasses[size]

  // Map light mode bg classes to dark mode equivalents
  const getDarkBgClass = (lightBg: string) => {
    const darkBgMap: Record<string, string> = {
      'bg-blue-50': 'dark:bg-blue-900/30',
      'bg-orange-50': 'dark:bg-orange-900/30',
      'bg-purple-50': 'dark:bg-purple-900/30',
      'bg-gray-50 dark:bg-slate-800/50': 'dark:bg-slate-800/50',
      'bg-gray-100 dark:bg-slate-700': 'dark:bg-slate-700',
      'bg-green-50 dark:bg-green-900/20': 'dark:bg-green-900/30',
      'bg-green-100 dark:bg-green-900/30': 'dark:bg-green-900/30',
      'bg-red-50 dark:bg-red-900/20': 'dark:bg-red-900/30'
    }
    return darkBgMap[lightBg] || 'dark:bg-slate-700'
  }

  return (
    <div 
      className={`
        flex flex-col items-center
        ${classes.container}
        ${bgColorClass}
        ${getDarkBgClass(bgColorClass)}
        rounded-lg
        border border-gray-200 dark:border-slate-600
        shadow-sm
        min-w-[80px]
        transition-transform hover:scale-105
      `}
      data-testid={testId}
    >
      <div className={`flex items-center gap-1 mb-1 text-gray-500 dark:text-slate-400`}>
        <span className={classes.icon}>{icon}</span>
        <span className={`${classes.label} font-medium uppercase tracking-wide`}>
          {label}
        </span>
      </div>
      <span className={`${classes.value} font-bold ${colorClass}`}>
        {value}
      </span>
    </div>
  )
}

/**
 * KPI Badges component displaying all 7 key metrics
 * - Total Budget
 * - Commitments
 * - Actuals
 * - Total Spend
 * - Net Variance
 * - Over Budget Count
 * - Under Budget Count
 */
export function KPIBadges({
  kpis,
  currency,
  direction = 'horizontal',
  size = 'md',
  className = '',
  compact = false,
  'data-testid': testId = 'kpi-badges'
}: KPIBadgesProps) {
  const varianceColor = getVarianceColorClass(kpis.net_variance)
  const varianceBgColor = getVarianceBgColorClass(kpis.net_variance)

  const badges = [
    {
      label: 'Budget',
      value: formatCurrency(kpis.total_budget, currency, { compact }),
      icon: <DollarSign className="w-full h-full" />,
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgColorClass: 'bg-blue-50 dark:bg-blue-900/20',
      testId: `${testId}-budget`
    },
    {
      label: 'Commits',
      value: formatCurrency(kpis.total_commitments, currency, { compact }),
      icon: <CreditCard className="w-full h-full" />,
      colorClass: 'text-orange-600 dark:text-orange-400',
      bgColorClass: 'bg-orange-50',
      testId: `${testId}-commitments`
    },
    {
      label: 'Actuals',
      value: formatCurrency(kpis.total_actuals, currency, { compact }),
      icon: <Receipt className="w-full h-full" />,
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgColorClass: 'bg-purple-50',
      testId: `${testId}-actuals`
    },
    {
      label: 'Spend',
      value: formatCurrency(kpis.total_spend, currency, { compact }),
      icon: <TrendingUp className="w-full h-full" />,
      colorClass: 'text-gray-700 dark:text-slate-300',
      bgColorClass: 'bg-gray-100 dark:bg-slate-700',
      testId: `${testId}-spend`
    },
    {
      label: 'Variance',
      value: formatCurrency(kpis.net_variance, currency, { compact }),
      icon: kpis.net_variance >= 0 
        ? <TrendingUp className="w-full h-full" />
        : <TrendingDown className="w-full h-full" />,
      colorClass: varianceColor,
      bgColorClass: varianceBgColor,
      testId: `${testId}-variance`
    },
    {
      label: 'Over',
      value: kpis.over_budget_count.toString(),
      icon: <AlertTriangle className="w-full h-full" />,
      colorClass: kpis.over_budget_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400',
      bgColorClass: kpis.over_budget_count > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-slate-800/50',
      testId: `${testId}-over`
    },
    {
      label: 'Under',
      value: kpis.under_budget_count.toString(),
      icon: <CheckCircle className="w-full h-full" />,
      colorClass: kpis.under_budget_count > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400',
      bgColorClass: kpis.under_budget_count > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-slate-800/50',
      testId: `${testId}-under`
    }
  ]

  const containerClasses = direction === 'horizontal'
    ? 'flex flex-wrap gap-3 justify-center'
    : 'flex flex-col gap-2'

  return (
    <div 
      className={`${containerClasses} ${className}`}
      data-testid={testId}
      role="group"
      aria-label="Key Performance Indicators"
    >
      {badges.map((badge) => (
        <KPIBadge
          key={badge.label}
          label={badge.label}
          value={badge.value}
          icon={badge.icon}
          colorClass={badge.colorClass}
          bgColorClass={badge.bgColorClass}
          size={size}
          testId={badge.testId}
        />
      ))}
    </div>
  )
}

/**
 * Compact single KPI display
 */
export function SingleKPI({
  label,
  value,
  currency,
  icon,
  trend,
  className = ''
}: {
  label: string
  value: number
  currency: Currency
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}) {
  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-slate-400'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon && <span className="text-gray-500 dark:text-slate-400">{icon}</span>}
      <div>
        <span className="text-xs text-gray-500 dark:text-slate-400 uppercase">{label}</span>
        <p className={`font-bold ${trend ? trendColors[trend] : 'text-gray-900 dark:text-slate-100'}`}>
          {formatCurrency(value, currency)}
        </p>
      </div>
    </div>
  )
}

export default KPIBadges