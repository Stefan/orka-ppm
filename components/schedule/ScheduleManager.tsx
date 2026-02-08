'use client'

/**
 * Schedule Manager – list with filtering, search, create/edit forms (Task 12.1).
 */

import React, { useState, useCallback } from 'react'
import type { ScheduleListItem } from '@/types/schedule'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTranslations } from '@/lib/i18n/context'
import { Search, Plus, Calendar } from 'lucide-react'

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
  const { t } = useTranslations()
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={t('schedules.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
          title={t('schedules.filterByStatus')}
        >
          <option value="">{t('schedules.allStatuses')}</option>
          <option value="active">{t('schedules.statusActive')}</option>
          <option value="draft">{t('schedules.statusDraft')}</option>
          <option value="completed">{t('schedules.statusCompleted')}</option>
        </select>
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
            title={t('schedules.filterByProject')}
          >
            <option value="">{t('schedules.allProjects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {onCreateSchedule && (
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('schedules.newSchedule')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 dark:text-slate-400" data-testid={`${testId}-loading`}>{t('schedules.loadingSchedules')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-slate-400 border border-dashed border-gray-200 dark:border-slate-700 rounded-lg" data-testid={`${testId}-empty`}>
          {t('schedules.noSchedulesFound')} {onCreateSchedule && t('schedules.createOneToGetStarted')}
        </div>
      ) : (
        <ul className="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100">
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onScheduleClick?.(s)}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block text-left"
                  >
                    {s.name}
                  </button>
                  {s.description && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{s.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
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
            <DialogTitle>{t('schedules.createScheduleTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('schedules.projectLabel')}</label>
                <select
                  value={createProjectId}
                  onChange={(e) => setCreateProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
                >
                  <option value="">{t('schedules.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('schedules.nameLabel')}</label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t('schedules.scheduleName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('schedules.descriptionOptional')}</label>
              <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder={t('schedules.descriptionOptional')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('schedules.startDate')}</label>
                <Input type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('schedules.endDate')}</label>
                <Input type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={submitting || !createName.trim() || !createStart || !createEnd || (projects.length > 0 && !createProjectId)}>
              {submitting ? t('schedules.creating') : t('schedules.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
