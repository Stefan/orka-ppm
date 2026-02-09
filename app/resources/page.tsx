'use client'

import { useEffect, useState, useMemo, useDeferredValue, useReducer, lazy, Suspense } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { Users, Plus, Search, Filter, TrendingUp, AlertCircle, BarChart3, PieChart as PieChartIcon, Target, Zap, RefreshCw, Download, MapPin, RotateCcw, FolderOpen } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import ResourceCard from './components/ResourceCard'
import { getApiUrl } from '../../lib/api/client'
import { SkeletonCard, SkeletonChart } from '../../components/ui/skeletons'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslations } from '@/lib/i18n/context'
import { GuidedTour, useGuidedTour, TourTriggerButton, resourcesTourSteps } from '@/components/guided-tour'

// Lazy load heavy components for better code splitting
const AIResourceOptimizer = lazy(() => import('../../components/ai/AIResourceOptimizer'))
const VirtualizedResourceTable = lazy(() => import('../../components/ui/VirtualizedResourceTable'))
const MobileOptimizedChart = lazy(() => import('../../components/charts/MobileOptimizedChart'))

interface Resource {
  id: string
  name: string
  email: string
  role?: string | null
  capacity: number
  availability: number
  hourly_rate?: number | null
  skills: string[]
  location?: string | null
  current_projects: string[]
  utilization_percentage: number
  available_hours: number
  allocated_hours: number
  capacity_hours: number
  availability_status: string
  can_take_more_work: boolean
  created_at: string
  updated_at: string
}

interface ResourceFilters {
  search: string
  role: string
  availability_status: string
  skills: string[]
  location: string
  utilization_range: [number, number]
}

// Reducer for batching filter state updates
type FilterAction =
  | { type: 'SET_FILTER'; key: keyof ResourceFilters; value: any }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_MULTIPLE_FILTERS'; filters: Partial<ResourceFilters> }

function filterReducer(state: ResourceFilters, action: FilterAction): ResourceFilters {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value }
    case 'RESET_FILTERS':
      return {
        search: '',
        role: 'all',
        availability_status: 'all',
        skills: [],
        location: 'all',
        utilization_range: [0, 100]
      }
    case 'SET_MULTIPLE_FILTERS':
      return { ...state, ...action.filters }
    default:
      return state
  }
}

