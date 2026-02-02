'use client'

/**
 * Resource assignment dialog and conflict/utilization display (Task 12.3).
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertTriangle, Users } from 'lucide-react'

export interface ResourceAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  taskId?: string | null
  taskName?: string
  tasks?: { id: string; name: string; wbs_code: string }[]
  resources: { id: string; name: string }[]
  accessToken: string | null
  onAssigned?: () => void
}

export function ResourceAssignmentDialog({
  open,
  onOpenChange,
  scheduleId,
  taskId: initialTaskId,
  taskName,
  tasks = [],
  resources,
  accessToken,
  onAssigned,
}: ResourceAssignmentDialogProps) {
  const [taskId, setTaskId] = useState(initialTaskId ?? '')
  const [resourceId, setResourceId] = useState('')
  const [allocation, setAllocation] = useState(100)
  const [submitting, setSubmitting] = useState(false)
  const effectiveTaskId = initialTaskId ?? taskId
  const effectiveTaskName = taskName ?? tasks.find((t) => t.id === effectiveTaskId)?.name
  const [conflicts, setConflicts] = useState<{ type: string; description: string; resource_name?: string }[]>([])
  const [utilization, setUtilization] = useState<{ resource_name: string; utilization_percentage: number; is_overallocated: boolean }[]>([])

  useEffect(() => {
    if (!open || !scheduleId || !accessToken) return
    const load = async () => {
      try {
        const [cr, ur] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}/resource-conflicts`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then((r) => (r.ok ? r.json() : { conflicts: [] })),
          fetch(`/api/schedules/${scheduleId}/resource-utilization`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then((r) => (r.ok ? r.json() : { resource_utilization: [] })),
        ])
        setConflicts(cr.conflicts ?? [])
        setUtilization(ur.resource_utilization ?? [])
      } catch {
        setConflicts([])
        setUtilization([])
      }
    }
    load()
  }, [open, scheduleId, accessToken])

  const handleAssign = async () => {
    if (!effectiveTaskId || !resourceId || !accessToken) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/schedules/tasks/${effectiveTaskId}/resources`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resource_id: resourceId,
          allocation_percentage: Math.max(1, Math.min(100, allocation)),
        }),
      })
      if (res.ok) {
        onAssigned?.()
        onOpenChange(false)
        setResourceId('')
        setAllocation(100)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto" showClose onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Assign resource
            {effectiveTaskName && <span className="text-sm font-normal text-gray-500">· {effectiveTaskName}</span>}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {tasks.length > 0 && !initialTaskId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select task</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.wbs_code} {t.name}</option>
                ))}
              </select>
            </div>
          )}
          {effectiveTaskId && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
                <select
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select resource</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allocation (%)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={allocation}
                  onChange={(e) => setAllocation(Number(e.target.value) || 100)}
                />
              </div>
              <Button onClick={handleAssign} disabled={submitting || !resourceId || !effectiveTaskId}>
                {submitting ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          )}

          {conflicts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Conflicts
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {conflicts.slice(0, 5).map((c, i) => (
                  <li key={i}>{c.description ?? c.type}</li>
                ))}
              </ul>
            </div>
          )}

          {utilization.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">Utilization</h4>
              <ul className="text-sm space-y-1">
                {utilization.slice(0, 5).map((u, i) => (
                  <li key={i} className={u.is_overallocated ? 'text-amber-600' : 'text-gray-600'}>
                    {u.resource_name}: {u.utilization_percentage}%{u.is_overallocated ? ' (overallocated)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!effectiveTaskId && tasks.length === 0 && (
            <p className="text-sm text-gray-500">No tasks in this schedule. Add tasks first.</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
