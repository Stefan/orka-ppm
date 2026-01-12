'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { ThumbsUp, ThumbsDown, Bug, Lightbulb, Filter, Bell, AlertCircle, User, Calendar, Tag, X, TrendingUp } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl } from '../../lib/api/client'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { AdaptiveGrid } from '../../components/ui/molecules/AdaptiveGrid'
import { TouchButton } from '../../components/ui/atoms/TouchButton'

interface FeatureRequest {
  id: string
  title: string
  description: string
  status: 'submitted' | 'under_review' | 'approved' | 'in_development' | 'completed' | 'rejected'
  priority: 'low' | 'medium' | 'high'
  votes: number
  upvotes: number
  downvotes: number
  submitted_by: string
  assigned_to?: string
  tags: string[]
  created_at: string
  updated_at: string
  completed_at?: string
}

interface BugReport {
  id: string
  title: string
  description: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  status: 'submitted' | 'confirmed' | 'in_progress' | 'resolved' | 'closed' | 'duplicate'
  priority: 'low' | 'medium' | 'high' | 'critical'
  severity: 'minor' | 'major' | 'critical' | 'blocker'
  category: 'ui' | 'functionality' | 'performance' | 'security' | 'data' | 'integration'
  submitted_by: string
  assigned_to?: string
  created_at: string
  updated_at: string
  resolved_at?: string
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  related_id?: string
  related_type?: string
  read: boolean
  created_at: string
  read_at?: string
}

