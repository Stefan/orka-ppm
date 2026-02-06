'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { EVMHistoryPoint, EVM_STATUS_CONFIG } from '@/types/evm'
import { formatIndex, formatEVMCurrency, getIndexColorClass } from '@/lib/evm-calculations'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

export interface EVMTrendChartProps {
  /** Historical EVM data points */
  history: EVMHistoryPoint[]
  /** Chart title */
  title?: string
  /** Show CPI line */
  showCPI?: boolean
  /** Show SPI line */
  showSPI?: boolean
  /** Show EAC line */
  showEAC?: boolean
  /** Chart height */
  height?: number
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Format date for chart axis
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/**
 * Custom tooltip component
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  
  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
        {formatDate(label)}
      </p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium">
              {entry.name === 'EAC' 
                ? formatEVMCurrency(entry.value)
                : formatIndex(entry.value)
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * EVM Trend Chart component
 * Shows CPI and SPI trends over time
 */
export function EVMTrendChart({
  history,
  title = 'EVM Performance Trends',
  showCPI = true,
  showSPI = true,
  showEAC = false,
  height = 300,
  className = '',
  'data-testid': testId = 'evm-trend-chart'
}: EVMTrendChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    return history.map(point => ({
      ...point,
      dateLabel: formatDate(point.date)
    }))
  }, [history])
  
  // Calculate current values for summary
  const currentValues = useMemo(() => {
    if (history.length === 0) return null
    const latest = history[history.length - 1]
    return {
      cpi: latest.cpi,
      spi: latest.spi,
      eac: latest.eac
    }
  }, [history])
  
  // Calculate trends
  const trends = useMemo(() => {
    if (history.length < 2) return { cpi: 'stable', spi: 'stable' }
    
    const first = history[0]
    const last = history[history.length - 1]
    
    const cpiChange = last.cpi - first.cpi
    const spiChange = last.spi - first.spi
    
    return {
      cpi: Math.abs(cpiChange) < 0.02 ? 'stable' : cpiChange > 0 ? 'up' : 'down',
      spi: Math.abs(spiChange) < 0.02 ? 'stable' : spiChange > 0 ? 'up' : 'down'
    }
  }, [history])
  
  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400" />
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />
    return <Minus className="w-4 h-4 text-gray-400 dark:text-slate-500" />
  }
  
  if (history.length === 0) {
    return (
      <div 
        className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 ${className}`}
        data-testid={testId}
      >
        <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-slate-500">
          <div className="text-center">
            <Activity className="w-12 h-12 mx-auto mb-2" />
            <p>No EVM history data available</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-slate-100">{title}</h3>
        </div>
        
        {currentValues && (
          <div className="flex items-center gap-4 text-sm">
            {showCPI && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-slate-400">CPI:</span>
                <span className={`font-medium ${getIndexColorClass(currentValues.cpi)}`}>
                  {formatIndex(currentValues.cpi)}
                </span>
                {getTrendIcon(trends.cpi)}
              </div>
            )}
            {showSPI && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-slate-400">SPI:</span>
                <span className={`font-medium ${getIndexColorClass(currentValues.spi)}`}>
                  {formatIndex(currentValues.spi)}
                </span>
                {getTrendIcon(trends.spi)}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="dateLabel" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              domain={[0.5, 1.5]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* Reference line at 1.0 */}
            <ReferenceLine 
              y={1} 
              stroke="#9ca3af" 
              strokeDasharray="5 5"
              label={{ value: 'Target', position: 'right', fill: '#9ca3af', fontSize: 12 }}
            />
            
            {/* Warning threshold at 0.9 */}
            <ReferenceLine 
              y={0.9} 
              stroke="#f59e0b" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            
            {/* Critical threshold at 0.8 */}
            <ReferenceLine 
              y={0.8} 
              stroke="#ef4444" 
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            
            {showCPI && (
              <Line
                type="monotone"
                dataKey="cpi"
                name="CPI"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {showSPI && (
              <Line
                type="monotone"
                dataKey="spi"
                name="SPI"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend explanation */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
          <span>
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />
            Above 1.0 = Good
          </span>
          <span>
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1" />
            0.9-1.0 = Caution
          </span>
          <span>
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
            Below 0.9 = Warning
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact EVM indicator for project cards
 */
export interface EVMIndicatorProps {
  /** Cost Performance Index */
  cpi: number
  /** Schedule Performance Index */
  spi: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show labels */
  showLabels?: boolean
  /** Additional CSS classes */
  className?: string
}

export function EVMIndicator({
  cpi,
  spi,
  size = 'md',
  showLabels = true,
  className = ''
}: EVMIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs gap-2',
    md: 'text-sm gap-3',
    lg: 'text-base gap-4'
  }
  
  const badgeClasses = {
    sm: 'px-1.5 py-0.5',
    md: 'px-2 py-0.5',
    lg: 'px-2.5 py-1'
  }
  
  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <div className="flex items-center gap-1">
        {showLabels && <span className="text-gray-500 dark:text-slate-400">CPI:</span>}
        <span className={`
          font-medium rounded-full border
          ${badgeClasses[size]}
          ${getIndexColorClass(cpi).replace('text-', 'bg-').replace('600', '100')}
          ${getIndexColorClass(cpi)}
        `}>
          {formatIndex(cpi)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {showLabels && <span className="text-gray-500 dark:text-slate-400">SPI:</span>}
        <span className={`
          font-medium rounded-full border
          ${badgeClasses[size]}
          ${getIndexColorClass(spi).replace('text-', 'bg-').replace('600', '100')}
          ${getIndexColorClass(spi)}
        `}>
          {formatIndex(spi)}
        </span>
      </div>
    </div>
  )
}

/**
 * EVM Summary Card component
 */
export interface EVMSummaryCardProps {
  /** EVM metrics */
  cpi: number
  spi: number
  cv: number
  sv: number
  eac: number
  vac: number
  /** Additional CSS classes */
  className?: string
}

export function EVMSummaryCard({
  cpi,
  spi,
  cv,
  sv,
  eac,
  vac,
  className = ''
}: EVMSummaryCardProps) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        EVM Summary
      </h4>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Performance Indices */}
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Cost Performance</div>
          <div className={`font-semibold ${getIndexColorClass(cpi)}`}>
            CPI: {formatIndex(cpi)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Schedule Performance</div>
          <div className={`font-semibold ${getIndexColorClass(spi)}`}>
            SPI: {formatIndex(spi)}
          </div>
        </div>
        
        {/* Variances */}
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Cost Variance</div>
          <div className={`font-semibold ${cv >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {cv >= 0 ? '+' : ''}{formatEVMCurrency(cv)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Schedule Variance</div>
          <div className={`font-semibold ${sv >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {sv >= 0 ? '+' : ''}{formatEVMCurrency(sv)}
          </div>
        </div>
        
        {/* Forecasts */}
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Est. at Completion</div>
          <div className="font-semibold text-gray-900 dark:text-slate-100">
            {formatEVMCurrency(eac)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-slate-400 mb-1">Variance at Completion</div>
          <div className={`font-semibold ${vac >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {vac >= 0 ? '+' : ''}{formatEVMCurrency(vac)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EVMTrendChart
