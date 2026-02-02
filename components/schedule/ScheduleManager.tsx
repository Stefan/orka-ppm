'use client'

/**
 * Schedule Manager – list with filtering, search, create/edit forms (Task 12.1).
 */

import React, { useState, useCallback } from 'react'
import type { ScheduleListItem } from '@/types/schedule'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Search, Plus, Calendar, Filter } from 'lucide-react'

export interface ScheduleManagerProps {
  schedules: ScheduleListItem[]
  projects?: { id: string; name: string }[]
  loading?: boolean
  onRefresh: () => void
  onCreateSchedule?: (data: { project_id: string; name: string; description?: string; start_date: string; end_date: string }) => Promise<void>
  onScheduleClick?: (schedule: ScheduleListItem) => void
  className?: string
  'data-testid'?: string
}

export function ScheduleManager({
  schedules,
  projects = [],
  loading = false,
  onRefresh,
  onCreateSchedule,
  onScheduleClick,
  className = '',
  'data-testid': testId = 'schedule-manager',
}: ScheduleManagerProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createProjectId, setCreateProjectId] = useState('')
  const [createStart, setCreateStart] = useState('')
  const [createEnd, setCreateEnd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = schedules.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    const matchProject = !projectFilter || s.project_id === projectFilter
    return matchSearch && matchStatus && matchProject
  })

  const handleCreate = useCallback(async () => {
    if (!onCreateSchedule || !createProjectId || !createName.trim() || !createStart || !createEnd) return
    setSubmitting(true)
    try {
      await onCreateSchedule({
        project_id: createProjectId,
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        start_date: createStart,
        end_date: createEnd,
      })
      setCreateOpen(false)
      setCreateName('')
      setCreateDescription('')
      setCreateProjectId('')
      setCreateStart('')
      setCreateEnd('')
      onRefresh()
    } finally {
      setSubmitting(false)
    }
  }, [onCreateSchedule, createProjectId, createName, createDescription, createStart, createEnd, onRefresh])

  return (
    <div className={`flex flex-col gap-4 ${className}`} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search schedules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          title="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            title="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {onCreateSchedule && (
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New schedule
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500" data-testid={`${testId}-loading`}>Loading schedules...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg" data-testid={`${testId}-empty`}>
          No schedules found. {onCreateSchedule && 'Create one to get started.'}
        </div>
      ) : (
        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onScheduleClick?.(s)}
                    className="text-sm font-medium text-blue-600 hover:underline truncate block text-left"
                  >
                    {s.name}
                  </button>
                  {s.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{s.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.start_date} – {s.end_date} · {s.status}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onScheduleClick?.(s)}
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" showClose onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create schedule</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={createProjectId}
                  onChange={(e) => setCreateProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Schedule name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <Input type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <Input type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !createName.trim() || !createStart || !createEnd || (projects.length > 0 && !createProjectId)}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
