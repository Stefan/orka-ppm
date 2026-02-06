'use client'

import React, { useState, useCallback, useMemo } from 'react'
import InteractiveChart from '../charts/InteractiveChart'
import { AIInsight } from './types'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info,
  Download,
  Maximize2,
  X
} from 'lucide-react'

/**
 * PMR-specific chart types
 */
export type PMRChartType = 
  | 'budget-variance'
  | 'schedule-performance'
  | 'risk-heatmap'
  | 'resource-utilization'
  | 'cost-performance'

/**
 * PMR Chart Data Point with AI insights
 */
export interface PMRChartDataPoint {
  name: string
  value: number
  baseline?: number
  forecast?: number
  variance?: number
  status?: 'on-track' | 'at-risk' | 'critical'
  aiInsights?: AIInsight[]
  metadata?: Record<string, any>
}

/**
 * AI Insight Overlay Configuration
 */
export interface AIInsightOverlay {
  dataPointIndex: number
  insight: AIInsight
  position: { x: number; y: number }
}

/**
 * PMR Chart Props
 */
export interface PMRChartProps {
  type: PMRChartType
  data: PMRChartDataPoint[]
  title?: string
  height?: number
  showAIInsights?: boolean
  enableDrillDown?: boolean
  enableExport?: boolean
  className?: string
  onDataPointClick?: (dataPoint: PMRChartDataPoint) => void
  onExport?: (format: 'png' | 'svg' | 'pdf' | 'json' | 'csv') => void
}

/**
 * PMRChart Component
 * 
 * Enhanced interactive chart component specifically designed for PMR reports.
 * Extends the base InteractiveChart with PMR-specific features:
 * - Budget variance visualization
 * - Schedule performance tracking
 * - Risk heatmap display
 * - AI insight overlays
 * - Drill-down capabilities
 * - Export functionality for PMR reports
 */
