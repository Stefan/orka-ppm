'use client'

import React, { lazy, Suspense, useEffect } from 'react'
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
import CSVImportView from './components/views/CSVImportView'
import POBreakdownView from './components/views/POBreakdownView'
import BudgetVarianceTable from './components/tables/BudgetVarianceTable'

// Import hooks
import { useFinancialData } from './hooks/useFinancialData'
import { useAnalytics } from './hooks/useAnalytics'
import { useFeatureFlag } from '../../contexts/FeatureFlagContext'

// Import types
import { ViewMode } from './types'

// Lazy load heavy components
const CommitmentsActualsView = lazy(() => import('./components/CommitmentsActualsView'))
const Costbook = lazy(() => import('../../components/costbook/Costbook'))

const TAB_PARAM_VALID: ViewMode[] = ['overview', 'detailed', 'trends', 'analysis', 'po-breakdown', 'csv-import', 'commitments-actuals', 'costbook']

function getInitialViewMode(searchParams: ReturnType<typeof useSearchParams>): ViewMode {
  const tab = searchParams.get('tab')
  return (tab && TAB_PARAM_VALID.includes(tab as ViewMode)) ? (tab as ViewMode) : 'overview'
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
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => getInitialViewMode(searchParams))

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

  // Use custom hooks for data management
  const {
    projects,
    budgetVariances,
    financialAlerts,
    metrics,
    comprehensiveReport,
    costAnalysis,
    budgetPerformance,
    loading,
    error,
    refetch
  } = useFinancialData({
    accessToken: session?.access_token || undefined,
    selectedCurrency
  })

  const analyticsData = useAnalytics({
    budgetVariances,
    projects,
    financialAlerts
  })

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

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </AppLayout>
  )

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t('errors.loadFailed')}</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="space-y-6">
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
          />
        </div>

        {/* Navigation Tabs */}
        <div data-testid="financials-tabs">
          <TabNavigation
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* Overview: KPI card, then Financial Metrics (Gesamtbudget etc.), then charts */}
        {viewMode === 'overview' && (
          <div data-testid="financials-overview-view">
            <OverviewView
              analyticsData={analyticsData}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
              totalProjectBudget={metrics?.total_budget}
              metrics={metrics ?? undefined}
            />
          </div>
        )}

        {/* Critical Alerts */}
        {financialAlerts.length > 0 && (
          <div data-testid="financials-alerts" className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900">{t('financials.budgetWarnings')}</h3>
              <span className="text-sm text-red-700">{financialAlerts.length} {financialAlerts.length !== 1 ? t('financials.criticalAlerts') : t('financials.criticalAlert')}</span>
            </div>
            <div className="space-y-3">
              {financialAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{alert.project_name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>{t('financials.budget')}: {alert.budget.toLocaleString()} {selectedCurrency}</span>
                        <span>{t('financials.spent')}: {alert.actual_cost.toLocaleString()} {selectedCurrency}</span>
                        <span>{t('financials.utilization')}: {alert.utilization_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.alert_level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
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
          <div data-testid="financials-filters" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('financials.timeRange')}</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="all">{t('financials.allTime')}</option>
                  <option value="30d">{t('financials.last30Days')}</option>
                  <option value="90d">{t('financials.last90Days')}</option>
                  <option value="1y">{t('financials.lastYear')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('financials.budgetStatus')}</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white">
                  <option value="all">{t('financials.allProjects')}</option>
                  <option value="over">{t('financials.overBudgetOnly')}</option>
                  <option value="under">{t('financials.underBudgetOnly')}</option>
                  <option value="on">{t('financials.onBudget')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('financials.warningLevel')}</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white">
                  <option value="all">{t('financials.allLevels')}</option>
                  <option value="critical">{t('financials.criticalOnly')}</option>
                  <option value="warning">{t('financials.warningOnly')}</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200">
                  {t('financials.resetFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View-specific Content */}
        {viewMode === 'analysis' && (
          <div data-testid="financials-analysis-view">
            <AnalysisView
              budgetPerformance={budgetPerformance}
              costAnalysis={costAnalysis}
              analyticsData={analyticsData}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
            />
          </div>
        )}

        {viewMode === 'trends' && (
          <div data-testid="financials-trends-view">
            <TrendsView
              comprehensiveReport={comprehensiveReport}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
            />
          </div>
        )}

        {viewMode === 'detailed' && (
          <div data-testid="financials-detailed-view">
            <DetailedView
              comprehensiveReport={comprehensiveReport}
              selectedCurrency={selectedCurrency}
              accessToken={session?.access_token}
            />
          </div>
        )}

        {viewMode === 'csv-import' && (
          <div data-testid="financials-csv-import-view">
            <CSVImportView
              accessToken={session?.access_token}
            />
          </div>
        )}

        {viewMode === 'po-breakdown' && (
          <div data-testid="financials-po-breakdown-view">
            <POBreakdownView
              accessToken={session?.access_token}
              projectId={projects[0]?.id}
            />
          </div>
        )}

        {viewMode === 'commitments-actuals' && (
          <div data-testid="financials-commitments-actuals-view">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            }>
              <CommitmentsActualsView 
                session={session}
                selectedCurrency={selectedCurrency}
                onRefresh={refetch}
              />
            </Suspense>
          </div>
        )}

        {viewMode === 'costbook' && (
          <div data-testid="financials-costbook-view">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            }>
              <Costbook
                useMockData={true}
                initialCurrency={selectedCurrency as import('@/types/costbook').Currency}
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
      </ResponsiveContainer>
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