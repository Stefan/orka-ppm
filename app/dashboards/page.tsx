'use client'

// Next.js 16 Dashboard - Ultra-Compact Grid Layout (Enterprise PPM Style)
// Stack: Next.js 16, Tailwind CSS, Recharts, lucide-react
// Design: Grid-based, Mobile-first, Hover details, Minimal scrolling
// Note: AppLayout has TopBar, so available height is less than 100vh

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { useTranslations } from '@/lib/i18n/context'
import { 
  loadDashboardData, 
  clearDashboardCache,
  type QuickStats,
  type KPIs,
  type Project
} from '../../lib/api/dashboard-loader'
import { 
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, RefreshCw, 
  BarChart3, Users, FileText, ChevronDown, X, Filter, Upload 
} from 'lucide-react'
import ProjectImportModal from '@/components/projects/ProjectImportModal'
import { ChartSkeleton } from '../../components/ui/Skeleton'
import { GuidedTour, useGuidedTour, TourTriggerButton, dashboardTourSteps } from '@/components/guided-tour'
import { logger } from '@/lib/monitoring/logger'
// Charts werden nicht auf der Dashboard-Hauptseite verwendet, daher entfernen
// import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Dynamic imports for code splitting with stable dimensions to prevent CLS
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-64" />
})
const VarianceAlerts = dynamic(() => import('./components/VarianceAlerts'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const WorkflowDashboard = dynamic(() => import('@/components/workflow/WorkflowDashboard'), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const ScheduleDashboardWidgets = dynamic(() => import('./components/ScheduleDashboardWidgets'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const ChangeOrderWidgets = dynamic(() => import('./components/ChangeOrderWidgets'), {
  ssr: false,
  loading: () => <div className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const ProjectControlsWidgets = dynamic(() => import('./components/ProjectControlsWidgets'), {
  ssr: false,
  loading: () => <div className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})

// KPI Card Component - balanced sizing with design tokens
// Map light-mode color classes to their dark-mode equivalents
const kpiColorMap: Record<string, string> = {
  'text-green-600 dark:text-green-400': 'text-green-600 dark:text-green-400',
  'text-blue-600 dark:text-blue-400': 'text-blue-600 dark:text-blue-400',
  'text-purple-600 dark:text-purple-400': 'text-purple-600 dark:text-purple-400',
  'text-indigo-600 dark:text-indigo-400': 'text-indigo-600 dark:text-indigo-400',
  'text-teal-600': 'text-teal-600 dark:text-teal-400',
  'text-red-600 dark:text-red-400': 'text-red-600 dark:text-red-400',
  'text-orange-600 dark:text-orange-400': 'text-orange-600 dark:text-orange-400',
  'text-amber-600': 'text-amber-600 dark:text-amber-400',
}

function KPICard({ label, value, change, icon: Icon, color, testId }: any) {
  const isPositive = change >= 0
  const colorWithDark = kpiColorMap[color] || color
  return (
    <div data-testid={testId} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-700 px-4 py-3 hover:shadow-md transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-slate-300 uppercase tracking-wide truncate mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold leading-none ${colorWithDark}`}>{value}%</p>
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? '↑' : '↓'}{Math.abs(change)}%
            </span>
          </div>
        </div>
        <Icon className={`${colorWithDark} opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0`} size={28} />
      </div>
    </div>
  )
}

// Project Card Component - balanced sizing
function ProjectCard({ project }: { project: Project }) {
  const healthColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }
  
  return (
    <div data-testid="project-card" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-2.5 hover:shadow-md hover:border-blue-400 transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
            {project.name}
          </h3>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${healthColors[project.health as keyof typeof healthColors]} flex-shrink-0`}></div>
      </div>
    </div>
  )
}

// Quick Action Button Component - standardized font sizes
function QuickActionButton({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 md:p-4 bg-white dark:bg-slate-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md transition-all duration-200 group"
    >
      <Icon className="text-gray-400 dark:text-slate-500 group-hover:text-blue-600 mb-2 transition-colors" size={20} />
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:hover:text-slate-100 dark:group-hover:text-slate-100 transition-colors">{label}</span>
    </button>
  )
}

// Alert chip – colored bg with left accent bar, icon, high-contrast text
function AlertChip({ alert, onDismiss }: { alert: any, onDismiss: (id: string) => void }) {
  const severityConfig = {
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      accent: 'bg-red-500',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
      desc: 'text-red-700 dark:text-red-200',
    },
    high: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      accent: 'bg-red-500',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
      desc: 'text-red-700 dark:text-red-200',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      border: 'border-amber-200 dark:border-amber-800',
      accent: 'bg-amber-500',
      icon: 'text-amber-600 dark:text-amber-400',
      title: 'text-amber-900 dark:text-amber-100',
      desc: 'text-amber-700 dark:text-amber-200',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-800',
      accent: 'bg-blue-500',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
      desc: 'text-blue-700 dark:text-blue-200',
    },
  }

  const severity = alert.severity || 'warning'
  const config = severityConfig[severity as keyof typeof severityConfig]

  return (
    <div
      data-testid="alert-chip"
      className={`relative ${config.bg} border ${config.border} rounded-lg pl-4 pr-2 py-1.5 flex items-center gap-2 min-w-0 max-w-sm group hover:shadow-sm transition-all overflow-hidden`}
    >
      {/* Color accent bar on the left edge */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent} rounded-l-lg`} aria-hidden />

      <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${config.icon}`} aria-hidden />
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`text-sm font-medium ${config.title} truncate`}>{alert.title}</span>
        <span className={`text-xs ${config.desc} truncate`}>{alert.description}</span>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white dark:bg-slate-800/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-inherit"
        aria-label="Dismiss alert"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}

// Filter Dropdown Component - standardized font sizes
function FilterDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const options = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-xs text-gray-900 dark:text-slate-100"
      >
        <Filter size={14} aria-hidden />
        <span className="hidden sm:inline">{value}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === option ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-slate-200'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Main Dashboard Component
export default function CompactDashboard() {
  const { session } = useAuth()
  const { t } = useTranslations()
  
  const router = useRouter()
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)
  const [timeFilter, setTimeFilter] = useState('Last 30 days')
  const [alerts, setAlerts] = useState<any[]>([
    { id: '1', title: 'Budget Overrun', description: 'Project Alpha exceeded budget by 15%', severity: 'critical' },
    { id: '2', title: 'Schedule Delay Risk', description: 'Critical path activities delayed by 3 days', severity: 'high' },
    { id: '4', title: 'Timeline Delay', description: 'Project Beta is 2 weeks behind schedule', severity: 'warning' },
    { id: '3', title: 'Resource Conflict', description: 'Team member assigned to multiple projects', severity: 'warning' },
  ])
  const [showImportModal, setShowImportModal] = useState(false)
  const hasCriticalDataRef = useRef(false)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('dashboard-v1')

  const loadOptimizedData = useCallback(async () => {
    if (!session?.access_token) return
    
    // Only show full-page loading when we have no data yet (refresh/revisit keeps showing current UI)
    setLoading((prev) => (hasCriticalDataRef.current ? prev : true))
    
    try {
      await loadDashboardData(
        session.access_token,
        (criticalData) => {
          hasCriticalDataRef.current = true
          setQuickStats(criticalData.quickStats)
          setKPIs(criticalData.kpis)
          setLoading(false)
        },
        (projects) => {
          setRecentProjects(projects)
        }
      )
    } catch (err) {
      logger.error('Dashboard load error', { err }, 'dashboards/page')
      setQuickStats({
        total_projects: 0,
        active_projects: 0,
        health_distribution: { green: 0, yellow: 0, red: 0 },
        critical_alerts: 0,
        at_risk_projects: 0
      })
      setKPIs({
        project_success_rate: 0,
        budget_performance: 0,
        timeline_performance: 0,
        average_health_score: 0,
        resource_efficiency: 0,
        active_projects_ratio: 0
      })
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (session?.access_token) {
      loadOptimizedData()
    }
  }, [session, loadOptimizedData])

  const quickRefresh = useCallback(async () => {
    if (!session?.access_token) return
    try {
      clearDashboardCache()
      await loadOptimizedData()
    } catch (err) {
      logger.error('Refresh failed', { err }, 'dashboards/page')
    }
  }, [session?.access_token, loadOptimizedData])

  const handleFilterChange = useCallback((newFilter: string) => {
    setTimeFilter(newFilter)
    loadOptimizedData()
  }, [loadOptimizedData])

  const handleDismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  // Loading State - Mobile-first responsive
  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6">
          <div className="animate-pulse space-y-3 md:space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 md:h-24 bg-gray-200 dark:bg-slate-700 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="lg:col-span-2 h-48 md:h-64 bg-gray-200 dark:bg-slate-700 rounded"></div>
              <div className="h-48 md:h-64 bg-gray-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Compact container with reduced spacing; pb for Quick Actions bar so content is not hidden when scrolling */}
      <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 space-y-2 md:space-y-3 pb-20">
        
        {/* Header - Row 1: Title + stats + actions */}
        <div data-testid="dashboard-header" data-tour="dashboard-header" className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 data-testid="dashboard-title" className="text-xl font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">{t('dashboard.title')}</h1>
            <span data-testid="dashboard-project-count" className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
              {quickStats?.total_projects || 0} {t('dashboard.projects')} • {quickStats?.active_projects || 0} {t('stats.activeProjects')}
            </span>
          </div>
          <div className="flex items-center gap-2" data-tour="dashboard-filter">
            <TourTriggerButton
              onStart={hasCompletedTour ? resetAndStartTour : startTour}
              hasCompletedTour={hasCompletedTour}
            />
            <FilterDropdown value={timeFilter} onChange={handleFilterChange} />
            <button
              data-testid="dashboard-refresh-button"
              onClick={quickRefresh}
              className="p-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              title={t('dashboard.refresh')}
            >
              <RefreshCw size={16} className="text-gray-700 dark:text-slate-300" />
            </button>
          </div>
        </div>
        {/* Row 2: Alert Chips */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {alerts.map((alert) => (
              <AlertChip key={alert.id} alert={alert} onDismiss={handleDismissAlert} />
            ))}
          </div>
        )}

        {/* TOP: KPI Cards - Responsive Grid (2→3→5 columns) */}
        {kpis && (
          <div data-testid="dashboard-kpi-section" data-tour="dashboard-kpis" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
            <KPICard
              testId="kpi-card-success-rate"
              label={t('kpi.successRate')}
              value={kpis.project_success_rate || 0}
              change={5.2}
              icon={TrendingUp}
              color="text-green-600 dark:text-green-400"
            />
            <KPICard
              testId="kpi-card-budget-performance"
              label={t('kpi.budgetPerformance')}
              value={kpis.budget_performance || 0}
              change={-2.1}
              icon={DollarSign}
              color="text-blue-600 dark:text-blue-400"
            />
            <KPICard
              testId="kpi-card-timeline-performance"
              label={t('kpi.timelinePerformance')}
              value={kpis.timeline_performance || 0}
              change={3.7}
              icon={Clock}
              color="text-purple-600 dark:text-purple-400"
            />
            <KPICard
              testId="kpi-card-active-projects"
              label={t('kpi.activeProjects')}
              value={kpis.active_projects_ratio || 0}
              change={1.2}
              icon={BarChart3}
              color="text-indigo-600 dark:text-indigo-400"
            />
            <KPICard
              testId="kpi-card-resources"
              label={t('resources.title')}
              value={kpis.resource_efficiency || 0}
              change={0.8}
              icon={Users}
              color="text-teal-600 dark:text-teal-400"
            />
          </div>
        )}

        {/* Workflow Approvals - Compact View */}
        {session?.user?.id && (
          <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>}>
            <WorkflowDashboard 
              userId={session.user.id} 
              userRole={session.user.role || 'viewer'}
              compact={true}
            />
          </Suspense>
        )}

        {/* Budget Variance and Variance Trends side by side */}
        <div data-testid="dashboard-variance-section" data-tour="dashboard-variance" className="flex flex-col sm:flex-row gap-4">
          {/* Budget Variance - compact fixed width */}
          <div className="w-full sm:w-auto sm:max-w-xs flex-shrink-0">
            <Suspense fallback={<div className="h-full bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 animate-pulse" style={{ minHeight: '240px' }}></div>}>
              <VarianceKPIs session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
          
          {/* Variance Trends - takes remaining space */}
          <div className="w-full sm:flex-1 min-w-0">
            <Suspense fallback={<div className="h-full bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 animate-pulse" style={{ minHeight: '240px' }}></div>}>
              <VarianceTrends session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
        </div>

        {/* Schedule widgets (Task 15) */}
        {session?.access_token && (
          <Suspense fallback={<div className="h-32 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />}>
            <ScheduleDashboardWidgets accessToken={session.access_token} />
          </Suspense>
        )}

        {/* Change Orders widget */}
        {recentProjects.length > 0 && (
          <Suspense fallback={<div className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />}>
            <ChangeOrderWidgets projectIds={recentProjects.map((p) => p.id)} />
          </Suspense>
        )}

        {/* Project Controls widget */}
        {recentProjects.length > 0 && (
          <Suspense fallback={<div className="h-24 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />}>
            <ProjectControlsWidgets projectIds={recentProjects.map((p) => p.id)} />
          </Suspense>
        )}

        {/* Health Summary - Full Width */}
        <div data-testid="dashboard-health-section" className="space-y-2 md:space-y-3">
          {/* Project Health Summary - Compact - standardized font sizes using design tokens */}
          {quickStats && (
            <div data-testid="health-summary" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 uppercase tracking-wide">{t('health.projectHealth')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-700 dark:text-slate-300">{t('health.healthy')}</span>
                  </div>
                  <span data-testid="health-healthy-count" className="font-semibold text-gray-900 dark:text-slate-100 text-base">{quickStats.health_distribution?.green || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-700 dark:text-slate-300">{t('health.atRisk')}</span>
                  </div>
                  <span data-testid="health-at-risk-count" className="font-semibold text-gray-900 dark:text-slate-100 text-base">{quickStats.health_distribution?.yellow || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-700 dark:text-slate-300">{t('health.critical')}</span>
                  </div>
                  <span data-testid="health-critical-count" className="font-semibold text-gray-900 dark:text-slate-100 text-base">{quickStats.health_distribution?.red || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Projects Grid - balanced sizing */}
        <div data-testid="dashboard-projects-section" data-tour="dashboard-projects" className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-20">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 uppercase tracking-wide">{t('projects.recentProjects')}</h2>
          <div data-testid="recent-projects-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {recentProjects.slice(0, 8).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {recentProjects.length === 0 && (
            <p className="text-sm text-gray-700 dark:text-slate-300 text-center py-4">{t('scenarios.noScenarios')}</p>
          )}
        </div>
      </div>

      {/* Quick Actions: rendered via portal so it stays fixed at viewport bottom when scrolling */}
      {typeof document !== 'undefined' && createPortal(
        <div data-testid="dashboard-quick-actions" className="fixed bottom-0 left-0 right-0 border-t-2 border-gray-300 dark:border-slate-700 py-2 px-3 shadow-2xl z-[100] bg-white/95 dark:bg-slate-800 backdrop-blur-sm">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide whitespace-nowrap mr-1">{t('actions.quickActions')}:</span>
              <button data-testid="action-scenarios" onClick={() => router.push('/scenarios')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 dark:border dark:border-blue-600 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 transition-all whitespace-nowrap shadow-md hover:shadow-lg text-white [&_svg]:text-white [&_span]:text-white">
                <BarChart3 size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">{t('actions.scenarios')}</span>
              </button>
              <button data-testid="action-resources" onClick={() => router.push('/resources')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border-2 border-gray-400 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap shadow-sm text-gray-800 dark:text-white [&_svg]:text-inherit">
                <Users size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">{t('actions.resources')}</span>
              </button>
              <button data-testid="action-financials" onClick={() => router.push('/financials')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border-2 border-gray-400 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap shadow-sm text-gray-800 dark:text-white [&_svg]:text-inherit">
                <DollarSign size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">{t('actions.financials')}</span>
              </button>
              <button data-testid="action-reports" onClick={() => router.push('/reports')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border-2 border-gray-400 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap shadow-sm text-gray-800 dark:text-white [&_svg]:text-inherit">
                <FileText size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">{t('actions.reports')}</span>
              </button>
              <button data-testid="action-timeline" onClick={() => router.push('/schedules')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border-2 border-gray-400 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap shadow-sm text-gray-800 dark:text-white [&_svg]:text-inherit">
                <Clock size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">Timeline</span>
              </button>
              <button data-testid="action-analytics" onClick={() => router.push('/dashboards')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border-2 border-gray-400 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap shadow-sm text-gray-800 dark:text-white [&_svg]:text-inherit">
                <TrendingUp size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">Analytics</span>
              </button>
              <button data-testid="action-import" onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 dark:border dark:border-blue-600 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all whitespace-nowrap shadow-md hover:shadow-lg text-white [&_svg]:text-white [&_span]:text-white">
                <Upload size={18} className="shrink-0" aria-hidden />
                <span className="text-sm font-medium">Import Projects</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <GuidedTour
        steps={dashboardTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="dashboard-v1"
      />
      {/* Project Import Modal */}
      <ProjectImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </AppLayout>
  )
}
