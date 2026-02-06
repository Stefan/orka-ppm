'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine
} from 'recharts'
import { ProjectWithFinancials, Currency } from '@/types/costbook'
import { formatCurrency } from '@/lib/currency-utils'

export interface TrendSparklineProps {
  /** Array of projects with financial data */
  projects: ProjectWithFinancials[]
  /** Currency for formatting */
  currency: Currency
  /** Chart height */
  height?: number
  /** Show area fill under line */
  showArea?: boolean
  /** Show grid lines */
  showGrid?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

interface TrendDataPoint {
  month: string
  cumulativeSpend: number
  cumulativeBudget: number
}

/**
 * Generate mock time-based data for Phase 1
 * In Phase 2, this will use actual historical data
 */
function generateTrendData(projects: ProjectWithFinancials[]): TrendDataPoint[] {
  if (projects.length === 0) {
    return []
  }

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0)
  const totalSpend = projects.reduce((sum, p) => sum + p.total_spend, 0)
  
  // Generate last 6 months of mock data
  const months: TrendDataPoint[] = []
  const now = new Date()
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    
    const monthName = date.toLocaleString('default', { month: 'short' })
    
    // Simulate progressive spend (cumulative)
    const progressRatio = (6 - i) / 6
    const cumulativeSpend = totalSpend * progressRatio * (0.9 + Math.random() * 0.2)
    
    // Linear budget progression
    const cumulativeBudget = totalBudget * progressRatio
    
    months.push({
      month: monthName,
      cumulativeSpend: Math.round(cumulativeSpend),
      cumulativeBudget: Math.round(cumulativeBudget)
    })
  }
  
  return months
}

/**
 * Custom tooltip for sparkline
 */
function CustomTooltip({ 
  active, 
  payload, 
  label,
  currency 
}: { 
  active?: boolean
  payload?: any[]
  label?: string
  currency: Currency
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-2 border border-gray-200 dark:border-slate-700 rounded-lg shadow-md text-xs">
        <p className="font-medium text-gray-900 dark:text-slate-100 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-slate-400">{entry.name}:</span>
            <span className="font-medium">
              {formatCurrency(entry.value, currency, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

/**
 * TrendSparkline component for Costbook
 * Shows spending trends over time
 */
export function TrendSparkline({
  projects,
  currency,
  height = 150,
  showArea = true,
  showGrid = true,
  className = '',
  'data-testid': testId = 'trend-sparkline'
}: TrendSparklineProps) {
  const data = useMemo(() => generateTrendData(projects), [projects])
  
  // Format axis values
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toString()
  }

  if (data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center h-[${height}px] text-gray-500 dark:text-slate-400 text-sm ${className}`}
        data-testid={testId}
      >
        No data available
      </div>
    )
  }

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.cumulativeSpend, d.cumulativeBudget))
  )

  return (
    <div 
      className={`w-full ${className}`} 
      data-testid={testId}
    >
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Spending Trend
        <span className="ml-2 text-xs text-gray-500 dark:text-slate-400 font-normal">
          (Last 6 months)
        </span>
      </h4>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          )}
          
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 10, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
            domain={[0, maxValue * 1.1]}
            width={45}
          />
          
          <Tooltip content={<CustomTooltip currency={currency} />} />
          
          {/* Budget line */}
          <Line
            type="monotone"
            dataKey="cumulativeBudget"
            name="Budget"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4, fill: '#3B82F6' }}
          />
          
          {/* Spend line with optional area */}
          {showArea && (
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
              </linearGradient>
            </defs>
          )}
          
          {showArea && (
            <Area
              type="monotone"
              dataKey="cumulativeSpend"
              fill="url(#spendGradient)"
              stroke="none"
            />
          )}
          
          <Line
            type="monotone"
            dataKey="cumulativeSpend"
            name="Spend"
            stroke="#22C55E"
            strokeWidth={2}
            dot={{ r: 3, fill: '#22C55E' }}
            activeDot={{ r: 5, fill: '#22C55E' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed' }} />
          <span className="text-gray-600 dark:text-slate-400">Planned Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-green-500" />
          <span className="text-gray-600 dark:text-slate-400">Actual Spend</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Minimal sparkline for inline display
 */
export function MiniSparkline({
  data,
  color = '#22C55E',
  width = 100,
  height = 30
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  const chartData = data.map((value, index) => ({ value, index }))
  
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default TrendSparkline