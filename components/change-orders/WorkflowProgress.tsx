'use client'

interface Level {
  level: number
  role: string
  status: string
}

interface WorkflowProgressProps {
  approvalLevels: Level[]
  isComplete: boolean
}

export default function WorkflowProgress({ approvalLevels, isComplete }: WorkflowProgressProps) {
  if (!approvalLevels.length) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Approval Progress</h4>
      <div className="flex flex-wrap gap-2">
        {approvalLevels.map((lvl) => (
          <div
            key={lvl.level}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              lvl.status === 'approved'
                ? 'bg-green-100 text-green-800'
                : lvl.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : lvl.status === 'pending'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            <span className="font-medium">L{lvl.level}</span>
            <span className="capitalize">{lvl.role.replace(/_/g, ' ')}</span>
            <span className="text-xs">({lvl.status})</span>
          </div>
        ))}
      </div>
      {isComplete && (
        <p className="text-sm text-green-600 font-medium">✓ Workflow complete</p>
      )}
    </div>
  )
}