const PMRChart: React.FC<PMRChartProps> = ({
  type,
  data,
  title,
  height = 400,
  showAIInsights = true,
  enableDrillDown = true,
  enableExport = true,
  className = '',
  onDataPointClick,
  onExport
}) => {
  const [selectedDataPoint, setSelectedDataPoint] = useState<PMRChartDataPoint | null>(null)
  const [showInsightOverlay, setShowInsightOverlay] = useState(false)
  const [expandedView, setExpandedView] = useState(false)

  /**
   * Get chart configuration based on PMR chart type
   */
  const chartConfig = useMemo(() => {
    switch (type) {
      case 'budget-variance':
        return {
          chartType: 'bar' as const,
          dataKey: 'variance',
          nameKey: 'name',
          colors: data.map(d => {
            if (!d.variance) return '#3B82F6'
            if (d.variance > 10) return '#EF4444' // Red for over budget
            if (d.variance > 5) return '#F59E0B' // Orange for warning
            if (d.variance < -5) return '#10B981' // Green for under budget
            return '#3B82F6' // Blue for on track
          }),
          title: title || 'Budget Variance Analysis'
        }
      
      case 'schedule-performance':
        return {
          chartType: 'line' as const,
          dataKey: 'value',
          nameKey: 'name',
          colors: ['#3B82F6', '#10B981', '#F59E0B'],
          title: title || 'Schedule Performance Index'
        }
      
      case 'risk-heatmap':
        return {
          chartType: 'bar' as const,
          dataKey: 'value',
          nameKey: 'name',
          colors: data.map(d => {
            if (!d.value) return '#3B82F6'
            if (d.value >= 80) return '#EF4444' // Critical
            if (d.value >= 60) return '#F59E0B' // High
            if (d.value >= 40) return '#FBBF24' // Medium
            return '#10B981' // Low
          }),
          title: title || 'Risk Heatmap'
        }
      
      case 'resource-utilization':
        return {
          chartType: 'bar' as const,
          dataKey: 'value',
          nameKey: 'name',
          colors: ['#8B5CF6', '#06B6D4'],
          title: title || 'Resource Utilization'
        }
      
      case 'cost-performance':
        return {
          chartType: 'line' as const,
          dataKey: 'value',
          nameKey: 'name',
          colors: ['#3B82F6', '#10B981'],
          title: title || 'Cost Performance Index'
        }
      
      default:
        return {
          chartType: 'bar' as const,
          dataKey: 'value',
          nameKey: 'name',
          colors: ['#3B82F6'],
          title: title || 'PMR Chart'
        }
    }
  }, [type, data, title])

  /**
   * Transform PMR data to chart format
   */
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      [chartConfig.dataKey]: point.value,
      [chartConfig.nameKey]: point.name,
      color: point.status === 'critical' ? '#EF4444' : 
             point.status === 'at-risk' ? '#F59E0B' : 
             '#10B981'
    }))
  }, [data, chartConfig])

  /**
   * Get AI insights for a data point
   */
  const getInsightsForDataPoint = useCallback((dataPoint: PMRChartDataPoint): AIInsight[] => {
    return dataPoint.aiInsights || []
  }, [])

  /**
   * Handle data point selection
   */
  const handleDataPointClick = useCallback((chartDataPoint: any) => {
    const pmrDataPoint = data.find(d => d.name === chartDataPoint.name)
    if (pmrDataPoint) {
      setSelectedDataPoint(pmrDataPoint)
      setShowInsightOverlay(true)
      onDataPointClick?.(pmrDataPoint)
    }
  }, [data, onDataPointClick])

  /**
   * Handle export
   */
  const handleExport = useCallback((format: 'json' | 'csv' | 'image' | 'pdf') => {
    const exportFormat = format === 'image' ? 'png' : format
    onExport?.(exportFormat as 'png' | 'svg' | 'pdf' | 'json' | 'csv')
  }, [onExport])

  /**
   * Get status indicator
   */
  const getStatusIndicator = (status?: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
      case 'at-risk':
        return <TrendingDown className="h-4 w-4 text-orange-500" />
      case 'on-track':
        return <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
      default:
        return <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
    }
  }

  /**
   * Render AI insight overlay
   */
  const renderInsightOverlay = () => {
    if (!showInsightOverlay || !selectedDataPoint) return null

    const insights = getInsightsForDataPoint(selectedDataPoint)
    if (insights.length === 0) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              {getStatusIndicator(selectedDataPoint.status)}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {selectedDataPoint.name}
              </h3>
            </div>
            <button
              onClick={() => setShowInsightOverlay(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Data Point Details */}
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400">Value</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {selectedDataPoint.value.toLocaleString()}
                </p>
              </div>
              {selectedDataPoint.baseline !== undefined && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Baseline</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {selectedDataPoint.baseline.toLocaleString()}
                  </p>
                </div>
              )}
              {selectedDataPoint.variance !== undefined && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Variance</p>
                  <p className={`text-lg font-semibold ${
                    selectedDataPoint.variance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {selectedDataPoint.variance > 0 ? '+' : ''}
                    {selectedDataPoint.variance.toFixed(1)}%
                  </p>
                </div>
              )}
              {selectedDataPoint.forecast !== undefined && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Forecast</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {selectedDataPoint.forecast.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="p-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-slate-100 mb-3">AI Insights</h4>
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border ${
                    insight.priority === 'critical' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                    insight.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                    insight.priority === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-slate-100">{insight.title}</h5>
                    <span className="text-xs px-2 py-1 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                      {(insight.confidence_score * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-3">{insight.content}</p>
                  
                  {insight.recommended_actions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">Recommended Actions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {insight.recommended_actions.map((action, idx) => (
                          <li key={idx} className="text-sm text-gray-700 dark:text-slate-300">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-end space-x-2">
            <button
              onClick={() => setShowInsightOverlay(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Close
            </button>
            {enableExport && (
              <button
                onClick={() => {
                  handleExport('json')
                  setShowInsightOverlay(false)
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export Details</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /**
   * Render expanded view
   */
  const renderExpandedView = () => {
    if (!expandedView) return null

    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-800 overflow-y-auto">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{chartConfig.title}</h2>
            <button
              onClick={() => setExpandedView(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <InteractiveChart
            type={chartConfig.chartType}
            data={chartData}
            title=""
            dataKey={chartConfig.dataKey}
            nameKey={chartConfig.nameKey}
            colors={chartConfig.colors}
            height={600}
            enableDrillDown={enableDrillDown}
            enableFiltering={true}
            enableExport={enableExport}
            enableBrushing={true}
            showLegend={true}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Chart Header with PMR-specific controls */}
        <div className="absolute top-2 right-2 z-10 flex items-center space-x-2">
          {showAIInsights && data.some(d => d.aiInsights && d.aiInsights.length > 0) && (
            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 text-xs rounded-full flex items-center space-x-1">
              <Info className="h-3 w-3" />
              <span>AI Insights Available</span>
            </div>
          )}
          
          <button
            onClick={() => setExpandedView(true)}
            className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
            title="Expand Chart"
          >
            <Maximize2 className="h-4 w-4 text-gray-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Base Interactive Chart */}
        <InteractiveChart
          type={chartConfig.chartType}
          data={chartData}
          title={chartConfig.title}
          dataKey={chartConfig.dataKey}
          nameKey={chartConfig.nameKey}
          colors={chartConfig.colors}
          height={height}
          enableDrillDown={enableDrillDown}
          enableFiltering={true}
          enableExport={enableExport}
          showLegend={true}
          className={className}
        />

        {/* AI Insight Indicators */}
        {showAIInsights && (
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            {data.map((point, index) => {
              const insights = getInsightsForDataPoint(point)
              if (insights.length === 0) return null

              const criticalInsights = insights.filter(i => i.priority === 'critical' || i.priority === 'high')
              if (criticalInsights.length === 0) return null

              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedDataPoint(point)
                    setShowInsightOverlay(true)
                    onDataPointClick?.(point)
                  }}
                  className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 text-xs rounded-full hover:bg-orange-200 flex items-center space-x-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>{point.name}: {criticalInsights.length} alert{criticalInsights.length > 1 ? 's' : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Overlays */}
      {renderInsightOverlay()}
      {renderExpandedView()}
    </>
  )
}

export default PMRChart
