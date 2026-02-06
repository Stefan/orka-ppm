'use client'

import { useState, useEffect } from 'react'
import { changeOrdersApi } from '@/lib/change-orders-api'
import WorkflowProgress from './WorkflowProgress'
import ApprovalActions from './ApprovalActions'

interface ApprovalWorkflowTrackerProps {
  changeOrderId: string
  currentUserId: string
  onStatusChange?: () => void
}

export default function ApprovalWorkflowTracker({
  changeOrderId,
  currentUserId,
  onStatusChange,
}: ApprovalWorkflowTrackerProps) {
  const [workflow, setWorkflow] = useState<{
    status: string
    approval_levels: Array<{ level: number; role: string; status: string }>
    is_complete: boolean
  } | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [status, pending] = await Promise.all([
          changeOrdersApi.getWorkflowStatus(changeOrderId).catch(() => null),
          changeOrdersApi.getPendingApprovals(currentUserId).catch(() => []),
        ])
        setWorkflow(status)
        const mine = Array.isArray(pending)
          ? pending.find((p: { change_order_id: string }) => p.change_order_id === changeOrderId)
          : null
        setPendingApproval(mine ? { id: (mine as { id: string }).id } : null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [changeOrderId, currentUserId])

  const handleApprove = async (id: string, comments?: string) => {
    await changeOrdersApi.approve(id, comments)
    onStatusChange?.()
    setPendingApproval(null)
  }

  const handleReject = async (id: string, comments: string) => {
    await changeOrdersApi.reject(id, comments)
    onStatusChange?.()
    setPendingApproval(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="p-4 text-gray-500 dark:text-slate-400 text-sm rounded-lg border">
        No workflow active. Submit the change order to initiate approval workflow.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <WorkflowProgress
        approvalLevels={workflow.approval_levels}
        isComplete={workflow.is_complete}
      />
      {pendingApproval && !workflow.is_complete && (
        <div className="p-4 border rounded-lg bg-amber-50">
          <h4 className="text-sm font-medium text-amber-800 mb-3">Your Action Required</h4>
          <ApprovalActions
            approvalId={pendingApproval.id}
            onApprove={handleApprove}
            onReject={handleReject}
            onComplete={onStatusChange}
          />
        </div>
      )}
    </div>
  )
}
