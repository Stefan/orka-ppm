'use client'

// Next.js 16 Dashboard - Ultra-Compact Grid Layout (Enterprise PPM Style)
// Stack: Next.js 16, Tailwind CSS, Recharts, lucide-react
// Design: Grid-based, Mobile-first, Hover details, Minimal scrolling
// Note: AppLayout has TopBar, so available height is less than 100vh

import { useEffect, useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
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
// Charts werden nicht auf der Dashboard-Hauptseite verwendet, daher entfernen
// import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Dynamic imports for code splitting with stable dimensions to prevent CLS
const VarianceKPIs = dynamic(() => import('./components/VarianceKPIs'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const VarianceTrends = dynamic(() => import('./components/VarianceTrends'), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-64" />
})
const VarianceAlerts = dynamic(() => import('./components/VarianceAlerts'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-100 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})
const WorkflowDashboard = dynamic(() => import('@/components/workflow/WorkflowDashboard'), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 rounded-lg animate-pulse" style={{ contain: 'layout style paint' }}></div>
})

// KPI Card Component - balanced sizing with design tokens
function KPICard({ label, value, change, icon: Icon, color, testId }: any) {
  const isPositive = change >= 0
  return (
    <div data-testid={testId} className="bg-white rounded-lg border border-gray-200 px-4 py-3 hover:shadow-md transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold leading-none ${color}`}>{value}%</p>
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '↑' : '↓'}{Math.abs(change)}%
            </span>
          </div>
        </div>
        <Icon className={`${color} opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0`} size={28} />
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
    <div data-testid="project-card" className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 hover:shadow-md hover:border-blue-400 transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">
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
      className="flex flex-col items-center justify-center p-3 md:p-4 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all duration-200 group"
    >
      <Icon className="text-gray-400 group-hover:text-blue-600 mb-2 transition-colors" size={20} />
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
    </button>
  )
}

