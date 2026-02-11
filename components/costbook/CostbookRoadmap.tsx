'use client'

/**
 * Costbook – Unified Roadmap (3 Phasen)
 * Wireframe: h-screen overflow-hidden, max-w-7xl mx-auto p-3, grid grid-rows-[auto_1fr_auto] gap-3
 * Phase 1: Basis (Header, KPI-Badges, Projects Breakdown, Variance Waterfall, Health Bubble, Trend Sparkline, Footer)
 * Phase 2: Anomaly, NL Search, Recommendations, Cash Out Forecast + Distribution Settings Pop Up, AI-Import Builder
 * Phase 3: EVM (CPI/SPI/TCPI), Comments, Vendor Score, Voice, Gamification, Template-Sharing, Distribution Rules Engine
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ProjectWithFinancials, Currency, KPIMetrics } from '@/types/costbook'
import { calculateKPIs } from '@/lib/costbook-calculations'
import { convertCurrency } from '@/lib/currency-utils'
import { fetchProjectsWithFinancials } from '@/lib/costbook/supabase-queries'

// Phase 1: Core UI
import { CostbookErrorBoundary } from './CostbookErrorBoundary'
import { CostbookHeader } from './CostbookHeader'
import { CostbookFooter } from './CostbookFooter'
import { KPIBadges } from './KPIBadges'
import { ProjectsGrid } from './ProjectsGrid'
import { VisualizationPanel } from './VisualizationPanel'
import { CollapsiblePanel } from './CollapsiblePanel'
import { LoadingSpinner } from './LoadingSpinner'
import { ErrorDisplay } from './ErrorDisplay'

export interface CostbookRoadmapProps {
  /** Initial currency */
  initialCurrency?: Currency
  /** Handler for project selection */
  onProjectSelect?: (project: ProjectWithFinancials) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

