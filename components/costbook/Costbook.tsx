'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Layers } from 'lucide-react'
import { ProjectWithFinancials, Currency, KPIMetrics } from '@/types/costbook'
import { calculateKPIs } from '@/lib/costbook-calculations'
import { convertCurrency } from '@/lib/currency-utils'
import {
  getMockProjectsWithFinancials,
  fetchProjectsWithFinancials
} from '@/lib/costbook/supabase-queries'
import {
  detectAnomalies,
  AnomalyResult,
  calculateAnomalySummary
} from '@/lib/costbook/anomaly-detection'
import {
  parseNLQuery,
  matchesFilter,
  sortProjects,
  FilterCriteria,
  ParseResult
} from '@/lib/nl-query-parser'
import {
  generateRecommendations,
  EnhancedRecommendation,
  updateRecommendationStatus,
  getRecommendationsSummary
} from '@/lib/recommendation-engine'

// Components
import { CostbookErrorBoundary } from './CostbookErrorBoundary'
import { CostbookHeader, CompactCostbookHeader } from './CostbookHeader'
import { CostbookFooter, CompactCostbookFooter } from './CostbookFooter'
import { ProjectsGrid, ViewModeToggle } from './ProjectsGrid'
import { VisualizationPanel, CompactVisualizationPanel } from './VisualizationPanel'
import { LoadingSpinner, CardSkeleton } from './LoadingSpinner'
import { ErrorDisplay } from './ErrorDisplay'
import { ProjectAnomalyStatus, AnomalySummaryBadge } from './AnomalyIndicator'
import { AnomalyDetailDialog } from './AnomalyDetailDialog'
import { NLSearchInput } from './NLSearchInput'
import { NoResults } from './SearchSuggestions'
import { RecommendationsPanel, RecommendationsBadge } from './RecommendationsPanel'
import { RecommendationDetail } from './RecommendationDetail'
import { PerformanceDialog, PerformanceMetrics } from './PerformanceDialog'
import { HelpDialog } from './HelpDialog'
import { CommentsPanel } from './CommentsPanel'
import { CSVImportDialog } from './CSVImportDialog'
import { MobileAccordion, AccordionSection } from './MobileAccordion'
import { HierarchyTreeView, ViewType as HierarchyViewType } from './HierarchyTreeView'
import { VirtualizedTransactionTable } from './VirtualizedTransactionTable'
import { CollapsiblePanel } from './CollapsiblePanel'
import { DistributionSettingsDialog } from './DistributionSettingsDialog'
import { DistributionRulesPanel } from './DistributionRulesPanel'
import { buildCESHierarchy, buildWBSHierarchy } from '@/lib/costbook/hierarchy-builders'
import { getMockTransactions, TransactionFilters as TxFilters, filterTransactions, sortTransactions, TransactionSortField, SortDirection } from '@/lib/costbook/transaction-queries'
import { fetchCommentsCountBatch } from '@/lib/comments-service'
import { CSVImportResult, Commitment, Actual, HierarchyNode, Transaction, DistributionSettings, DistributionRule } from '@/types/costbook'

export interface CostbookProps {
  /** Use mock data instead of fetching from Supabase */
  useMockData?: boolean
  /** Initial currency */
  initialCurrency?: Currency
  /** Handler for project selection */
  onProjectSelect?: (project: ProjectWithFinancials) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Main Costbook component
 * Integrates all subcomponents into a cohesive financial dashboard
 */
function CostbookInner({
  useMockData = false,
  initialCurrency = Currency.USD,
  onProjectSelect,
  className = '',
  'data-testid': testId = 'costbook'
}: CostbookProps) {
  // State
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [baseCurrency] = useState<Currency>(Currency.USD) // Data is stored in USD
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({})
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Dialog states
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false)
  const [showAnomalyDialog, setShowAnomalyDialog] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyResult | null>(null)
  const [showDistributionDialog, setShowDistributionDialog] = useState(false)
  const [showDistributionRules, setShowDistributionRules] = useState(false)
  
  // Distribution state (Phase 2 & 3)
  const [distributionSettings, setDistributionSettings] = useState<Map<string, DistributionSettings>>(new Map())
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([])
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState<EnhancedRecommendation[]>([])
  const [showRecommendationDetail, setShowRecommendationDetail] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<EnhancedRecommendation | null>(null)

  // Comments state (Phase 3)
  const [commentsPanelProjectId, setCommentsPanelProjectId] = useState<string | null>(null)
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map())

  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    queryTime: 0,
    renderTime: 0,
    projectCount: 0,
    commitmentCount: 0,
    actualCount: 0,
    cacheHitRate: 85,
    errorCount: 0,
    lastRefresh: undefined
  })

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionFilters, setTransactionFilters] = useState<TxFilters>({})
  const [transactionSort, setTransactionSort] = useState<{ field: TransactionSortField; direction: SortDirection }>({
    field: 'date',
    direction: 'desc'
  })

  // Hierarchy state
  const [hierarchyViewType, setHierarchyViewType] = useState<HierarchyViewType>('ces')
  const [selectedHierarchyNode, setSelectedHierarchyNode] = useState<HierarchyNode | null>(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    const startTime = performance.now()
    setIsLoading(true)
    setError(null)

    try {
      let data: ProjectWithFinancials[]
      
      if (useMockData) {
        // Simulate network delay for mock data
        await new Promise(resolve => setTimeout(resolve, 500))
        data = getMockProjectsWithFinancials()
      } else {
        data = await fetchProjectsWithFinancials()
      }

      setProjects(data)

      // Detect anomalies
      const detectedAnomalies = detectAnomalies(data)
      setAnomalies(detectedAnomalies)
      
      // Generate recommendations
      const generatedRecommendations = generateRecommendations(data, detectedAnomalies)
      setRecommendations(generatedRecommendations)

      setLastRefreshTime(new Date())

      // Load mock transactions
      const mockTx = getMockTransactions()
      setTransactions(mockTx)

      // Track performance
      const queryTime = performance.now() - startTime
      setPerformanceMetrics({
        queryTime: Math.round(queryTime),
        renderTime: Math.round(performance.now() - startTime - queryTime),
        transformTime: 10,
        totalTime: Math.round(performance.now() - startTime),
        projectCount: data.length,
        commitmentCount: mockTx.filter(t => t.type === 'commitment').length,
        actualCount: mockTx.filter(t => t.type === 'actual').length,
        totalRecords: data.length + mockTx.length,
        cacheHitRate: 85,
        errorCount: 0,
        lastRefresh: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      setError(err instanceof Error ? err : new Error('Failed to load data'))
      
      // Fall back to mock data on error
      if (!useMockData) {
        try {
          const mockData = getMockProjectsWithFinancials()
          setProjects(mockData)

          // Detect anomalies in mock data
          const detectedAnomalies = detectAnomalies(mockData)
          setAnomalies(detectedAnomalies)
          
          // Generate recommendations for mock data
          const generatedRecommendations = generateRecommendations(mockData, detectedAnomalies)
          setRecommendations(generatedRecommendations)

          setLastRefreshTime(new Date())
        } catch {
          // If even mock data fails, keep the error state
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [useMockData])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Convert projects to selected currency
  const convertedProjects = useMemo(() => {
    if (selectedCurrency === baseCurrency) {
      return projects
    }

    return projects.map(project => ({
      ...project,
      budget: convertCurrency(project.budget, baseCurrency, selectedCurrency),
      total_commitments: convertCurrency(project.total_commitments, baseCurrency, selectedCurrency),
      total_actuals: convertCurrency(project.total_actuals, baseCurrency, selectedCurrency),
      total_spend: convertCurrency(project.total_spend, baseCurrency, selectedCurrency),
      variance: convertCurrency(project.variance, baseCurrency, selectedCurrency),
      eac: project.eac ? convertCurrency(project.eac, baseCurrency, selectedCurrency) : undefined
    }))
  }, [projects, selectedCurrency, baseCurrency])

  // Filter and sort projects based on NL query
  const filteredProjects = useMemo(() => {
    // If no filter criteria, return all projects
    if (Object.keys(filterCriteria).length === 0) {
      return convertedProjects
    }
    
    // Filter projects
    const filtered = convertedProjects.filter(project => 
      matchesFilter(project, filterCriteria)
    )
    
    // Sort if specified
    if (filterCriteria.sortBy) {
      return sortProjects(filtered, filterCriteria)
    }
    
    return filtered
  }, [convertedProjects, filterCriteria])

  // Fetch comment counts when projects change (Phase 3)
  const projectIdsKey = useMemo(
    () => filteredProjects.map(p => p.id).sort().join(','),
    [filteredProjects]
  )
  useEffect(() => {
    if (filteredProjects.length === 0) {
      setCommentCounts(new Map())
      return
    }
    const projectIds = filteredProjects.map(p => p.id)
    fetchCommentsCountBatch(projectIds).then(setCommentCounts).catch(() => setCommentCounts(new Map()))
  }, [projectIdsKey, filteredProjects.length])

  // Calculate KPIs from filtered projects
  const kpis = useMemo(() => {
    return calculateKPIs(filteredProjects)
  }, [filteredProjects])

  // Handlers
  const handleCurrencyChange = useCallback((currency: Currency) => {
    setSelectedCurrency(currency)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleProjectClick = useCallback((project: ProjectWithFinancials) => {
    setSelectedProjectId(project.id)
    if (onProjectSelect) {
      onProjectSelect(project)
    }
  }, [onProjectSelect])

  const handleCommentsClick = useCallback((projectId: string) => {
    setCommentsPanelProjectId(projectId)
  }, [])

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    // Parse the natural language query
    const result = parseNLQuery(term)
    setFilterCriteria(result.criteria)
    setParseResult(result)
  }, [])

  // Footer handlers (placeholders for Phase 1)
  const handleReports = useCallback(() => {
    console.log('Reports clicked')
    // TODO: Implement reports dialog
  }, [])

  const handlePOBreakdown = useCallback(() => {
    console.log('PO Breakdown clicked')
    // TODO: Implement PO breakdown view
  }, [])

  const handleCSVImport = useCallback(() => {
    setShowCSVImportDialog(true)
  }, [])

  const handleCSVImportComplete = useCallback((result: CSVImportResult, data: Partial<Commitment>[] | Partial<Actual>[]) => {
    console.log('CSV Import completed:', result)
    console.log('Imported data:', data)
    // In a real app, this would save the data to the database
    // and refresh the display
    if (result.success) {
      fetchData()
    }
  }, [fetchData])

  // Transaction handlers
  const handleTransactionSortChange = useCallback((field: TransactionSortField, direction: SortDirection) => {
    setTransactionSort({ field, direction })
  }, [])

  // Filtered and sorted transactions
  const displayedTransactions = useMemo(() => {
    let filtered = filterTransactions(transactions, transactionFilters)
    return sortTransactions(filtered, transactionSort.field, transactionSort.direction)
  }, [transactions, transactionFilters, transactionSort])

  // Build hierarchy data
  const hierarchyData = useMemo(() => {
    // In a real app, this would use actual commitment data
    // For now, we use mock data
    const mockCommitments: Commitment[] = transactions
      .filter(t => t.type === 'commitment')
      .map(t => ({
        id: t.id,
        project_id: t.project_id,
        po_number: t.po_number || '',
        vendor_id: 'vendor-1',
        vendor_name: t.vendor_name,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        status: t.status as any,
        issue_date: t.date,
        created_at: t.date,
        updated_at: t.date
      }))

    if (hierarchyViewType === 'ces') {
      return buildCESHierarchy(mockCommitments, selectedCurrency)
    } else {
      return buildWBSHierarchy(mockCommitments, selectedCurrency)
    }
  }, [transactions, hierarchyViewType, selectedCurrency])

  const handleExport = useCallback(() => {
    console.log('Export clicked')
    // TODO: Implement export functionality
  }, [])

  const handleResources = useCallback(() => {
    console.log('Resources clicked')
    // TODO: Navigate to resources page
  }, [])

  const handleSettings = useCallback(() => {
    console.log('Settings clicked')
    // TODO: Implement settings dialog
  }, [])

  const handlePerformance = useCallback(() => {
    setShowPerformanceDialog(true)
  }, [])

  const handleHelp = useCallback(() => {
    setShowHelpDialog(true)
  }, [])

  const handleAnomalyClick = useCallback((anomaly: AnomalyResult) => {
    setSelectedAnomaly(anomaly)
    setShowAnomalyDialog(true)
  }, [])

  const handleAnomalyAcknowledge = useCallback((anomaly: AnomalyResult) => {
    // In a real app, this would update the anomaly status in the database
    console.log('Acknowledged anomaly:', anomaly.projectId, anomaly.anomalyType)
    setShowAnomalyDialog(false)
    setSelectedAnomaly(null)
  }, [])

  const handleAnomalyDismiss = useCallback((anomaly: AnomalyResult) => {
    // In a real app, this would dismiss the anomaly
    console.log('Dismissed anomaly:', anomaly.projectId, anomaly.anomalyType)
    setShowAnomalyDialog(false)
    setSelectedAnomaly(null)
  }, [])

  // Recommendation handlers
  const handleRecommendationView = useCallback((rec: EnhancedRecommendation) => {
    setSelectedRecommendation(rec)
    setShowRecommendationDetail(true)
  }, [])

  const handleRecommendationAccept = useCallback((rec: EnhancedRecommendation) => {
    setRecommendations(prev => updateRecommendationStatus(prev, rec.id, 'accepted'))
    console.log('Accepted recommendation:', rec.id, rec.title)
  }, [])

  const handleRecommendationReject = useCallback((rec: EnhancedRecommendation) => {
    setRecommendations(prev => updateRecommendationStatus(prev, rec.id, 'rejected'))
    console.log('Rejected recommendation:', rec.id, rec.title)
  }, [])

  const handleRecommendationDefer = useCallback((rec: EnhancedRecommendation) => {
    setRecommendations(prev => updateRecommendationStatus(prev, rec.id, 'deferred'))
    console.log('Deferred recommendation:', rec.id, rec.title)
  }, [])

  // Hierarchy handlers
  const handleHierarchyNodeSelect = useCallback((node: HierarchyNode) => {
    setSelectedHierarchyNode(node)
    console.log('Selected hierarchy node:', node.label, node.total)
  }, [])

  // Distribution handlers (Phase 2 & 3)
  const handleDistributionSettings = useCallback((projectId: string) => {
    setSelectedProjectId(projectId)
    setShowDistributionDialog(true)
  }, [])

  const handleApplyDistribution = useCallback((settings: DistributionSettings) => {
    if (selectedProjectId) {
      // Save distribution settings for this project
      setDistributionSettings(prev => {
        const updated = new Map(prev)
        updated.set(selectedProjectId, settings)
        return updated
      })
      console.log('Applied distribution settings for project:', selectedProjectId, settings)
      // In real app: API call to save settings
    }
    setShowDistributionDialog(false)
  }, [selectedProjectId])

  const handleCreateRule = useCallback((rule: Omit<DistributionRule, 'id' | 'created_at' | 'last_applied' | 'application_count'>) => {
    const newRule: DistributionRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      created_at: new Date().toISOString(),
      last_applied: '',
      application_count: 0
    }
    setDistributionRules(prev => [...prev, newRule])
    console.log('Created distribution rule:', newRule)
    // In real app: API call to create rule
  }, [])

  const handleUpdateRule = useCallback((ruleId: string, updates: Partial<DistributionRule>) => {
    setDistributionRules(prev => 
      prev.map(rule => rule.id === ruleId ? { ...rule, ...updates } : rule)
    )
    console.log('Updated distribution rule:', ruleId, updates)
    // In real app: API call to update rule
  }, [])

  const handleDeleteRule = useCallback((ruleId: string) => {
    setDistributionRules(prev => prev.filter(rule => rule.id !== ruleId))
    console.log('Deleted distribution rule:', ruleId)
    // In real app: API call to delete rule
  }, [])

  const handleApplyRule = useCallback((ruleId: string, projectIds: string[]) => {
    const rule = distributionRules.find(r => r.id === ruleId)
    if (!rule) return

    // Apply rule to projects
    const targetProjects = projectIds.length > 0 
      ? projects.filter(p => projectIds.includes(p.id))
      : projects // Apply to all if no specific projects

    targetProjects.forEach(project => {
      setDistributionSettings(prev => {
        const updated = new Map(prev)
        updated.set(project.id, rule.settings)
        return updated
      })
    })

    // Update rule application count
    handleUpdateRule(ruleId, {
      last_applied: new Date().toISOString(),
      application_count: rule.application_count + 1
    })

    console.log('Applied distribution rule to projects:', ruleId, targetProjects.length)
    // In real app: API call to apply rule
  }, [distributionRules, projects, handleUpdateRule])

  // Render mobile layout
  if (isMobile) {
    return (
      <div
        className={`flex flex-col bg-gray-50 min-h-[600px] p-2 ${className}`}
        data-testid={testId}
      >
        {/* Mobile Header */}
        <CompactCostbookHeader
          kpis={kpis}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencyChange}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          className="flex-shrink-0"
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3 space-y-4">
          {error && (
            <ErrorDisplay
              error={error}
              onRetry={handleRefresh}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Projects Section - First on mobile */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Projects ({filteredProjects.length})
              </h2>
            </div>
            {filteredProjects.length === 0 && searchTerm ? (
              <NoResults
                query={searchTerm}
                onSuggestionSelect={handleSearch}
              />
            ) : (
              <ProjectsGrid
                projects={filteredProjects}
                currency={selectedCurrency}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectClick}
                viewMode="list"
                searchTerm={searchTerm}
                isLoading={isLoading}
                commentCounts={commentCounts}
                onCommentsClick={handleCommentsClick}
              />
            )}
          </section>

          {/* Compact Visualization - Second on mobile */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <CompactVisualizationPanel
              projects={filteredProjects}
              kpis={kpis}
              currency={selectedCurrency}
            />
          </section>
        </main>

        {/* Mobile Footer */}
        <CompactCostbookFooter
          onReports={handleReports}
          onCSVImport={handleCSVImport}
          onExport={handleExport}
          onSettings={handleSettings}
          className="flex-shrink-0"
        />
      </div>
    )
  }

  // Render desktop layout
  return (
    <div
      className={`flex flex-col bg-gray-50 min-h-[800px] p-4 ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <CostbookHeader
        kpis={kpis}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={handleCurrencyChange}
        onRefresh={handleRefresh}
        onPerformance={handlePerformance}
        onHelp={handleHelp}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        isLoading={isLoading}
        lastRefreshTime={lastRefreshTime || undefined}
        className="flex-shrink-0 mb-4"
      />

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          onRetry={handleRefresh}
          onDismiss={() => setError(null)}
          className="mb-4"
        />
      )}

        {/* Main Content */}
        <main className="flex flex-col gap-6 flex-1 min-h-[500px]">
          {/* NL Search Section */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <NLSearchInput
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search projects... (e.g., 'over budget', 'high variance', 'vendor Acme')"
              className="max-w-2xl"
            />
            {parseResult && searchTerm && (
              <p className="mt-2 text-sm text-gray-500">
                {parseResult.interpretation}
                {filteredProjects.length !== convertedProjects.length && (
                  <span className="ml-2 text-blue-600">
                    ({filteredProjects.length} of {convertedProjects.length} projects)
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Projects Section (takes most space) */}
          <section className="flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 whitespace-nowrap">
                Projects ({filteredProjects.length})
              </h2>
              <div className="flex-shrink-0">
                <ViewModeToggle
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
            </div>

            {/* Projects Grid/List */}
            <div className="flex-1 overflow-auto min-h-[400px] bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredProjects.length === 0 && searchTerm ? (
                <NoResults
                  query={searchTerm}
                  onSuggestionSelect={handleSearch}
                />
              ) : (
                <ProjectsGrid
                  projects={filteredProjects}
                  currency={selectedCurrency}
                  selectedProjectId={selectedProjectId}
                  onProjectSelect={handleProjectClick}
                  viewMode={viewMode}
                  searchTerm={searchTerm}
                  anomalies={anomalies}
                  onAnomalyClick={handleAnomalyClick}
                  commentCounts={commentCounts}
                  onCommentsClick={handleCommentsClick}
                />
              )}
            </div>
          </section>

          {/* Visualization and Recommendations Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualizations (2/3 width on large screens) */}
            <div className="lg:col-span-2">
              <VisualizationPanel
                projects={filteredProjects}
                kpis={kpis}
                currency={selectedCurrency}
                onProjectClick={handleProjectClick}
                isLoading={isLoading}
              />
            </div>
            
            {/* Recommendations Panel (1/3 width on large screens) */}
            <div className="lg:col-span-1">
              <RecommendationsPanel
                recommendations={recommendations}
                onView={handleRecommendationView}
                onAccept={handleRecommendationAccept}
                onReject={handleRecommendationReject}
                onDefer={handleRecommendationDefer}
                collapsible={true}
                defaultCollapsed={false}
                initialLimit={3}
              />
            </div>
          </section>

          {/* Hierarchy Section */}
          <section className="mt-6">
            <CollapsiblePanel
              title="Cost Structure Breakdown"
              icon={<Layers className="w-5 h-5 text-blue-600" />}
              defaultOpen={false}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-4">
                {/* View Type Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      View Type:
                    </span>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-1">
                      <button
                        onClick={() => setHierarchyViewType('ces')}
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          hierarchyViewType === 'ces'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        CES
                      </button>
                      <button
                        onClick={() => setHierarchyViewType('wbs')}
                        className={`px-3 py-1 text-xs font-medium rounded ${
                          hierarchyViewType === 'wbs'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        WBS
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Committed</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Actual</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>Variance</span>
                    </div>
                  </div>
                </div>

                {/* Hierarchy Tree */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <HierarchyTreeView
                    data={hierarchyData}
                    viewType={hierarchyViewType}
                    currency={selectedCurrency}
                    onNodeSelect={handleHierarchyNodeSelect}
                    selectedNodeId={selectedHierarchyNode?.id}
                    showBudget={true}
                    showSpend={true}
                    showVariance={true}
                    className="max-h-96"
                  />
                </div>

                {hierarchyData.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      No {hierarchyViewType === 'ces' ? 'CES' : 'WBS'} data available for current filters
                    </p>
                  </div>
                )}
              </div>
            </CollapsiblePanel>
          </section>
      </main>

      {/* Footer */}
      <CostbookFooter
        onScenarios={() => console.log('Scenarios - Phase 2')}
        onResources={handleResources}
        onReports={handleReports}
        onPOBreakdown={handlePOBreakdown}
        onCSVImport={handleCSVImport}
        onForecast={() => setShowDistributionRules(true)} // Open Distribution Rules
        onVendorScore={() => console.log('Vendor Score - Phase 3')}
        onSettings={handleSettings}
        onExport={handleExport}
        currentPhase={1}
        className="flex-shrink-0 mt-3"
      />

      {/* Performance Dialog */}
      <PerformanceDialog
        isOpen={showPerformanceDialog}
        onClose={() => setShowPerformanceDialog(false)}
        metrics={performanceMetrics}
        onRefresh={handleRefresh}
        data-testid="performance-dialog"
      />

      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
        data-testid="help-dialog"
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        isOpen={showCSVImportDialog}
        onClose={() => setShowCSVImportDialog(false)}
        onImport={handleCSVImportComplete}
        data-testid="csv-import-dialog"
      />

      {/* Anomaly Detail Dialog */}
      {showAnomalyDialog && selectedAnomaly && (
        <AnomalyDetailDialog
          anomaly={selectedAnomaly}
          projectName={projects.find(p => p.id === selectedAnomaly.projectId)?.name}
          isOpen={showAnomalyDialog}
          onClose={() => {
            setShowAnomalyDialog(false)
            setSelectedAnomaly(null)
          }}
          onAcknowledge={handleAnomalyAcknowledge}
          onDismiss={handleAnomalyDismiss}
          data-testid="anomaly-detail-dialog"
        />
      )}

      {/* Comments Panel (Phase 3) */}
      {commentsPanelProjectId && (
        <CommentsPanel
          projectId={commentsPanelProjectId}
          projectName={filteredProjects.find(p => p.id === commentsPanelProjectId)?.name}
          isOpen={!!commentsPanelProjectId}
          onClose={() => setCommentsPanelProjectId(null)}
          onCommentCountChange={(count) => {
            setCommentCounts(prev => new Map(prev).set(commentsPanelProjectId, count))
          }}
        />
      )}

      {/* Recommendation Detail Dialog */}
      <RecommendationDetail
        recommendation={selectedRecommendation}
        isOpen={showRecommendationDetail}
        onClose={() => {
          setShowRecommendationDetail(false)
          setSelectedRecommendation(null)
        }}
        onAccept={handleRecommendationAccept}
        onReject={handleRecommendationReject}
        onDefer={handleRecommendationDefer}
        data-testid="recommendation-detail-dialog"
      />

      {/* Distribution Settings Dialog (Phase 2) */}
      {showDistributionDialog && selectedProjectId && (() => {
        const project = projects.find(p => p.id === selectedProjectId)
        if (!project) return null
        
        return (
          <DistributionSettingsDialog
            isOpen={showDistributionDialog}
            onClose={() => {
              setShowDistributionDialog(false)
              setSelectedProjectId(undefined)
            }}
            onApply={handleApplyDistribution}
            projectBudget={project.budget}
            projectStartDate={project.start_date}
            projectEndDate={project.end_date}
            currentSpend={project.total_commitments + project.total_actuals}
            currency={selectedCurrency}
            initialSettings={distributionSettings.get(selectedProjectId)}
            data-testid="distribution-settings-dialog"
          />
        )
      })()}

      {/* Distribution Rules Panel (Phase 3) */}
      {showDistributionRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Distribution Rules Manager</h2>
              <button
                onClick={() => setShowDistributionRules(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <DistributionRulesPanel
                rules={distributionRules}
                onCreateRule={handleCreateRule}
                onUpdateRule={handleUpdateRule}
                onDeleteRule={handleDeleteRule}
                onApplyRule={handleApplyRule}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Costbook with error boundary wrapper
 */
export function Costbook(props: CostbookProps) {
  return (
    <CostbookErrorBoundary>
      <CostbookInner {...props} />
    </CostbookErrorBoundary>
  )
}

export default Costbook