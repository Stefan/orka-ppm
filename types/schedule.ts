/**
 * Types for Integrated Master Schedule and Gantt chart.
 * Aligns with backend API: schedules, tasks, dependencies, milestones.
 */

export interface ScheduleTask {
  id: string
  schedule_id: string
  parent_task_id?: string | null
  wbs_code: string
  name: string
  description?: string | null
  planned_start_date: string
  planned_end_date: string
  actual_start_date?: string | null
  actual_end_date?: string | null
  duration_days: number
  progress_percentage: number
  status: string
  is_critical?: boolean
  total_float_days?: number
  free_float_days?: number
  planned_effort_hours?: number | null
  actual_effort_hours?: number | null
  baseline_start_date?: string | null
  baseline_end_date?: string | null
  created_at?: string
  updated_at?: string
}

export interface ScheduleDependency {
  id: string
  predecessor_task_id: string
  successor_task_id: string
  dependency_type: string
  lag_days?: number
}

export interface ScheduleMilestone {
  id: string
  schedule_id: string
  task_id?: string | null
  name: string
  target_date: string
  status: string
  description?: string | null
}

/** Schedule list item (from GET /schedules). */
export interface ScheduleListItem {
  id: string
  project_id: string
  name: string
  description?: string | null
  start_date: string
  end_date: string
  status: string
  created_at?: string
  updated_at?: string
}

export interface ScheduleWithTasks {
  id: string
  project_id: string
  name: string
  description?: string | null
  start_date: string
  end_date: string
  status: string
  tasks: ScheduleTask[]
  dependencies?: ScheduleDependency[]
  milestones?: ScheduleMilestone[]
}

export type GanttZoomLevel = 'day' | 'week' | 'month' | 'quarter'

export interface GanttChartProps {
  tasks: ScheduleTask[]
  dependencies?: ScheduleDependency[]
  milestones?: ScheduleMilestone[]
  startDate: Date
  endDate: Date
  zoom?: GanttZoomLevel
  showCriticalPath?: boolean
  showFloat?: boolean
  showBaseline?: boolean
  onTaskClick?: (task: ScheduleTask) => void
  onTaskUpdate?: (taskId: string, updates: Partial<Pick<ScheduleTask, 'planned_start_date' | 'planned_end_date' | 'progress_percentage'>>) => void
  onDependencyCreate?: (predecessorId: string, successorId: string) => void
  className?: string
  'data-testid'?: string
}
