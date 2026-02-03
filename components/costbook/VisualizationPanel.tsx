'use client'

import React, { useMemo } from 'react'
import { ProjectWithFinancials, Currency, KPIMetrics } from '@/types/costbook'
import { VarianceWaterfall } from './VarianceWaterfall'
import { HealthBubbleChart } from './HealthBubbleChart'
import { TrendSparkline } from './TrendSparkline'
import { EVMTrendChart } from './EVMTrendChart'
import { generateMockEVMHistory } from '@/lib/evm-calculations'
import { BarChart3, PieChart, TrendingUp, Activity } from 'lucide-react'

export interface VisualizationPanelProps {
  /** Array of projects with financial data */
  projects: ProjectWithFinancials[]
  /** KPI metrics for aggregate values */
  kpis: KPIMetrics
  /** Currency for formatting */
  currency: Currency
  /** Handler for project click in bubble chart */
  onProjectClick?: (project: ProjectWithFinancials) => void
  /** Whether panel is loading */
  isLoading?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Loading placeholder for chart
 */
function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div 
      className={`bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse flex items-center justify-center`}
      style={{ height }}
    >
      <BarChart3 className="w-8 h-8 text-gray-300 dark:text-slate-500" />
    </div>
  )
}

/**
 * Chart container with header
 */
function ChartContainer({
  title,
  icon,
  children,
  className = ''
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400 dark:text-slate-500">{icon}</span>
        <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">{title}</h3>
      </div>
      {children}
    </div>
  )
}

/**
 * VisualizationPanel component for Costbook
 * Displays three charts in a vertical layout:
 * 1. Variance Waterfall
 * 2. Health Bubble Chart
 * 3. Trend Sparkline
 */
export function VisualizationPanel({
  projects,
  kpis,
  currency,
  onProjectClick,
  isLoading = false,
  className = '',
  'data-testid': testId = 'visualization-panel'
}: VisualizationPanelProps) {
  if (isLoading) {
    return (
      <div 
        className={`flex flex-col gap-3 ${className}`}
        data-testid={`${testId}-loading`}
      >
        <ChartContainer title="Budget Breakdown" icon={<BarChart3 className="w-4 h-4" />}>
          <ChartSkeleton height={220} />
        </ChartContainer>
        
        <ChartContainer title="Health Overview" icon={<PieChart className="w-4 h-4" />}>
          <ChartSkeleton height={220} />
        </ChartContainer>
        
        <ChartContainer title="Spending Trend" icon={<TrendingUp className="w-4 h-4" />}>
          <ChartSkeleton height={140} />
        </ChartContainer>
        <ChartContainer title="EVM Performance Trends" icon={<Activity className="w-4 h-4" />}>
          <ChartSkeleton height={140} />
        </ChartContainer>
      </div>
    )
  }

  return (
    <div 
      className={`flex flex-col gap-3 ${className}`}
      data-testid={testId}
    >
      {/* Variance Waterfall Chart */}
      <ChartContainer
        title="Budget Breakdown"
        icon={<BarChart3 className="w-4 h-4" />}
      >
        <VarianceWaterfall
          totalBudget={kpis.total_budget}
          totalCommitments={kpis.total_commitments}
          totalActuals={kpis.total_actuals}
          variance={kpis.net_variance}
          currency={currency}
          height={180}
          data-testid={`${testId}-waterfall`}
        />
      </ChartContainer>

      {/* Health Bubble Chart */}
      <ChartContainer
        title="Health Overview"
        icon={<PieChart className="w-4 h-4" />}
      >
        <HealthBubbleChart
          projects={projects}
          currency={currency}
          height={180}
          onProjectClick={onProjectClick}
          data-testid={`${testId}-bubble`}
        />
      </ChartContainer>

      {/* Trend Sparkline */}
      <ChartContainer
        title="Spending Trend"
        icon={<TrendingUp className="w-4 h-4" />}
      >
        <TrendSparkline
          projects={projects}
          currency={currency}
          height={120}
          showArea={true}
          showGrid={true}
          data-testid={`${testId}-trend`}
        />
      </ChartContainer>

      {/* EVM Performance Trends (Phase 3) */}
      {projects.length > 0 && (
        <ChartContainer
          title="EVM Performance Trends"
          icon={<Activity className="w-4 h-4" />}
        >
          <EVMTrendChartSection projects={projects} testId={testId} />
        </ChartContainer>
      )}
    </div>
  )
}

/**
 * EVM trend chart section - uses first project's mock history for aggregate view
 */
function EVMTrendChartSection({
  projects,
  testId
}: {
  projects: ProjectWithFinancials[]
  testId: string
}) {
  const evmHistory = useMemo(() => {
    if (projects.length === 0) return []
    // Use first project to generate representative EVM history for the panel
    return generateMockEVMHistory(projects[0], 6)
  }, [projects])

  if (evmHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-[140px] text-gray-500 text-sm">
        No EVM history available
      </div>
    )
  }

  return (
    <EVMTrendChart
      history={evmHistory}
      title="CPI / SPI Over Time"
      showCPI={true}
      showSPI={true}
      height={140}
      data-testid={`${testId}-evm-trend`}
    />
  )
}

/**
 * Compact visualization panel for mobile
 */
export function CompactVisualizationPanel({
  projects,
  kpis,
  currency,
  className = ''
}: {
  projects: ProjectWithFinancials[]
  kpis: KPIMetrics
  currency: Currency
  className?: string
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <TrendSparkline
        projects={projects}
        currency={currency}
        height={100}
        showArea={true}
        showGrid={false}
      />
      
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{projects.length}</div>
          <div className="text-xs text-blue-600/70">Projects</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{kpis.under_budget_count}</div>
          <div className="text-xs text-green-600/70">Under Budget</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{kpis.over_budget_count}</div>
          <div className="text-xs text-red-600/70">Over Budget</div>
        </div>
        <div className={`p-3 rounded-lg ${kpis.net_variance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className={`text-2xl font-bold ${kpis.net_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Math.round(Math.abs(kpis.net_variance) / 1000)}K
          </div>
          <div className={`text-xs ${kpis.net_variance >= 0 ? 'text-green-600/70' : 'text-red-600/70'}`}>
            {kpis.net_variance >= 0 ? 'Under' : 'Over'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VisualizationPanel