export default function Resources() {
  const { session } = useAuth()
  const { currentPortfolioId } = usePortfolio()
  const { t } = useTranslations()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'heatmap'>('cards')
  const [showFilters, setShowFilters] = useState(false)
  const [portfolioFilter, setPortfolioFilter] = useState<boolean>(false)
  const [showOptimization, setShowOptimization] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [detailResource, setDetailResource] = useState<Resource | null>(null)
  const [editResource, setEditResource] = useState<Resource | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const { isOpen, startTour, closeTour, completeTour, resetAndStartTour, hasCompletedTour } = useGuidedTour('resources-v1')

  // Auto-refresh functionality for real-time updates
  useEffect(() => {
    if (autoRefresh && session) {
      const interval = setInterval(() => {
        fetchResources()
        setLastRefresh(new Date())
      }, 30000) // Refresh every 30 seconds
      
      setRefreshInterval(interval)
      
      return () => {
        if (interval) clearInterval(interval)
      }
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
    // Return undefined for other cases
    return undefined
  }, [autoRefresh, session])

  // Use reducer for batching filter state updates
  const [filters, dispatchFilters] = useReducer(filterReducer, {
    search: '',
    role: 'all',
    availability_status: 'all',
    skills: [],
    location: 'all',
    utilization_range: [0, 100]
  })

  // Debounce search filter to reduce update frequency (300ms delay)
  const debouncedSearchFilter = useDebounce(filters.search, 300)

  // Defer filter changes for non-critical updates (charts, analytics)
  const deferredFilters = useDeferredValue(filters)

  // Filtered resources based on current filters
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Search filter (using debounced value)
      if (debouncedSearchFilter && !resource.name.toLowerCase().includes(debouncedSearchFilter.toLowerCase()) &&
          !resource.email.toLowerCase().includes(debouncedSearchFilter.toLowerCase())) {
        return false
      }
      
      // Role filter
      if (filters.role !== 'all' && resource.role !== filters.role) return false
      
      // Availability status filter
      if (filters.availability_status !== 'all' && resource.availability_status !== filters.availability_status) return false
      
      // Location filter
      if (filters.location !== 'all' && resource.location !== filters.location) return false
      
      // Utilization range filter
      if (resource.utilization_percentage < filters.utilization_range[0] || 
          resource.utilization_percentage > filters.utilization_range[1]) return false
      
      // Skills filter
      if (filters.skills.length > 0) {
        const skills = resource.skills ?? []
        const hasRequiredSkills = filters.skills.some(skill =>
          skills.some(resourceSkill =>
            resourceSkill.toLowerCase().includes(skill.toLowerCase())
          )
        )
        if (!hasRequiredSkills) return false
      }
      
      return true
    })
  }, [resources, debouncedSearchFilter, filters.role, filters.availability_status, filters.location, filters.utilization_range, filters.skills])

  // Analytics data (uses deferred filters for non-critical chart updates)
  const analyticsData = useMemo(() => {
    const utilizationDistribution = [
      { name: t('resources.underUtilizedRange'), rangeKey: 'underUtilized', value: resources.filter(r => r.utilization_percentage <= 50).length, color: '#10B981' },
      { name: t('resources.wellUtilizedRange'), rangeKey: 'wellUtilized', value: resources.filter(r => r.utilization_percentage > 50 && r.utilization_percentage <= 80).length, color: '#3B82F6' },
      { name: t('resources.highlyUtilizedRange'), rangeKey: 'highlyUtilized', value: resources.filter(r => r.utilization_percentage > 80 && r.utilization_percentage <= 100).length, color: '#F59E0B' },
      { name: t('resources.overUtilizedRange'), rangeKey: 'overUtilized', value: resources.filter(r => r.utilization_percentage > 100).length, color: '#EF4444' }
    ]

    const skillsDistribution = resources.reduce((acc, resource) => {
      (resource.skills ?? []).forEach(skill => {
        acc[skill] = (acc[skill] || 0) + 1
      })
      return acc
    }, {} as Record<string, number>)

    const topSkills = Object.entries(skillsDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ name: skill, value: count }))

    const roleDistribution = resources.reduce((acc, resource) => {
      const role = resource.role || 'Unassigned'
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const roleData = Object.entries(roleDistribution).map(([role, count]) => ({
      name: role === 'Unassigned' ? t('resources.unassigned') : role,
      roleKey: role === 'Unassigned' ? 'all' : role,
      value: count,
      color: role === 'Unassigned' ? '#6B7280' : '#3B82F6'
    }))

    return {
      utilizationDistribution,
      topSkills,
      roleDistribution: roleData,
      totalResources: resources.length,
      averageUtilization: resources.length > 0 ? resources.reduce((sum, r) => sum + r.utilization_percentage, 0) / resources.length : 0,
      availableResources: resources.filter(r => r.can_take_more_work).length,
      overallocatedResources: resources.filter(r => r.utilization_percentage > 100).length
    }
  }, [resources, deferredFilters, t])

  useEffect(() => {
    if (session) fetchResources()
  }, [session, portfolioFilter, currentPortfolioId])

  async function fetchResources() {
    setLoading(true)
    setError(null)
    try {
      if (!session?.access_token) throw new Error('Not authenticated')
      const params = new URLSearchParams()
      if (portfolioFilter && currentPortfolioId) params.set('portfolio_id', currentPortfolioId)
      const url = params.toString() ? getApiUrl(`/resources?${params.toString()}`) : getApiUrl('/resources')
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.status}`)
      }
      
      const data = await response.json()
      setResources(Array.isArray(data) ? data as Resource[] : [])
      setLastRefresh(new Date())
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function createResource(resourceData: {
    name: string
    email: string
    role?: string
    capacity?: number
    availability?: number
    hourly_rate?: number
    skills?: string[]
    location?: string
  }) {
    if (!session?.access_token) throw new Error('Not authenticated')
    
    try {
      const response = await fetch(getApiUrl('/resources'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceData)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let detail: string | undefined
        const raw = errorData.detail
        if (Array.isArray(raw)) {
          detail = raw.map((e: { msg?: string; loc?: unknown }) => e.msg || JSON.stringify(e.loc)).join(', ')
        } else if (raw && typeof raw === 'object' && 'message' in raw) {
          detail = (raw as { message?: string }).message
        } else if (typeof raw === 'string') {
          detail = raw
        } else {
          detail = errorData.error
        }
        throw new Error(detail || `Failed to create resource: ${response.status}`)
      }
      
      const newResource = await response.json()
      setResources(prev => [...prev, newResource])
      setShowAddModal(false)
      return newResource
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error creating resource'
      const isDuplicateEmail = message.toLowerCase().includes('already exists')
      if (!isDuplicateEmail) console.error('Error creating resource:', error)
      throw error instanceof Error ? error : new Error(message)
    }
  }

  async function deleteResource(resource: Resource) {
    if (!session?.access_token) throw new Error('Not authenticated')
    try {
      const response = await fetch(getApiUrl(`/resources/${resource.id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) {
        const status = response.status
        const errorData = await response.json().catch(() => ({}))
        const raw = errorData.detail
        const msg =
          (raw && typeof raw === 'object' && 'message' in raw
            ? (raw as { message?: string }).message
            : typeof raw === 'string'
              ? raw
              : errorData.error) || `Failed to delete resource (${status})`
        throw new Error(msg)
      }
      setResources((prev) => prev.filter((r) => r.id !== resource.id))
    } catch (error: unknown) {
      console.error('Error deleting resource:', error)
      throw error instanceof Error ? error : new Error('Unknown error deleting resource')
    }
  }

  async function updateResource(
    resourceId: string,
    resourceData: {
      name: string
      email: string
      role?: string
      capacity?: number
      availability?: number
      hourly_rate?: number
      skills?: string[]
      location?: string
    }
  ) {
    if (!session?.access_token) throw new Error('Not authenticated')
    try {
      const response = await fetch(getApiUrl(`/resources/${resourceId}`), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceData),
      })
      if (!response.ok) {
        let detail: string | undefined
        const text = await response.text()
        try {
          const errorData = text ? JSON.parse(text) : {}
          const raw = errorData.detail
          if (Array.isArray(raw)) {
            detail = raw.map((e: { msg?: string; loc?: unknown }) => e.msg || JSON.stringify(e.loc)).join(', ')
          } else if (raw && typeof raw === 'object' && 'message' in raw) {
            detail = (raw as { message?: string }).message
          } else if (typeof raw === 'string') {
            detail = raw
          } else {
            detail = errorData.error
          }
        } catch {
          detail = text?.slice(0, 200) || undefined
        }
        throw new Error(detail || `Failed to update resource: ${response.status}`)
      }
      const updated = await response.json()
      setResources((prev) => prev.map((r) => (r.id === resourceId ? { ...r, ...updated } : r)))
      setEditResource(null)
      return updated
    } catch (error: unknown) {
      console.error('Error updating resource:', error)
      throw error instanceof Error ? error : new Error('Unknown error updating resource')
    }
  }

  const handleFilterChange = (filterType: keyof ResourceFilters, value: any) => {
    dispatchFilters({ type: 'SET_FILTER', key: filterType, value })
  }

  const clearFilters = () => {
    dispatchFilters({ type: 'RESET_FILTERS' })
  }

  const exportResourceData = () => {
    const exportData = {
      resources: filteredResources,
      analytics: analyticsData,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resources-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        
        {/* Analytics Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonChart variant="pie" height="h-64" />
          <SkeletonChart variant="bar" height="h-64" />
          <SkeletonChart variant="pie" height="h-64" />
        </div>
        
        {/* Resource Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} variant="resource" />
          ))}
        </div>
      </div>
    </AppLayout>
  )

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{t('resources.errorLoading')}</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div data-testid="resources-page" className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
        {/* Enhanced Mobile-First Header: mobile = title + icon-only buttons in one row; lg+ = title block | toolbar with text */}
        <div data-testid="resources-header" className="flex flex-col space-y-4">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
            <div className="min-w-0 flex-1">
              {/* Mobile: title and icon-only toolbar in one row */}
              <div className="flex items-center justify-between gap-2 lg:block">
                <h1 data-testid="resources-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">{t('resources.title')}</h1>
                {/* Icon-only toolbar next to title (mobile/tablet) */}
                <div className="flex items-center gap-1 shrink-0 lg:hidden">
                  <TourTriggerButton onStart={hasCompletedTour ? resetAndStartTour : startTour} hasCompletedTour={hasCompletedTour} />
                  <button onClick={() => { setAddError(null); setShowAddModal(true) }} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-400" title={t('resources.addResource')} aria-label={t('resources.addResource')}><Plus className="h-4 w-4" /></button>
                  <button onClick={() => setViewMode(viewMode === 'cards' ? 'table' : viewMode === 'table' ? 'heatmap' : 'cards')} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600" title={viewMode === 'cards' ? t('resources.switchToTable') : viewMode === 'table' ? t('resources.switchToHeatmap') : t('resources.switchToCards')} aria-label={viewMode === 'cards' ? t('resources.switchToTable') : viewMode === 'table' ? t('resources.switchToHeatmap') : t('resources.switchToCards')}>{viewMode === 'cards' ? <BarChart3 className="h-4 w-4" /> : viewMode === 'table' ? <PieChartIcon className="h-4 w-4" /> : <Users className="h-4 w-4" />}</button>
                  <button onClick={() => fetchResources()} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600" title={t('resources.refreshNow')} aria-label={t('resources.refreshNow')}><RotateCcw className="h-4 w-4" /></button>
                  <button onClick={() => setAutoRefresh(!autoRefresh)} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${autoRefresh ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`} title={autoRefresh ? t('resources.autoOff') : t('resources.autoOn')} aria-label={autoRefresh ? t('resources.disableAutoRefresh') : t('resources.enableAutoRefresh')}><RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} /></button>
                  <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${showFilters ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`} title={showFilters ? t('resources.hideFilters') : t('resources.showFilters')} aria-label={showFilters ? t('resources.hideFilters') : t('resources.showFilters')}><Filter className="h-4 w-4" /></button>
                  <button onClick={() => setShowOptimization(!showOptimization)} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border ${showOptimization ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'}`} title={showOptimization ? t('resources.hideOptimization') : t('resources.showOptimization')} aria-label={showOptimization ? t('resources.hideOptimization') : t('resources.showOptimization')}><Zap className="h-4 w-4" /></button>
                  <button onClick={exportResourceData} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600" title={t('resources.exportData')} aria-label={t('resources.export')}><Download className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex flex-col space-y-2 mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {analyticsData.overallocatedResources > 0 && (
                    <div className="flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
                      <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span>{analyticsData.overallocatedResources} {t('resources.overallocated')}</span>
                    </div>
                  )}
                  {autoRefresh && (
                    <div className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin flex-shrink-0" />
                      <span>{t('resources.live')}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-700 dark:text-slate-300">
                  <span>{filteredResources.length} {t('resources.of')} {resources.length} {t('nav.resources').toLowerCase()}</span>
                  <span>{t('resources.avg')}: {analyticsData.averageUtilization.toFixed(1)}%</span>
                  <span>{analyticsData.availableResources} {t('resources.available')}</span>
                  {lastRefresh && (
                    <span className="hidden sm:inline">{t('dashboard.updated')}: {lastRefresh.toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Toolbar with text (desktop only) */}
            <div className="min-w-0 hidden lg:flex flex-wrap items-center gap-2 mb-4">
              <TourTriggerButton
                onStart={hasCompletedTour ? resetAndStartTour : startTour}
                hasCompletedTour={hasCompletedTour}
              />
              {(() => {
                const btnSecondary = 'inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-xl border transition-[background-color,border-color,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-slate-200 text-slate-900 border-slate-300 hover:bg-slate-300 hover:border-slate-400 active:bg-slate-400 focus:ring-slate-500 focus:ring-offset-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600 dark:hover:border-slate-500 dark:active:bg-slate-500 dark:focus:ring-slate-400 dark:focus:ring-offset-slate-900'
                const btnPrimary = 'inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-500 hover:border-indigo-600 active:bg-indigo-700 shadow-sm hover:shadow transition-[background-color,box-shadow,border-color] duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:bg-indigo-500 dark:border-indigo-600 dark:hover:bg-indigo-400 dark:active:bg-indigo-600 dark:focus:ring-offset-slate-900'
                const btnToggle = (active: boolean) => active ? btnPrimary : btnSecondary
                return (
                  <>
                    {/* Gruppe 1: Nur „Ressource hinzufügen“ – Assign/Schedule brauchen Projektkontext (z. B. Projektseite) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAddError(null); setShowAddModal(true) }}
                        className={btnPrimary}
                        title={t('resources.addResource')}
                        aria-label={t('resources.addResource')}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{t('resources.addResource')}</span>
                        <span className="sm:hidden">{t('resources.addShort')}</span>
                      </button>
                    </div>

                    <div className="w-px self-stretch min-h-[32px] bg-slate-200/80 dark:bg-slate-600/70 rounded-full" aria-hidden />

                    {/* Gruppe 2: Ansicht & Aktualisierung – alle einheitlich Secondary, Auto grün wenn an */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode(viewMode === 'cards' ? 'table' : viewMode === 'table' ? 'heatmap' : 'cards')}
                        className={btnSecondary}
                        title={viewMode === 'cards' ? t('resources.switchToTable') : viewMode === 'table' ? t('resources.switchToHeatmap') : t('resources.switchToCards')}
                        aria-label={viewMode === 'cards' ? t('resources.switchToTable') : viewMode === 'table' ? t('resources.switchToHeatmap') : t('resources.switchToCards')}
                      >
                        {viewMode === 'cards' ? <BarChart3 className="h-4 w-4 shrink-0" /> : viewMode === 'table' ? <PieChartIcon className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
                        <span className="hidden sm:inline">{viewMode === 'cards' ? t('resources.table') : viewMode === 'table' ? t('resources.heatmap') : t('resources.cards')}</span>
                      </button>
                      <button onClick={() => fetchResources()} className={btnSecondary} title={t('resources.refreshNow')} aria-label={t('resources.refreshNow')}>
                        <RotateCcw className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{t('resources.refresh') === 'resources.refresh' ? t('resources.refreshNow') : t('resources.refresh')}</span>
                      </button>
                      <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={autoRefresh ? 'inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-500 active:bg-emerald-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white dark:bg-emerald-500 dark:border-emerald-600 dark:hover:bg-emerald-400 dark:focus:ring-offset-slate-900' : btnSecondary}
                        title={autoRefresh ? t('resources.disableAutoRefresh') : t('resources.enableAutoRefresh')}
                        aria-label={autoRefresh ? t('resources.disableAutoRefresh') : t('resources.enableAutoRefresh')}
                      >
                        <RefreshCw className={`h-4 w-4 shrink-0 ${autoRefresh ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{t('resources.auto')}</span>
                      </button>
                    </div>

                    <div className="w-px self-stretch min-h-[32px] bg-slate-200/80 dark:bg-slate-600/70 rounded-full" aria-hidden />

                    {/* Gruppe 3: Filter (einheitlich Toggle) + AI Optimize (Hot Feature – auch inaktiv sichtbar hervorgehoben) */}
                    <div className="flex items-center gap-2" data-tour="resources-ai-optimizer">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={btnToggle(showFilters)}
                        title={showFilters ? t('resources.hideFilters') : t('resources.showFilters')}
                        aria-label={showFilters ? t('resources.hideFilters') : t('resources.showFilters')}
                      >
                        <Filter className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{t('resources.filters') === 'resources.filters' ? t('resources.showFilters') : t('resources.filters')}</span>
                      </button>
                      <button
                        onClick={() => setShowOptimization(!showOptimization)}
                        className={showOptimization
                          ? btnPrimary
                          : 'inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-xl border transition-[background-color,border-color] duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-200 hover:border-indigo-400 active:bg-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800 dark:hover:bg-indigo-900/70 dark:active:bg-indigo-900'
                        }
                        title={showOptimization ? t('resources.hideOptimization') : t('resources.showOptimization')}
                        aria-label={showOptimization ? t('resources.hideOptimization') : t('resources.showOptimization')}
                      >
                        <Zap className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{t('resources.aiOptimize')}</span>
                        <span className="sm:hidden">{t('resources.ai')}</span>
                      </button>
                    </div>

                    <div className="w-px self-stretch min-h-[32px] bg-slate-200/80 dark:bg-slate-600/70 rounded-full" aria-hidden />

                    {/* Gruppe 4: Export – einheitlich Secondary */}
                    <button onClick={exportResourceData} className={btnSecondary} title={t('resources.exportData')} aria-label={t('resources.export')}>
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">{t('resources.export') === 'resources.export' ? t('resources.exportData') : t('resources.export')}</span>
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Mobile-First Analytics Dashboard: 1 col on tablet (H2 log kpiCols:2 at 820px) */}
        <div data-tour="resources-overview" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{t('resources.totalResources')}</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{analyticsData.totalResources}</p>
              </div>
              <Users className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{t('resources.avgUtilization')}</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{analyticsData.averageUtilization.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{t('resources.available')}</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{analyticsData.availableResources}</p>
              </div>
              <Target className="h-5 w-5 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{t('resources.overallocated')}</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{analyticsData.overallocatedResources}</p>
              </div>
              <AlertCircle className="h-5 w-5 sm:h-8 sm:w-8 text-red-600 dark:text-red-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* AI Optimization Panel */}
        {showOptimization && (
          <div className="mb-6">
            <Suspense fallback={<SkeletonCard variant="stat" />}>
              <AIResourceOptimizer
                authToken={session?.access_token || ''}
                onOptimizationApplied={(_suggestionId) => {
                  // Refresh resources data when optimization is applied
                  fetchResources()
                }}
                className="max-h-96 overflow-y-auto"
              />
            </Suspense>
          </div>
        )}

        {/* Enhanced Mobile-First Filter Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portfolioFilter}
                    onChange={(e) => setPortfolioFilter(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <FolderOpen className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('resources.currentPortfolioOnly') || 'Current portfolio only'}</span>
                </label>
                {portfolioFilter && !currentPortfolioId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('resources.selectPortfolioHint') || 'Select a portfolio in the top bar.'}</p>
                )}
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Name or email..."
                    className="input-field w-full min-h-[44px] pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  {Array.from(new Set(resources.map(r => r.role).filter(Boolean))).map(role => (
                    <option key={role} value={role || ""}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Availability</label>
                <select
                  value={filters.availability_status}
                  onChange={(e) => handleFilterChange('availability_status', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="partially_allocated">Partially Allocated</option>
                  <option value="mostly_allocated">Mostly Allocated</option>
                  <option value="fully_allocated">Fully Allocated</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Locations</option>
                  {Array.from(new Set(resources.map(r => r.location).filter(Boolean))).map(location => (
                    <option key={location} value={location || ""}>{location}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Utilization Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={filters.utilization_range[0]}
                    onChange={(e) => handleFilterChange('utilization_range', [parseInt(e.target.value), filters.utilization_range[1]])}
                    className="input-field w-full min-h-[44px] p-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                    min="0"
                    max="200"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={filters.utilization_range[1]}
                    onChange={(e) => handleFilterChange('utilization_range', [filters.utilization_range[0], parseInt(e.target.value)])}
                    className="input-field w-full min-h-[44px] p-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm"
                    min="0"
                    max="200"
                    placeholder="Max"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full min-h-[44px] px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 font-medium"
                  title={t('resources.clearFilters')}
                  aria-label={t('resources.clearFilters')}
                >
                  {t('resources.clearFilters')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Charts - Mobile/Tablet responsive (min-w-0 avoids overflow on iPad) */}
        <Suspense fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
            <SkeletonChart variant="pie" height="h-64" />
            <SkeletonChart variant="bar" height="h-64" />
            <SkeletonChart variant="pie" height="h-64" />
          </div>
        }>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 min-w-0 overflow-hidden">
            <MobileOptimizedChart
              type="pie"
              data={analyticsData.utilizationDistribution}
              title={t('resources.utilizationDistribution')}
              dataKey="value"
              nameKey="name"
              colors={analyticsData.utilizationDistribution.map(item => item.color)}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={true}
              className="bg-white dark:bg-slate-800 shadow-sm min-w-0"
              onDataPointClick={(data) => {
                const utilizationRanges: Record<string, [number, number]> = {
                  underUtilized: [0, 50],
                  wellUtilized: [51, 80],
                  highlyUtilized: [81, 100],
                  overUtilized: [101, 200]
                }
                const range = data.rangeKey && utilizationRanges[data.rangeKey]
                if (range) {
                  handleFilterChange('utilization_range', range)
                  setShowFilters(true)
                }
              }}
            />

            <MobileOptimizedChart
              type="bar"
              data={analyticsData.topSkills.slice(0, 5)}
              title={t('resources.topSkills')}
              dataKey="value"
              nameKey="name"
              colors={['#3B82F6']}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={false}
              className="bg-white dark:bg-slate-800 shadow-sm min-w-0"
              onDataPointClick={(data) => {
                // Filter resources by clicked skill
                handleFilterChange('skills', [data.name])
                setShowFilters(true)
              }}
            />

            <MobileOptimizedChart
              type="pie"
              data={analyticsData.roleDistribution}
              title={t('resources.roleDistribution')}
              dataKey="value"
              nameKey="name"
              colors={analyticsData.roleDistribution.map(item => item.color)}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={true}
              className="bg-white dark:bg-slate-800 shadow-sm min-w-0"
              onDataPointClick={(data) => {
                handleFilterChange('role', (data as { roleKey?: string }).roleKey ?? 'all')
                setShowFilters(true)
              }}
            />
          </div>
        </Suspense>

        {/* Mobile-First Resource Views - Always render container with test ID */}
        <div data-testid="resources-grid">
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onViewDetails={(r) => setDetailResource(r as Resource | null)}
                  onEdit={(r) => { setEditError(null); setEditResource(r as Resource | null) }}
                  onDelete={(r) => { setDeleteError(null); setResourceToDelete(r as Resource | null) }}
                />
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <Suspense fallback={<SkeletonCard variant="resource" />}>
              <VirtualizedResourceTable 
                resources={filteredResources}
                height={600}
                itemHeight={80}
                onViewDetails={(r) => setDetailResource(r as Resource | null)}
              />
            </Suspense>
          )}

          {/* Enhanced Touch-Optimized Heatmap */}
          {viewMode === 'heatmap' && (
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Resource Utilization Heatmap</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-700 dark:text-slate-300">
                <span>Total: {filteredResources.length}</span>
                <span>Avg: {analyticsData.averageUtilization.toFixed(1)}%</span>
              </div>
            </div>
            
            {/* Touch-optimized heatmap grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredResources.map((resource) => {
                const utilizationLevel = 
                  resource.utilization_percentage <= 50 ? 'under' :
                  resource.utilization_percentage <= 80 ? 'optimal' :
                  resource.utilization_percentage <= 100 ? 'high' : 'over'
                
                const colorClasses = {
                  under: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 hover:bg-green-200 active:bg-green-300',
                  optimal: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 hover:bg-blue-200 active:bg-blue-300',
                  high: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 hover:bg-yellow-200 active:bg-yellow-300',
                  over: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 hover:bg-red-200 active:bg-red-300'
                }
                
                return (
                  <button
                    key={resource.id}
                    type="button"
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer touch-manipulation min-h-[120px] sm:min-h-[140px] ${colorClasses[utilizationLevel]}`}
                    title={`${resource.name} – in Kartenansicht öffnen`}
                    aria-label={`${resource.name}, ${resource.utilization_percentage.toFixed(0)}% Auslastung. In Kartenansicht öffnen.`}
                    style={{
                      transform: 'scale(1)',
                      touchAction: 'manipulation',
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.transform = 'scale(0.98)'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    onClick={() => setViewMode('cards')}
                  >
                    <div className="text-center h-full flex flex-col justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{resource.name}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-400 truncate">{resource.role || 'Unassigned'}</div>
                      </div>
                      
                      {/* Enhanced utilization display */}
                      <div className="my-2">
                        <div className="text-lg sm:text-xl font-bold">{resource.utilization_percentage.toFixed(0)}%</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              utilizationLevel === 'under' ? 'bg-green-500' :
                              utilizationLevel === 'optimal' ? 'bg-blue-500' :
                              utilizationLevel === 'high' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, resource.utilization_percentage)}%` }}
                          >
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
                        <div>{resource.available_hours.toFixed(1)}h available</div>
                        <div>{resource.current_projects.length} projects</div>
                      </div>
                      
                      {/* Skills preview */}
                      {(resource.skills ?? []).length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {(resource.skills ?? []).slice(0, 2).map((skill, index) => (
                              <span key={index} className="px-1 py-0.5 bg-white dark:bg-slate-800 bg-opacity-60 text-xs rounded truncate max-w-full">
                                {skill}
                              </span>
                            ))}
                            {(resource.skills ?? []).length > 2 && (
                              <span className="px-1 py-0.5 bg-white dark:bg-slate-800 bg-opacity-60 text-xs rounded">
                                +{(resource.skills ?? []).length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Availability indicator */}
                      <div className="mt-2">
                        <span 
                          className={`inline-block w-2 h-2 rounded-full ${
                            resource.can_take_more_work ? 'bg-green-500' : 'bg-red-500'
                          }`} 
                          title={resource.can_take_more_work ? 'Available for more work' : 'At capacity'}
                        >
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            
            {/* Enhanced mobile-friendly legend */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm">
                <div
                  className="flex items-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                >
                  <div className="w-4 h-4 bg-green-100 dark:bg-green-800 border border-green-300 dark:border-green-600 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-green-800 dark:text-green-300">{t('resources.underUtilized')}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">≤50% - {analyticsData.utilizationDistribution[0]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="w-4 h-4 bg-blue-100 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-blue-800 dark:text-blue-300">{t('resources.wellUtilized')}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">51-80% - {analyticsData.utilizationDistribution[1]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-yellow-800 dark:text-yellow-300">{t('resources.highlyUtilized')}</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">81-100% - {analyticsData.utilizationDistribution[2]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="w-4 h-4 bg-red-100 dark:bg-red-800 border border-red-300 dark:border-red-600 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-red-800 dark:text-red-300">{t('resources.overUtilized')}</div>
                    <div className="text-xs text-red-600 dark:text-red-400">{">"}100% - {analyticsData.utilizationDistribution[3]?.value || 0}</div>
                  </div>
                </div>
              </div>
              
              {/* Touch interaction hints */}
              <div className="bg-gray-50 dark:bg-slate-700 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-slate-100">{t('resources.utilizationInsights')}</h4>
                  <div className="text-xs text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-600 px-2 py-1 rounded border border-gray-200 dark:border-slate-500">
                    {t('resources.tapCardsForDetails')}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                  <div>
                    <span className="text-gray-700 dark:text-slate-300">{t('resources.mostUtilized')}:</span>
                    <div className="font-medium text-gray-900 dark:text-slate-100 truncate">
                      {filteredResources.reduce((max, resource) =>
                        resource.utilization_percentage > max.utilization_percentage ? resource : max,
                        filteredResources[0] || { name: 'N/A', utilization_percentage: 0 }
                      ).name} ({filteredResources.length > 0 ?
                        Math.max(...filteredResources.map(r => r.utilization_percentage)).toFixed(1) : 0}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-700 dark:text-slate-300">Least Utilized:</span>
                    <div className="font-medium text-gray-900 dark:text-slate-100 truncate">
                      {filteredResources.reduce((min, resource) =>
                        resource.utilization_percentage < min.utilization_percentage ? resource : min,
                        filteredResources[0] || { name: 'N/A', utilization_percentage: 100 }
                      ).name} ({filteredResources.length > 0 ?
                        Math.min(...filteredResources.map(r => r.utilization_percentage)).toFixed(1) : 0}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-700 dark:text-slate-300">Available Capacity:</span>
                    <div className="font-medium text-gray-900 dark:text-slate-100">
                      {filteredResources.reduce((sum, r) => sum + r.available_hours, 0).toFixed(1)}h total
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Enhanced Mobile-First Add Resource Modal – soft overlay, card look */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => { setAddError(null); setShowAddModal(false) }}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 sm:p-6 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('resources.addNewResource')}</h3>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setAddError(null)
                const formData = new FormData(e.currentTarget)
                const skillsInput = formData.get('skills') as string
                const skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(Boolean) : []
                
                try {
                  const roleValue = formData.get('role') as string
                  const hourlyRateValue = formData.get('hourly_rate') as string
                  const locationValue = formData.get('location') as string
                  
                  await createResource({
                    name: formData.get('name') as string,
                    email: formData.get('email') as string,
                    ...(roleValue && { role: roleValue }),
                    capacity: parseInt(formData.get('capacity') as string) || 40,
                    availability: parseInt(formData.get('availability') as string) || 100,
                    ...(hourlyRateValue && { hourly_rate: parseFloat(hourlyRateValue) }),
                    skills,
                    ...(locationValue && { location: locationValue })
                  })
                } catch (err) {
                  setAddError(err instanceof Error ? err.message : 'Failed to create resource')
                }
              }} className="p-4 sm:p-6 space-y-4"
              >
                {addError && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-3 py-2 text-sm" role="alert">
                    <p>{addError}</p>
                    {addError.toLowerCase().includes('already exists') && (
                      <p className="mt-1 text-amber-700 dark:text-amber-300">Use a different email or edit the existing resource.</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Role</label>
                  <input
                    type="text"
                    name="role"
                    placeholder="e.g. Developer, Designer, Manager"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Capacity (hrs/week)</label>
                    <input
                      type="number"
                      name="capacity"
                      defaultValue="40"
                      min="1"
                      max="80"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Availability (%)</label>
                    <input
                      type="number"
                      name="availability"
                      defaultValue="100"
                      min="0"
                      max="100"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    name="hourly_rate"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Skills</label>
                  <input
                    type="text"
                    name="skills"
                    placeholder="e.g. React, Python, Design (comma-separated)"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g. Berlin, Remote"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setAddError(null); setShowAddModal(false) }}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium"
                  >
                    {t('resources.addResource')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Resource Confirmation Modal – app-specific, same styling as Add/Edit */}
        {resourceToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => { setDeleteError(null); setResourceToDelete(null) }}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-md">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Ressource löschen</h3>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-gray-700 dark:text-slate-300">
                  &quot;{resourceToDelete.name}&quot; ({resourceToDelete.email}) wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                {deleteError && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 text-sm" role="alert">
                    {deleteError}
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setDeleteError(null); setResourceToDelete(null) }}
                  disabled={deleteInProgress}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!resourceToDelete) return
                    setDeleteError(null)
                    setDeleteInProgress(true)
                    try {
                      await deleteResource(resourceToDelete)
                      setResourceToDelete(null)
                    } catch (err) {
                      setDeleteError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
                    } finally {
                      setDeleteInProgress(false)
                    }
                  }}
                  disabled={deleteInProgress}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 disabled:opacity-50 font-medium"
                >
                  {deleteInProgress ? 'Wird gelöscht…' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Resource Modal – same overlay/card styling, form pre-filled */}
        {editResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => { setEditResource(null); setEditError(null) }}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 sm:p-6 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Edit Resource</h3>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setEditError(null)
                  const formData = new FormData(e.currentTarget)
                  const skillsInput = formData.get('skills') as string
                  const skills = skillsInput ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean) : []
                  try {
                    const roleValue = formData.get('role') as string
                    const hourlyRateValue = formData.get('hourly_rate') as string
                    const locationValue = formData.get('location') as string
                    await updateResource(editResource.id, {
                      name: formData.get('name') as string,
                      email: formData.get('email') as string,
                      ...(roleValue && { role: roleValue }),
                      capacity: parseInt(formData.get('capacity') as string) || 40,
                      availability: parseInt(formData.get('availability') as string) || 100,
                      ...(hourlyRateValue && { hourly_rate: parseFloat(hourlyRateValue) }),
                      skills,
                      ...(locationValue && { location: locationValue }),
                    })
                  } catch (error) {
                    setEditError(error instanceof Error ? error.message : 'Failed to update resource')
                  }
                }}
                className="p-4 sm:p-6 space-y-4"
              >
                {editError && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 text-sm" role="alert">
                    {editError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editResource.name}
                    className="w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={editResource.email}
                    className="w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Role</label>
                  <input
                    type="text"
                    name="role"
                    defaultValue={editResource.role ?? ''}
                    placeholder="e.g. Developer, Designer, Manager"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Capacity (hrs/week)</label>
                    <input
                      type="number"
                      name="capacity"
                      defaultValue={editResource.capacity ?? 40}
                      min="1"
                      max="80"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Availability (%)</label>
                    <input
                      type="number"
                      name="availability"
                      defaultValue={editResource.availability ?? 100}
                      min="0"
                      max="100"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    name="hourly_rate"
                    step="0.01"
                    min="0"
                    defaultValue={editResource.hourly_rate ?? ''}
                    placeholder="Optional"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Skills</label>
                  <input
                    type="text"
                    name="skills"
                    defaultValue={Array.isArray(editResource.skills) ? editResource.skills.join(', ') : ''}
                    placeholder="e.g. React, Python, Design (comma-separated)"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editResource.location ?? ''}
                    placeholder="e.g. Berlin, Remote"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setEditResource(null); setEditError(null) }}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium"
                  >
                    Save changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Resource Detail Modal – styling aligned with app (soft overlay, card look) */}
        {detailResource && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-detail-title"
          >
            <div
              className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setDetailResource(null)}
            />
            <div
              className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
                <h2 id="resource-detail-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">Resource Details</h2>
                <button
                  type="button"
                  onClick={() => setDetailResource(null)}
                  className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Name</div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Email</div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.email}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Role</div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.role || '—'}</div>
                </div>
                {detailResource.location && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Location</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.location}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Capacity</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.capacity} h/week</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Availability</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">{detailResource.availability}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Utilization</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">{(detailResource.utilization_percentage ?? 0).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Available hours</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">{(detailResource.available_hours ?? 0).toFixed(1)} h</div>
                  </div>
                </div>
                {detailResource.hourly_rate != null && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Hourly rate</div>
                    <div className="font-medium text-gray-900 dark:text-slate-100">${detailResource.hourly_rate}/hr</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Status</div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{(detailResource.availability_status ?? '').replace(/_/g, ' ')}</div>
                </div>
                {(detailResource.skills ?? []).length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Skills</div>
                    <div className="flex flex-wrap gap-1">
                      {(detailResource.skills ?? []).map((skill, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Current projects</div>
                  <div className="font-medium text-gray-900 dark:text-slate-100">{(detailResource.current_projects ?? []).length}</div>
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDetailResource(null)}
                  className="w-full min-h-[44px] px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <GuidedTour
        steps={resourcesTourSteps}
        isOpen={isOpen}
        onClose={closeTour}
        onComplete={completeTour}
        tourId="resources-v1"
      />
    </AppLayout>
  )
}