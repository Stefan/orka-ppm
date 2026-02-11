'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, CheckCircle, Eye, Filter, Search, Calendar, User, DollarSign, Bell, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

// Types based on the design document
interface PendingApproval {
  id: string
  change_request_id: string
  change_number: string
  title: string
  description: string
  change_type: string
  priority: string
  status: string
  
  // Approval specific
  step_number: number
  approver_role: string
  due_date?: string
  escalation_date?: string
  is_required: boolean
  is_parallel: boolean
  depends_on_step?: number
  
  // Request details
  requested_by: string
  requested_date: string
  required_by_date?: string
  project_name: string
  
  // Impact summary
  estimated_cost_impact?: number
  estimated_schedule_impact_days?: number
  critical_path_affected?: boolean
  
  // Urgency indicators
  is_overdue: boolean
  days_until_due?: number
  is_escalated: boolean
  escalated_from?: string
}

interface PendingApprovalsFilters {
  search: string
  priority: string
  change_type: string
  project: string
  overdue_only: boolean
  escalated_only: boolean
  sort_by: 'due_date' | 'priority' | 'cost_impact' | 'requested_date'
  sort_order: 'asc' | 'desc'
}

interface BulkActionOptions {
  approve_all: boolean
  reject_all: boolean
  request_info_all: boolean
  delegate_all: boolean
  delegate_to?: string
  bulk_comments?: string
}

