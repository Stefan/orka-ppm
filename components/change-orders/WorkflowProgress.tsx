'use client'

interface Level {
  level: number
  role: string
  status: string
  approval_date?: string
  comments?: string | null
  conditions?: string[] | unknown
}

interface WorkflowProgressProps {
  approvalLevels: Level[]
  isComplete: boolean
}

export default function WorkflowProgress({ approvalLevels, isComplete }: WorkflowProgressProps) {
  if (!approvalLevels.length) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Approval Progress</h4>
      <div className="space-y-2">
        {approvalLevels.map((lvl) => (
          <div
            key={lvl.level}
            className={`rounded-lg border p-3 text-sm ${
              lvl.status === 'approved'
                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
                : lvl.status === 'rejected'
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                : lvl.status === 'pending'
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50'
                : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">L{lvl.level}</span>
              <span className="capitalize">{lvl.role.replace(/_/g, ' ')}</span>
              <span className="text-xs opacity-80">({lvl.status})</span>
              {lvl.approval_date && (
                <span className="text-xs text-gray-600 dark:text-slate-400">
                  {new Date(lvl.approval_date).toLocaleString()}
                </span>
              )}
            </div>
            {lvl.comments && (
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">Comments: {lvl.comments}</p>
            )}
            {Array.isArray(lvl.conditions) && lvl.conditions.length > 0 && (
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">Conditions: {lvl.conditions.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
      {isComplete && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Workflow complete</p>
      )}
    </div>
  )
}
