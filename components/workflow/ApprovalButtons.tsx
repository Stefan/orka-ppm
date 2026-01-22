'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, X } from 'lucide-react'

interface ApprovalButtonsProps {
  approvalId: string
  workflowInstanceId: string
  onApprovalSubmitted: (decision: 'approved' | 'rejected') => void
  disabled?: boolean
  showComments?: boolean
}

export default function ApprovalButtons({
  approvalId,
  workflowInstanceId,
  onApprovalSubmitted,
  disabled = false,
  showComments = true
}: ApprovalButtonsProps) {
  const [showModal, setShowModal] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'rejected' | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleButtonClick = (decision: 'approved' | 'rejected') => {
    if (showComments) {
      setPendingDecision(decision)
      setShowModal(true)
    } else {
      submitApproval(decision, '')
    }
  }

  const submitApproval = async (decision: 'approved' | 'rejected', comment: string) => {
    try {
      setSubmitting(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/workflows/instances/${workflowInstanceId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision,
          comments: comment.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to submit approval')
      }

      // Success
      setShowModal(false)
      setComments('')
      setPendingDecision(null)
      onApprovalSubmitted(decision)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleModalSubmit = () => {
    if (pendingDecision) {
      submitApproval(pendingDecision, comments)
    }
  }

  const handleModalClose = () => {
    if (!submitting) {
      setShowModal(false)
      setComments('')
      setPendingDecision(null)
      setError(null)
    }
  }

  return (
    <>
      {/* Approval Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleButtonClick('approved')}
          disabled={disabled || submitting}
          className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
        >
          <CheckCircle size={20} />
          Approve
        </button>
        <button
          onClick={() => handleButtonClick('rejected')}
          disabled={disabled || submitting}
          className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
        >
          <XCircle size={20} />
          Reject
        </button>
      </div>

      {/* Comments Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                {pendingDecision === 'approved' ? (
                  <CheckCircle className="text-green-600" size={24} />
                ) : (
                  <XCircle className="text-red-600" size={24} />
                )}
                <h3 className="text-lg font-semibold text-gray-900">
                  {pendingDecision === 'approved' ? 'Approve' : 'Reject'} Workflow
                </h3>
              </div>
              <button
                onClick={handleModalClose}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments {pendingDecision === 'rejected' && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder={
                    pendingDecision === 'approved'
                      ? 'Add optional comments about your approval...'
                      : 'Please explain why you are rejecting this workflow...'
                  }
                  disabled={submitting}
                />
                {pendingDecision === 'rejected' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Comments are required when rejecting a workflow
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className={`p-3 rounded-lg ${
                pendingDecision === 'approved' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm ${
                  pendingDecision === 'approved' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {pendingDecision === 'approved' 
                    ? 'This workflow will be approved and moved to the next step.'
                    : 'This workflow will be rejected and stopped.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={handleModalClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={submitting || (pendingDecision === 'rejected' && !comments.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                  pendingDecision === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? 'Submitting...' : `Confirm ${pendingDecision === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
