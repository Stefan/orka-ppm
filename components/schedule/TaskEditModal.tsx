'use client'

/**
 * Task edit modal for Gantt chart – progress and date updates (Task 11.2).
 */

import React, { useState, useEffect } from 'react'
import type { ScheduleTask } from '@/types/schedule'
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

export interface TaskEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: ScheduleTask | null
  onSave: (taskId: string, updates: {
    planned_start_date?: string
    planned_end_date?: string
    progress_percentage?: number
  }) => void
}

export function TaskEditModal({
  open,
  onOpenChange,
  task,
  onSave,
}: TaskEditModalProps) {
  const [progress, setProgress] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (task) {
      setProgress(task.progress_percentage ?? 0)
      setStartDate(task.planned_start_date?.slice(0, 10) ?? '')
      setEndDate(task.planned_end_date?.slice(0, 10) ?? '')
    }
  }, [task])

  if (!task) return null

  const handleSave = () => {
    const updates: { planned_start_date?: string; planned_end_date?: string; progress_percentage?: number } = {}
    if (startDate) updates.planned_start_date = startDate
    if (endDate) updates.planned_end_date = endDate
    if (progress !== task.progress_percentage) updates.progress_percentage = Math.max(0, Math.min(100, progress))
    if (Object.keys(updates).length > 0) {
      onSave(task.id, updates)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        showClose={true}
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <p className="text-sm text-gray-500 font-mono mt-0.5">{task.wbs_code}</p>
          <p className="text-sm text-gray-700 mt-1">{task.name}</p>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Progress (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none bg-gray-200 accent-blue-600"
              />
              <span className="text-sm font-medium w-10">{progress}%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Planned start
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Planned end
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