// Ultra-Compact Alert Chip Component - standardized font sizes using design tokens
function AlertChip({ alert, onDismiss }: { alert: any, onDismiss: (id: string) => void }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const severityConfig = {
    critical: { 
      bg: 'bg-red-100', 
      border: 'border-red-300', 
      text: 'text-red-800',
      dot: 'bg-red-600'
    },
    warning: { 
      bg: 'bg-orange-100', 
      border: 'border-orange-300', 
      text: 'text-orange-800',
      dot: 'bg-orange-600'
    },
    info: { 
      bg: 'bg-blue-100', 
      border: 'border-blue-300', 
      text: 'text-blue-800',
      dot: 'bg-blue-600'
    }
  }
  
  const severity = alert.severity || 'warning'
  const config = severityConfig[severity as keyof typeof severityConfig]
  
  return (
    <div 
      data-testid="alert-chip"
      className={`${config.bg} border ${config.border} rounded-md px-2.5 py-1.5 flex items-center gap-2 group hover:shadow-md transition-all relative`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2 h-2 rounded-full ${config.dot} flex-shrink-0`}></div>
      <div className="flex flex-col min-w-0">
        <span className={`text-sm font-semibold ${config.text}`}>{alert.title}</span>
        <span className={`text-xs ${config.text} opacity-70 truncate`}>{alert.description}</span>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className={`p-0.5 rounded hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${config.text}`}
      >
        <X size={14} />
      </button>
      
      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-20 whitespace-nowrap">
          {alert.description}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
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
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs"
      >
        <Filter size={14} />
        <span className="hidden sm:inline">{value}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === option ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
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
  
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [kpis, setKPIs] = useState<KPIs | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [varianceAlertCount, setVarianceAlertCount] = useState(0)
  const [timeFilter, setTimeFilter] = useState('Last 30 days')
  const [alerts, setAlerts] = useState<any[]>([
    { id: '1', title: 'Budget Overrun', description: 'Project Alpha exceeded budget by 15%', severity: 'critical' },
    { id: '2', title: 'Timeline Delay', description: 'Project Beta is 2 weeks behind schedule', severity: 'warning' },
    { id: '3', title: 'Resource Conflict', description: 'Team member assigned to multiple projects', severity: 'warning' },
  ])
  const [showImportModal, setShowImportModal] = useState(false)

  const loadOptimizedData = useCallback(async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    
    try {
      await loadDashboardData(
        session.access_token,
        (criticalData) => {
          setQuickStats(criticalData.quickStats)
          setKPIs(criticalData.kpis)
          setLoading(false)
        },
        (projects) => {
          setRecentProjects(projects)
        }
      )
    } catch (err) {
      console.error('Dashboard load error:', err)
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
      console.error('Refresh failed:', err)
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
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 md:h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="lg:col-span-2 h-48 md:h-64 bg-gray-200 rounded"></div>
              <div className="h-48 md:h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Compact container with reduced spacing */}
      <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 space-y-2 md:space-y-3">
        
        {/* Header - with proper typography hierarchy */}
        <div data-testid="dashboard-header" className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 data-testid="dashboard-title" className="text-xl font-bold text-gray-900 whitespace-nowrap">{t('dashboard.title')}</h1>
            <span data-testid="dashboard-project-count" className="text-sm text-gray-500 whitespace-nowrap">
              {quickStats?.total_projects || 0} {t('dashboard.projects')} • {quickStats?.active_projects || 0} {t('stats.activeProjects')}
            </span>
            {/* Alert Chips - Inline with header */}
            {alerts.map((alert) => (
              <AlertChip key={alert.id} alert={alert} onDismiss={handleDismissAlert} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <FilterDropdown value={timeFilter} onChange={handleFilterChange} />
            <button
              data-testid="dashboard-refresh-button"
              onClick={quickRefresh}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={t('dashboard.refresh')}
            >
              <RefreshCw size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* TOP: KPI Cards - Responsive Grid (2→3→5 columns) */}
        {kpis && (
          <div data-testid="dashboard-kpi-section" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
            <KPICard
              testId="kpi-card-success-rate"
              label={t('kpi.successRate')}
              value={kpis.project_success_rate || 0}
              change={5.2}
              icon={TrendingUp}
              color="text-green-600"
            />
            <KPICard
              testId="kpi-card-budget-performance"
              label={t('kpi.budgetPerformance')}
              value={kpis.budget_performance || 0}
              change={-2.1}
              icon={DollarSign}
              color="text-blue-600"
            />
            <KPICard
              testId="kpi-card-timeline-performance"
              label={t('kpi.timelinePerformance')}
              value={kpis.timeline_performance || 0}
              change={3.7}
              icon={Clock}
              color="text-purple-600"
            />
            <KPICard
              testId="kpi-card-active-projects"
              label={t('kpi.activeProjects')}
              value={kpis.active_projects_ratio || 0}
              change={1.2}
              icon={BarChart3}
              color="text-indigo-600"
            />
            <KPICard
              testId="kpi-card-resources"
              label={t('resources.title')}
              value={kpis.resource_efficiency || 0}
              change={0.8}
              icon={Users}
              color="text-teal-600"
            />
          </div>
        )}

        {/* Workflow Approvals - Compact View */}
        {session?.user?.id && (
          <Suspense fallback={<div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>}>
            <WorkflowDashboard 
              userId={session.user.id} 
              userRole={session.user.role || 'viewer'}
              compact={true}
            />
          </Suspense>
        )}

        {/* Budget Variance and Variance Trends side by side */}
        <div data-testid="dashboard-variance-section" className="flex flex-col sm:flex-row gap-4">
          {/* Budget Variance - compact fixed width */}
          <div className="w-full sm:w-auto sm:max-w-xs flex-shrink-0">
            <Suspense fallback={<div className="h-full bg-white rounded-lg border border-gray-200 animate-pulse" style={{ minHeight: '240px' }}></div>}>
              <VarianceKPIs session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
          
          {/* Variance Trends - takes remaining space */}
          <div className="w-full sm:flex-1 min-w-0">
            <Suspense fallback={<div className="h-full bg-white rounded-lg border border-gray-200 animate-pulse" style={{ minHeight: '240px' }}></div>}>
              <VarianceTrends session={session} selectedCurrency="USD" />
            </Suspense>
          </div>
        </div>

        {/* Health Summary - Full Width */}
        <div data-testid="dashboard-health-section" className="space-y-2 md:space-y-3">
          {/* Project Health Summary - Compact - standardized font sizes using design tokens */}
          {quickStats && (
            <div data-testid="health-summary" className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">{t('health.projectHealth')}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-600">{t('health.healthy')}</span>
                  </div>
                  <span data-testid="health-healthy-count" className="font-semibold text-gray-900 text-base">{quickStats.health_distribution?.green || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-600">{t('health.atRisk')}</span>
                  </div>
                  <span data-testid="health-at-risk-count" className="font-semibold text-gray-900 text-base">{quickStats.health_distribution?.yellow || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-sm text-gray-600">{t('health.critical')}</span>
                  </div>
                  <span data-testid="health-critical-count" className="font-semibold text-gray-900 text-base">{quickStats.health_distribution?.red || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Projects Grid - balanced sizing */}
        <div data-testid="dashboard-projects-section" className="bg-white rounded-lg border border-gray-200 p-4 mb-20">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">{t('projects.recentProjects')}</h2>
          <div data-testid="recent-projects-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {recentProjects.slice(0, 8).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {recentProjects.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">{t('scenarios.noScenarios')}</p>
          )}
        </div>
      </div>

      {/* BOTTOM: Quick Actions - Fixed at bottom of viewport with higher z-index */}
      <div data-testid="dashboard-quick-actions" className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-white/95 border-t-2 border-gray-300 py-2 px-3 shadow-2xl z-50">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap mr-1">{t('actions.quickActions')}:</span>
            <button data-testid="action-scenarios" onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all whitespace-nowrap shadow-md hover:shadow-lg">
              <BarChart3 size={18} />
              <span className="text-sm font-medium">{t('actions.scenarios')}</span>
            </button>
            <button data-testid="action-resources" onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
              <Users size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">{t('actions.resources')}</span>
            </button>
            <button data-testid="action-financials" onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
              <DollarSign size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">{t('actions.financials')}</span>
            </button>
            <button data-testid="action-reports" onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
              <FileText size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">{t('actions.reports')}</span>
            </button>
            <button onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
              <Clock size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Timeline</span>
            </button>
            <button onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap shadow-sm">
              <TrendingUp size={18} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Analytics</span>
            </button>
            <button data-testid="action-import" onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all whitespace-nowrap shadow-md hover:shadow-lg">
              <Upload size={18} />
              <span className="text-sm font-medium">Import Projects</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Import Modal */}
      <ProjectImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </AppLayout>
  )
}
