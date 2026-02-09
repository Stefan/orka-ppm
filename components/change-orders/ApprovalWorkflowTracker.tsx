'use client'

import { useState, useEffect } from 'react'
import { changeOrdersApi } from '@/lib/change-orders-api'
import WorkflowProgress from './WorkflowProgress'
import ApprovalActions from './ApprovalActions'
import { Sparkles } from 'lucide-react'

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
  const [aiRecommendations, setAiRecommendations] = useState<Array<{ text: string; type: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [status, pending, recs] = await Promise.all([
          changeOrdersApi.getWorkflowStatus(changeOrderId).catch(() => null),
          changeOrdersApi.getPendingApprovals(currentUserId).catch(() => []),
          changeOrdersApi.getAIRecommendations(changeOrderId, true).catch(() => ({ recommendations: [] })),
        ])
        setWorkflow(status)
        const mine = Array.isArray(pending)
          ? pending.find((p: { change_order_id: string }) => p.change_order_id === changeOrderId)
          : null
        setPendingApproval(mine ? { id: (mine as { id: string }).id } : null)
        setAiRecommendations(recs.recommendations || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [changeOrderId, currentUserId])

  const handleApprove = async (id: string, payload?: { comments?: string; conditions?: string[] }) => {
    await changeOrdersApi.approve(id, payload)
    onStatusChange?.()
    setPendingApproval(null)
    const [status] = await Promise.all([
      changeOrdersApi.getWorkflowStatus(changeOrderId).catch(() => null),
    ])
    if (status) setWorkflow(status)
  }

  const handleReject = async (id: string, payload: { comments: string; conditions?: string[] }) => {
    await changeOrdersApi.reject(id, payload)
    onStatusChange?.()
    setPendingApproval(null)
    const status = await changeOrdersApi.getWorkflowStatus(changeOrderId).catch(() => null)
    if (status) setWorkflow(status)
  }

  const handleDelegate = async (id: string, delegateToUserId: string) => {
    await changeOrdersApi.delegate(id, delegateToUserId)
    setPendingApproval(null)
    const status = await changeOrdersApi.getWorkflowStatus(changeOrderId).catch(() => null)
    if (status) setWorkflow(status)
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
      {aiRecommendations.length > 0 && (
        <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
          <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI recommendations (hints only)
          </h4>
          <ul className="text-xs space-y-1 list-disc list-inside text-indigo-700 dark:text-indigo-300">
            {aiRecommendations.map((r, i) => (
              <li key={i}>{r.text}</li>
            ))}
          </ul>
        </div>
      )}
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
            onDelegate={handleDelegate}
            onComplete={onStatusChange}
          />
        </div>
      )}
    </div>
  )
}
