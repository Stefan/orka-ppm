'use client'

interface ApprovalWorkflowProps {
  status?: string
  lastApprovedBy?: string
  lastApprovedAt?: string
}

export default function ApprovalWorkflow({ status, lastApprovedBy, lastApprovedAt }: ApprovalWorkflowProps) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Approval Status</h4>
      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Status: {status ?? 'Pending'}</p>
      {lastApprovedBy && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Last approved by {lastApprovedBy} {lastApprovedAt ? `on ${lastApprovedAt}` : ''}
        </p>
      )}
    </div>
  )
}
