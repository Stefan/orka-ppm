import React from 'react'
import { cn } from '@/lib/design-system'
import { Card, CardHeader, CardContent } from './Card'
import { LoadingSpinner } from '../shared/LoadingSpinner'
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

interface SimulationCardProps {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

/**
 * Reusable card component for simulation displays
 * Provides consistent layout for Monte Carlo and What-If scenarios
 */
export const SimulationCard: React.FC<SimulationCardProps> = ({
  title,
  subtitle,
  loading = false,
  error,
  children,
  className,
  actions
}) => {
  return (
    <Card variant="default" padding="md" className={cn('relative', className)}>
      <CardHeader className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      
      <CardContent className="pt-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}
        
        {error && !loading && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && children}
      </CardContent>
    </Card>
  )
}

interface ImpactBadgeProps {
  label: string
  value: number | string
  type: 'cost' | 'schedule' | 'resource' | 'neutral'
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

/**
 * Badge component for displaying impact metrics
 */
export const ImpactBadge: React.FC<ImpactBadgeProps> = ({
  label,
  value,
  type,
  trend = 'neutral',
  className
}) => {
  const typeColors = {
    cost: trend === 'up' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50',
    schedule: trend === 'up' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50',
    resource: 'text-amber-600 bg-amber-50',
    neutral: 'text-gray-600 bg-gray-50'
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
      typeColors[type],
      className
    )}>
      {TrendIcon && <TrendIcon className="w-4 h-4" />}
      <span className="text-xs text-gray-600">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

interface StatisticDisplayProps {
  label: string
  value: string | number
  description?: string
  className?: string
}

/**
 * Component for displaying statistical values
 */
export const StatisticDisplay: React.FC<StatisticDisplayProps> = ({
  label,
  value,
  description,
  className
}) => {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-bold text-gray-900 mt-1">
        {value}
      </span>
      {description && (
        <span className="text-xs text-gray-600 mt-1">
          {description}
        </span>
      )}
    </div>
  )
}

export default SimulationCard
