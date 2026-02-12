'use client'

import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { AlertTriangle } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { useTranslations } from '../../lib/i18n/context'

// Import modular components
import FinancialHeader from './components/FinancialHeader'
import TabNavigation from './components/TabNavigation'
import OverviewView from './components/views/OverviewView'
import AnalysisView from './components/views/AnalysisView'
import DetailedView from './components/views/DetailedView'
import TrendsView from './components/views/TrendsView'
import POBreakdownView from './components/views/POBreakdownView'
import BudgetVarianceTable from './components/tables/BudgetVarianceTable'

// Import context and hooks
import { FinancialsDataProvider, useFinancialsData } from './context/FinancialsDataContext'
import { useFeatureFlag } from '../../contexts/FeatureFlagContext'

// Import types
import { ViewMode } from './types'
import { GuidedTour, useGuidedTour, TourTriggerButton, financialsTourSteps } from '@/components/guided-tour'

// Lazy load heavy components
const CommitmentsActualsView = lazy(() => import('./components/CommitmentsActualsView'))
const Costbook = lazy(() => import('../../components/costbook/Costbook'))

const TAB_PARAM_VALID: ViewMode[] = ['overview', 'detailed', 'trends', 'analysis', 'po-breakdown', 'commitments-actuals', 'costbook']

function getInitialViewMode(searchParams: ReturnType<typeof useSearchParams>): ViewMode {
  const tab = searchParams.get('tab')
  return (tab && TAB_PARAM_VALID.includes(tab as ViewMode)) ? (tab as ViewMode) : 'overview'
}

/** Lazy main tabs: mount a tab's content only when first visited, then keep mounted and hide with CSS. */
function useVisitedViewModes(viewMode: ViewMode) {
  const [visited, setVisited] = useState<Set<ViewMode>>(() => new Set([viewMode]))
  useEffect(() => {
    setVisited((prev) => (prev.has(viewMode) ? prev : new Set(prev).add(viewMode)))
  }, [viewMode])
  return visited
}

function FinancialsFallback() {
  return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </AppLayout>
  )
}

function FinancialsContent() {
  const { session } = useAuth()
  const searchParams = useSearchParams()
  const { t } = useTranslations()
  const [selectedCurrency, setSelectedCurrency] = React.useState('USD')
  const [dateRange, setDateRange] = React.useState('all')
  const [showFilters, setShowFilters] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => getInitialViewMode(searchParams))
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('financials-v1')

  // Portfolio deferred: always pass undefined so projects are not filtered by portfolio
  const effectivePortfolioId = undefined

  // Feature flag checks
  const { enabled: costbookEnabled } = useFeatureFlag('costbook_phase1')

  // Sync view mode when URL tab param changes (e.g. back/forward)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && TAB_PARAM_VALID.includes(tab as ViewMode)) {
      setViewMode(tab as ViewMode)
    }
  }, [searchParams])

  // Redirect from costbook view if feature is disabled
  useEffect(() => {
    if (viewMode === 'costbook' && !costbookEnabled) {
      setViewMode('overview')
    }
  }, [viewMode, costbookEnabled])

  return (
    <FinancialsDataProvider
      accessToken={session?.access_token ?? undefined}
      selectedCurrency={selectedCurrency}
      portfolioId={effectivePortfolioId}
    >
      <FinancialsContentInner
        session={session}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedCurrency={selectedCurrency}
        setSelectedCurrency={setSelectedCurrency}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        costbookEnabled={costbookEnabled}
        dateRange={dateRange}
        setDateRange={setDateRange}
        isOpen={isOpen}
        startTour={startTour}
        closeTour={closeTour}
        completeTour={completeTour}
        resetAndStartTour={resetAndStartTour}
        hasCompletedTour={hasCompletedTour}
        portfolioId={effectivePortfolioId}
      />
    </FinancialsDataProvider>
  )
}

