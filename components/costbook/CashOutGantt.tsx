'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { ProjectWithFinancials, Currency, DistributionSettings } from '@/types/costbook'
import { formatCurrency } from '@/lib/currency-utils'
import { ForecastScenario, ScenarioSelector, createBaselineScenario, duplicateScenario } from './ScenarioSelector'
import {
  Calendar,
  DollarSign,
  GripVertical,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'

/**
 * Forecast item representing a cash out event
 */
export interface ForecastItem {
  id: string
  projectId: string
  projectName: string
  amount: number
  originalDate: string
  forecastDate: string
  type: 'commitment' | 'actual' | 'predicted'
  description?: string
  isDragging?: boolean
}

export interface CashOutGanttProps {
  /** Projects to display forecasts for */
  projects: ProjectWithFinancials[]
  /** Currency for display */
  currency: Currency
  /** Called when a forecast date is changed via drag */
  onForecastChange?: (itemId: string, newDate: string) => void
  /** Start date for the timeline */
  startDate?: Date
  /** End date for the timeline */
  endDate?: Date
  /** Distribution settings per project (Duration/Profile) – shown as columns/badges */
  distributionSettingsByProject?: Map<string, DistributionSettings>
  /** Open distribution settings modal for a project */
  onOpenDistributionSettings?: (projectId: string) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

// Helper to generate month labels
function getMonthLabels(start: Date, end: Date): { label: string; date: Date }[] {
  const labels: { label: string; date: Date }[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), 1)
  
  while (current <= end) {
    labels.push({
      label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      date: new Date(current)
    })
    current.setMonth(current.getMonth() + 1)
  }
  
  return labels
}

// Calculate position percentage for a date within the range
function getDatePosition(date: Date, start: Date, end: Date): number {
  const totalRange = end.getTime() - start.getTime()
  const position = date.getTime() - start.getTime()
  return Math.max(0, Math.min(100, (position / totalRange) * 100))
}

// Parse date from position percentage
function getDateFromPosition(position: number, start: Date, end: Date): Date {
  const totalRange = end.getTime() - start.getTime()
  const timestamp = start.getTime() + (position / 100) * totalRange
  return new Date(timestamp)
}

// Generate mock forecast items from projects
function generateForecastItems(projects: ProjectWithFinancials[]): ForecastItem[] {
  const items: ForecastItem[] = []
  
  for (const project of projects) {
    // Add commitment-based forecasts
    const commitmentDate = new Date()
    commitmentDate.setMonth(commitmentDate.getMonth() + 1)
    
    if (project.total_commitments > project.total_actuals) {
      items.push({
        id: `${project.id}-commitment`,
        projectId: project.id,
        projectName: project.name,
        amount: project.total_commitments - project.total_actuals,
        originalDate: commitmentDate.toISOString(),
        forecastDate: commitmentDate.toISOString(),
        type: 'commitment',
        description: 'Pending commitments'
      })
    }
    
    // Add predicted spend
    const remainingBudget = project.budget - project.total_spend
    if (remainingBudget > 0) {
      const predictedDate = new Date()
      predictedDate.setMonth(predictedDate.getMonth() + 2)
      
      items.push({
        id: `${project.id}-predicted`,
        projectId: project.id,
        projectName: project.name,
        amount: remainingBudget * 0.5, // Predict 50% of remaining
        originalDate: predictedDate.toISOString(),
        forecastDate: predictedDate.toISOString(),
        type: 'predicted',
        description: 'Predicted spend'
      })
    }
  }
  
  return items
}

/**
 * Individual forecast bar component with drag support
 */
function ForecastBar({
  item,
  position,
  width,
  color,
  currency,
  onDragStart,
  onDragEnd,
  onDrag
}: {
  item: ForecastItem
  position: number
  width: number
  color: string
  currency: Currency
  onDragStart: () => void
  onDragEnd: () => void
  onDrag: (newPosition: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!barRef.current) return
    
    const rect = barRef.current.parentElement?.getBoundingClientRect()
    if (!rect) return
    
    const offsetX = e.clientX - (rect.left + (position / 100) * rect.width)
    setDragOffset(offsetX)
    setIsDragging(true)
    onDragStart()
    
    e.preventDefault()
  }, [position, onDragStart])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !barRef.current) return
    
    const rect = barRef.current.parentElement?.getBoundingClientRect()
    if (!rect) return
    
    const newPosition = ((e.clientX - rect.left - dragOffset) / rect.width) * 100
    onDrag(Math.max(0, Math.min(100 - width, newPosition)))
  }, [isDragging, dragOffset, width, onDrag])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    onDragEnd()
  }, [onDragEnd])
  
  // Add/remove global listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  return (
    <div
      ref={barRef}
      className={`
        absolute top-1 bottom-1 rounded-md cursor-grab
        flex items-center px-2 text-xs font-medium text-white
        transition-shadow
        ${isDragging ? 'shadow-lg cursor-grabbing z-10' : 'hover:shadow-md'}
        ${color}
      `}
      style={{
        left: `${position}%`,
        width: `${Math.max(width, 3)}%`,
        minWidth: '60px'
      }}
      onMouseDown={handleMouseDown}
      title={`${item.projectName}: ${formatCurrency(item.amount, currency)}`}
    >
      <GripVertical className="w-3 h-3 mr-1 opacity-50" />
      <span className="truncate">{formatCurrency(item.amount, currency, { compact: true })}</span>
    </div>
  )
}

