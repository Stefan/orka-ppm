'use client'

import { useState } from 'react'
import { Check, X, UserPlus } from 'lucide-react'

interface ApprovalActionsProps {
  approvalId: string
  onApprove: (id: string, payload?: { comments?: string; conditions?: string[] }) => Promise<void>
  onReject: (id: string, payload: { comments: string; conditions?: string[] }) => Promise<void>
  onDelegate?: (id: string, delegateToUserId: string) => Promise<void>
  onComplete?: () => void
}

export default function ApprovalActions({ approvalId, onApprove, onReject, onDelegate, onComplete }: ApprovalActionsProps) {
  const [comments, setComments] = useState('')
  const [conditions, setConditions] = useState('')
  const [delegateUserId, setDelegateUserId] = useState('')
  const [showDelegateModal, setShowDelegateModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove(approvalId, {
        comments: comments || undefined,
        conditions: conditions.trim() ? conditions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      })
      onComplete?.()
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!comments.trim()) {
      alert('Please provide rejection comments')
      return
    }
    setLoading(true)
    try {
      await onReject(approvalId, {
        comments: comments.trim(),
        conditions: conditions.trim() ? conditions.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      })
      onComplete?.()
    } finally {
      setLoading(false)
    }
  }

  const handleDelegate = async () => {
    if (!delegateUserId.trim()) return
    setLoading(true)
    try {
      await onDelegate?.(approvalId, delegateUserId.trim())
      setShowDelegateModal(false)
      setDelegateUserId('')
      onComplete?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        placeholder="Comments (required for rejection)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        rows={2}
      />
      <input
        type="text"
        placeholder="Conditions (optional, comma-separated)"
        value={conditions}
        onChange={(e) => setConditions(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={loading || !comments.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
        {onDelegate && (
          <button
            type="button"
            onClick={() => setShowDelegateModal(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <UserPlus className="w-4 h-4" />
            Delegate
          </button>
        )}
      </div>
      {showDelegateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDelegateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-medium mb-2">Delegate approval</h4>
            <input
              type="text"
              placeholder="Delegate to user ID (UUID)"
              value={delegateUserId}
              onChange={(e) => setDelegateUserId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowDelegateModal(false)} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
              <button type="button" onClick={handleDelegate} disabled={loading || !delegateUserId.trim()} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Delegate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
