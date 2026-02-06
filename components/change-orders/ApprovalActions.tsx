'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'

interface ApprovalActionsProps {
  approvalId: string
  onApprove: (id: string, comments?: string) => Promise<void>
  onReject: (id: string, comments: string) => Promise<void>
  onComplete?: () => void
}

export default function ApprovalActions({ approvalId, onApprove, onReject, onComplete }: ApprovalActionsProps) {
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove(approvalId, comments || undefined)
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
      await onReject(approvalId, comments)
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
      <div className="flex gap-2">
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
      </div>
    </div>
  )
}
