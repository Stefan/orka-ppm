'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import WorkflowStatusBadge from './WorkflowStatusBadge'
import WorkflowApprovalModal from './WorkflowApprovalModal'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'

interface WorkflowApproval {
  id: string
  approver_id: string
  status: string
  comments: string | null
  approved_at: string | null
}

interface WorkflowInstance {
  id: string
  workflow_id: string
  workflow_name: string
  entity_type: string
  entity_id: string
  current_step: number
  status: string
  started_by: string
  started_at: string
  completed_at: string | null
  approvals: Record<number, WorkflowApproval[]>
  created_at: string
  updated_at: string
}

interface WorkflowDashboardProps {
  userId: string
  userRole: string
  compact?: boolean
}

export default function WorkflowDashboard({ 
  userId, 
  userRole,
  compact = false 
}: WorkflowDashboardProps) {
  const { session } = useAuth()
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  useEffect(() => {
    if (session) {
      fetchWorkflows()
    } else {
      // No session, set empty workflows and stop loading
      setWorkflows([])
      setLoading(false)
    }
  }, [userId, session])

  const fetchWorkflows = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!session?.access_token) {
        // Silently handle no authentication - user might not be logged in yet
        setWorkflows([])
        return
      }

      // Fetch workflows where user is involved (as initiator or approver)
      const response = await fetch('/api/workflows/instances/my-workflows', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch workflows')
      }

      const data = await response.json()
      setWorkflows(data.workflows || [])
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getPendingApprovalsCount = useCallback((workflow: WorkflowInstance): number => {
    if (workflow.status !== 'pending' && workflow.status !== 'in_progress') {
      return 0
    }

    const currentStepApprovals = workflow.approvals[workflow.current_step] || []
    return currentStepApprovals.filter(
      approval => approval.approver_id === userId && approval.status === 'pending'
    ).length
  }, [userId])

  const getFilteredWorkflows = useCallback(() => {
    let filtered = workflows

    switch (filter) {
      case 'pending':
        filtered = workflows.filter(w => 
          w.status === 'pending' || w.status === 'in_progress'
        )
        break
      case 'completed':
        filtered = workflows.filter(w => 
          w.status === 'completed' || w.status === 'rejected'
        )
        break
      default:
        // 'all' - no filtering
        break
    }

    return filtered
  }, [workflows, filter])

  const handleWorkflowClick = (workflowId: string) => {
    setSelectedWorkflowId(workflowId)
  }

  const handleCloseModal = () => {
    setSelectedWorkflowId(null)
    // Refresh workflows after modal closes
    fetchWorkflows()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'in_progress':
        return <Clock className="text-yellow-600" size={16} />
      case 'completed':
        return <CheckCircle className="text-green-600" size={16} />
      case 'rejected':
        return <XCircle className="text-red-600" size={16} />
      default:
        return <AlertCircle className="text-gray-600" size={16} />
    }
  }

  const filteredWorkflows = getFilteredWorkflows()
  const pendingCount = workflows.filter(w => 
    (w.status === 'pending' || w.status === 'in_progress') && 
    getPendingApprovalsCount(w) > 0
  ).length

  // Compact view for dashboard integration
  if (compact) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )
    }

    if (pendingCount === 0) {
      return null // Don't show if no pending approvals
    }

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-blue-600" size={20} />
            <h3 className="font-semibold text-gray-900">Pending Approvals</h3>
          </div>
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            {pendingCount}
          </span>
        </div>

        <div className="space-y-2">
          {workflows
            .filter(w => getPendingApprovalsCount(w) > 0)
            .slice(0, 3)
            .map(workflow => (
              <button
                key={workflow.id}
                onClick={() => handleWorkflowClick(workflow.id)}
                className="w-full bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {workflow.workflow_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Step {workflow.current_step + 1} • {workflow.entity_type}
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400 flex-shrink-0 ml-2" size={16} />
                </div>
              </button>
            ))}
        </div>

        {pendingCount > 3 && (
          <button
            onClick={() => {/* Navigate to full workflow page */}}
            className="w-full mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all {pendingCount} pending approvals →
          </button>
        )}

        {selectedWorkflowId && (
          <WorkflowApprovalModal
            workflowInstanceId={selectedWorkflowId}
            onClose={handleCloseModal}
          />
        )}
      </div>
    )
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Approvals</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage and track approval workflows
          </p>
        </div>
        
        {pendingCount > 0 && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-yellow-600" size={20} />
              <span className="font-semibold text-yellow-800">
                {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            filter === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            filter === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending ({workflows.filter(w => w.status === 'pending' || w.status === 'in_progress').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            filter === 'completed'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Completed ({workflows.filter(w => w.status === 'completed' || w.status === 'rejected').length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24"></div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Workflows List */}
      {!loading && !error && (
        <div className="space-y-3">
          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <AlertCircle className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No workflows found</p>
            </div>
          ) : (
            filteredWorkflows.map(workflow => {
              const pendingApprovals = getPendingApprovalsCount(workflow)
              
              return (
                <div
                  key={workflow.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(workflow.status)}
                        <h3 className="font-semibold text-gray-900 truncate">
                          {workflow.workflow_name}
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="text-gray-500">Entity:</span>{' '}
                          <span className="font-medium">{workflow.entity_type}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Step:</span>{' '}
                          <span className="font-medium">{workflow.current_step + 1}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Started:</span>{' '}
                          <span className="font-medium">
                            {new Date(workflow.started_at).toLocaleDateString()}
                          </span>
                        </div>
                        {workflow.completed_at && (
                          <div>
                            <span className="text-gray-500">Completed:</span>{' '}
                            <span className="font-medium">
                              {new Date(workflow.completed_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {pendingApprovals > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 inline-flex items-center gap-2">
                          <AlertCircle className="text-yellow-600" size={16} />
                          <span className="text-sm font-medium text-yellow-800">
                            {pendingApprovals} pending approval{pendingApprovals !== 1 ? 's' : ''} from you
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleWorkflowClick(workflow.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      View Details
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Modal */}
      {selectedWorkflowId && (
        <WorkflowApprovalModal
          workflowInstanceId={selectedWorkflowId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