function FinancialsContentInner({
  session,
  viewMode,
  setViewMode,
  selectedCurrency,
  setSelectedCurrency,
  showFilters,
  setShowFilters,
  selectedProjectId,
  setSelectedProjectId,
  costbookEnabled,
  dateRange,
  setDateRange,
  isOpen,
  startTour,
  closeTour,
  completeTour,
  resetAndStartTour,
  hasCompletedTour,
  portfolioId: effectivePortfolioId
}: {
  session: { access_token?: string } | null
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  selectedCurrency: string
  setSelectedCurrency: (c: string) => void
  showFilters: boolean
  setShowFilters: (s: boolean) => void
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  costbookEnabled: boolean
  dateRange: string
  setDateRange: (v: string) => void
  isOpen: boolean
  startTour: () => void
  closeTour: () => void
  completeTour: () => void
  resetAndStartTour: () => void
  hasCompletedTour: boolean
  portfolioId?: string | undefined
}) {
  const { t } = useTranslations()
  const data = useFinancialsData()
  const visitedViewModes = useVisitedViewModes(viewMode)
  const {
    projects,
    budgetVariances,
    financialAlerts,
    metrics,
    comprehensiveReport,
    budgetPerformance,
    loading,
    error,
    refetch,
    analyticsData,
    costAnalysis,
    commitmentsSummary,
    commitmentsAnalytics,
    trendsMonthlyData,
    trendsSummary,
    commitmentsLoading,
    refetchCommitmentsActuals,
    portfolioActualsTotal
  } = data

  const hasData = projects.length > 0 || metrics != null
  const showContentSkeleton = loading && !hasData

  const exportFinancialData = () => {
    const exportData = {
      metrics,
      budgetVariances,
      financialAlerts,
      comprehensiveReport,
      analytics: analyticsData,
      currency: selectedCurrency,
      view_mode: viewMode,
      exported_at: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${viewMode}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-300">{t('errors.loadFailed')}</h3>
              <p className="mt-1 text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="space-y-6 min-w-0">
        {/* Header */}
        <div data-testid="financials-header">
          <FinancialHeader
            metrics={metrics}
            analyticsData={analyticsData}
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onExport={exportFinancialData}
            onEditBudget={() => setViewMode('detailed')}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
        </div>

        {/* Navigation Tabs */}
        <div data-testid="financials-tabs" data-tour="financials-tabs" className="flex items-center justify-between gap-4 flex-wrap min-w-0">
          <TabNavigation
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <TourTriggerButton
            onStart={hasCompletedTour ? resetAndStartTour : startTour}
            hasCompletedTour={hasCompletedTour}
          />
        </div>

        {/* View-specific Content (EAC, Variance, etc.) – skeleton only on initial load */}
        <div data-tour="financials-content" className="space-y-6">
        {showContentSkeleton ? (
          <div className="animate-pulse space-y-6">
            <div className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-slate-700 rounded-lg" />
              ))}
            </div>
            <div className="h-64 bg-gray-100 dark:bg-slate-700 rounded-lg" />
            <div className="h-96 bg-gray-100 dark:bg-slate-700 rounded-lg" />
          </div>
        ) : (
          <>
        {/* Overview: KPI card, then Financial Metrics (Gesamtbudget etc.), then charts */}
        {visitedViewModes.has('overview') && (
          <div data-testid="financials-overview-view" className={viewMode === 'overview' ? 'block' : 'hidden'}>
            <OverviewView
              analyticsData={analyticsData}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
              totalProjectBudget={metrics?.total_budget}
              metrics={metrics ?? undefined}
              portfolioId={effectivePortfolioId}
              commitmentsSummary={commitmentsSummary}
              commitmentsAnalytics={commitmentsAnalytics}
              portfolioActualsTotal={portfolioActualsTotal}
            />
          </div>
        )}

        {/* Critical Alerts */}
        {financialAlerts.length > 0 && (
          <div data-testid="financials-alerts" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">{t('financials.budgetWarnings')}</h3>
              <span className="text-sm text-red-800 dark:text-red-300">{financialAlerts.length} {financialAlerts.length !== 1 ? t('financials.criticalAlerts') : t('financials.criticalAlert')}</span>
            </div>
            <div className="space-y-3">
              {financialAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-slate-100">{alert.project_name}</h4>
                      <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-700 dark:text-slate-300">
                        <span>{t('financials.budget')}: {alert.budget.toLocaleString()} {selectedCurrency}</span>
                        <span>{t('financials.spent')}: {alert.actual_cost.toLocaleString()} {selectedCurrency}</span>
                        <span>{t('financials.utilization')}: {alert.utilization_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.alert_level === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-300' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-300'
                    }`}
                    >
                      {alert.alert_level === 'critical' ? t('financials.criticalAlert') : t('financials.warning')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div data-testid="financials-filters" className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('financials.timeRange')}</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                >
                  <option value="all">{t('financials.allTime')}</option>
                  <option value="30d">{t('financials.last30Days')}</option>
                  <option value="90d">{t('financials.last90Days')}</option>
                  <option value="1y">{t('financials.lastYear')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('financials.budgetStatus')}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                  <option value="all">{t('financials.allProjects')}</option>
                  <option value="over">{t('financials.overBudgetOnly')}</option>
                  <option value="under">{t('financials.underBudgetOnly')}</option>
                  <option value="on">{t('financials.onBudget')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('financials.warningLevel')}</label>
                <select className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800">
                  <option value="all">{t('financials.allLevels')}</option>
                  <option value="critical">{t('financials.criticalOnly')}</option>
                  <option value="warning">{t('financials.warningOnly')}</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">
                  {t('financials.resetFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View-specific Content (lazy-mount: only mount when first visited, then hide with CSS) */}
        {visitedViewModes.has('analysis') && (
          <div data-testid="financials-analysis-view" className={viewMode === 'analysis' ? 'block' : 'hidden'}>
            <AnalysisView
              budgetPerformance={budgetPerformance}
              costAnalysis={costAnalysis}
              analyticsData={analyticsData}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
              commitmentsSummary={commitmentsSummary}
              commitmentsAnalytics={commitmentsAnalytics}
            />
          </div>
        )}

        {visitedViewModes.has('trends') && (
          <div data-testid="financials-trends-view" className={viewMode === 'trends' ? 'block' : 'hidden'}>
            <TrendsView
              comprehensiveReport={comprehensiveReport}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
              monthlyData={trendsMonthlyData}
              trendsSummary={trendsSummary}
              trendsLoading={commitmentsLoading}
            />
          </div>
        )}

        {visitedViewModes.has('detailed') && (
          <div data-testid="financials-detailed-view" className={viewMode === 'detailed' ? 'block' : 'hidden'}>
            <DetailedView
              comprehensiveReport={comprehensiveReport}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
              commitmentsSummary={commitmentsSummary}
              commitmentsAnalytics={commitmentsAnalytics}
              commitmentsLoading={commitmentsLoading}
            />
          </div>
        )}

        {visitedViewModes.has('po-breakdown') && (
          <div data-testid="financials-po-breakdown-view" className={viewMode === 'po-breakdown' ? 'block' : 'hidden'}>
            <POBreakdownView
              accessToken={session?.access_token}
              projectId={selectedProjectId ?? undefined}
            />
          </div>
        )}

        {visitedViewModes.has('commitments-actuals') && (
          <div data-testid="financials-commitments-actuals-view" className={viewMode === 'commitments-actuals' ? 'block' : 'hidden'}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }>
              <CommitmentsActualsView
                session={session}
                selectedCurrency={selectedCurrency}
                onRefresh={refetch}
                commitmentsSummary={commitmentsSummary}
                commitmentsAnalytics={commitmentsAnalytics}
                commitmentsLoading={commitmentsLoading}
                onRefreshCommitmentsActuals={refetchCommitmentsActuals}
              />
            </Suspense>
          </div>
        )}

        {visitedViewModes.has('costbook') && (
          <div data-testid="financials-costbook-view" className={viewMode === 'costbook' ? 'block' : 'hidden'}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            }>
              <Costbook
                initialCurrency={selectedCurrency as import('@/types/costbook').Currency}
                showTourButton={false}
                projectId={selectedProjectId ?? undefined}
              />
            </Suspense>
          </div>
        )}

        {/* Original Budget Variance Table (hidden by default, can be shown if needed) */}
        {budgetVariances.length > 0 && false && (
          <div data-testid="financials-budget-variance-table">
            <BudgetVarianceTable
              budgetVariances={budgetVariances}
              projects={projects}
              selectedCurrency={selectedCurrency}
              analyticsData={analyticsData}
            />
          </div>
        )}
          </>
        )}
        </div>
      </ResponsiveContainer>
      <GuidedTour
        steps={financialsTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="financials-v1"
      />
    </AppLayout>
  )
}

export default function Financials() {
  return (
    <Suspense fallback={<FinancialsFallback />}>
      <FinancialsContent />
    </Suspense>
  )
}