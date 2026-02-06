'use client'

/**
 * Gantt Chart component for Integrated Master Schedule.
 * Task 11: Gantt chart with bars, dependencies, timeline zoom, critical path, milestones.
 * Task 11.2: Task edit modal, drag-and-drop rescheduling, dependency creation via UI.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react'
import {
  ScheduleTask,
  ScheduleDependency,
  ScheduleMilestone,
  GanttZoomLevel,
  GanttChartProps,
} from '@/types/schedule'
import { ZoomIn, ZoomOut, Calendar, Flag, Link2 } from 'lucide-react'
import { TaskEditModal } from './TaskEditModal'

const ROW_HEIGHT = 36
const LABEL_WIDTH = 240
const TICK_HEIGHT = 32

function getDatePosition(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime()
  const pos = date.getTime() - start.getTime()
  return total > 0 ? Math.max(0, Math.min(1, pos / total)) : 0
}

function getDateFromPosition(pct: number, start: Date, end: Date): Date {
  const total = end.getTime() - start.getTime()
  return new Date(start.getTime() + pct * total)
}

function getTicks(start: Date, end: Date, zoom: GanttZoomLevel): { date: Date; label: string; isMajor: boolean }[] {
  const ticks: { date: Date; label: string; isMajor: boolean }[] = []
  const curr = new Date(start)
  curr.setHours(0, 0, 0, 0)
  const endTime = end.getTime()

  if (zoom === 'day') {
    while (curr.getTime() <= endTime) {
      const isMajor = curr.getDate() === 1
      ticks.push({
        date: new Date(curr),
        label: curr.getDate().toString(),
        isMajor,
      })
      curr.setDate(curr.getDate() + 1)
    }
  } else if (zoom === 'week') {
    while (curr.getTime() <= endTime) {
      const weekStart = new Date(curr)
      const weekNum = getWeekNumber(weekStart)
      ticks.push({
        date: new Date(curr),
        label: `W${weekNum}`,
        isMajor: curr.getDate() <= 7,
      })
      curr.setDate(curr.getDate() + 7)
    }
  } else if (zoom === 'month') {
    while (curr.getTime() <= endTime) {
      ticks.push({
        date: new Date(curr),
        label: curr.toLocaleDateString('en-US', { month: 'short' }),
        isMajor: curr.getMonth() === 0,
      })
      curr.setMonth(curr.getMonth() + 1)
    }
  } else {
    // quarter
    while (curr.getTime() <= endTime) {
      const q = Math.floor(curr.getMonth() / 3) + 1
      ticks.push({
        date: new Date(curr),
        label: `Q${q} ${curr.getFullYear()}`,
        isMajor: curr.getMonth() === 0,
      })
      curr.setMonth(curr.getMonth() + 3)
    }
  }
  return ticks
}

function getWeekNumber(d: Date): number {
  const first = new Date(d.getFullYear(), 0, 1)
  const past = (d.getTime() - first.getTime()) / 86400000
  return Math.ceil((past + first.getDay() + 1) / 7)
}

export function GanttChart({
  tasks,
  dependencies = [],
  milestones = [],
  startDate,
  endDate,
  zoom: initialZoom = 'week',
  showCriticalPath = true,
  showFloat = true,
  showBaseline = false,
  onTaskClick,
  onTaskUpdate,
  onDependencyCreate,
  className = '',
  'data-testid': testId = 'gantt-chart',
}: GanttChartProps) {
  const [zoom, setZoom] = useState<GanttZoomLevel>(initialZoom)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [selectedTask, setSelectedTask] = useState<ScheduleTask | null>(null)
  const [dependencyFromTaskId, setDependencyFromTaskId] = useState<string | null>(null)
  const dragRef = useRef<{ taskId: string; startX: number; startLeft: number; startWidth: number; durationMs: number } | null>(null)
  const justDraggedRef = useRef(false)

  const start = useMemo(() => new Date(startDate), [startDate])
  const end = useMemo(() => new Date(endDate), [endDate])
  const totalMs = end.getTime() - start.getTime()

  const ticks = useMemo(() => getTicks(start, end, zoom), [start, end, zoom])

  const timelineWidth = useMemo(() => {
    const minWidth = 600
    const tickCount = ticks.length
    const preferred = tickCount * (zoom === 'day' ? 24 : zoom === 'week' ? 40 : zoom === 'month' ? 60 : 80)
    return Math.max(minWidth, preferred)
  }, [ticks.length, zoom])

  const taskById = useMemo(() => {
    const m = new Map<string, ScheduleTask>()
    tasks.forEach((t) => m.set(t.id, t))
    return m
  }, [tasks])

  const taskPositions = useMemo(() => {
    return tasks.map((task, index) => {
      const plannedStart = new Date(task.planned_start_date)
      const plannedEnd = new Date(task.planned_end_date)
      const left = getDatePosition(plannedStart, start, end)
      const width = Math.max(
        0.02,
        (plannedEnd.getTime() - plannedStart.getTime()) / totalMs
      )
      const progress = (task.progress_percentage ?? 0) / 100
      const baselineStart = task.baseline_start_date ? new Date(task.baseline_start_date) : null
      const baselineEnd = task.baseline_end_date ? new Date(task.baseline_end_date) : null
      let baselineLeft = 0
      let baselineWidth = 0
      if (showBaseline && baselineStart && baselineEnd) {
        baselineLeft = getDatePosition(baselineStart, start, end)
        baselineWidth = Math.max(
          0.02,
          (baselineEnd.getTime() - baselineStart.getTime()) / totalMs
        )
      }
      const floatDays = task.total_float_days ?? 0
      const lateEnd = floatDays > 0 ? new Date(plannedEnd.getTime() + floatDays * 86400000) : plannedEnd
      const floatWidth = showFloat && floatDays > 0 && !task.is_critical
        ? Math.max(0, getDatePosition(lateEnd, start, end) - left - width)
        : 0

      return {
        task,
        index,
        left,
        width,
        progress,
        baselineLeft,
        baselineWidth,
        floatWidth,
        top: index * ROW_HEIGHT,
      }
    })
  }, [tasks, start, end, totalMs, showFloat, showBaseline])

  const dependencyPaths = useMemo(() => {
    return dependencies.map((dep) => {
      const pred = taskPositions.find((p) => p.task.id === dep.predecessor_task_id)
      const succ = taskPositions.find((p) => p.task.id === dep.successor_task_id)
      if (!pred || !succ) return null
      const predEnd = (pred.left + pred.width) * timelineWidth + LABEL_WIDTH
      const succStart = succ.left * timelineWidth + LABEL_WIDTH
      const y1 = pred.top + ROW_HEIGHT / 2
      const y2 = succ.top + ROW_HEIGHT / 2
      const midX = (predEnd + succStart) / 2
      const path = `M ${predEnd} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${succStart} ${y2}`
      return {
        path,
        isCritical: pred.task.is_critical && succ.task.is_critical,
      }
    }).filter(Boolean) as { path: string; isCritical: boolean }[]
  }, [dependencies, taskPositions, timelineWidth])

  const milestonePositions = useMemo(() => {
    return milestones.map((m) => {
      const d = new Date(m.target_date)
      const left = getDatePosition(d, start, end)
      const taskIndex = tasks.findIndex((t) => t.id === m.task_id)
      const top = taskIndex >= 0 ? taskIndex * ROW_HEIGHT + ROW_HEIGHT / 2 : tasks.length * ROW_HEIGHT - ROW_HEIGHT / 2
      return {
        milestone: m,
        left: left * timelineWidth + LABEL_WIDTH,
        top,
      }
    })
  }, [milestones, tasks, start, end, timelineWidth])

  const zoomIn = useCallback(() => {
    const order: GanttZoomLevel[] = ['quarter', 'month', 'week', 'day']
    const i = order.indexOf(zoom)
    if (i < order.length - 1) setZoom(order[i + 1])
  }, [zoom])

  const zoomOut = useCallback(() => {
    const order: GanttZoomLevel[] = ['quarter', 'month', 'week', 'day']
    const i = order.indexOf(zoom)
    if (i > 0) setZoom(order[i - 1])
  }, [zoom])

  const handleTaskClick = useCallback(
    (task: ScheduleTask) => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false
        return
      }
      if (dependencyFromTaskId) {
        if (dependencyFromTaskId === 'active') {
          setDependencyFromTaskId(task.id)
          return
        }
        if (dependencyFromTaskId === task.id) {
          setDependencyFromTaskId(null)
          return
        }
        onDependencyCreate?.(dependencyFromTaskId, task.id)
        setDependencyFromTaskId(null)
        return
      }
      setSelectedTask(task)
    },
    [dependencyFromTaskId, onDependencyCreate]
  )

  const handleSaveTask = useCallback(
    (taskId: string, updates: { planned_start_date?: string; planned_end_date?: string; progress_percentage?: number }) => {
      onTaskUpdate?.(taskId, updates)
      setSelectedTask(null)
    },
    [onTaskUpdate]
  )

  const formatDate = useCallback((d: Date) => d.toISOString().slice(0, 10), [])

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, task: ScheduleTask, left: number, width: number) => {
      e.preventDefault()
      e.stopPropagation()
      if (dependencyFromTaskId) return
      const durationMs = (new Date(task.planned_end_date).getTime() - new Date(task.planned_start_date).getTime())
      dragRef.current = { taskId: task.id, startX: e.clientX, startLeft: left, startWidth: width, durationMs }
    },
    [dependencyFromTaskId]
  )

  const handleBarMouseUp = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || !onTaskUpdate) return
      const deltaPct = (e.clientX - drag.startX) / timelineWidth
      if (Math.abs(deltaPct) < 0.005) return
      justDraggedRef.current = true
      const newLeft = Math.max(0, Math.min(1 - drag.startWidth, drag.startLeft + deltaPct))
      const newStart = getDateFromPosition(newLeft, start, end)
      const newEnd = getDateFromPosition(newLeft + drag.startWidth, start, end)
      onTaskUpdate(drag.taskId, {
        planned_start_date: formatDate(newStart),
        planned_end_date: formatDate(newEnd),
      })
    },
    [onTaskUpdate, timelineWidth, start, end, formatDate]
  )

  React.useEffect(() => {
    const onUp = (e: MouseEvent) => handleBarMouseUp(e)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [handleBarMouseUp])

  return (
    <div
      className={`flex flex-col border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden touch-manipulation ${className}`}
      data-testid={testId}
    >
      {/* Toolbar - touch-friendly (Task 14.1) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 min-h-[44px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="p-2 min-w-[44px] min-h-[44px] rounded hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 touch-manipulation"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium capitalize">{zoom}</span>
          <button
            type="button"
            onClick={zoomIn}
            className="p-2 min-w-[44px] min-h-[44px] rounded hover:bg-gray-200 dark:hover:bg-slate-600 active:bg-gray-300 touch-manipulation"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
          {onDependencyCreate && (
            <button
              type="button"
              onClick={() => setDependencyFromTaskId((prev) => (prev ? null : 'active'))}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border ${
                dependencyFromTaskId ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-300' : 'border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700'
              }`}
              title="Click predecessor task, then successor task"
            >
              <Link2 className="w-3.5 h-3.5" /> Add dependency
            </button>
          )}
          {showCriticalPath && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500" /> Critical
            </span>
          )}
          {showFloat && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-200" /> Float
            </span>
          )}
          {milestones.length > 0 && (
            <span className="flex items-center gap-1">
              <Flag className="w-3.5 h-3.5" /> Milestones
            </span>
          )}
        </div>
      </div>
      {dependencyFromTaskId && (
        <p className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-b border-blue-100">
          Click the predecessor task, then the successor task to create a dependency.
        </p>
      )}

      {/* Chart area */}
      <div
        className="flex-1 overflow-auto"
        onScroll={(e) => setScrollLeft((e.target as HTMLDivElement).scrollLeft)}
      >
        <div style={{ width: LABEL_WIDTH + timelineWidth, minHeight: tasks.length * ROW_HEIGHT + TICK_HEIGHT }}>
          {/* Timeline header */}
          <div className="flex sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <div
              className="flex-shrink-0 border-r border-gray-200 dark:border-slate-700 flex items-end px-2 pb-1"
              style={{ width: LABEL_WIDTH, height: TICK_HEIGHT }}
            >
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Task
              </span>
            </div>
            <div
              className="flex-1 relative"
              style={{ width: timelineWidth, height: TICK_HEIGHT }}
            >
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 flex items-end pb-1 ${
                    tick.isMajor ? 'border-l border-gray-300 dark:border-slate-600' : 'border-l border-gray-100'
                  }`}
                  style={{
                    left: (i / Math.max(1, ticks.length - 1)) * timelineWidth,
                    width: 1,
                  }}
                >
                  <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap -translate-x-1/2 ml-0.5">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dependency lines (SVG) */}
          {dependencyPaths.length > 0 && (
            <svg
              className="absolute pointer-events-none"
              width={LABEL_WIDTH + timelineWidth}
              height={tasks.length * ROW_HEIGHT}
              style={{ top: TICK_HEIGHT, left: 0 }}
            >
              {dependencyPaths.map((dp, i) => (
                <path
                  key={i}
                  d={dp.path}
                  fill="none"
                  stroke={dp.isCritical && showCriticalPath ? '#ef4444' : '#94a3b8'}
                  strokeWidth={dp.isCritical && showCriticalPath ? 2 : 1}
                  strokeDasharray={dp.isCritical ? undefined : '4 2'}
                />
              ))}
            </svg>
          )}

          {/* Task rows */}
          <div className="relative">
            {taskPositions.map(({ task, index, left, width, progress, baselineLeft, baselineWidth, floatWidth, top }) => (
              <div
                key={task.id}
                className={`flex items-center border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50/80 ${
                  dependencyFromTaskId === task.id ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200' : ''
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                <div
                  className="flex-shrink-0 flex items-center gap-2 px-2 border-r border-gray-200 dark:border-slate-700 cursor-pointer"
                  style={{ width: LABEL_WIDTH }}
                  onClick={() => handleTaskClick(task)}
                >
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">{task.wbs_code}</span>
                  <span className="text-sm truncate" title={task.name}>
                    {task.name}
                  </span>
                  {task.is_critical && showCriticalPath && (
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Critical" />
                  )}
                </div>
                <div
                  className="relative flex-1"
                  style={{ width: timelineWidth, height: ROW_HEIGHT - 4, marginTop: 2, marginBottom: 2 }}
                >
                  {/* Baseline bar (dashed) */}
                  {showBaseline && baselineWidth > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-5 border border-dashed border-gray-400 rounded bg-gray-100 dark:bg-slate-700/50"
                      style={{
                        left: `${baselineLeft * 100}%`,
                        width: `${baselineWidth * 100}%`,
                      }}
                    />
                  )}
                  {/* Float (slack) bar */}
                  {floatWidth > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-5 rounded-r bg-amber-200/60 border border-amber-300"
                      style={{
                        left: `${(left + width) * 100}%`,
                        width: `${floatWidth * 100}%`,
                      }}
                    />
                  )}
                  {/* Main task bar – drag to reschedule */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 rounded border cursor-grab active:cursor-grabbing"
                    style={{
                      left: `${left * 100}%`,
                      width: `${width * 100}%`,
                      backgroundColor: task.is_critical && showCriticalPath ? '#fecaca' : '#bfdbfe',
                      borderColor: task.is_critical && showCriticalPath ? '#ef4444' : '#3b82f6',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTaskClick(task)
                    }}
                    onMouseDown={(e) => onTaskUpdate && handleBarMouseDown(e, task, left, width)}
                    title={`${task.planned_start_date} – ${task.planned_end_date} · ${task.progress_percentage}% (drag to reschedule)`}
                  >
                    <div
                      className="h-full rounded-l bg-blue-500/70 pointer-events-none"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Milestone markers */}
          {milestonePositions.map(({ milestone, left, top }) => (
            <div
              key={milestone.id}
              className="absolute w-0 h-0 pointer-events-none"
              style={{
                left: left - 6,
                top: TICK_HEIGHT + top - 8,
              }}
              title={`${milestone.name} – ${milestone.target_date}`}
            >
              <Flag
                className="w-4 h-4 text-violet-600"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
          ))}
        </div>
      </div>

      <TaskEditModal
        open={selectedTask !== null}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        task={selectedTask}
        onSave={handleSaveTask}
      />
    </div>
  )
}

export default GanttChart
