'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { ThumbsUp, ThumbsDown, Bug, Lightbulb, Filter, Bell, AlertCircle, User, Calendar, Tag, X, TrendingUp } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl } from '../../lib/api/client'
import { ResponsiveContainer } from '../../components/ui/molecules/ResponsiveContainer'
import { AdaptiveGrid } from '../../components/ui/molecules/AdaptiveGrid'
import { TouchButton } from '../../components/ui/atoms/TouchButton'
import { useTranslations } from '../../lib/i18n/context'

interface FeatureRequest {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  priority: 'low' | 'medium' | 'high' | 'critical'
  votes_count: number
  comments_count: number
  submitted_by: string
  assigned_to?: string
  tags: string[]
  created_at: string
  updated_at: string
  completed_at?: string
  estimated_effort?: string
}

interface BugReport {
  id: string
  title: string
  description: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'ui' | 'functionality' | 'performance' | 'security' | 'data' | 'integration'
  submitted_by: string
  assigned_to?: string
  browser_info?: string
  resolution?: string
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
  const { t } = useTranslations()
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
    severity: 'medium',
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
      setError(t('feedback.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const fetchFeatures = async () => {
    if (!session?.access_token) return
    
    try {
      const params = new URLSearchParams()
      if (featureFilters.status) params.append('status', featureFilters.status)
      if (featureFilters.priority) params.append('priority', featureFilters.priority)
      
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
        // Use mock data as fallback
        setFeatures([
          {
            id: 'mock-1',
            title: 'Enhanced Dashboard Analytics',
            description: 'Add more detailed analytics and visualizations to the dashboard',
            status: 'in_progress',
            priority: 'high',
            votes_count: 15,
            comments_count: 3,
            submitted_by: session.user?.email || 'unknown',
            tags: ['analytics', 'dashboard'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'mock-2',
            title: 'Mobile App Support',
            description: 'Develop native mobile applications for iOS and Android',
            status: 'pending',
            priority: 'medium',
            votes_count: 23,
            comments_count: 5,
            submitted_by: session.user?.email || 'unknown',
            tags: ['mobile', 'ios', 'android'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
      }
    } catch (error) {
      console.error('Failed to fetch features:', error)
      // Use mock data as fallback
      setFeatures([
        {
          id: 'mock-1',
          title: 'Enhanced Dashboard Analytics',
          description: 'Add more detailed analytics and visualizations to the dashboard',
          status: 'in_progress',
          priority: 'high',
          votes_count: 15,
          comments_count: 3,
          submitted_by: session.user?.email || 'unknown',
          tags: ['analytics', 'dashboard'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
    }
  }

  const fetchBugs = async () => {
    if (!session?.access_token) return
    
    try {
      const params = new URLSearchParams()
      if (bugFilters.status) params.append('status', bugFilters.status)
      if (bugFilters.priority) params.append('priority', bugFilters.priority)
      
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
        // Use mock data as fallback
        setBugs([
          {
            id: 'bug-mock-1',
            title: 'Dashboard loading slowly',
            description: 'The dashboard takes more than 5 seconds to load',
            status: 'open',
            priority: 'high',
            severity: 'high',
            category: 'performance',
            submitted_by: session.user?.email || 'unknown',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
      }
    } catch (error) {
      console.error('Failed to fetch bugs:', error)
      // Use mock data as fallback
      setBugs([
        {
          id: 'bug-mock-1',
          title: 'Dashboard loading slowly',
          description: 'The dashboard takes more than 5 seconds to load',
          status: 'open',
          priority: 'high',
          severity: 'high',
          category: 'performance',
          submitted_by: session.user?.email || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
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
        setError(t('feedback.errors.submitFeatureFailed'))
      }
    } catch (error) {
      setError(t('feedback.errors.submitFeatureFailed'))
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
          severity: 'medium',
          category: 'functionality'
        })
        fetchBugs()
      } else {
        setError(t('feedback.errors.submitBugFailed'))
      }
    } catch (error) {
      setError(t('feedback.errors.submitBugFailed'))
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
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
      case 'open': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      case 'in_progress': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
      case 'completed': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      case 'resolved': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      case 'rejected': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      case 'closed': return 'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
      default: return 'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
      case 'medium': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      default: return 'bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-300'
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
        <div data-testid="feedback-page">
        {/* Header */}
        <div data-testid="feedback-header" className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
          <div>
            <h1 data-testid="feedback-title" className="text-2xl sm:text-3xl font-bold text-gray-900">{t('feedback.title')}</h1>
            <p className="text-gray-600 mt-2">{t('feedback.subtitle')}</p>
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
              {t('feedback.suggestFeature')}
            </TouchButton>
            
            <TouchButton
              onClick={() => setShowBugForm(true)}
              variant="primary"
              size="md"
              className="bg-red-600 hover:bg-red-700"
              leftIcon={<Bug />}
            >
              {t('feedback.reportBug')}
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
              {t('feedback.featureRequests')} ({features.length})
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
              {t('feedback.bugReports')} ({bugs.length})
            </button>
          </nav>
        </div>

        {/* Feature Requests Tab */}
        {activeTab === 'features' && (
          <div data-testid="feedback-form" className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                {t('feedback.filters.title')}
              </h3>
              <AdaptiveGrid 
                columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                gap="md"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">{t('feedback.filters.status')}</label>
                  <select
                    value={featureFilters.status}
                    onChange={(e) => setFeatureFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="input-field w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('feedback.filters.allStatuses')}</option>
                    <option value="pending">{t('feedback.status.pending')}</option>
                    <option value="in_progress">{t('feedback.status.inProgress')}</option>
                    <option value="completed">{t('feedback.status.completed')}</option>
                    <option value="rejected">{t('feedback.status.rejected')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">{t('feedback.filters.priority')}</label>
                  <select
                    value={featureFilters.priority}
                    onChange={(e) => setFeatureFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('feedback.filters.allPriorities')}</option>
                    <option value="low">{t('feedback.priority.low')}</option>
                    <option value="medium">{t('feedback.priority.medium')}</option>
                    <option value="high">{t('feedback.priority.high')}</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <TouchButton
                    onClick={fetchFeatures}
                    variant="primary"
                    size="md"
                    fullWidth
                  >
                    {t('feedback.filters.applyFilters')}
                  </TouchButton>
                </div>
              </AdaptiveGrid>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {features.map((feature) => (
                <div key={feature.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-slate-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{feature.title}</h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(feature.status)}`}>
                          {feature.status.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(feature.priority)}`}>
                          {feature.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed">{feature.description}</p>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-slate-400">
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          {feature.submitted_by}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(feature.created_at).toLocaleDateString()}
                        </span>
                        {feature.tags && feature.tags.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4" />
                            {feature.tags.map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-md font-medium">
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
                        className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span className="font-medium">Vote</span>
                      </button>
                      
                      <div className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-50 rounded-lg">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">{feature.votes_count} votes</span>
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
                {t('feedback.filters.bugTitle')}
              </h3>
              <AdaptiveGrid 
                columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                gap="md"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.filters.status')}</label>
                  <select
                    value={bugFilters.status}
                    onChange={(e) => setBugFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">{t('feedback.filters.allStatuses')}</option>
                    <option value="open">{t('feedback.status.open')}</option>
                    <option value="in_progress">{t('feedback.status.inProgress')}</option>
                    <option value="resolved">{t('feedback.status.resolved')}</option>
                    <option value="closed">{t('feedback.status.closed')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.filters.priority')}</label>
                  <select
                    value={bugFilters.priority}
                    onChange={(e) => setBugFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">{t('feedback.filters.allPriorities')}</option>
                    <option value="low">{t('feedback.priority.low')}</option>
                    <option value="medium">{t('feedback.priority.medium')}</option>
                    <option value="high">{t('feedback.priority.high')}</option>
                    <option value="critical">{t('feedback.priority.critical')}</option>
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
                    {t('feedback.filters.applyFilters')}
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
                          {t(`feedback.severity.${bug.severity}`)} severity
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
                  <h2 className="text-2xl font-bold text-gray-900">{t('feedback.featureForm.title')}</h2>
                  <p className="text-gray-600 mt-1">{t('feedback.featureForm.subtitle')}</p>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">{t('feedback.featureForm.titleLabel')}</label>
                  <input
                    type="text"
                    value={featureForm.title}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder={t('feedback.featureForm.titlePlaceholder')}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">{t('feedback.featureForm.descriptionLabel')}</label>
                  <textarea
                    value={featureForm.description}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={5}
                    className="textarea-field w-full"
                    placeholder={t('feedback.featureForm.descriptionPlaceholder')}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">{t('feedback.featureForm.descriptionHelp')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.featureForm.priorityLabel')}</label>
                  <select
                    value={featureForm.priority}
                    onChange={(e) => setFeatureForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="low">{t('feedback.featureForm.priorityLow')}</option>
                    <option value="medium">{t('feedback.featureForm.priorityMedium')}</option>
                    <option value="high">{t('feedback.featureForm.priorityHigh')}</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-2">{t('feedback.featureForm.priorityHelp')}</p>
                </div>
                
                <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowFeatureForm(false)}
                    className="px-6 py-3 text-gray-900 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    {t('feedback.featureForm.cancel')}
                  </button>
                  <button
                    onClick={submitFeatureRequest}
                    disabled={!featureForm.title || !featureForm.description}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                  >
                    {t('feedback.featureForm.submit')}
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
                  <h2 className="text-2xl font-bold text-gray-900">{t('feedback.bugForm.title')}</h2>
                  <p className="text-gray-600 mt-1">{t('feedback.bugForm.subtitle')}</p>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">{t('feedback.bugForm.titleLabel')}</label>
                  <input
                    type="text"
                    value={bugForm.title}
                    onChange={(e) => setBugForm(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder={t('feedback.bugForm.titlePlaceholder')}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 required">{t('feedback.bugForm.descriptionLabel')}</label>
                  <textarea
                    value={bugForm.description}
                    onChange={(e) => setBugForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="textarea-field w-full"
                    placeholder={t('feedback.bugForm.descriptionPlaceholder')}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">{t('feedback.bugForm.descriptionHelp')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.bugForm.stepsLabel')}</label>
                  <textarea
                    value={bugForm.steps_to_reproduce}
                    onChange={(e) => setBugForm(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                    rows={4}
                    className="textarea-field w-full"
                    placeholder={t('feedback.bugForm.stepsPlaceholder')}
                  />
                  <p className="text-sm text-gray-500 mt-2">{t('feedback.bugForm.stepsHelp')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.bugForm.priorityLabel')}</label>
                    <select
                      value={bugForm.priority}
                      onChange={(e) => setBugForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="low">{t('feedback.bugForm.priorityLow')}</option>
                      <option value="medium">{t('feedback.bugForm.priorityMedium')}</option>
                      <option value="high">{t('feedback.bugForm.priorityHigh')}</option>
                      <option value="critical">{t('feedback.bugForm.priorityCritical')}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.bugForm.severityLabel')}</label>
                    <select
                      value={bugForm.severity}
                      onChange={(e) => setBugForm(prev => ({ ...prev, severity: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="low">{t('feedback.bugForm.severityLow')}</option>
                      <option value="medium">{t('feedback.bugForm.severityMedium')}</option>
                      <option value="high">{t('feedback.bugForm.severityHigh')}</option>
                      <option value="critical">{t('feedback.bugForm.severityCritical')}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">{t('feedback.bugForm.categoryLabel')}</label>
                    <select
                      value={bugForm.category}
                      onChange={(e) => setBugForm(prev => ({ ...prev, category: e.target.value }))}
                      className="input-field w-full"
                    >
                      <option value="ui">{t('feedback.bugForm.categoryUI')}</option>
                      <option value="functionality">{t('feedback.bugForm.categoryFunctionality')}</option>
                      <option value="performance">{t('feedback.bugForm.categoryPerformance')}</option>
                      <option value="security">{t('feedback.bugForm.categorySecurity')}</option>
                      <option value="data">{t('feedback.bugForm.categoryData')}</option>
                      <option value="integration">{t('feedback.bugForm.categoryIntegration')}</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowBugForm(false)}
                    className="px-6 py-3 text-gray-900 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                  >
                    {t('feedback.bugForm.cancel')}
                  </button>
                  <button
                    onClick={submitBugReport}
                    disabled={!bugForm.title || !bugForm.description}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
                  >
                    {t('feedback.bugForm.submit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </ResponsiveContainer>
    </AppLayout>
  )
}