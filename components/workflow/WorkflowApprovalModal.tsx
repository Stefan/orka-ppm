'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, XCircle, Clock, User, Calendar } from 'lucide-react'
import WorkflowHistory from './WorkflowHistory'
import { useWorkflowRealtime } from '@/hooks/useWorkflowRealtime'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'

interface WorkflowApproval {
  id: string
  approver_id: string
  status: string
  comments: string | null
  approved_at: string | null
}

interface WorkflowStep {
  step_number: number
  approvals: WorkflowApproval[]
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

interface WorkflowApprovalModalProps {
  workflowInstanceId: string
  onClose: () => void
}

export default function WorkflowApprovalModal({
  workflowInstanceId,
  onClose
}: WorkflowApprovalModalProps) {
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comments, setComments] = useState('')
  const { session } = useAuth()
  const currentUserId = session?.user?.id ?? null
  const accessToken = session?.access_token ?? null

  useEffect(() => {
    fetchWorkflowDetails()
  }, [workflowInstanceId, accessToken])

  // Setup realtime subscriptions
  useWorkflowRealtime(workflowInstanceId, {
    onWorkflowUpdate: (payload) => {
      console.log('Workflow updated via realtime:', payload)
      // Refresh workflow details when updates occur
      fetchWorkflowDetails()
    },
    onApprovalUpdate: (payload) => {
      console.log('Approval updated via realtime:', payload)
      // Refresh workflow details when approvals change
      fetchWorkflowDetails()
    }
  })

  const fetchWorkflowDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/workflows/instances/${workflowInstanceId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch workflow details')
      }

      const data = await response.json()
      setWorkflow(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (decision: 'approved' | 'rejected') => {
    if (!workflow || !currentUserId) return

    try {
      setSubmitting(true)
      setError(null)

      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/workflows/instances/${workflowInstanceId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision,
          comments: comments.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to submit approval')
      }

      // Refresh workflow details
      await fetchWorkflowDetails()
      
      // Clear comments
      setComments('')
      
      // Show success message
      alert(`Workflow ${decision} successfully`)
      
      // If workflow is completed or rejected, close modal
      if (decision === 'rejected') {
        setTimeout(() => onClose(), 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const canApprove = () => {
    if (!workflow || !currentUserId) return false
    if (workflow.status !== 'pending' && workflow.status !== 'in_progress') return false

    const currentStepApprovals = workflow.approvals[workflow.current_step] || []
    const userApproval = currentStepApprovals.find(a => a.approver_id === currentUserId)
    
    return userApproval && userApproval.status === 'pending'
  }

  const getCurrentStepApprovals = () => {
    if (!workflow) return []
    return workflow.approvals[workflow.current_step] || []
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 max-w-2xl w-full mx-4 border border-gray-200 dark:border-slate-700">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-2/3"></div>
            <div className="h-32 bg-gray-200 dark:bg-slate-600 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 max-w-2xl w-full mx-4 border border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Error</h2>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X size={24} aria-hidden />
            </button>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!workflow) return null

  const statusConfig = {
    pending: { color: 'yellow', icon: Clock, label: 'Pending' },
    in_progress: { color: 'blue', icon: Clock, label: 'In Progress' },
    completed: { color: 'green', icon: CheckCircle, label: 'Completed' },
    rejected: { color: 'red', icon: XCircle, label: 'Rejected' }
  }

  const config = statusConfig[workflow.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {workflow.workflow_name}
            </h2>
            <div className="flex items-center gap-2">
              <StatusIcon className={`text-${config.color}-600`} size={20} aria-hidden />
              <span className={`text-${config.color}-800 font-medium`}>
                {config.label}
              </span>
              <span className="text-gray-500 dark:text-slate-400">•</span>
              <span className="text-gray-600 dark:text-slate-300">Step {workflow.current_step + 1}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={24} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Entity Info */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">Workflow Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-slate-400">Entity Type:</span>
                <span className="ml-2 font-medium dark:text-slate-200">{workflow.entity_type}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">Entity ID:</span>
                <span className="ml-2 font-mono text-xs dark:text-slate-300">{workflow.entity_id}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-slate-400">Started:</span>
                <span className="ml-2 font-medium dark:text-slate-200">
                  {new Date(workflow.started_at).toLocaleString()}
                </span>
              </div>
              {workflow.completed_at && (
                <div>
                  <span className="text-gray-600 dark:text-slate-400">Completed:</span>
                  <span className="ml-2 font-medium dark:text-slate-200">
                    {new Date(workflow.completed_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Current Step Approvals */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Current Step Approvals</h3>
            <div className="space-y-2">
              {getCurrentStepApprovals().map((approval) => (
                <div
                  key={approval.id}
                  className={`border rounded-lg p-4 ${
                    approval.status === 'approved' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                    approval.status === 'rejected' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                    'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <User className="text-gray-400 dark:text-slate-500" size={20} aria-hidden />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-slate-100">
                          Approver {approval.approver_id.slice(0, 8)}
                        </div>
                        {approval.approved_at && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            <Calendar size={12} aria-hidden />
                            {new Date(approval.approved_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {approval.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-medium rounded">
                          <CheckCircle size={14} aria-hidden />
                          Approved
                        </span>
                      )}
                      {approval.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-xs font-medium rounded">
                          <XCircle size={14} aria-hidden />
                          Rejected
                        </span>
                      )}
                      {approval.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded">
                          <Clock size={14} aria-hidden />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                  {approval.comments && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                      <p className="text-sm text-gray-700 dark:text-slate-300">{approval.comments}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Approval Actions */}
          {canApprove() && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Your Approval</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Comments (optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
                  rows={3}
                  placeholder="Add your comments here..."
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleApproval('approved')}
                  disabled={submitting}
                  className="flex-1 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  {submitting ? 'Submitting...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleApproval('rejected')}
                  disabled={submitting}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  {submitting ? 'Submitting...' : 'Reject'}
                </button>
              </div>
            </div>
          )}

          {/* Workflow History */}
          <WorkflowHistory workflowInstance={workflow} />
        </div>
      </div>
    </div>
  )
}
