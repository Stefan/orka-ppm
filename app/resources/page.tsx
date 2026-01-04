'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState, useMemo } from 'react'
import { 
  Users, Plus, Search, Filter, TrendingUp, AlertCircle, Eye, Settings,
  BarChart3, PieChart, Calendar, Clock, DollarSign, Target, Zap,
  ChevronDown, ChevronUp, RefreshCw, Download, Bell, MapPin
} from 'lucide-react'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'

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

interface OptimizationSuggestion {
  resource_id: string
  resource_name: string
  match_score: number
  matching_skills: string[]
  availability: number
  reasoning: string
}

export default function Resources() {
  const { session } = useAuth()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'heatmap'>('cards')
  const [showFilters, setShowFilters] = useState(false)
  const [showOptimization, setShowOptimization] = useState(false)
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([])
  const [filters, setFilters] = useState<ResourceFilters>({
    search: '',
    role: 'all',
    availability_status: 'all',
    skills: [],
    location: 'all',
    utilization_range: [0, 100]
  })

  // Filtered resources based on current filters
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Search filter
      if (filters.search && !resource.name.toLowerCase().includes(filters.search.toLowerCase()) &&
          !resource.email.toLowerCase().includes(filters.search.toLowerCase())) {
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
  }, [resources, filters])

  // Analytics data
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
  }, [resources])

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
      
      const response = await fetch(getApiUrl('/resources/'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.status}`)
      }
      
      const data = await response.json()
      setResources(Array.isArray(data) ? data as Resource[] : [])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchOptimizationSuggestions() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/ai/resource-optimizer'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          optimization_goals: ['skill_match', 'availability', 'cost_efficiency'],
          time_horizon_days: 30
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setOptimizationSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch optimization suggestions:', error)
    }
  }

  const handleFilterChange = (filterType: keyof ResourceFilters, value: any) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      role: 'all',
      availability_status: 'all',
      skills: [],
      location: 'all',
      utilization_range: [0, 100]
    })
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
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading resources</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Enhanced Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Resource Management</h1>
              {analyticsData.overallocatedResources > 0 && (
                <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {analyticsData.overallocatedResources} Overallocated
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <span>{filteredResources.length} of {resources.length} resources</span>
              <span>Avg. utilization: {analyticsData.averageUtilization.toFixed(1)}%</span>
              <span>{analyticsData.availableResources} available for new work</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : viewMode === 'table' ? 'heatmap' : 'cards')}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {viewMode === 'cards' ? <BarChart3 className="h-4 w-4 mr-2" /> : 
               viewMode === 'table' ? <PieChart className="h-4 w-4 mr-2" /> : 
               <Users className="h-4 w-4 mr-2" />}
              {viewMode === 'cards' ? 'Table View' : viewMode === 'table' ? 'Heatmap' : 'Cards'}
            </button>
            
            <button
              onClick={() => {
                setShowOptimization(!showOptimization)
                if (!showOptimization) fetchOptimizationSuggestions()
              }}
              className="flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              <Zap className="h-4 w-4 mr-2" />
              AI Optimize
            </button>
            
            <button
              onClick={exportResourceData}
              className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </button>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Resources</p>
                <p className="text-2xl font-bold text-blue-600">{analyticsData.totalResources}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Utilization</p>
                <p className="text-2xl font-bold text-green-600">{analyticsData.averageUtilization.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-purple-600">{analyticsData.availableResources}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overallocated</p>
                <p className="text-2xl font-bold text-red-600">{analyticsData.overallocatedResources}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* AI Optimization Panel */}
        {showOptimization && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-900">AI Resource Optimization Suggestions</h3>
              <button
                onClick={() => setShowOptimization(false)}
                className="text-purple-600 hover:text-purple-800"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
            
            {optimizationSuggestions.length > 0 ? (
              <div className="space-y-3">
                {optimizationSuggestions.slice(0, 5).map((suggestion, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{suggestion.resource_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{suggestion.reasoning}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Match Score: {(suggestion.match_score * 100).toFixed(0)}%</span>
                          <span>Available: {suggestion.availability}h/week</span>
                          <span>Skills: {suggestion.matching_skills.join(', ')}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
                          Apply
                        </button>
                        <button className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <p className="text-purple-700">No optimization suggestions available at this time.</p>
              </div>
            )}
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Name or email..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
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
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    max="200"
                  />
                  <input
                    type="number"
                    value={filters.utilization_range[1]}
                    onChange={(e) => handleFilterChange('utilization_range', [filters.utilization_range[0], parseInt(e.target.value)])}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    max="200"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilization Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie
                  data={analyticsData.utilizationDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
                >
                  {analyticsData.utilizationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Skills</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analyticsData.topSkills.slice(0, 5)}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie
                  data={analyticsData.roleDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {analyticsData.roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resource Display */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource) => (
              <div key={resource.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{resource.name}</h3>
                    <p className="text-sm text-gray-600">{resource.role || 'No role specified'}</p>
                    <p className="text-sm text-gray-500">{resource.email}</p>
                    {resource.location && (
                      <div className="flex items-center mt-1 text-sm text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        {resource.location}
                      </div>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    resource.availability_status === 'available' ? 'bg-green-100 text-green-800' :
                    resource.availability_status === 'partially_allocated' ? 'bg-yellow-100 text-yellow-800' :
                    resource.availability_status === 'mostly_allocated' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {resource.availability_status.replace('_', ' ')}
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Utilization</span>
                    <span>{resource.utilization_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        resource.utilization_percentage <= 70 ? 'bg-green-500' :
                        resource.utilization_percentage <= 90 ? 'bg-yellow-500' :
                        resource.utilization_percentage <= 100 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, resource.utilization_percentage)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Available Hours:</span>
                    <span className="font-medium">{resource.available_hours.toFixed(1)}h/week</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Current Projects:</span>
                    <span className="font-medium">{resource.current_projects.length}</span>
                  </div>
                  {resource.hourly_rate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hourly Rate:</span>
                      <span className="font-medium">${resource.hourly_rate}/hr</span>
                    </div>
                  )}
                </div>

                {resource.skills.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {resource.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {resource.skills.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{resource.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <button className="text-sm text-blue-600 hover:text-blue-800">View Details</button>
                  <button className="text-sm text-gray-600 hover:text-gray-800">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'table' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projects</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResources.map((resource) => (
                    <tr key={resource.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                          <div className="text-sm text-gray-500">{resource.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {resource.role || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 mr-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  resource.utilization_percentage <= 70 ? 'bg-green-500' :
                                  resource.utilization_percentage <= 90 ? 'bg-yellow-500' :
                                  resource.utilization_percentage <= 100 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, resource.utilization_percentage)}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-sm text-gray-900">{resource.utilization_percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {resource.available_hours.toFixed(1)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {resource.current_projects.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {resource.skills.slice(0, 2).map((skill, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {skill}
                            </span>
                          ))}
                          {resource.skills.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              +{resource.skills.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          resource.availability_status === 'available' ? 'bg-green-100 text-green-800' :
                          resource.availability_status === 'partially_allocated' ? 'bg-yellow-100 text-yellow-800' :
                          resource.availability_status === 'mostly_allocated' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {resource.availability_status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'heatmap' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization Heatmap</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredResources.map((resource) => (
                <div
                  key={resource.id}
                  className={`p-4 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${
                    resource.utilization_percentage <= 50 ? 'bg-green-100 border-green-300' :
                    resource.utilization_percentage <= 80 ? 'bg-blue-100 border-blue-300' :
                    resource.utilization_percentage <= 100 ? 'bg-yellow-100 border-yellow-300' :
                    'bg-red-100 border-red-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
                    <div className="text-xs text-gray-600 truncate">{resource.role || 'Unassigned'}</div>
                    <div className="text-lg font-bold mt-2">{resource.utilization_percentage.toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">{resource.available_hours.toFixed(1)}h available</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2"></div>
                <span>Under-utilized (≤50%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded mr-2"></div>
                <span>Well-utilized (51-80%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mr-2"></div>
                <span>Highly-utilized (81-100%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mr-2"></div>
                <span>Over-utilized ({">"}100%)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}