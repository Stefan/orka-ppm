'use client'

import { useState, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  CheckSquare,
  Clock,
  AlertCircle,
  FileText
} from 'lucide-react'
import ChangeRequestForm from './ChangeRequestForm'
import { ChangeRequest, mockDataService } from '../lib/mockData'
import { useAsyncData, LoadingState, SkeletonTable } from '../lib/loadingStates'

interface ChangeRequestFilters {
  search: string
  status: string
  change_type: string
  priority: string
  project_id: string
  assigned_to_me: boolean
}

// Reducer for batching filter state updates
type FilterAction =
  | { type: 'SET_FILTER'; key: keyof ChangeRequestFilters; value: string | boolean }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_MULTIPLE_FILTERS'; filters: Partial<ChangeRequestFilters> }

function filterReducer(state: ChangeRequestFilters, action: FilterAction): ChangeRequestFilters {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value }
    case 'RESET_FILTERS':
      return {
        search: '',
        status: '',
        change_type: '',
        priority: '',
        project_id: '',
        assigned_to_me: false
      }
    case 'SET_MULTIPLE_FILTERS':
      return { ...state, ...action.filters }
    default:
      return state
  }
}

const CHANGE_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'implementing', label: 'Implementing' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'closed', label: 'Closed' }
]

const CHANGE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'scope', label: 'Scope' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'budget', label: 'Budget' },
  { value: 'design', label: 'Design' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'resource', label: 'Resource' },
  { value: 'quality', label: 'Quality' },
  { value: 'safety', label: 'Safety' },
  { value: 'emergency', label: 'Emergency' }
]

const PRIORITY_LEVELS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
  { value: 'emergency', label: 'Emergency' }
]

export default function ChangeRequestManager() {
  const router = useRouter()
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Use reducer for batching filter state updates
  const [filters, dispatchFilters] = useReducer(filterReducer, {
    search: '',
    status: '',
    change_type: '',
    priority: '',
    project_id: '',
    assigned_to_me: false
  })

  // Use enhanced async data loading with loading states
  const {
    data: changeRequests,
    isLoading,
    isError,
    error,
    refetch
  } = useAsyncData<ChangeRequest[]>(
    () => Promise.resolve(mockDataService.getChangeRequests()),
    []
  )

  const handleFilterChange = (key: keyof ChangeRequestFilters, value: string | boolean) => {
    dispatchFilters({ type: 'SET_FILTER', key, value })
  }

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (!changeRequests) return
    
    if (selectedItems.size === changeRequests.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(changeRequests.map(cr => cr.id)))
    }
  }

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} on items:`, Array.from(selectedItems))
    // Implement bulk operations
  }

  const handleCreateNew = () => {
    setShowCreateForm(true)
  }

  const handleFormSubmit = (data: any) => {
    console.log('Creating new change request:', data)
    // Handle form submission
    setShowCreateForm(false)
    // Refresh the list
    refetch()
  }

  const handleFormCancel = () => {
    setShowCreateForm(false)
  }

  const handleViewDetails = (id: string) => {
    router.push(`/changes/${id}`)
  }

  const handleEdit = (id: string) => {
    router.push(`/changes/${id}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4 text-gray-500 dark:text-slate-400" />
      case 'submitted':
      case 'under_review':
        return <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
      case 'pending_approval':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'approved':
        return <CheckSquare className="h-4 w-4 text-green-500 dark:text-green-400" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
      case 'implementing':
        return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      case 'implemented':
      case 'closed':
        return <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
      default:
        return <FileText className="h-4 w-4 text-gray-500 dark:text-slate-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
      case 'medium':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      case 'high':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      case 'critical':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
      case 'emergency':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
    }
  }

  const filteredChangeRequests = (changeRequests || []).filter(cr => {
    if (filters.search && !cr.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !cr.change_number.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (filters.status && cr.status !== filters.status) return false
    if (filters.change_type && cr.change_type !== filters.change_type) return false
    if (filters.priority && cr.priority !== filters.priority) return false
    if (filters.project_id && cr.project_id !== filters.project_id) return false
    return true
  })

  // Enhanced loading state management
  if (showCreateForm) {
    return (
      <ChangeRequestForm
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    )
  }

  return (
    <LoadingState
      state={isLoading ? 'loading' : isError ? 'error' : 'success'}
      message="Loading change requests..."
      {...(error && { error })}
      fallback={<SkeletonTable rows={5} columns={6} />}
    >
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Change Request
          </button>
          
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {selectedItems.size} selected
              </span>
              <button
                onClick={() => handleBulkAction('approve')}
                className="bg-green-700 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                Bulk Approve
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Bulk Reject
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search change requests..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {CHANGE_STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={filters.change_type}
              onChange={(e) => handleFilterChange('change_type', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {CHANGE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITY_LEVELS.map(priority => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.assigned_to_me}
                onChange={(e) => handleFilterChange('assigned_to_me', e.target.checked)}
                className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">Assigned to me</span>
            </label>
          </div>
        )}
      </div>

      {/* Change Requests Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === (changeRequests?.length || 0) && (changeRequests?.length || 0) > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Change Request
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Type & Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Impact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredChangeRequests.map((cr) => (
                <tr key={cr.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(cr.id)}
                      onChange={() => handleSelectItem(cr.id)}
                      className="rounded border-gray-300 dark:border-slate-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {cr.change_number}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-slate-100 font-medium">
                        {cr.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {cr.project_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        Requested by {cr.requested_by} on {new Date(cr.requested_date).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 capitalize">
                        {cr.change_type}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(cr.priority)}`}>
                        {cr.priority}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(cr.status)}
                      <span className="text-sm text-gray-900 dark:text-slate-100 capitalize">
                        {cr.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-slate-100">
                      {cr.estimated_cost_impact && (
                        <div>${cr.estimated_cost_impact.toLocaleString()}</div>
                      )}
                      {cr.estimated_schedule_impact_days && (
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {cr.estimated_schedule_impact_days} days
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {cr.implementation_progress !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={cr.implementation_progress} aria-valuemin={0} aria-valuemax={100}>
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${cr.implementation_progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {cr.implementation_progress}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(cr.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(cr.id)}
                        className="text-gray-600 hover:text-gray-800 dark:text-slate-200"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => console.log('Delete', cr.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => console.log('More actions', cr.id)}
                        className="text-gray-600 hover:text-gray-800 dark:text-slate-200"
                        title="More Actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredChangeRequests.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">No change requests</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Get started by creating a new change request.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateNew}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                New Change Request
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredChangeRequests.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-slate-300">
            Showing {filteredChangeRequests.length} of {changeRequests?.length || 0} change requests
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-50">
              Previous
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded">1</span>
            <button className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      )}
      </div>
    </LoadingState>
  )
}