function CostbookRoadmapInner({
  initialCurrency = Currency.USD,
  onProjectSelect,
  className = '',
  'data-testid': testId = 'costbook-roadmap'
}: CostbookRoadmapProps) {
  // Phase 1: State
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [baseCurrency] = useState<Currency>(Currency.USD)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(true)

  // Phase 1: Data fetch – Total Spend = SUM(commitments.total_amount) + SUM(actuals.amount), Variance = budget - Total Spend
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchProjectsWithFinancials()
      setProjects(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load Costbook data'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Phase 1: Convert currency for display - Cost Breakdown Structure (Approved Budget, EAC, Variance)
  const convertedProjects = useMemo(() => {
    if (selectedCurrency === baseCurrency) return projects
    return projects.map(p => ({
      ...p,
      budget: convertCurrency(p.budget, baseCurrency, selectedCurrency),
      total_commitments: convertCurrency(p.total_commitments, baseCurrency, selectedCurrency),
      total_actuals: convertCurrency(p.total_actuals, baseCurrency, selectedCurrency),
      total_spend: convertCurrency(p.total_spend, baseCurrency, selectedCurrency),
      variance: convertCurrency(p.variance, baseCurrency, selectedCurrency)
    }))
  }, [projects, selectedCurrency, baseCurrency])

  const kpis: KPIMetrics = useMemo(
    () => calculateKPIs(convertedProjects),
    [convertedProjects]
  )

  const handleCurrencyChange = useCallback((c: Currency) => setSelectedCurrency(c), [])
  const handleRefresh = useCallback(() => fetchData(), [fetchData])
  const handleProjectClick = useCallback((p: ProjectWithFinancials) => {
    setSelectedProjectId(prev => (prev === p.id ? undefined : p.id))
    onProjectSelect?.(p)
  }, [onProjectSelect])

  // Phase 2: Placeholders – Anomaly, NL Search, Recommendations, Distribution Settings Pop Up
  // const [searchTerm, setSearchTerm] = useState('')
  // const [showDistributionSettings, setShowDistributionSettings] = useState(false)
  const handlePerformance = useCallback(() => {}, [])
  const handleHelp = useCallback(() => {}, [])
  const handleScenarios = useCallback(() => {}, [])
  const handleResources = useCallback(() => {}, [])
  const handleReports = useCallback(() => {}, [])
  const handlePOBreakdown = useCallback(() => {}, [])
  const handleCSVImport = useCallback(() => {}, [])
  const handleForecast = useCallback(() => {}, [])
  const handleVendorScore = useCallback(() => {}, [])
  const handleSettings = useCallback(() => {}, [])

  if (isLoading) {
    return (
      <div className="h-full min-h-[400px] overflow-hidden w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center bg-gray-50 dark:bg-slate-800/50" data-testid={testId}>
        <LoadingSpinner message="Loading Costbook..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full min-h-[400px] overflow-hidden w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center bg-gray-50 dark:bg-slate-800/50" data-testid={testId}>
        <ErrorDisplay error={error} onRetry={handleRefresh} />
      </div>
    )
  }

  // Wireframe: fill parent (h-full) when embedded in Financials; grid grid-rows-[auto_1fr_auto] gap-3
  return (
    <div
      className={`h-full min-h-0 overflow-hidden w-full px-4 sm:px-6 lg:px-8 py-4 grid grid-rows-[auto_1fr_auto] gap-3 bg-gray-50 dark:bg-slate-800/50 ${className}`}
      data-testid={testId}
    >
      {/* Row 1 (Header): flex justify-between – Costbook title, KPI-Badge-Row, Refresh/Perf/Help */}
      <header className="flex justify-between items-center flex-wrap gap-3 flex-shrink-0">
        <CostbookHeader
          kpis={kpis}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencyChange}
          onRefresh={handleRefresh}
          onPerformance={handlePerformance}
          onHelp={handleHelp}
          className="w-full"
        />
      </header>

      {/* Row 2 (Main): grid grid-cols-12 gap-4 – Projects Breakdown (col-span-8), Charts (col-span-4) */}
      <main className="grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left (col-span-8): Projects Breakdown – collapsible Panel, grid grid-cols-1 md:2 lg:3, max-h-[calc(100vh-220px)] overflow-y-auto */}
        <div className="col-span-12 lg:col-span-8 min-h-0 flex flex-col overflow-hidden w-full">
          <CollapsiblePanel
            title="Projects Breakdown"
            isOpen={projectsPanelOpen}
            onToggle={() => setProjectsPanelOpen(prev => !prev)}
          >
            <div className="min-h-0 overflow-y-auto w-full">
              <ProjectsGrid
                projects={convertedProjects}
                currency={selectedCurrency}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectClick}
                viewMode="grid"
                className="w-full"
              />
            </div>
          </CollapsiblePanel>
        </div>

        {/* Right (col-span-4): Variance Waterfall, Health Bubble, Trend Sparkline – Financial Tracking: Delta EAC, Provisions; Cash Out Forecast */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0">
          <VisualizationPanel
            projects={convertedProjects}
            kpis={kpis}
            currency={selectedCurrency}
            onProjectClick={handleProjectClick}
            isLoading={false}
          />
        </div>
      </main>

      {/* Row 3 (Footer): flex gap-4 justify-center – 8 Icon-Buttons */}
      <footer className="flex gap-4 justify-center flex-shrink-0">
        <CostbookFooter
          onScenarios={handleScenarios}
          onResources={handleResources}
          onReports={handleReports}
          onPOBreakdown={handlePOBreakdown}
          onCSVImport={handleCSVImport}
          onForecast={handleForecast}
          onVendorScore={handleVendorScore}
          onSettings={handleSettings}
        />
      </footer>
    </div>
  )
}

/** Costbook Roadmap – testbar mit Suspense */
export function CostbookRoadmap(props: CostbookRoadmapProps) {
  return (
    <CostbookErrorBoundary>
      <CostbookRoadmapInner {...props} />
    </CostbookErrorBoundary>
  )
}

export default CostbookRoadmap
