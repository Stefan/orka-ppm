'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Search, Filter, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import AppLayout from '../../components/AppLayout'

interface Resource {
  id: string
  name: string
  email: string
  role?: string
  capacity: number
  availability: number
  hourly_rate?: number
  skills: string[]
  location?: string
  current_projects?: string[]
  created_at: string
}

interface UtilizationData {
  id: string
  name: string
  capacity: number
  availability: number
  current_allocation: number
  utilization_percentage: number
  status: 'available' | 'medium' | 'high' | 'overbooked'
  skills: string[]
}

interface AllocationSuggestion {
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
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [capacity, setCapacity] = useState('')
  const [availability, setAvailability] = useState('100')
  const [hourlyRate, setHourlyRate] = useState('')
  const [skills, setSkills] = useState('')
  const [location, setLocation] = useState('')
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [minAvailability, setMinAvailability] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Allocation suggestion states
  const [requiredSkills, setRequiredSkills] = useState('')
  const [suggestions, setSuggestions] = useState<AllocationSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (session) {
      fetchResources()
      fetchUtilizationData()
    }
  }, [session])

  async function fetchResources() {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resources/`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!response.ok) throw new Error('Fetch failed')
      const data = await response.json()
      setResources(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUtilizationData() {
    if (!session) return
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resources/utilization`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      if (!response.ok) throw new Error('Utilization fetch failed')
      const data = await response.json()
      setUtilizationData(data)
    } catch (err) {
      console.error('Failed to fetch utilization data:', err)
    }
  }

  async function searchResources() {
    if (!session) return
    try {
      const searchParams = {
        skills: skillFilter ? skillFilter.split(',').map(s => s.trim()) : undefined,
        role: roleFilter || undefined,
        min_availability: minAvailability ? parseInt(minAvailability) : undefined
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resources/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(searchParams)
      })
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      setResources(data)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function getAllocationSuggestions() {
    if (!session || !requiredSkills) return
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resources/allocation-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          project_id: "00000000-0000-0000-0000-000000000000", // Placeholder
          required_skills: requiredSkills.split(',').map(s => s.trim())
        })
      })
      if (!response.ok) throw new Error('Suggestions fetch failed')
      const data = await response.json()
      setSuggestions(data)
      setShowSuggestions(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function createResource(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/resources/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name,
          email,
          role: role || undefined,
          capacity: parseInt(capacity),
          availability: parseInt(availability),
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          skills: skills.split(',').map(s => s.trim()),
          location: location || undefined
        })
      })
      if (!response.ok) throw new Error('Create failed')
      
      // Reset form
      setName('')
      setEmail('')
      setRole('')
      setCapacity('')
      setAvailability('100')
      setHourlyRate('')
      setSkills('')
      setLocation('')
      
      fetchResources()
      fetchUtilizationData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Filter resources based on search term
  const filteredResources = resources.filter(resource =>
    resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Get color for utilization status
  const getUtilizationColor = (status: string) => {
    switch (status) {
      case 'available': return '#10B981' // green
      case 'medium': return '#F59E0B' // yellow
      case 'high': return '#EF4444' // red
      case 'overbooked': return '#7C2D12' // dark red
      default: return '#6B7280' // gray
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Resource Management</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search resources by name, email, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <input
              type="text"
              placeholder="Filter by skills (comma-separated)"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Min availability %"
              value={minAvailability}
              onChange={(e) => setMinAvailability(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={searchResources}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* Utilization Heatmap */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Resource Utilization Overview
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={utilizationData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [`${value}%`, 'Utilization']}
              labelFormatter={(label) => `Resource: ${label}`}
            />
            <Bar dataKey="utilization_percentage" radius={[4, 4, 0, 0]}>
              {utilizationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getUtilizationColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center space-x-6 mt-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span>Available (&lt;60%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
            <span>Medium (60-80%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
            <span>High (80-100%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-900 rounded mr-2"></div>
            <span>Overbooked (&gt;100%)</span>
          </div>
        </div>
      </div>

      {/* Allocation Suggestions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Resource Allocation Suggestions
        </h2>
        <div className="flex space-x-4 mb-4">
          <input
            type="text"
            placeholder="Required skills (comma-separated)"
            value={requiredSkills}
            onChange={(e) => setRequiredSkills(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={getAllocationSuggestions}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Get Suggestions
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.resource_id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{suggestion.resource_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{suggestion.reasoning}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {suggestion.matching_skills.map(skill => (
                        <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      {Math.round(suggestion.match_score * 100)}% Match
                    </div>
                    <div className="text-sm text-gray-500">
                      {suggestion.availability}% Available
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Resource Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Resources ({filteredResources.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Availability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResources.map((resource) => {
                const utilization = utilizationData.find(u => u.id === resource.id)
                return (
                  <tr key={resource.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                        <div className="text-sm text-gray-500">{resource.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.role || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.capacity}h/week
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900">{resource.availability}%</div>
                        {resource.availability < 50 && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 ml-2" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {resource.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {utilization && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          utilization.status === 'available' ? 'bg-green-100 text-green-800' :
                          utilization.status === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          utilization.status === 'high' ? 'bg-red-100 text-red-800' :
                          'bg-red-200 text-red-900'
                        }`}>
                          {utilization.status}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Resource Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-6">Add New Resource</h2>
        <form onSubmit={createResource} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Senior Developer, Project Manager"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (hours/week) *</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min="1"
              max="80"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Availability (%)</label>
            <input
              type="number"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate</label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g., 75.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Skills (comma-separated) *</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g., React, TypeScript, Node.js"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., New York, Remote"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <button 
              type="submit" 
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create Resource
            </button>
          </div>
        </form>
      </div>
      </div>
    </AppLayout>
  )
}