export default function PendingApprovals() {
  const t = useTranslations('changes');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApprovals, setSelectedApprovals] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [filters, setFilters] = useState<PendingApprovalsFilters>({
    search: '',
    priority: '',
    change_type: '',
    project: '',
    overdue_only: false,
    escalated_only: false,
    sort_by: 'due_date',
    sort_order: 'asc'
  })
  const [bulkActionOptions, setBulkActionOptions] = useState<BulkActionOptions>({
    approve_all: false,
    reject_all: false,
    request_info_all: false,
    delegate_all: false
  })

  // Load pending approvals from API when available
  useEffect(() => {
    setPendingApprovals([])
    setLoading(false)
  }, [])

  const handleFilterChange = (key: keyof PendingApprovalsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSelectApproval = (approvalId: string) => {
    const newSelected = new Set(selectedApprovals)
    if (newSelected.has(approvalId)) {
      newSelected.delete(approvalId)
    } else {
      newSelected.add(approvalId)
    }
    setSelectedApprovals(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedApprovals.size === filteredApprovals.length) {
      setSelectedApprovals(new Set())
    } else {
      setSelectedApprovals(new Set(filteredApprovals.map(approval => approval.id)))
    }
  }

  const handleBulkAction = async (action: string) => {
    const selectedIds = Array.from(selectedApprovals)
    console.log(`Bulk ${action} on approvals:`, selectedIds)
    
    try {
      // Implement bulk action API calls here
      switch (action) {
        case 'approve':
          // Call bulk approve API
          break
        case 'reject':
          // Call bulk reject API
          break
        case 'request_info':
          // Call bulk request info API
          break
        case 'delegate':
          // Call bulk delegate API
          break
      }
      
      // Refresh the list after bulk action
      setSelectedApprovals(new Set())
      setShowBulkActions(false)
      
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error)
    }
  }

  const handleViewDetails = (changeRequestId: string) => {
    // Navigate to change request details
    window.location.href = `/changes/${changeRequestId}`
  }

  const handleMakeDecision = (approvalId: string) => {
    // Navigate to approval workflow for this specific approval
    const approval = pendingApprovals.find(a => a.id === approvalId)
    if (approval) {
      window.location.href = `/changes/${approval.change_request_id}?tab=approvals&approval=${approvalId}`
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      case 'high':
        return <ArrowUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      case 'medium':
        return <Minus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      case 'low':
        return <ArrowDown className="h-4 w-4 text-gray-600 dark:text-slate-400" />
      default:
        return <Minus className="h-4 w-4 text-gray-600 dark:text-slate-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'critical':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200'
      case 'high':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
      case 'medium':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'low':
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-700'
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-700'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const sortApprovals = (approvals: PendingApproval[]) => {
    return [...approvals].sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (filters.sort_by) {
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity
          bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity
          break
        case 'priority':
          const priorityOrder = { emergency: 5, critical: 4, high: 3, medium: 2, low: 1 }
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0
          break
        case 'cost_impact':
          aValue = a.estimated_cost_impact || 0
          bValue = b.estimated_cost_impact || 0
          break
        case 'requested_date':
          aValue = new Date(a.requested_date).getTime()
          bValue = new Date(b.requested_date).getTime()
          break
        default:
          return 0
      }
      
      if (filters.sort_order === 'desc') {
        return bValue - aValue
      }
      return aValue - bValue
    })
  }

  const filteredApprovals = sortApprovals(
    pendingApprovals.filter(approval => {
      if (filters.search && !approval.title.toLowerCase().includes(filters.search.toLowerCase()) &&
          !approval.change_number.toLowerCase().includes(filters.search.toLowerCase()) &&
          !approval.project_name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      if (filters.priority && approval.priority !== filters.priority) return false
      if (filters.change_type && approval.change_type !== filters.change_type) return false
      if (filters.overdue_only && !approval.is_overdue) return false
      if (filters.escalated_only && !approval.is_escalated) return false
      return true
    })
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('pendingApprovals.title')}</h2>
            <p className="text-gray-600 dark:text-slate-400">{t('pendingApprovals.subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pendingApprovals.length}</div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{t('pendingApprovals.totalPending')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {pendingApprovals.filter(a => a.is_overdue).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{t('pendingApprovals.overdue')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {pendingApprovals.filter(a => a.is_escalated).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-slate-400">{t('pendingApprovals.escalated')}</div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleFilterChange('overdue_only', !filters.overdue_only)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              filters.overdue_only 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700' 
                : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('pendingApprovals.overdueOnly')}
          </button>
          
          <button
            onClick={() => handleFilterChange('escalated_only', !filters.escalated_only)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              filters.escalated_only 
                ? 'bg-orange-50 border-orange-200 text-orange-700' 
                : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <Bell className="h-4 w-4" />
            {t('pendingApprovals.escalatedOnly')}
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
          >
            <Filter className="h-4 w-4" />
            {t('pendingApprovals.moreFilters')}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('pendingApprovals.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('pendingApprovals.searchPlaceholder')}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('pendingApprovals.priority')}</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('pendingApprovals.allPriorities')}</option>
                <option value="emergency">Emergency</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('pendingApprovals.changeType')}</label>
              <select
                value={filters.change_type}
                onChange={(e) => handleFilterChange('change_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('pendingApprovals.allTypes')}</option>
                <option value="scope">Scope</option>
                <option value="schedule">Schedule</option>
                <option value="budget">Budget</option>
                <option value="design">Design</option>
                <option value="regulatory">Regulatory</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('pendingApprovals.sortBy')}</label>
              <div className="flex gap-2">
                <select
                  value={filters.sort_by}
                  onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="due_date">{t('pendingApprovals.dueDate')}</option>
                  <option value="priority">Priority</option>
                  <option value="cost_impact">{t('pendingApprovals.costImpact')}</option>
                  <option value="requested_date">{t('pendingApprovals.requestDate')}</option>
                </select>
                <button
                  onClick={() => handleFilterChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
                >
                  {filters.sort_order === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedApprovals.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {t('pendingApprovals.bulkActions.selected', { count: selectedApprovals.size })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="bg-green-700 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                >
                  {t('pendingApprovals.bulkActions.bulkApprove')}
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                  {t('pendingApprovals.bulkActions.bulkReject')}
                </button>
                <button
                  onClick={() => handleBulkAction('request_info')}
                  className="bg-yellow-700 hover:bg-yellow-800 text-white px-3 py-1 rounded text-sm"
                >
                  {t('pendingApprovals.bulkActions.requestInfo')}
                </button>
                <button
                  onClick={() => setShowBulkActions(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  {t('pendingApprovals.bulkActions.moreActions')}
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedApprovals(new Set())}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
            >
              {t('pendingApprovals.bulkActions.clearSelection')}
            </button>
          </div>
        </div>
      )}

      {/* Approvals List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        {filteredApprovals.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">{t('pendingApprovals.noApprovals')}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {filters.search || filters.priority || filters.change_type || filters.overdue_only || filters.escalated_only
                ? t('pendingApprovals.noMatchingApprovals')
                : t('pendingApprovals.noApprovalsMessage')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {/* Header */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedApprovals.size === filteredApprovals.length && filteredApprovals.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-slate-300">{t('pendingApprovals.selectAll')}</span>
                </div>
              </div>
            </div>

            {/* Approval Items */}
            {filteredApprovals.map((approval) => (
              <div key={approval.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedApprovals.has(approval.id)}
                    onChange={() => handleSelectApproval(approval.id)}
                    className="mt-1 rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                            {approval.change_number}: {approval.title}
                          </h3>
                          
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(approval.priority)}`}>
                              {getPriorityIcon(approval.priority)}
                              <span className="ml-1 capitalize">{approval.priority}</span>
                            </span>
                            
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 capitalize">
                              {approval.change_type}
                            </span>
                            
                            {approval.is_overdue && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue
                              </span>
                            )}
                            
                            {approval.is_escalated && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                                <Bell className="h-3 w-3 mr-1" />
                                Escalated
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-gray-600 dark:text-slate-400 mb-3 line-clamp-2">{approval.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                            <User className="h-4 w-4" />
                            <span>{t('pendingApprovals.approvalCard.by')}: {approval.requested_by}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                            <Calendar className="h-4 w-4" />
                            <span>{t('pendingApprovals.approvalCard.project')}: {approval.project_name}</span>
                          </div>
                          
                          {approval.estimated_cost_impact && approval.estimated_cost_impact > 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                              <DollarSign className="h-4 w-4" />
                              <span>${approval.estimated_cost_impact.toLocaleString()}</span>
                            </div>
                          )}
                          
                          {approval.estimated_schedule_impact_days && approval.estimated_schedule_impact_days > 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                              <Clock className="h-4 w-4" />
                              <span>{approval.estimated_schedule_impact_days} days</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-600 dark:text-slate-400">
                              {t('pendingApprovals.approvalCard.step')} {approval.step_number} - {approval.approver_role}
                            </span>
                            
                            {approval.due_date && (
                              <span className={`flex items-center gap-1 ${
                                approval.is_overdue ? 'text-red-600 dark:text-red-400' : 
                                approval.days_until_due && approval.days_until_due <= 1 ? 'text-orange-600 dark:text-orange-400' : 
                                'text-gray-600 dark:text-slate-400'
                              }`}>
                                <Clock className="h-3 w-3" />
                                {t('pendingApprovals.approvalCard.due')}: {formatDate(approval.due_date)}
                                {approval.days_until_due !== undefined && (
                                  <span className="ml-1">
                                    ({approval.days_until_due > 0 ? t('pendingApprovals.approvalCard.daysLeft', { count: approval.days_until_due }) : 
                                      approval.days_until_due === 0 ? t('pendingApprovals.approvalCard.dueToday') : 
                                      t('pendingApprovals.approvalCard.daysOverdue', { count: Math.abs(approval.days_until_due) })})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetails(approval.change_request_id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              {t('pendingApprovals.approvalCard.viewDetails')}
                            </button>
                            
                            <button
                              onClick={() => handleMakeDecision(approval.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                              {t('pendingApprovals.approvalCard.makeDecision')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Actions Modal */}
      {showBulkActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('pendingApprovals.bulkActions.moreActions')}</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                {t('pendingApprovals.bulkActions.selected', { count: selectedApprovals.size })}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t('pendingApprovals.bulkActions.bulkComments')}
                </label>
                <textarea
                  value={bulkActionOptions.bulk_comments || ''}
                  onChange={(e) => setBulkActionOptions(prev => ({ ...prev, bulk_comments: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('pendingApprovals.bulkActions.bulkCommentsPlaceholder')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t('pendingApprovals.bulkActions.delegateTo')}
                </label>
                <input
                  type="text"
                  value={bulkActionOptions.delegate_to || ''}
                  onChange={(e) => setBulkActionOptions(prev => ({ ...prev, delegate_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('pendingApprovals.bulkActions.delegateToPlaceholder')}
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <button
                onClick={() => setShowBulkActions(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
              >
                {t('pendingApprovals.bulkActions.cancel')}
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('delegate')}
                  disabled={!bulkActionOptions.delegate_to}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm"
                >
                  {t('pendingApprovals.bulkActions.apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}