'use client'

import { useEffect, useState, useMemo, useDeferredValue, useReducer, lazy, Suspense } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { Users, Plus, Search, Filter, TrendingUp, AlertCircle, BarChart3, PieChart as PieChartIcon, Target, Zap, RefreshCw, Download, MapPin, RotateCcw } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import ResourceCard from './components/ResourceCard'
import ResourceActionButtons from '../../components/resources/ResourceActionButtons'
import { getApiUrl } from '../../lib/api/client'
import { SkeletonCard, SkeletonChart } from '../../components/ui/skeletons'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslations } from '@/lib/i18n/context'

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
  const { t } = useTranslations()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'heatmap'>('cards')
  const [showFilters, setShowFilters] = useState(false)
  const [showOptimization, setShowOptimization] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

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
        const hasRequiredSkills = filters.skills.some(skill => 
          resource.skills.some(resourceSkill => 
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
      { name: 'Under-utilized (0-50%)', value: resources.filter(r => r.utilization_percentage <= 50).length, color: '#10B981' },
      { name: 'Well-utilized (51-80%)', value: resources.filter(r => r.utilization_percentage > 50 && r.utilization_percentage <= 80).length, color: '#3B82F6' },
      { name: 'Highly-utilized (81-100%)', value: resources.filter(r => r.utilization_percentage > 80 && r.utilization_percentage <= 100).length, color: '#F59E0B' },
      { name: 'Over-utilized ({">"}100%)', value: resources.filter(r => r.utilization_percentage > 100).length, color: '#EF4444' }
    ]

    const skillsDistribution = resources.reduce((acc, resource) => {
      resource.skills.forEach(skill => {
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
      name: role,
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
  }, [resources, deferredFilters])

  useEffect(() => {
    if (session) {
      fetchResources()
    }
  }, [session])

  async function fetchResources() {
    setLoading(true)
    setError(null)
    try {
      if (!session?.access_token) throw new Error('Not authenticated')
      
      const response = await fetch(getApiUrl('/resources'), {
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
        const errorData = await response.json()
        throw new Error(errorData.detail || `Failed to create resource: ${response.status}`)
      }
      
      const newResource = await response.json()
      setResources(prev => [...prev, newResource])
      setShowAddModal(false)
      return newResource
    } catch (error: unknown) {
      console.error('Error creating resource:', error)
      throw error instanceof Error ? error : new Error('Unknown error creating resource')
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t('resources.errorLoading')}</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div data-testid="resources-page" className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Enhanced Mobile-First Header */}
        <div data-testid="resources-header" className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col space-y-2">
                <h1 data-testid="resources-title" className="text-2xl sm:text-3xl font-bold text-gray-900">{t('resources.title')}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  {analyticsData.overallocatedResources > 0 && (
                    <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span>{analyticsData.overallocatedResources} {t('resources.overallocated')}</span>
                    </div>
                  )}
                  {autoRefresh && (
                    <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin flex-shrink-0" />
                      <span>{t('resources.live')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
                <span>{filteredResources.length} {t('resources.of')} {resources.length} {t('nav.resources').toLowerCase()}</span>
                <span>{t('resources.avg')}: {analyticsData.averageUtilization.toFixed(1)}%</span>
                <span>{analyticsData.availableResources} {t('resources.available')}</span>
                {lastRefresh && (
                  <span className="hidden sm:inline">{t('dashboard.updated')}: {lastRefresh.toLocaleTimeString()}</span>
                )}
              </div>
            </div>
            
            {/* Mobile-Optimized Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Resource Action Buttons with RBAC */}
              <ResourceActionButtons
                onAssignResource={() => {/* Handle assign */}}
                onScheduleResource={() => {/* Handle schedule */}}
                variant="compact"
              />
              
              {/* Combined Refresh Controls */}
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 gap-1">
                {/* Manual Refresh Button */}
                <button
                  onClick={() => {
                    fetchResources()
                  }}
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors text-sm font-medium"
                  title="Daten jetzt aktualisieren"
                  aria-label="Daten jetzt aktualisieren"
                >
                  <RotateCcw className="h-5 w-5" />
                  <span className="hidden sm:inline ml-2">Refresh</span>
                </button>

                {/* Auto-Refresh Toggle */}
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                    autoRefresh
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={autoRefresh ? 'Auto-Aktualisierung deaktivieren' : 'Auto-Aktualisierung aktivieren (30s)'}
                  aria-label={autoRefresh ? 'Auto-Aktualisierung deaktivieren' : 'Auto-Aktualisierung aktivieren (30s)'}
                >
                  <RefreshCw className={`h-5 w-5 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline ml-2">Auto</span>
                </button>
              </div>
              
              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : viewMode === 'table' ? 'heatmap' : 'cards')}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 active:bg-gray-300 text-sm font-medium"
                title={viewMode === 'cards' ? 'Zur Tabellenansicht wechseln' : viewMode === 'table' ? 'Zur Heatmap-Ansicht wechseln' : 'Zur Kartenansicht wechseln'}
                aria-label={viewMode === 'cards' ? 'Zur Tabellenansicht wechseln' : viewMode === 'table' ? 'Zur Heatmap-Ansicht wechseln' : 'Zur Kartenansicht wechseln'}
              >
                {viewMode === 'cards' ? <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" /> : 
                 viewMode === 'table' ? <PieChartIcon className="h-4 w-4 mr-2 flex-shrink-0" /> : 
                 <Users className="h-4 w-4 mr-2 flex-shrink-0" />}
                <span className="hidden sm:inline">
                  {viewMode === 'cards' ? 'Table' : viewMode === 'table' ? 'Heatmap' : 'Cards'}
                </span>
              </button>
              
              <button
                onClick={() => {
                  setShowOptimization(!showOptimization)
                }}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  showOptimization
                    ? 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300'
                }`}
                title={showOptimization ? 'KI-Optimierung ausblenden' : 'KI-Optimierung anzeigen'}
                aria-label={showOptimization ? 'KI-Optimierung ausblenden' : 'KI-Optimierung anzeigen'}
              >
                <Zap className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">AI Optimize</span>
                <span className="sm:hidden">AI</span>
              </button>
              
              <button
                onClick={exportResourceData}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:bg-green-300 text-sm font-medium"
                  title="Ressourcendaten exportieren"
                aria-label="Ressourcendaten exportieren"
              >
                <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Export</span>
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  showFilters
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
                }`}
                title={showFilters ? 'Filter-Optionen ausblenden' : 'Filter-Optionen anzeigen'}
                aria-label={showFilters ? 'Filter-Optionen ausblenden' : 'Filter-Optionen anzeigen'}
              >
                <Filter className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium"
                title="Ressource hinzufügen"
                aria-label="Ressource hinzufügen"
              >
                <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Add Resource</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-First Analytics Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Total Resources</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">{analyticsData.totalResources}</p>
              </div>
              <Users className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Avg. Utilization</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{analyticsData.averageUtilization.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Available</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{analyticsData.availableResources}</p>
              </div>
              <Target className="h-5 w-5 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Overallocated</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{analyticsData.overallocatedResources}</p>
              </div>
              <AlertCircle className="h-5 w-5 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
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
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Name or email..."
                    className="input-field w-full min-h-[44px] pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  {Array.from(new Set(resources.map(r => r.role).filter(Boolean))).map(role => (
                    <option key={role} value={role || ""}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={filters.availability_status}
                  onChange={(e) => handleFilterChange('availability_status', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="partially_allocated">Partially Allocated</option>
                  <option value="mostly_allocated">Mostly Allocated</option>
                  <option value="fully_allocated">Fully Allocated</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="w-full min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Locations</option>
                  {Array.from(new Set(resources.map(r => r.location).filter(Boolean))).map(location => (
                    <option key={location} value={location || ""}>{location}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Utilization Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={filters.utilization_range[0]}
                    onChange={(e) => handleFilterChange('utilization_range', [parseInt(e.target.value), filters.utilization_range[1]])}
                    className="input-field w-full min-h-[44px] p-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    max="200"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={filters.utilization_range[1]}
                    onChange={(e) => handleFilterChange('utilization_range', [filters.utilization_range[0], parseInt(e.target.value)])}
                    className="input-field w-full min-h-[44px] p-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    max="200"
                    placeholder="Max"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full min-h-[44px] px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 active:bg-gray-300 font-medium"
                  title="Alle Filter zurücksetzen"
                  aria-label="Alle Filter zurücksetzen"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Charts - Mobile Optimized */}
        <Suspense fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonChart variant="pie" height="h-64" />
            <SkeletonChart variant="bar" height="h-64" />
            <SkeletonChart variant="pie" height="h-64" />
          </div>
        }>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MobileOptimizedChart
              type="pie"
              data={analyticsData.utilizationDistribution}
              title="Utilization Distribution"
              dataKey="value"
              nameKey="name"
              colors={analyticsData.utilizationDistribution.map(item => item.color)}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={true}
              className="bg-white shadow-sm"
              onDataPointClick={(data) => {
                // Filter resources based on clicked utilization category
                const utilizationRanges = {
                  'Under-utilized (0-50%)': [0, 50],
                  'Well-utilized (51-80%)': [51, 80],
                  'Highly-utilized (81-100%)': [81, 100],
                  'Over-utilized (>100%)': [101, 200]
                }
                const range = utilizationRanges[data.name as keyof typeof utilizationRanges]
                if (range) {
                  handleFilterChange('utilization_range', range)
                  setShowFilters(true)
                }
              }}
            />

            <MobileOptimizedChart
              type="bar"
              data={analyticsData.topSkills.slice(0, 5)}
              title="Top Skills"
              dataKey="value"
              nameKey="name"
              colors={['#3B82F6']}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={false}
              className="bg-white shadow-sm"
              onDataPointClick={(data) => {
                // Filter resources by clicked skill
                handleFilterChange('skills', [data.name])
                setShowFilters(true)
              }}
            />

            <MobileOptimizedChart
              type="pie"
              data={analyticsData.roleDistribution}
              title="Role Distribution"
              dataKey="value"
              nameKey="name"
              colors={analyticsData.roleDistribution.map(item => item.color)}
              height={250}
              enablePinchZoom={true}
              enablePan={true}
              enableExport={true}
              showLegend={true}
              className="bg-white shadow-sm"
              onDataPointClick={(data) => {
                // Filter resources by clicked role
                handleFilterChange('role', data.name === 'Unassigned' ? 'all' : data.name)
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
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <Suspense fallback={<SkeletonCard variant="resource" />}>
              <VirtualizedResourceTable 
                resources={filteredResources}
                height={600}
                itemHeight={80}
              />
            </Suspense>
          )}

          {/* Enhanced Touch-Optimized Heatmap */}
          {viewMode === 'heatmap' && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
              <h3 className="text-lg font-semibold text-gray-900">Resource Utilization Heatmap</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-700">
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
                  under: 'bg-green-100 border-green-300 hover:bg-green-200 active:bg-green-300',
                  optimal: 'bg-blue-100 border-blue-300 hover:bg-blue-200 active:bg-blue-300',
                  high: 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200 active:bg-yellow-300',
                  over: 'bg-red-100 border-red-300 hover:bg-red-200 active:bg-red-300'
                }
                
                return (
                  <div
                    key={resource.id}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer touch-manipulation min-h-[120px] sm:min-h-[140px] ${colorClasses[utilizationLevel]}`}
                    title={`${resource.name} - ${resource.role || 'Unassigned'} - ${resource.utilization_percentage.toFixed(1)}% utilized`}
                    style={{ 
                      transform: 'scale(1)',
                      touchAction: 'manipulation'
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.transform = 'scale(0.98)'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <div className="text-center h-full flex flex-col justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
                        <div className="text-xs text-gray-700 truncate">{resource.role || 'Unassigned'}</div>
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
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>{resource.available_hours.toFixed(1)}h available</div>
                        <div>{resource.current_projects.length} projects</div>
                      </div>
                      
                      {/* Skills preview */}
                      {resource.skills.length > 0 && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {resource.skills.slice(0, 2).map((skill, index) => (
                              <span key={index} className="px-1 py-0.5 bg-white bg-opacity-60 text-xs rounded truncate max-w-full">
                                {skill}
                              </span>
                            ))}
                            {resource.skills.length > 2 && (
                              <span className="px-1 py-0.5 bg-white bg-opacity-60 text-xs rounded">
                                +{resource.skills.length - 2}
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
                  </div>
                )
              })}
            </div>
            
            {/* Enhanced mobile-friendly legend */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm">
                <div className="flex items-center p-2 rounded-lg bg-green-50">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-green-800">Under-utilized</div>
                    <div className="text-xs text-green-600">≤50% - {analyticsData.utilizationDistribution[0]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-blue-50">
                  <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-blue-800">Well-utilized</div>
                    <div className="text-xs text-blue-600">51-80% - {analyticsData.utilizationDistribution[1]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-yellow-50">
                  <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-yellow-800">Highly-utilized</div>
                    <div className="text-xs text-yellow-600">81-100% - {analyticsData.utilizationDistribution[2]?.value || 0}</div>
                  </div>
                </div>
                <div className="flex items-center p-2 rounded-lg bg-red-50">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mr-2 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <div className="font-medium text-red-800">Over-utilized</div>
                    <div className="text-xs text-red-600">{">"}100% - {analyticsData.utilizationDistribution[3]?.value || 0}</div>
                  </div>
                </div>
              </div>
              
              {/* Touch interaction hints */}
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Utilization Insights</h4>
                  <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    Tap cards for details
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Most Utilized:</span>
                    <div className="font-medium text-gray-900 truncate">
                      {filteredResources.reduce((max, resource) => 
                        resource.utilization_percentage > max.utilization_percentage ? resource : max, 
                        filteredResources[0] || { name: 'N/A', utilization_percentage: 0 }
                      ).name} ({filteredResources.length > 0 ? 
                        Math.max(...filteredResources.map(r => r.utilization_percentage)).toFixed(1) : 0}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Least Utilized:</span>
                    <div className="font-medium text-gray-900 truncate">
                      {filteredResources.reduce((min, resource) => 
                        resource.utilization_percentage < min.utilization_percentage ? resource : min, 
                        filteredResources[0] || { name: 'N/A', utilization_percentage: 100 }
                      ).name} ({filteredResources.length > 0 ? 
                        Math.min(...filteredResources.map(r => r.utilization_percentage)).toFixed(1) : 0}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Available Capacity:</span>
                    <div className="font-medium text-gray-900">
                      {filteredResources.reduce((sum, r) => sum + r.available_hours, 0).toFixed(1)}h total
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Enhanced Mobile-First Add Resource Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New Resource</h3>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault()
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
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Failed to create resource')
                }
              }} className="p-4 sm:p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <input
                    type="text"
                    name="role"
                    placeholder="e.g. Developer, Designer, Manager"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (hrs/week)</label>
                    <input
                      type="number"
                      name="capacity"
                      defaultValue="40"
                      min="1"
                      max="80"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability (%)</label>
                    <input
                      type="number"
                      name="availability"
                      defaultValue="100"
                      min="0"
                      max="100"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    name="hourly_rate"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                  <input
                    type="text"
                    name="skills"
                    placeholder="e.g. React, Python, Design (comma-separated)"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g. Berlin, Remote"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 active:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium"
                  >
                    Add Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}