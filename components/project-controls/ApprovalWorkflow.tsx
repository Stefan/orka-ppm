'use client'

interface ApprovalWorkflowProps {
  status?: string
  lastApprovedBy?: string
  lastApprovedAt?: string
}

export default function ApprovalWorkflow({ status, lastApprovedBy, lastApprovedAt }: ApprovalWorkflowProps) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-medium text-gray-700">Approval Status</h4>
      <p className="text-sm text-gray-600 mt-1">Status: {status ?? 'Pending'}</p>
      {lastApprovedBy && (
        <p className="text-xs text-gray-500 mt-1">
          Last approved by {lastApprovedBy} {lastApprovedAt ? `on ${lastApprovedAt}` : ''}
        </p>
      )}
    </div>
  )
}
