'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  RundownProfile,
  RundownChartPoint,
  formatMonthLabel,
  getCurrentMonth,
  compareMonths,
  calculateVariance,
  profilesToChartData
} from '@/types/rundown'

export interface RundownSparklineProps {
  /** Rundown profiles to display */
  profiles: RundownProfile[]
  /** Width of the sparkline (default: 100%) */
  width?: number | string
  /** Height of the sparkline (default: 60) */
  height?: number
  /** Show tooltip on hover */
  showTooltip?: boolean
  /** Show current month indicator */
  showCurrentMonth?: boolean
  /** Warning threshold percentage (default: 10) */
  warningThreshold?: number
  /** Whether to show the warning indicator */
  showWarning?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Custom tooltip component
 */
function RundownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  
  const data = payload[0]?.payload as RundownChartPoint
  if (!data) return null
  
  const variance = calculateVariance(data.actual, data.planned)
  
  return (
    <div className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 text-xs">
      <div className="font-medium text-gray-900 mb-1">{data.label}</div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Planned:</span>
          <span className="font-medium">${(data.planned / 1000).toFixed(0)}K</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Actual:</span>
          <span className={`font-medium ${variance.isOver ? 'text-red-600' : 'text-green-600'}`}>
            ${(data.actual / 1000).toFixed(0)}K
          </span>
        </div>
        {data.predicted !== null && data.isFuture && (
          <div className="flex justify-between gap-3 border-t border-gray-100 pt-1 mt-1">
            <span className="text-gray-500">Predicted:</span>
            <span className="font-medium text-purple-600">
              ${(data.predicted / 1000).toFixed(0)}K
            </span>
          </div>
        )}
        {!data.isFuture && (
          <div className="flex justify-between gap-3 border-t border-gray-100 pt-1 mt-1">
            <span className="text-gray-500">Variance:</span>
            <span className={`font-medium ${variance.isOver ? 'text-red-600' : 'text-green-600'}`}>
              {variance.isOver ? '+' : ''}{variance.percentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rundown Sparkline Component
 * 
 * Displays a compact line chart showing:
 * - Planned values (dashed line)
 * - Actual values (solid line)
 * - Predicted values (dotted line, for future months)
 */
export function RundownSparkline({
  profiles,
  width = '100%',
  height = 60,
  showTooltip = true,
  showCurrentMonth = true,
  warningThreshold = 10,
  showWarning = true,
  className = '',
  'data-testid': testId = 'rundown-sparkline'
}: RundownSparklineProps) {
  // Convert profiles to chart data
  const chartData = useMemo(() => {
    return profilesToChartData(profiles)
  }, [profiles])
  
  // Calculate if there's a warning condition
  const warningStatus = useMemo(() => {
    if (!chartData.length) return null
    
    const currentMonth = getCurrentMonth()
    
    // Find the last actual data point
    const lastActual = chartData.filter(d => !d.isFuture).pop()
    if (!lastActual) return null
    
    const variance = calculateVariance(lastActual.actual, lastActual.planned)
    
    // Check if predicted exceeds planned by threshold
    const futureData = chartData.filter(d => d.isFuture && d.predicted !== null)
    const hasPredictionWarning = futureData.some(d => {
      if (d.predicted === null) return false
      const predVariance = calculateVariance(d.predicted, d.planned)
      return predVariance.percentage > warningThreshold
    })
    
    return {
      currentVariance: variance,
      isOverBudget: variance.isOver,
      hasPredictionWarning,
      showWarning: variance.percentage > warningThreshold || hasPredictionWarning
    }
  }, [chartData, warningThreshold])
  
  // Get current month index for reference line
  const currentMonthData = useMemo(() => {
    const currentMonth = getCurrentMonth()
    const idx = chartData.findIndex(d => d.month === currentMonth)
    return idx >= 0 ? chartData[idx] : null
  }, [chartData])
  
  if (chartData.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center h-[${height}px] text-gray-400 text-xs ${className}`}
        data-testid={testId}
      >
        No data
      </div>
    )
  }
  
  // Determine if we should show actual line in red or green
  const actualLineColor = warningStatus?.isOverBudget ? '#ef4444' : '#22c55e'
  
  return (
    <div 
      className={`relative ${className}`}
      data-testid={testId}
    >
      {/* Warning indicator */}
      {showWarning && warningStatus?.showWarning && (
        <div className="absolute -top-1 -right-1 z-10">
          <div className="relative">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-orange-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500 items-center justify-center">
              <AlertTriangle className="w-2 h-2 text-white" />
            </span>
          </div>
        </div>
      )}
      
      {/* Chart */}
      <ResponsiveContainer width={width} height={height}>
        <ComposedChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          {/* Current month reference line */}
          {showCurrentMonth && currentMonthData && (
            <ReferenceLine
              x={currentMonthData.label}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
          
          {/* X Axis - hidden but needed for reference */}
          <XAxis 
            dataKey="label" 
            hide
            tickLine={false}
            axisLine={false}
          />
          
          {/* Y Axis - hidden */}
          <YAxis hide domain={['auto', 'auto']} />
          
          {/* Tooltip */}
          {showTooltip && (
            <Tooltip 
              content={<RundownTooltip />}
              cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            />
          )}
          
          {/* Planned line (dashed, gray) */}
          <Line
            type="monotone"
            dataKey="planned"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            name="Planned"
          />
          
          {/* Actual line (solid, colored based on budget status) */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={actualLineColor}
            strokeWidth={2}
            dot={false}
            name="Actual"
          />
          
          {/* Predicted line (dotted, purple, only for future) */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#a855f7"
            strokeWidth={1.5}
            strokeDasharray="2 2"
            dot={false}
            name="Predicted"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Compact sparkline with label
 */
export interface RundownSparklineWithLabelProps extends RundownSparklineProps {
  /** Label text */
  label?: string
  /** Show variance badge */
  showVariance?: boolean
}

export function RundownSparklineWithLabel({
  label = 'Contingency Rundown',
  showVariance = true,
  profiles,
  ...props
}: RundownSparklineWithLabelProps) {
  const variance = useMemo(() => {
    const chartData = profilesToChartData(profiles)
    const lastActual = chartData.filter(d => !d.isFuture).pop()
    if (!lastActual) return null
    return calculateVariance(lastActual.actual, lastActual.planned)
  }, [profiles])
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {showVariance && variance && (
          <span className={`
            text-xs font-medium px-1.5 py-0.5 rounded
            ${variance.isOver 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
            }
          `}>
            {variance.isOver ? '+' : ''}{variance.percentage.toFixed(1)}%
          </span>
        )}
      </div>
      <RundownSparkline profiles={profiles} {...props} />
    </div>
  )
}

/**
 * Sparkline skeleton loader
 */
export function RundownSparklineSkeleton({ 
  height = 60,
  className = ''
}: { 
  height?: number
  className?: string 
}) {
  return (
    <div 
      className={`animate-pulse ${className}`}
      style={{ height }}
    >
      <div className="h-full bg-gray-200 rounded" />
    </div>
  )
}

/**
 * Legend component for the sparkline
 */
export function RundownLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-xs ${className}`}>
      <div className="flex items-center gap-1">
        <span className="w-4 h-0.5 bg-gray-400" style={{ borderStyle: 'dashed' }} />
        <span className="text-gray-500">Planned</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-4 h-0.5 bg-green-500" />
        <span className="text-gray-500">Actual</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-4 h-0.5 bg-purple-500" style={{ borderStyle: 'dotted' }} />
        <span className="text-gray-500">Predicted</span>
      </div>
    </div>
  )
}

export default RundownSparkline
