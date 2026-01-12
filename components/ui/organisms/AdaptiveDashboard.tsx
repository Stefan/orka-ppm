/**
 * AdaptiveDashboard - Organism component for AI-powered dashboard
 * Widget-based dashboard system with intelligent arrangement and optimization
 */

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/design-system'
import { Card } from '../Card'
import { Button } from '../Button'
import { 
  Zap, 
  BarChart3,
  AlertTriangle,
  GripVertical,
  RefreshCw,
  X,
  Settings
} from 'lucide-react'

// Types for dashboard widgets
export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list' | 'ai-insight'
  title: string
  data: any
  size: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  priority: number
  aiRecommended?: boolean
  refreshInterval?: number
  lastUpdated?: Date
  isLoading?: boolean
  error?: string
}

export interface AdaptiveDashboardProps {
  userId: string
  userRole: string
  widgets?: DashboardWidget[]
  layout?: 'grid' | 'masonry' | 'list'
  enableAI?: boolean
  enableDragDrop?: boolean
  onWidgetUpdate?: (widgets: DashboardWidget[]) => void
  onLayoutChange?: (layout: 'grid' | 'masonry' | 'list') => void
  className?: string
}

// AI optimization service (mock implementation)
const aiOptimizationService = {
  async getUserDashboardInteractions(_userId: string) {
    // Mock user behavior data
    return {
      mostViewedWidgets: ['metrics-1', 'chart-2', 'ai-insight-1'],
      timeSpentPerWidget: {
        'metrics-1': 45000, // 45 seconds
        'chart-2': 120000, // 2 minutes
        'ai-insight-1': 30000, // 30 seconds
      },
      preferredLayout: 'grid',
      deviceUsage: { mobile: 0.3, tablet: 0.2, desktop: 0.5 }
    }
  },

  async getAIDashboardRecommendations(_params: {
    userId: string
    userRole: string
    behavior: any
  }) {
    // Mock AI recommendations
    return {
      suggestedWidgets: [
        {
          id: 'ai-insight-budget',
          type: 'ai-insight' as const,
          title: 'Budget Optimization Insight',
          data: {
            insight: 'Your Q4 budget allocation could be optimized by reallocating 15% from Project Alpha to Project Beta for better ROI.',
            confidence: 0.87,
            impact: 'high',
            actions: ['Reallocate Budget', 'View Details', 'Dismiss']
          },
          size: 'medium' as const,
          position: { x: 0, y: 0 },
          priority: 1,
          aiRecommended: true
        }
      ],
      layoutOptimization: {
        recommendedLayout: 'grid',
        widgetArrangement: [
          { id: 'metrics-1', position: { x: 0, y: 0 }, size: 'small' },
          { id: 'chart-2', position: { x: 1, y: 0 }, size: 'large' },
        ]
      }
    }
  },

  async optimizeWidgetLayout(widgets: DashboardWidget[]) {
    // Mock layout optimization
    return widgets.map((widget, index) => ({
      ...widget,
      position: { x: index % 3, y: Math.floor(index / 3) },
      priority: widget.aiRecommended ? 1 : widget.priority || 5
    })).sort((a, b) => a.priority - b.priority)
  }
}