export default function Feedback() {
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState<'features' | 'bugs'>('features')
  const [features, setFeatures] = useState<FeatureRequest[]>([])
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [showFeatureForm, setShowFeatureForm] = useState(false)
  const [showBugForm, setShowBugForm] = useState(false)
  const [featureForm, setFeatureForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    tags: [] as string[]
  })
  const [bugForm, setBugForm] = useState({
    title: '',
    description: '',
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    priority: 'medium',
    severity: 'minor',
    category: 'functionality'
  })
  
  // Filter states
  const [featureFilters, setFeatureFilters] = useState({
    status: '',
    priority: '',
    search: ''
  })
  const [bugFilters, setBugFilters] = useState({
    status: '',
    priority: '',
    search: ''
  })

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchFeatures(),
        fetchBugs(),
        fetchNotifications()
      ])
    } catch (error) {
      setError('Failed to load feedback data')
    } finally {
      setLoading(false)
    }
  }

  const fetchFeatures = async () => {
    if (!session?.access_token) return
    
    try {
      const params = new URLSearchParams()
      if (featureFilters.status) params.append('status_filter', featureFilters.status)
      if (featureFilters.priority) params.append('priority_filter', featureFilters.priority)
      
      // Only append the '?' and params if there are actually parameters
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(getApiUrl(`/feedback/features${queryString}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setFeatures(data)
      } else {
        console.error(`Failed to fetch features: ${response.status} ${response.statusText}`)
        setError('Failed to load feature requests')
      }
    } catch (error) {
      console.error('Failed to fetch features:', error)
      setError('Failed to load feature requests')
    }
  }

  const fetchBugs = async () => {
    if (!session?.access_token) return
    
    try {
      const params = new URLSearchParams()
      if (bugFilters.status) params.append('status_filter', bugFilters.status)
      if (bugFilters.priority) params.append('priority_filter', bugFilters.priority)
      
      // Only append the '?' and params if there are actually parameters
      const queryString = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(getApiUrl(`/feedback/bugs${queryString}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBugs(data)
      } else {
        console.error(`Failed to fetch bugs: ${response.status} ${response.statusText}`)
        setError('Failed to load bug reports')
      }
    } catch (error) {
      console.error('Failed to fetch bugs:', error)
      setError('Failed to load bug reports')
    }
  }

  const fetchNotifications = async () => {
    if (!session?.access_token) return
    
    try {
      const params = new URLSearchParams({
        unread_only: 'true',
        limit: '10'
      })
      
      const response = await fetch(getApiUrl(`/notifications?${params}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const submitFeatureRequest = async () => {
    if (!session?.access_token || !featureForm.title || !featureForm.description) return
    
    try {
      const response = await fetch(getApiUrl('/feedback/features'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(featureForm)
      })
      
      if (response.ok) {
        setShowFeatureForm(false)
        setFeatureForm({ title: '', description: '', priority: 'medium', tags: [] })
        fetchFeatures()
      } else {
        setError('Failed to submit feature request')
      }
    } catch (error) {
      setError('Failed to submit feature request')
    }
  }

  const submitBugReport = async () => {
    if (!session?.access_token || !bugForm.title || !bugForm.description) return
    
    try {
      const response = await fetch(getApiUrl('/feedback/bugs'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bugForm)
      })
      
      if (response.ok) {
        setShowBugForm(false)
        setBugForm({
          title: '',
          description: '',
          steps_to_reproduce: '',
          expected_behavior: '',
          actual_behavior: '',
          priority: 'medium',
          severity: 'minor',
          category: 'functionality'
        })
        fetchBugs()
      } else {
        setError('Failed to submit bug report')
      }
    } catch (error) {
      setError('Failed to submit bug report')
    }
  }

  const voteOnFeature = async (featureId: string, voteType: 'upvote' | 'downvote') => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl(`/feedback/features/${featureId}/vote`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote_type: voteType })
      })
      
      if (response.ok) {
        fetchFeatures() // Refresh to get updated vote counts
      }
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'under_review': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'in_development': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <ResponsiveContainer padding="md" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Feedback & Ideas</h1>
            <p className="text-gray-600 mt-2">Share your ideas and report issues to help improve the platform</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="relative">
                <Bell className="h-6 w-6 text-gray-600" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              </div>
            )}
            
            <TouchButton
              onClick={() => setShowFeatureForm(true)}
              variant="primary"
              size="md"
              leftIcon={<Lightbulb />}
            >
              Suggest Feature
            </TouchButton>
            
            <TouchButton
              onClick={() => setShowBugForm(true)}
              variant="primary"
              size="md"
              className="bg-red-600 hover:bg-red-700"
              leftIcon={<Bug />}
            >
              Report Bug
            </TouchButton>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('features')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'features'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Lightbulb className="h-4 w-4 inline mr-2" />
              Feature Requests ({features.length})
            </button>
            <button
              onClick={() => setActiveTab('bugs')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bugs'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Bug className="h-4 w-4 inline mr-2" />
              Bug Reports ({bugs.length})
            </button>
          </nav>
        </div>

        {/* Feature Requests Tab */}
        {activeTab === 'features' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2 text-blue-600" />
                Filter Feature Requests
              </h3>
              <AdaptiveGrid 
                columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                gap="md"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
                  <select
                    value={featureFilters.status}
                    onChange={(e) => setFeatureFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="in_development">In Development</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Priority</label>
                  <select
                    value={featureFilters.priority}
                    onChange={(e) => setFeatureFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <TouchButton
                    onClick={fetchFeatures}
                    variant="primary"
                    size="md"
                    fullWidth
                  >
                    Apply Filters
                  </TouchButton>
                </div>
              </AdaptiveGrid>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {features.map((feature) => (
                <div key={feature.id} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(feature.status)}`}>
                          {feature.status.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(feature.priority)}`}>
                          {feature.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 mb-4 leading-relaxed">{feature.description}</p>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          {feature.submitted_by}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(feature.created_at).toLocaleDateString()}
                        </span>
                        {feature.tags.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4" />
                            {feature.tags.map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-6">
                      <button
                        onClick={() => voteOnFeature(feature.id, 'upvote')}
                        className="flex items-center space-x-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span className="font-medium">{feature.upvotes}</span>
                      </button>
                      
                      <button
                        onClick={() => voteOnFeature(feature.id, 'downvote')}
                        className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        <span className="font-medium">{feature.downvotes}</span>
                      </button>
                      
                      <div className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-50 rounded-lg">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">{feature.votes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bug Reports Tab */}
        {activeTab === 'bugs' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2 text-red-600" />
                Filter Bug Reports
              </h3>
              <AdaptiveGrid 
                columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                gap="md"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
                  <select
                    value={bugFilters.status}
                    onChange={(e) => setBugFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Priority</label>
                  <select
                    value={bugFilters.priority}
                    onChange={(e) => setBugFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Priority</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <TouchButton
                    onClick={fetchBugs}
                    variant="primary"
                    size="md"
                    className="bg-red-600 hover:bg-red-700"
                    fullWidth
                  >
                    Apply Filters
                  </TouchButton>
                </div>
              </AdaptiveGrid>
            </div>

            {/* Bug List */}
            <div className="space-y-4">
              {bugs.map((bug) => (
                <div key={bug.id} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{bug.title}</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(bug.status)}`}>
                          {bug.status.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(bug.priority)}`}>
                          {bug.priority}
                        </span>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {bug.category}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 mb-4 leading-relaxed">{bug.description}</p>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          {bug.submitted_by}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(bug.created_at).toLocaleDateString()}
                        </span>
                        <span className="px-3 py-1 bg-orange-50 text-orange-700 text-xs rounded-md font-medium">
                          {bug.severity} severity
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Request Form Modal */}
        {showFeatureForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Suggest a Feature</h2>
                  <p className="text-gray-600 mt-1">Help us improve the platform with your ideas</p>
                </div>
                <button
                  onClick={() => setShowFeatureForm(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">Feature Title</label>
                  <input
                    type="text"
                    value={featureForm.title}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Brief description of the feature you'd like to see"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">Detailed Description</label>
                  <textarea
                    value={featureForm.description}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={5}
                    className="textarea-field w-full"
                    placeholder="Explain the feature in detail and why it would be valuable to you and other users"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">Please be as specific as possible to help us understand your needs</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Priority Level</label>
                  <select
                    value={featureForm.priority}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="low">Low - Nice to have</option>
                    <option value="medium">Medium - Would improve workflow</option>
                    <option value="high">High - Important for productivity</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-2">How important is this feature to your work?</p>
                </div>
                
                <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowFeatureForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitFeatureRequest}
                    disabled={!featureForm.title || !featureForm.description}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                  >
                    Submit Feature Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bug Report Form Modal */}
        {showBugForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Report a Bug</h2>
                  <p className="text-gray-600 mt-1">Help us fix issues by providing detailed information</p>
                </div>
                <button
                  onClick={() => setShowBugForm(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">Bug Title</label>
                  <input
                    type="text"
                    value={bugForm.title}
                    onChange={(e) => setBugForm(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Brief description of the bug or issue"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">Bug Description</label>
                  <textarea
                    value={bugForm.description}
                    onChange={(e) => setBugForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="textarea-field w-full"
                    placeholder="Describe what went wrong and what you expected to happen"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">Include any error messages you saw</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Steps to Reproduce</label>
                  <textarea
                    value={bugForm.steps_to_reproduce}
                    onChange={(e) => setBugForm(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                    rows={4}
                    className="textarea-field w-full"
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. Bug occurs when..."
                  />
                  <p className="text-sm text-gray-500 mt-2">Help us reproduce the issue by listing the exact steps</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Priority Level</label>
                    <select
                      value={bugForm.priority}
                      onChange={(e) => setBugForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="low">Low - Minor inconvenience</option>
                      <option value="medium">Medium - Affects workflow</option>
                      <option value="high">High - Blocks important tasks</option>
                      <option value="critical">Critical - System unusable</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Severity Level</label>
                    <select
                      value={bugForm.severity}
                      onChange={(e) => setBugForm(prev => ({ ...prev, severity: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="minor">Minor - Small visual issue</option>
                      <option value="major">Major - Feature not working</option>
                      <option value="critical">Critical - Data loss risk</option>
                      <option value="blocker">Blocker - Cannot continue</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Bug Category</label>
                    <select
                      value={bugForm.category}
                      onChange={(e) => setBugForm(prev => ({ ...prev, category: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="ui">User Interface</option>
                      <option value="functionality">Core Functionality</option>
                      <option value="performance">Performance Issue</option>
                      <option value="security">Security Concern</option>
                      <option value="data">Data Problem</option>
                      <option value="integration">Integration Issue</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowBugForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitBugReport}
                    disabled={!bugForm.title || !bugForm.description}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                  >
                    Submit Bug Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ResponsiveContainer>
    </AppLayout>
  )
}