/**
 * Cash Out Gantt Chart component
 */
export function CashOutGantt({
  projects,
  currency,
  onForecastChange,
  startDate: propStartDate,
  endDate: propEndDate,
  distributionSettingsByProject,
  onOpenDistributionSettings,
  className = '',
  'data-testid': testId = 'cash-out-gantt'
}: CashOutGanttProps) {
  // Calculate date range
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0)
  
  const startDate = propStartDate || defaultStart
  const endDate = propEndDate || defaultEnd
  
  // State
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>(() => 
    generateForecastItems(projects)
  )
  const [scenarios, setScenarios] = useState<ForecastScenario[]>(() => [
    createBaselineScenario('portfolio')
  ])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('baseline-portfolio')
  const [zoom, setZoom] = useState(1)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  
  // Month labels for header
  const monthLabels = useMemo(() => getMonthLabels(startDate, endDate), [startDate, endDate])
  
  // Group forecast items by project
  const itemsByProject = useMemo(() => {
    const grouped = new Map<string, ForecastItem[]>()
    
    for (const item of forecastItems) {
      const existing = grouped.get(item.projectId) || []
      existing.push(item)
      grouped.set(item.projectId, existing)
    }
    
    return grouped
  }, [forecastItems])
  
  // Calculate total forecast by month
  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, number>()
    
    for (const item of forecastItems) {
      const date = new Date(item.forecastDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      totals.set(key, (totals.get(key) || 0) + item.amount)
    }
    
    return totals
  }, [forecastItems])
  
  // Handlers
  const handleDragStart = useCallback((itemId: string) => {
    setDraggedItemId(itemId)
  }, [])
  
  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null)
  }, [])
  
  const handleDrag = useCallback((itemId: string, newPosition: number) => {
    const newDate = getDateFromPosition(newPosition, startDate, endDate)
    
    setForecastItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, forecastDate: newDate.toISOString() }
      }
      return item
    }))
    
    onForecastChange?.(itemId, newDate.toISOString())
  }, [startDate, endDate, onForecastChange])
  
  const handleReset = useCallback(() => {
    setForecastItems(generateForecastItems(projects))
  }, [projects])
  
  // Scenario handlers
  const handleScenarioSelect = useCallback((id: string) => {
    setSelectedScenarioId(id)
  }, [])
  
  const handleScenarioCreate = useCallback((scenario: Omit<ForecastScenario, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const newScenario: ForecastScenario = {
      ...scenario,
      id: `scenario-${Date.now()}`,
      createdAt: now,
      updatedAt: now
    }
    setScenarios(prev => [...prev, newScenario])
    setSelectedScenarioId(newScenario.id)
  }, [])
  
  const handleScenarioUpdate = useCallback((id: string, updates: Partial<ForecastScenario>) => {
    setScenarios(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    ))
  }, [])
  
  const handleScenarioDelete = useCallback((id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id))
    if (selectedScenarioId === id) {
      setSelectedScenarioId(scenarios[0]?.id || null)
    }
  }, [selectedScenarioId, scenarios])
  
  const handleScenarioDuplicate = useCallback((id: string) => {
    const scenario = scenarios.find(s => s.id === id)
    if (scenario) {
      handleScenarioCreate(duplicateScenario(scenario))
    }
  }, [scenarios, handleScenarioCreate])
  
  // Color mapping for forecast types
  const typeColors: Record<ForecastItem['type'], string> = {
    commitment: 'bg-orange-500',
    actual: 'bg-purple-500',
    predicted: 'bg-blue-500'
  }
  
  return (
    <div 
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Duration/Profile summary when distribution settings are provided */}
      {distributionSettingsByProject && distributionSettingsByProject.size > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-xs">
          <span className="font-medium text-gray-600 dark:text-slate-400">Duration / Profile:</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {Array.from(distributionSettingsByProject.entries()).slice(0, 5).map(([projectId, settings]) => {
              const project = projects.find(p => p.id === projectId)
              const label = project?.name ?? projectId.slice(0, 8)
              return (
                <button
                  key={projectId}
                  type="button"
                  onClick={() => onOpenDistributionSettings?.(projectId)}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50 text-gray-700 dark:text-slate-300 truncate max-w-[140px]"
                  title={`${label}: ${settings.profile}, ${settings.duration_start?.slice(0, 10)} – ${settings.duration_end?.slice(0, 10)}`}
                >
                  <span className="truncate block">{label}</span>
                  <span className="text-gray-500 dark:text-slate-400">{settings.profile}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-slate-100">Cash Out Forecast</h3>
          <span className="text-sm text-gray-500 dark:text-slate-400">
            Drag bars to adjust forecast dates
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-slate-700 rounded-lg">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs text-gray-600 dark:text-slate-400">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.25))}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          
          {/* Reset button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg"
            title="Reset to original dates"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>
      
      {/* Scenario selector */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <ScenarioSelector
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          onSelect={handleScenarioSelect}
          onCreate={handleScenarioCreate}
          onUpdate={handleScenarioUpdate}
          onDelete={handleScenarioDelete}
          onDuplicate={handleScenarioDuplicate}
        />
      </div>
      
      {/* Timeline content */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${100 * zoom}%` }}>
          {/* Month headers */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
            <div className="w-48 flex-shrink-0 p-2 text-xs font-medium text-gray-500 dark:text-slate-400 border-r border-gray-200 dark:border-slate-700">
              Project
            </div>
            <div className="flex-1 flex">
              {monthLabels.map((month, i) => (
                <div
                  key={i}
                  className="flex-1 p-2 text-xs font-medium text-gray-500 dark:text-slate-400 text-center border-r border-gray-100 dark:border-slate-700 last:border-r-0"
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>
          
          {/* Project rows */}
          {projects.map(project => {
            const projectItems = itemsByProject.get(project.id) || []
            
            return (
              <div key={project.id} className="flex border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                {/* Project name */}
                <div className="w-48 flex-shrink-0 p-2 text-sm font-medium text-gray-900 dark:text-slate-100 border-r border-gray-200 dark:border-slate-700 truncate">
                  {project.name}
                </div>
                
                {/* Timeline area */}
                <div className="flex-1 relative h-10">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {monthLabels.map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 border-r border-gray-100 dark:border-slate-700 last:border-r-0"
                      />
                    ))}
                  </div>
                  
                  {/* Forecast bars */}
                  {projectItems.map(item => {
                    const position = getDatePosition(new Date(item.forecastDate), startDate, endDate)
                    const barWidth = 5 // 5% width
                    
                    return (
                      <ForecastBar
                        key={item.id}
                        item={item}
                        position={position}
                        width={barWidth}
                        color={typeColors[item.type]}
                        currency={currency}
                        onDragStart={() => handleDragStart(item.id)}
                        onDragEnd={handleDragEnd}
                        onDrag={(newPos) => handleDrag(item.id, newPos)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
          
          {/* Summary row */}
          <div className="flex border-t-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
            <div className="w-48 flex-shrink-0 p-2 text-sm font-bold text-gray-900 dark:text-slate-100 border-r border-gray-200 dark:border-slate-700">
              Monthly Total
            </div>
            <div className="flex-1 flex">
              {monthLabels.map((month, i) => {
                const key = `${month.date.getFullYear()}-${String(month.date.getMonth() + 1).padStart(2, '0')}`
                const total = monthlyTotals.get(key) || 0
                
                return (
                  <div
                    key={i}
                    className="flex-1 p-2 text-xs font-medium text-gray-700 dark:text-slate-300 text-center border-r border-gray-100 dark:border-slate-700 last:border-r-0"
                  >
                    {total > 0 ? formatCurrency(total, currency, { compact: true }) : '-'}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-xs">
        <span className="text-gray-500 dark:text-slate-400">Legend:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span className="text-gray-600 dark:text-slate-400">Commitments</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span className="text-gray-600 dark:text-slate-400">Actuals</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-gray-600 dark:text-slate-400">Predicted</span>
        </div>
        <div className="flex items-center gap-1 ml-auto text-gray-400 dark:text-slate-500">
          <Info className="w-3 h-3" />
          <span>Drag bars to reschedule</span>
        </div>
      </div>
    </div>
  )
}

export default CashOutGantt