// Widget content renderer
const WidgetContent: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const renderContent = () => {
    switch (widget.type) {
      case 'metric':
        return (
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {widget.data?.value || '0'}
            </div>
            <div className="text-sm text-gray-600">
              {widget.data?.label || 'Metric'}
            </div>
            {widget.data?.change && (
              <div className={`text-xs mt-1 ${
                widget.data.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {widget.data.change > 0 ? '+' : ''}{widget.data.change}%
              </div>
            )}
          </div>
        )

      case 'chart':
        return (
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-gray-500">Chart Placeholder</span>
          </div>
        )

      case 'ai-insight':
        return (
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <Zap className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700 leading-relaxed">
                {widget.data?.insight || 'AI insight content'}
              </div>
            </div>
            {widget.data?.confidence && (
              <div className="text-xs text-gray-500">
                Confidence: {Math.round(widget.data.confidence * 100)}%
              </div>
            )}
            {widget.data?.actions && (
              <div className="flex flex-wrap gap-2 mt-3">
                {widget.data.actions.map((action: string, index: number) => (
                  <Button
                    key={index}
                    variant={index === 0 ? 'primary' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )

      case 'table':
        return (
          <div className="space-y-2">
            {widget.data?.rows?.slice(0, 3).map((row: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            )) || (
              <div className="text-sm text-gray-500">No data available</div>
            )}
          </div>
        )

      case 'list':
        return (
          <div className="space-y-2">
            {widget.data?.items?.slice(0, 4).map((item: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'success' ? 'bg-green-500' :
                  item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-700 truncate">{item.name}</span>
              </div>
            )) || (
              <div className="text-sm text-gray-500">No items available</div>
            )}
          </div>
        )

      default:
        return (
          <div className="text-center text-gray-500">
            <div className="text-sm">Widget type: {widget.type}</div>
          </div>
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {widget.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : widget.error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
          <AlertTriangle className="h-4 w-4 mr-1" />
          Error loading widget
        </div>
      ) : (
        <div className="flex-1">
          {renderContent()}
        </div>
      )}
    </div>
  )
}

// Main AdaptiveDashboard component
export const AdaptiveDashboard: React.FC<AdaptiveDashboardProps> = ({
  userId,
  userRole,
  widgets: initialWidgets = [],
  layout: initialLayout = 'grid',
  enableAI = true,
  enableDragDrop = true,
  onWidgetUpdate,
  onLayoutChange,
  className
}) => {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(initialWidgets)
  const [layout, setLayout] = useState<'grid' | 'masonry' | 'list'>(initialLayout)
  const [isLoading, setIsLoading] = useState(true)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)

  // AI optimization effect
  useEffect(() => {
    if (enableAI && userId) {
      optimizeDashboard()
    } else {
      setIsLoading(false)
    }
  }, [userId, userRole, enableAI])

  const optimizeDashboard = async () => {
    setIsLoading(true)
    
    try {
      // Get user behavior patterns
      const userBehavior = await aiOptimizationService.getUserDashboardInteractions(userId)
      
      // Get AI recommendations
      const aiRecommendations = await aiOptimizationService.getAIDashboardRecommendations({
        userId,
        userRole,
        behavior: userBehavior
      })
      
      // Combine existing widgets with AI suggestions
      const allWidgets = [
        ...initialWidgets,
        ...aiRecommendations.suggestedWidgets
      ]
      
      // Optimize widget arrangement
      const optimizedWidgets = await aiOptimizationService.optimizeWidgetLayout(allWidgets)
      
      setWidgets(optimizedWidgets)
      
      // Update layout based on AI recommendation
      if (aiRecommendations.layoutOptimization.recommendedLayout !== layout) {
        setLayout(aiRecommendations.layoutOptimization.recommendedLayout as 'grid' | 'list' | 'masonry')
        onLayoutChange?.(aiRecommendations.layoutOptimization.recommendedLayout as 'grid' | 'list' | 'masonry')
      }
      
    } catch (error) {
      console.error('Dashboard optimization failed:', error)
      setWidgets(initialWidgets)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLayoutChange = (newLayout: 'grid' | 'masonry' | 'list') => {
    setLayout(newLayout)
    onLayoutChange?.(newLayout)
  }

  const handleWidgetRemove = (widgetId: string) => {
    const updatedWidgets = widgets.filter(w => w.id !== widgetId)
    setWidgets(updatedWidgets)
    onWidgetUpdate?.(updatedWidgets)
  }

  const handleRefreshWidget = async (widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, isLoading: true } : w
    ))

    // Simulate refresh
    setTimeout(() => {
      setWidgets(prev => prev.map(w => 
        w.id === widgetId ? { 
          ...w, 
          isLoading: false, 
          lastUpdated: new Date() 
        } : w
      ))
    }, 1000)
  }

  const handleReoptimize = async () => {
    setIsOptimizing(true)
    await optimizeDashboard()
    setIsOptimizing(false)
  }

  // Drag and drop handlers (simplified for mobile)
  const handleDragStart = (widgetId: string) => {
    if (enableDragDrop) {
      setDraggedWidget(widgetId)
    }
  }

  const handleDragEnd = () => {
    setDraggedWidget(null)
  }

  // Responsive grid configuration
  const gridColumns = useMemo(() => {
    switch (layout) {
      case 'list':
        return { mobile: 1, tablet: 1, desktop: 1 }
      case 'masonry':
        return { mobile: 1, tablet: 2, desktop: 3 }
      default: // grid
        return { mobile: 1, tablet: 2, desktop: 3, wide: 4 }
    }
  }, [layout])

  const renderWidget = (widget: DashboardWidget) => {
    const sizeClasses = {
      small: 'col-span-1 row-span-1',
      medium: layout === 'grid' ? 'col-span-1 md:col-span-2 row-span-1' : 'col-span-1',
      large: layout === 'grid' ? 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2' : 'col-span-1'
    }

    return (
      <div
        onTouchStart={() => handleDragStart(widget.id)}
        onTouchEnd={handleDragEnd}
        data-testid={widget.id || 'widget'}
        data-widget-id={widget.id || 'widget'}
      >
        <Card
          variant={widget.aiRecommended ? 'interactive' : 'default'}
          className={cn(
            sizeClasses[widget.size],
            'relative group transition-all duration-200',
            widget.aiRecommended && 'ring-2 ring-blue-200 bg-blue-50/30',
            draggedWidget === widget.id && 'opacity-50 scale-95',
            className
          )}
        >
        {/* Widget Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {enableDragDrop && (
              <GripVertical className="h-4 w-4 text-gray-400 cursor-move touch-manipulation" />
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {widget.title || 'Untitled Widget'}
            </h3>
            {widget.aiRecommended && (
              <div className="flex items-center text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded-full">
                <Zap className="h-3 w-3 mr-1" />
                AI
              </div>
            )}
          </div>
          
          {/* Widget Controls */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRefreshWidget(widget.id)}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleWidgetRemove(widget.id)}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Widget Content */}
        <WidgetContent widget={widget} />

        {/* Widget Footer */}
        {widget.lastUpdated && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Updated: {widget.lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        )}
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
          </div>
          <div className={cn(
            'grid gap-4',
            `grid-cols-${gridColumns.mobile}`,
            `md:grid-cols-${gridColumns.tablet}`,
            `lg:grid-cols-${gridColumns.desktop}`
          )}>
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-48">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-32 bg-gray-200 rounded" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
      <div className="space-y-6">
        {/* Dashboard Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            {/* Layout Selector */}
            <select
              value={layout}
              onChange={(e) => handleLayoutChange(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="grid">Grid Layout</option>
              <option value="masonry">Masonry Layout</option>
              <option value="list">List Layout</option>
            </select>
            
            {/* AI Optimization Button */}
            {enableAI && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReoptimize}
                disabled={isOptimizing}
                className="flex items-center"
              >
                {isOptimizing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {isOptimizing ? 'Optimizing...' : 'AI Optimize'}
              </Button>
            )}
            
            {/* Settings Button */}
            <Button variant="ghost" size="sm" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </div>
        </div>

        {/* AI Recommendations Banner */}
        {widgets.some(w => w.aiRecommended) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-900">
                  AI Recommendations Applied
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Your dashboard has been optimized based on your usage patterns and role.
                  Recommended widgets are highlighted with a blue border.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Widgets Grid */}
        <div
          className={cn(
            'grid gap-4',
            layout === 'grid' && `grid-cols-${gridColumns.mobile} md:grid-cols-${gridColumns.tablet} lg:grid-cols-${gridColumns.desktop}`,
            layout === 'masonry' && 'columns-1 md:columns-2 lg:columns-3',
            layout === 'list' && 'grid-cols-1 space-y-4'
          )}
        >
          {widgets.map((widget, index) => (
            <div key={widget.id || `widget-${index}`}>
              {renderWidget(widget)}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {widgets.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No widgets configured
            </h3>
            <p className="text-gray-600 mb-4">
              Add widgets to customize your dashboard experience.
            </p>
            <Button variant="primary">
              Add Widget
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdaptiveDashboard