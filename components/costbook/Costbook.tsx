'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Layers, Zap, X, ChevronLeft, ChevronRight, LayoutGrid, TrendingUp } from 'lucide-react'
import { ProjectWithFinancials, Currency, KPIMetrics } from '@/types/costbook'
import { calculateKPIs } from '@/lib/costbook-calculations'
import { convertCurrency } from '@/lib/currency-utils'
import { useFeatureFlag } from '@/contexts/FeatureFlagContext'
import {
  fetchProjectsWithFinancials,
  fetchProjectsWithFinancialsFromApi
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
import { CashOutGantt } from './CashOutGantt'
import { buildCESHierarchy, buildWBSHierarchy } from '@/lib/costbook/hierarchy-builders'

import { TransactionFilters as TxFilters, filterTransactions, sortTransactions, TransactionSortField, SortDirection } from '@/lib/costbook/transaction-queries'
import { fetchCommentsCountBatch } from '@/lib/comments-service'
import { CSVImportResult, Commitment, Actual, HierarchyNode, Transaction, DistributionSettings, DistributionRule, CostbookRow, Currency as CostbookCurrency, POStatus } from '@/types/costbook'
import { getApiUrl } from '@/lib/api'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { useToast } from '@/components/shared/Toast'
import { triggerSync } from '@/lib/integrations/ErpAdapter'

export interface CostbookProps {
  /** Initial currency */
  initialCurrency?: Currency
  /** Handler for project selection */
  onProjectSelect?: (project: ProjectWithFinancials) => void
  /** Show "Start Tour" button (set false when embedded e.g. in Financials to avoid duplicate) */
  showTourButton?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

import { DistributionSettingsDialog } from './DistributionSettingsDialog'
import { DistributionRulesPanel } from './DistributionRulesPanel'
import { CostbookSettingsDialog } from './CostbookSettingsDialog'
import { getCostbookSettings, type CostbookSettings } from '@/lib/costbook/costbook-settings'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GuidedTour, useGuidedTour, TourTriggerButton, costbookTourSteps } from '@/components/guided-tour'

/**
 * Main Costbook component
 * Integrates all subcomponents into a cohesive financial dashboard
 */
function CostbookInner({
  initialCurrency = Currency.USD,
  onProjectSelect,
  showTourButton = true,
  className = '',
  'data-testid': testId = 'costbook'
}: CostbookProps) {
  // Feature flag checks
  const { enabled: anomalyDetectionEnabled } = useFeatureFlag('ai_anomaly_detection')
  const { enabled: costbookPhase2Enabled } = useFeatureFlag('costbook_phase2')

  // State
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency)
  const [baseCurrency] = useState<Currency>(Currency.USD) // Data is stored in USD
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [costbookSettings, setCostbookSettingsState] = useState<CostbookSettings>(() => getCostbookSettings())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => getCostbookSettings().defaultView)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [costbookMainTab, setCostbookMainTab] = useState<'overview' | 'forecast' | 'cost-structure'>('overview')
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({})
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('costbook-v1')

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

  // AI Optimize Costbook state
  const [showOptimizeModal, setShowOptimizeModal] = useState(false)
  const [optimizeSuggestions, setOptimizeSuggestions] = useState<Array<{ id: string; description: string; metric: string; change: number; unit: string; impact: string }>>([])
  const [optimizeLoading, setOptimizeLoading] = useState(false)

  // Comments state (Phase 3)
  const [commentsPanelProjectId, setCommentsPanelProjectId] = useState<string | null>(null)
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map())

  // Integration sync (ERP)
  const [isSyncing, setIsSyncing] = useState(false)
  const { session } = useAuth()
  const toast = useToast()

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

  // Hierarchy state (real commitments from API for CES/WBS when not using mock)
  const [hierarchyCommitments, setHierarchyCommitments] = useState<Commitment[]>([])
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
      
      if (session?.access_token) {
        // Prefer backend API so commitments/actuals from CSV import are included (avoids empty data when Supabase RLS blocks direct read)
        try {
          data = await fetchProjectsWithFinancialsFromApi(session.access_token)
          if (!data?.length) data = await fetchProjectsWithFinancials()
        } catch {
          data = await fetchProjectsWithFinancials()
        }
      } else {
        data = await fetchProjectsWithFinancials()
        // Enrich with costbook rows (Cost Book columns) when API is available
        try {
          const res = await fetch(getApiUrl('/v1/costbook/rows'), { credentials: 'include' })
          if (res.ok) {
            const json = await res.json() as { rows?: CostbookRow[] }
            const rows = json.rows ?? []
            const byId = new Map(rows.map(r => [r.project_id, r]))
            data = data.map(p => {
              const row = byId.get(p.id)
              if (!row) return p
              return {
                ...p,
                pending_budget: row.pending_budget,
                approved_budget: row.approved_budget,
                control_estimate: row.control_estimate,
                open_committed: row.open_committed,
                invoice_value: row.invoice_value,
                remaining_commitment: row.remaining_commitment,
                vowd: row.vowd,
                accruals: row.accruals,
                etc: row.etc,
                eac: row.eac,
                delta_eac: row.delta_eac,
                variance: row.variance
              }
            })
          }
        } catch (_) {
          // Costbook API optional; continue with projects only
        }
      }

      setProjects(data)

      // Detect anomalies
      const detectedAnomalies = detectAnomalies(data)
      setAnomalies(detectedAnomalies)
      
      // Generate recommendations (with optional user/tenant context for personalization)
      const userContext = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TENANT_NAME
        ? { tenantName: process.env.NEXT_PUBLIC_TENANT_NAME }
        : undefined
      const generatedRecommendations = generateRecommendations(data, detectedAnomalies, { userContext })
      setRecommendations(generatedRecommendations)

      setLastRefreshTime(new Date())

      // Load transactions and hierarchy commitments from API when authenticated
      let committedTx: Transaction[] = []
      if (session?.access_token) {
        try {
          const res = await fetch(getApiUrl('/csv-import/commitments?limit=5000&offset=0'), {
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: 'include'
          })
          if (res.ok) {
            const json = (await res.json()) as { commitments?: Record<string, unknown>[] }
            const rows = json.commitments ?? []
            const commitments: Commitment[] = rows.map((row: Record<string, unknown>, idx: number) => {
              const amount = Number(row.total_amount ?? row.po_net_amount ?? 0)
              const vendor = String(row.vendor ?? '')
              const currency = (row.currency as CostbookCurrency) ?? CostbookCurrency.USD
              const poStatus = (row.po_status as string) ?? 'approved'
              const issueDate = typeof row.po_date === 'string' ? row.po_date : (row.created_at as string) ?? new Date().toISOString()
              const desc = [row.vendor_description, row.wbs_element].filter(Boolean).join(' ') || ' '
              return {
                id: (row.id as string) ?? `c-${idx}`,
                project_id: (row.project_id as string) ?? (row.project_nr as string) ?? '',
                po_number: String(row.po_number ?? ''),
                vendor_id: vendor ? `vendor-${String(idx)}` : 'vendor-unknown',
                vendor_name: vendor || 'Unknown',
                description: (desc.trim() || (row.po_number as string)) ?? '',
                amount,
                currency,
                status: (['draft', 'approved', 'issued', 'received', 'cancelled'].includes(poStatus) ? poStatus : 'approved') as POStatus,
                issue_date: issueDate,
                created_at: String(row.created_at ?? issueDate),
                updated_at: String(row.updated_at ?? row.created_at ?? issueDate)
              }
            })
            setHierarchyCommitments(commitments)
            const { commitmentToTransaction } = await import('@/lib/costbook/transaction-queries')
            committedTx = commitments.map(commitmentToTransaction)
            setTransactions(committedTx)
          } else {
            setHierarchyCommitments([])
            setTransactions(committedTx)
          }
        } catch (_) {
          setHierarchyCommitments([])
          setTransactions(committedTx)
        }
      } else {
        setHierarchyCommitments([])
        setTransactions(committedTx)
      }

      // Track performance
      const queryTime = performance.now() - startTime
      setPerformanceMetrics({
        queryTime: Math.round(queryTime),
        renderTime: Math.round(performance.now() - startTime - queryTime),
        transformTime: 10,
        totalTime: Math.round(performance.now() - startTime),
        projectCount: data.length,
        commitmentCount: committedTx.filter(t => t.type === 'commitment').length,
        actualCount: committedTx.filter(t => t.type === 'actual').length,
        totalRecords: data.length + committedTx.length,
        cacheHitRate: 85,
        errorCount: 0,
        lastRefresh: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      setError(err instanceof Error ? err : new Error('Failed to load data'))
    } finally {
      setIsLoading(false)
    }
  }, [session?.access_token])

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

  // Pagination: use costbook settings (projects per page)
  const projectsPerPage = costbookSettings.projectsPerPage
  const [projectsPage, setProjectsPage] = useState(0)
  const totalProjectPages = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage))
  const paginatedProjects = useMemo(
    () =>
      filteredProjects.slice(
        projectsPage * projectsPerPage,
        (projectsPage + 1) * projectsPerPage
      ),
    [filteredProjects, projectsPage, projectsPerPage]
  )
  useEffect(() => {
    setProjectsPage(0)
  }, [filteredProjects.length])

  // Forecast date range from settings
  const forecastDateRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + costbookSettings.forecastMonthsAhead, 0)
    return { start, end }
  }, [costbookSettings.forecastMonthsAhead])

  // Sync costbook settings from storage (e.g. another tab or dialog save)
  useEffect(() => {
    const handler = () => setCostbookSettingsState(getCostbookSettings())
    window.addEventListener('costbook-settings-changed', handler)
    return () => window.removeEventListener('costbook-settings-changed', handler)
  }, [])

  // Handlers
  const handleCurrencyChange = useCallback((currency: Currency) => {
    setSelectedCurrency(currency)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleIntegrationSync = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      toast.custom({ type: 'warning', title: 'Sync', message: 'Sign in to sync from ERP.' })
      return
    }
    setIsSyncing(true)
    try {
      const result = await triggerSync({ adapter: 'sap', entity: 'commitments' }, token)
      const added = (result.inserted ?? 0) + (result.updated ?? 0)
      if (result.errors?.length) {
        toast.custom({
          type: 'warning',
          title: 'Sync completed with issues',
          message: `${added} records; ${result.errors.length} error(s).`,
        })
      } else {
        toast.custom({
          type: 'success',
          title: 'Sync erfolgreich',
          message: added > 0 ? `${added} neue/aktualisierte Commitments.` : 'Keine Änderungen.',
        })
      }
      fetchData()
    } catch (e) {
      toast.custom({
        type: 'error',
        title: 'Sync fehlgeschlagen',
        message: e instanceof Error ? e.message : 'Sync failed.',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [session?.access_token, toast, fetchData])

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

  // Build hierarchy data: use real commitments from API when available, else from transactions (incl. mock)
  const hierarchyData = useMemo(() => {
    const commitments: Commitment[] =
      hierarchyCommitments.length > 0
        ? hierarchyCommitments
        : transactions
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
              status: t.status as POStatus,
              issue_date: t.date,
              created_at: t.date,
              updated_at: t.date
            }))

    const projectNames = Object.fromEntries(filteredProjects.map(p => [p.id, p.name]))
    if (hierarchyViewType === 'ces') {
      return buildCESHierarchy(commitments, selectedCurrency, projectNames)
    }
    return buildWBSHierarchy(commitments, selectedCurrency)
  }, [hierarchyCommitments, transactions, hierarchyViewType, selectedCurrency, filteredProjects])

  const handleExport = useCallback(() => {
    console.log('Export clicked')
    // TODO: Implement export functionality
  }, [])

  const handleResources = useCallback(() => {
    console.log('Resources clicked')
    // TODO: Navigate to resources page
  }, [])

  const handleSettings = useCallback(() => {
    setShowSettingsDialog(true)
  }, [])

  const handleCostbookSettingsSave = useCallback((settings: CostbookSettings) => {
    setCostbookSettingsState(settings)
    setViewMode(settings.defaultView)
  }, [])

  const handlePerformance = useCallback(() => {
    setShowPerformanceDialog(true)
  }, [])

  const handleHelp = useCallback(() => {
    setShowHelpDialog(true)
  }, [])

  const handleOptimizeCostbook = useCallback(async () => {
    setShowOptimizeModal(true)
    setOptimizeLoading(true)
    setOptimizeSuggestions([])
    try {
      const res = await fetch('/api/costbook/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: filteredProjects.map(p => p.id) }),
      })
      const data = await res.json().catch(() => ({}))
      setOptimizeSuggestions(data.suggestions || [])
    } catch {
      setOptimizeSuggestions([])
    } finally {
      setOptimizeLoading(false)
    }
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
    console.log('Selected hierarchy node:', node.name, node.total_budget)
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
        className={`flex flex-col bg-gray-50 dark:bg-slate-900 min-h-[600px] p-2 ${className}`}
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
          <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Projects ({filteredProjects.length})
              </h2>
            </div>
            {filteredProjects.length === 0 && searchTerm ? (
              <NoResults
                query={searchTerm}
                onSuggestionSelect={handleSearch}
              />
            ) : (
              <>
                <ProjectsGrid
                  projects={paginatedProjects}
                  currency={selectedCurrency}
                  selectedProjectId={selectedProjectId}
                  onProjectSelect={handleProjectClick}
                  viewMode="list"
                  searchTerm={searchTerm}
                  isLoading={isLoading}
                  commentCounts={commentCounts}
                  onCommentsClick={handleCommentsClick}
                />
                {totalProjectPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      Page {projectsPage + 1} of {totalProjectPages} ({projectsPerPage} per page)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProjectsPage((p) => Math.max(0, p - 1))}
                        disabled={projectsPage === 0}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectsPage((p) => Math.min(totalProjectPages - 1, p + 1))}
                        disabled={projectsPage >= totalProjectPages - 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Compact Visualization - Second on mobile (same page as Projects) */}
          <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
            <CompactVisualizationPanel
              projects={paginatedProjects}
              kpis={kpis}
              currency={selectedCurrency}
            />
            {totalProjectPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Page {projectsPage + 1} of {totalProjectPages} ({projectsPerPage} per page)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectsPage((p) => Math.max(0, p - 1))}
                    disabled={projectsPage === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectsPage((p) => Math.min(totalProjectPages - 1, p + 1))}
                    disabled={projectsPage >= totalProjectPages - 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>

        {/* Mobile Footer */}
        <CompactCostbookFooter
          onReports={handleReports}
          onExport={handleExport}
          onSettings={handleSettings}
          className="flex-shrink-0"
        />
      </div>
    )
  }

  // Render desktop layout: Unified No-Scroll View (grid-rows-[auto_1fr_auto]); footer is fixed via portal
  return (
    <>
    <div
      className={`grid grid-rows-[auto_1fr_auto] bg-gray-50 dark:bg-slate-900 min-h-[800px] max-h-[calc(100vh-8rem)] p-4 gap-0 pb-20 overflow-hidden ${className}`}
      data-testid={testId}
      style={{ minHeight: 'calc(100vh - 8rem)', maxHeight: 'calc(100vh - 8rem)' }}
    >
      {/* Row 1: Header (auto) */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <CostbookHeader
          kpis={kpis}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencyChange}
          onRefresh={handleRefresh}
          onPerformance={handlePerformance}
          onHelp={handleHelp}
          onSync={handleIntegrationSync}
          isSyncing={isSyncing}
          onSearch={handleSearch}
          searchTerm={searchTerm}
          isLoading={isLoading}
          lastRefreshTime={lastRefreshTime || undefined}
          className="mb-0"
        />
        {showTourButton && (
          <TourTriggerButton
            onStart={hasCompletedTour ? resetAndStartTour : startTour}
            hasCompletedTour={hasCompletedTour}
          />
        )}
        {error && (
          <ErrorDisplay
            error={error}
            onRetry={handleRefresh}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}
      </div>

      {/* Row 2: Main content – one row: Overview | Forecast | Cost Structure (scroll inside each column) */}
      <main className="min-h-0 flex flex-col flex-1 gap-3">
        {/* NL Search – compact single row */}
        <section data-tour="costbook-nl-search" className="flex-shrink-0 flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 px-3 py-2">
          <NLSearchInput
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search projects... (e.g., 'over budget', 'high variance')"
            className="flex-1 min-w-[200px] max-w-xl"
          />
          {parseResult && searchTerm && (
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {parseResult.interpretation}
              {filteredProjects.length !== convertedProjects.length && (
                <span className="ml-1 text-blue-600 dark:text-blue-400">
                  ({filteredProjects.length} of {convertedProjects.length})
                </span>
              )}
            </span>
          )}
        </section>

        {/* Tabs: Overview | Forecast | Cost Structure (CES/WBS) */}
        <Tabs
          value={costbookMainTab}
          onValueChange={(v) => setCostbookMainTab(v as 'overview' | 'forecast' | 'cost-structure')}
          className="flex-1 min-h-0 flex flex-col"
        >
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 bg-gray-200 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 shrink-0">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm"
            >
              <LayoutGrid className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="forecast"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm"
            >
              <TrendingUp className="w-4 h-4" />
              Forecast
            </TabsTrigger>
            <TabsTrigger
              value="cost-structure"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm"
            >
              <Layers className="w-4 h-4" />
              Cost Structure (CES/WBS)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 min-h-0 mt-3 flex flex-col data-[state=inactive]:hidden">
            <section className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 p-2 bg-white dark:bg-slate-800 rounded-t-lg border border-gray-200 dark:border-slate-700 border-b-0 shrink-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">Projects ({filteredProjects.length})</h2>
                <div className="flex items-center gap-2" data-tour="costbook-ai-optimize">
                  <button
                    type="button"
                    onClick={handleOptimizeCostbook}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    aria-label="AI Optimize Costbook"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    AI Optimize
                  </button>
                  <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-b-lg border border-gray-200 dark:border-slate-700 border-t-0 p-4">
              {isLoading ? (
                viewMode === 'list' ? (
                  <div className="space-y-0 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                      <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 animate-pulse" />
                      <div className="flex gap-4">
                        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-16 animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-16 animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20 animate-pulse" />
                      </div>
                    </div>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="h-14 px-4 flex items-center gap-4 border-b border-gray-100 dark:border-slate-700 last:border-b-0">
                        <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-48 animate-pulse flex-1" />
                        <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-20 animate-pulse" />
                        <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-20 animate-pulse" />
                        <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-16 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
                  </div>
                )
              ) : filteredProjects.length === 0 && searchTerm ? (
                <NoResults query={searchTerm} onSuggestionSelect={handleSearch} />
              ) : (
                <div className="flex-1 min-h-0 flex flex-col min-w-0">
                  <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    <ProjectsGrid
                    projects={paginatedProjects}
                    currency={selectedCurrency}
                    selectedProjectId={selectedProjectId}
                    onProjectSelect={handleProjectClick}
                    viewMode={viewMode}
                    searchTerm={searchTerm}
                    anomalies={anomalyDetectionEnabled ? anomalies : []}
                    onAnomalyClick={anomalyDetectionEnabled ? handleAnomalyClick : undefined}
                    commentCounts={commentCounts}
                    onCommentsClick={handleCommentsClick}
                  />
                  </div>
                  {totalProjectPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                      <span className="text-sm text-gray-600 dark:text-slate-400">
                        Page {projectsPage + 1} of {totalProjectPages} ({projectsPerPage} per page)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProjectsPage((p) => Math.max(0, p - 1))}
                          disabled={projectsPage === 0}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                        >
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectsPage((p) => Math.min(totalProjectPages - 1, p + 1))}
                          disabled={projectsPage >= totalProjectPages - 1}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                        >
                          Next <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="forecast" className="flex-1 min-h-0 mt-3 overflow-auto data-[state=inactive]:hidden">
            <section data-tour="costbook-distribution" className="flex flex-col min-h-full">
            <div className="flex justify-between items-center mb-1 p-2 bg-white dark:bg-slate-800 rounded-t-lg border border-gray-200 dark:border-slate-700 border-b-0 shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Forecast</h2>
              <button
                type="button"
                onClick={() => setShowDistributionRules(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Distribution Rules
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-800 rounded-b-lg border border-gray-200 dark:border-slate-700 border-t-0 p-4 space-y-3">
              <CashOutGantt
                projects={paginatedProjects}
                currency={selectedCurrency}
                startDate={forecastDateRange.start}
                endDate={forecastDateRange.end}
                distributionSettingsByProject={distributionSettings}
                onOpenDistributionSettings={costbookPhase2Enabled ? handleDistributionSettings : undefined}
              />
              <VisualizationPanel
                projects={paginatedProjects}
                kpis={kpis}
                currency={selectedCurrency}
                onProjectClick={handleProjectClick}
                isLoading={isLoading}
              />
              {costbookSettings.showRecommendationsPanel && (
              <div data-tour="costbook-recommendations">
                <RecommendationsPanel
                  recommendations={recommendations}
                  onView={handleRecommendationView}
                  onAccept={handleRecommendationAccept}
                  onReject={handleRecommendationReject}
                  onDefer={handleRecommendationDefer}
                  collapsible={true}
                  defaultCollapsed={true}
                  initialLimit={2}
                />
              </div>
              )}
            </div>
            </section>
          </TabsContent>

          <TabsContent value="cost-structure" className="flex-1 min-h-0 mt-3 overflow-auto data-[state=inactive]:hidden">
            <section data-tour="costbook-hierarchy" className="flex flex-col min-h-full">
            <div className="flex items-center gap-2 mb-1 p-2 bg-white dark:bg-slate-800 rounded-t-lg border border-gray-200 dark:border-slate-700 border-b-0 shrink-0">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden />
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                Cost Structure (CES/WBS)
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-800 rounded-b-lg border border-gray-200 dark:border-slate-700 border-t-0 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">View:</span>
                <div className="flex bg-gray-100 dark:bg-slate-700 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setHierarchyViewType('ces')}
                    className={`px-3 py-1 text-xs font-medium rounded ${hierarchyViewType === 'ces' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-slate-400'}`}
                  >
                    CES
                  </button>
                  <button
                    type="button"
                    onClick={() => setHierarchyViewType('wbs')}
                    className={`px-3 py-1 text-xs font-medium rounded ${hierarchyViewType === 'wbs' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-slate-400'}`}
                  >
                    WBS
                  </button>
                </div>
              </div>
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                <HierarchyTreeView
                  data={hierarchyData}
                  viewType={hierarchyViewType}
                  currency={selectedCurrency}
                  onNodeSelect={handleHierarchyNodeSelect}
                  selectedNodeId={selectedHierarchyNode?.id}
                  showBudget={true}
                  showSpend={true}
                  showVariance={true}
                  className="min-h-[600px]"
                />
              </div>
              {hierarchyData.length === 0 && (
                <div className="text-center py-6 text-gray-600 dark:text-slate-400 text-sm">
                  No {hierarchyViewType === 'ces' ? 'CES' : 'WBS'} data for current filters
                </div>
              )}
            </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>

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

      <CostbookSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleCostbookSettingsSave}
        data-testid="costbook-settings-dialog"
      />

      {/* Anomaly Detail Dialog */}
      {anomalyDetectionEnabled && showAnomalyDialog && selectedAnomaly && (
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

      {/* AI Optimize Costbook Modal – rendered in portal so it centers on viewport */}
      {showOptimizeModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="optimize-title">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h2 id="optimize-title" className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Optimize Costbook
              </h2>
              <button type="button" onClick={() => setShowOptimizeModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {optimizeLoading ? (
                <p className="text-sm text-gray-600 dark:text-slate-400">Loading suggestions…</p>
              ) : optimizeSuggestions.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-slate-400">No optimization suggestions right now.</p>
              ) : (
                <ul className="space-y-3">
                  {optimizeSuggestions.map((s) => (
                    <li key={s.id} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-100 dark:border-slate-600">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.description}</p>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{s.impact}</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Simulate</button>
                        <button type="button" className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium">Apply</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Distribution Settings Dialog (Phase 2) */}
      {costbookPhase2Enabled && showDistributionDialog && selectedProjectId && (() => {
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
            projectId={selectedProjectId}
            data-testid="distribution-settings-dialog"
          />
        )
      })()}

      {/* Distribution Rules Panel – always open on click (no feature-flag gate) */}
      {showDistributionRules && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="distribution-rules-title">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 id="distribution-rules-title" className="text-xl font-bold text-gray-900 dark:text-slate-100">Distribution Rules Manager</h2>
              <button
                onClick={() => setShowDistributionRules(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
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
        </div>,
        document.body
      )}
      <GuidedTour
        steps={costbookTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="costbook-v1"
      />
    </div>
    {typeof document !== 'undefined' && createPortal(
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-lg" data-testid="costbook-footer-bar">
        <div className="max-w-[1600px] mx-auto p-1">
          <CostbookFooter
            onScenarios={() => console.log('Scenarios - Phase 2')}
            onResources={handleResources}
            onReports={handleReports}
            onPOBreakdown={handlePOBreakdown}
            onForecast={() => setShowDistributionRules(true)}
            onVendorScore={() => console.log('Vendor Score - Phase 3')}
            onSettings={handleSettings}
            onExport={handleExport}
            currentPhase={costbookPhase2Enabled ? 2 : 1}
            className="flex-shrink-0"
          />
        </div>
      </div>,
      document.body
    )}
  </>
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