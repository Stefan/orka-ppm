'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Users, CheckCircle, TrendingUp, BarChart3, Target, PlayCircle, Settings, FileText, MessageSquare, AlertTriangle } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

// Utility function for date formatting
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

// Types based on the design document and backend models
interface ImplementationTask {
  id: string
  implementation_plan_id: string
  task_number: number
  title: string
  description?: string
  task_type: string
  assigned_to: string
  assigned_to_name?: string
  planned_start_date: string
  planned_end_date: string
  actual_start_date?: string
  actual_end_date?: string
  status: string
  progress_percentage: number
  estimated_effort_hours: number
  actual_effort_hours?: number
  dependencies: string[]
  deliverables: string[]
  created_at: string
  updated_at: string
}

interface ImplementationPlan {
  id: string
  change_request_id: string
  planned_start_date: string
  planned_end_date: string
  actual_start_date?: string
  actual_end_date?: string
  assigned_to: string
  assigned_to_name?: string
  status: string
  progress_percentage: number
  created_at: string
  updated_at: string
}

interface ImplementationMilestone {
  id: string
  title: string
  type: string
  target_date: string
  actual_date?: string
  status: string
  milestone_type: string
}

interface ImplementationProgressNote {
  id: string
  implementation_task_id: string
  note: string
  progress_percentage: number
  created_by: string
  created_by_name?: string
  created_at: string
}

interface ImplementationDeviation {
  id: string
  deviation_type: string
  severity: string
  description: string
  root_cause?: string
  corrective_action?: string
  detected_date: string
  status: string
}

interface ImplementationStatus {
  implementation_plan: ImplementationPlan
  progress_summary: {
    overall_progress_percentage: number
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    pending_tasks: number
  }
  schedule_status: {
    status: string
    progress_percentage: number
    expected_progress: number
    progress_variance: number
    projected_end_date: string
    days_variance: number
    on_schedule: boolean
  }
  tasks: ImplementationTask[]
  milestones: ImplementationMilestone[]
  recent_progress_notes: ImplementationProgressNote[]
  deviations: ImplementationDeviation[]
  status_updated_at: string
}

interface ImplementationTrackerProps {
  changeRequestId: string
  implementationPlanId?: string
  onStatusUpdate?: (status: ImplementationStatus) => void
}

const TASK_STATUSES = [
  { value: 'planned', label: 'Planned', color: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' }
]

const DEVIATION_SEVERITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' }
]

export default function ImplementationTracker({ 
  changeRequestId, 
  implementationPlanId,
  onStatusUpdate 
}: ImplementationTrackerProps) {
  const t = useTranslations('changes');
  const [implementationStatus, setImplementationStatus] = useState<ImplementationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'gantt' | 'milestones' | 'progress'>('overview')
  const [selectedTask, setSelectedTask] = useState<ImplementationTask | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressUpdate, setProgressUpdate] = useState({
    progress_percentage: 0,
    notes: '',
    actual_effort_hours: 0
  })

  // Load implementation status from API when available
  useEffect(() => {
    setImplementationStatus(null)
    setLoading(false)
  }, [changeRequestId, implementationPlanId, onStatusUpdate])

  const handleTaskProgressUpdate = (task: ImplementationTask) => {
    setSelectedTask(task)
    setProgressUpdate({
      progress_percentage: task.progress_percentage,
      notes: '',
      actual_effort_hours: task.actual_effort_hours || 0
    })
    setShowProgressModal(true)
  }

  const handleProgressSubmit = async () => {
    if (!selectedTask) return

    try {
      // API call to update task progress
      console.log('Updating task progress:', {
        taskId: selectedTask.id,
        ...progressUpdate
      })

      // Update local state
      if (implementationStatus) {
        const updatedTasks = implementationStatus.tasks.map(task =>
          task.id === selectedTask.id
            ? {
                ...task,
                progress_percentage: progressUpdate.progress_percentage,
                actual_effort_hours: progressUpdate.actual_effort_hours,
                updated_at: new Date().toISOString()
              }
            : task
        )

        const updatedStatus = {
          ...implementationStatus,
          tasks: updatedTasks,
          progress_summary: {
            ...implementationStatus.progress_summary,
            overall_progress_percentage: Math.round(
              updatedTasks.reduce((sum, task) => sum + task.progress_percentage, 0) / updatedTasks.length
            )
          }
        }

        setImplementationStatus(updatedStatus)
        if (onStatusUpdate) {
          onStatusUpdate(updatedStatus)
        }
      }

      setShowProgressModal(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('Error updating task progress:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const statusConfig = TASK_STATUSES.find(s => s.value === status)
    return statusConfig?.color || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
  }

  const getSeverityColor = (severity: string) => {
    const severityConfig = DEVIATION_SEVERITIES.find(s => s.value === severity)
    return severityConfig?.color || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const today = new Date()
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    )
  }

  if (!implementationStatus) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">No Implementation Plan</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          This change request does not have an active implementation plan.
        </p>
      </div>
    )
  }

  const { implementation_plan, progress_summary, schedule_status, tasks, milestones, recent_progress_notes, deviations } = implementationStatus

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Implementation Tracking</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Change Request: {changeRequestId} • Assigned to: {implementation_plan.assigned_to_name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {progress_summary.overall_progress_percentage}%
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">Overall Progress</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {calculateDaysRemaining(implementation_plan.planned_end_date)}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">Days Remaining</div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                schedule_status.on_schedule ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              }`}>
                {schedule_status.status.replace('_', ' ')}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Schedule Status</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400 mb-2">
            <span>Implementation Progress</span>
            <span>{progress_summary.overall_progress_percentage}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3" role="progressbar" 
               aria-valuenow={progress_summary.overall_progress_percentage} 
               aria-valuemin={0} 
               aria-valuemax={100}>
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress_summary.overall_progress_percentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'tasks', label: 'Tasks', icon: CheckCircle },
              { id: 'gantt', label: 'Gantt Chart', icon: Calendar },
              { id: 'milestones', label: 'Milestones', icon: Target },
              { id: 'progress', label: 'Progress Notes', icon: MessageSquare }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-900">Total Tasks</p>
                      <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{progress_summary.total_tasks}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-900">Completed</p>
                      <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{progress_summary.completed_tasks}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-900">In Progress</p>
                      <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">{progress_summary.in_progress_tasks}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center">
                    <PlayCircle className="h-8 w-8 text-gray-600 dark:text-slate-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Pending</p>
                      <p className="text-2xl font-semibold text-gray-600 dark:text-slate-400">{progress_summary.pending_tasks}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Status */}
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Schedule Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Planned End Date</p>
                    <p className="text-lg font-semibold">{formatDate(implementation_plan.planned_end_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Projected End Date</p>
                    <p className="text-lg font-semibold">{formatDate(schedule_status.projected_end_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">Schedule Variance</p>
                    <p className={`text-lg font-semibold ${
                      schedule_status.days_variance <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {schedule_status.days_variance > 0 ? '+' : ''}{schedule_status.days_variance} days
                    </p>
                  </div>
                </div>
              </div>

              {/* Deviations Alert */}
              {deviations.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Active Deviations ({deviations.length})
                    </h3>
                  </div>
                  <div className="mt-2 space-y-2">
                    {deviations.slice(0, 3).map((deviation) => (
                      <div key={deviation.id} className="text-sm text-yellow-700">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${getSeverityColor(deviation.severity)}`}>
                          {deviation.severity}
                        </span>
                        {deviation.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Implementation Tasks</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Add Task
                </button>
              </div>

              <div className="space-y-4">
                {tasks.map((task) => (
                  <div key={task.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500 dark:text-slate-400">#{task.task_number}</span>
                          <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">{task.title}</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">{task.description}</p>
                        )}

                        <div className="flex items-center gap-6 mt-3 text-sm text-gray-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {task.assigned_to_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(task.planned_start_date)} - {formatDate(task.planned_end_date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {task.estimated_effort_hours}h estimated
                            {task.actual_effort_hours && ` / ${task.actual_effort_hours}h actual`}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400 mb-1">
                            <span>Progress</span>
                            <span>{task.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${task.progress_percentage}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Dependencies */}
                        {task.dependencies.length > 0 && (
                          <div className="mt-3">
                            <span className="text-sm text-gray-500 dark:text-slate-400">
                              Dependencies: {task.dependencies.length} task(s)
                            </span>
                          </div>
                        )}

                        {/* Deliverables */}
                        {task.deliverables.length > 0 && (
                          <div className="mt-2">
                            <span className="text-sm text-gray-500 dark:text-slate-400">Deliverables:</span>
                            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-slate-400 ml-4">
                              {task.deliverables.map((deliverable, index) => (
                                <li key={index}>{deliverable}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleTaskProgressUpdate(task)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Update Progress
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 dark:text-slate-200">
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gantt Chart Tab */}
          {activeTab === 'gantt' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Gantt Chart View</h3>
              
              {/* Simplified Gantt Chart */}
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                <div className="overflow-x-auto">
                  <div className="min-w-full">
                    {/* Timeline Header */}
                    <div className="flex items-center mb-4">
                      <div className="w-64 text-sm font-medium text-gray-700 dark:text-slate-300">Task</div>
                      <div className="flex-1 grid grid-cols-31 gap-1 text-xs text-gray-500 dark:text-slate-400">
                        {Array.from({ length: 31 }, (_, i) => (
                          <div key={i} className="text-center">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Task Rows */}
                    {tasks.map((task) => {
                      const startDate = new Date(task.planned_start_date)
                      const endDate = new Date(task.planned_end_date)
                      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                      const startDay = startDate.getDate()
                      
                      return (
                        <div key={task.id} className="flex items-center mb-2">
                          <div className="w-64 text-sm text-gray-900 dark:text-slate-100 truncate pr-4">
                            #{task.task_number} {task.title}
                          </div>
                          <div className="flex-1 grid grid-cols-31 gap-1 h-6">
                            {Array.from({ length: 31 }, (_, i) => {
                              const dayNumber = i + 1
                              const isInRange = dayNumber >= startDay && dayNumber < startDay + duration
                              const progressWidth = isInRange ? (task.progress_percentage / 100) : 0
                              
                              return (
                                <div key={i} className="relative h-full">
                                  {isInRange && (
                                    <>
                                      <div className="absolute inset-0 bg-blue-200 rounded"></div>
                                      <div 
                                        className="absolute inset-0 bg-blue-600 rounded"
                                        style={{ width: `${progressWidth * 100}%` }}
                                      ></div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Implementation Milestones</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Add Milestone
                </button>
              </div>

              <div className="space-y-4">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Target className={`h-5 w-5 ${
                          milestone.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                        }`} />
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">{milestone.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            Target: {formatDate(milestone.target_date)}
                            {milestone.actual_date && ` • Actual: ${formatDate(milestone.actual_date)}`}
                          </p>
                        </div>
                      </div>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Notes Tab */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Progress Notes</h3>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Add Note
                </button>
              </div>

              <div className="space-y-4">
                {recent_progress_notes.map((note) => (
                  <div key={note.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {note.created_by_name}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-slate-400">
                            {formatDateTime(note.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-700 dark:text-slate-300">{note.note}</p>
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {note.progress_percentage}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Progress</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Update Modal */}
      {showProgressModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">
                Update Progress: {selectedTask.title}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Progress Percentage
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={progressUpdate.progress_percentage}
                    onChange={(e) => setProgressUpdate(prev => ({
                      ...prev,
                      progress_percentage: parseInt(e.target.value)
                    }))}
                    className="w-full"
                  />
                  <div className="text-center text-sm text-gray-600 dark:text-slate-400 mt-1">
                    {progressUpdate.progress_percentage}%
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Actual Effort Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={progressUpdate.actual_effort_hours}
                    onChange={(e) => setProgressUpdate(prev => ({
                      ...prev,
                      actual_effort_hours: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Progress Notes
                  </label>
                  <textarea
                    rows={3}
                    value={progressUpdate.notes}
                    onChange={(e) => setProgressUpdate(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    placeholder="Add notes about progress, issues, or achievements..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowProgressModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProgressSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Update Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Resource Allocation Component
interface ResourceAllocation {
  id: string
  resource_type: string
  resource_name: string
  allocated_hours: number
  utilized_hours: number
  cost_per_hour: number
  total_cost: number
  allocation_start_date: string
  allocation_end_date: string
}

interface ResourceAllocationProps {
  implementationPlanId: string
  resources: ResourceAllocation[]
  onResourceUpdate?: (resources: ResourceAllocation[]) => void
}

export function ResourceAllocationView({ 
  implementationPlanId: _implementationPlanId, 
  resources, 
  onResourceUpdate 
}: ResourceAllocationProps) {
  const [showAddResource, setShowAddResource] = useState(false)
  const [newResource, setNewResource] = useState({
    resource_type: 'human',
    resource_name: '',
    allocated_hours: 0,
    cost_per_hour: 0,
    allocation_start_date: '',
    allocation_end_date: ''
  })

  const handleAddResource = () => {
    const resource: ResourceAllocation = {
      id: `resource-${Date.now()}`,
      ...newResource,
      utilized_hours: 0,
      total_cost: newResource.allocated_hours * newResource.cost_per_hour
    }

    const updatedResources = [...resources, resource]
    if (onResourceUpdate) {
      onResourceUpdate(updatedResources)
    }

    setNewResource({
      resource_type: 'human',
      resource_name: '',
      allocated_hours: 0,
      cost_per_hour: 0,
      allocation_start_date: '',
      allocation_end_date: ''
    })
    setShowAddResource(false)
  }

  const calculateUtilization = (resource: ResourceAllocation) => {
    if (resource.allocated_hours === 0) return 0
    return Math.round((resource.utilized_hours / resource.allocated_hours) * 100)
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 50) return 'text-red-600 dark:text-red-400'
    if (utilization < 80) return 'text-yellow-600 dark:text-yellow-400'
    if (utilization <= 100) return 'text-green-600 dark:text-green-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Resource Allocation</h3>
        <button
          onClick={() => setShowAddResource(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Add Resource
        </button>
      </div>

      {/* Resource Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-900">Total Resources</p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{resources.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-900">Total Allocated Hours</p>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {resources.reduce((sum, r) => sum + r.allocated_hours, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-900">Total Cost</p>
              <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                ${resources.reduce((sum, r) => sum + r.total_cost, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resource List */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Allocation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Utilization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Period
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {resources.map((resource) => {
              const utilization = calculateUtilization(resource)
              return (
                <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{resource.resource_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 capitalize">
                      {resource.resource_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {resource.allocated_hours}h allocated<br />
                    <span className="text-gray-500 dark:text-slate-400">{resource.utilized_hours}h utilized</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            utilization <= 100 ? 'bg-green-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-medium ${getUtilizationColor(utilization)}`}>
                        {utilization}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    ${resource.cost_per_hour}/hr<br />
                    <span className="font-medium">${resource.total_cost.toLocaleString()} total</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(resource.allocation_start_date)} -<br />
                    {formatDate(resource.allocation_end_date)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {resources.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">No resources allocated</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Get started by adding resources to this implementation.
            </p>
          </div>
        )}
      </div>

      {/* Add Resource Modal */}
      {showAddResource && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Add Resource</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Resource Type
                  </label>
                  <select
                    value={newResource.resource_type}
                    onChange={(e) => setNewResource(prev => ({
                      ...prev,
                      resource_type: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="human">Human Resource</option>
                    <option value="equipment">Equipment</option>
                    <option value="material">Material</option>
                    <option value="contractor">Contractor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Resource Name
                  </label>
                  <input
                    type="text"
                    value={newResource.resource_name}
                    onChange={(e) => setNewResource(prev => ({
                      ...prev,
                      resource_name: e.target.value
                    }))}
                    placeholder="Enter resource name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Allocated Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newResource.allocated_hours}
                      onChange={(e) => setNewResource(prev => ({
                        ...prev,
                        allocated_hours: parseInt(e.target.value) || 0
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Cost per Hour
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newResource.cost_per_hour}
                      onChange={(e) => setNewResource(prev => ({
                        ...prev,
                        cost_per_hour: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newResource.allocation_start_date}
                      onChange={(e) => setNewResource(prev => ({
                        ...prev,
                        allocation_start_date: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={newResource.allocation_end_date}
                      onChange={(e) => setNewResource(prev => ({
                        ...prev,
                        allocation_end_date: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {newResource.allocated_hours > 0 && newResource.cost_per_hour > 0 && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      Total Cost: <span className="font-medium text-gray-900 dark:text-slate-100">
                        ${(newResource.allocated_hours * newResource.cost_per_hour).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddResource(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddResource}
                  disabled={!newResource.resource_name || newResource.allocated_hours <= 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md"
                >
                  Add Resource
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Progress Reporting Component
interface ProgressReport {
  id: string
  report_date: string
  overall_progress: number
  completed_tasks: number
  total_tasks: number
  schedule_variance_days: number
  cost_variance_percentage: number
  key_achievements: string[]
  upcoming_milestones: string[]
  risks_and_issues: string[]
  next_period_focus: string[]
}

interface ProgressReportingProps {
  implementationPlanId: string
  reports: ProgressReport[]
  onGenerateReport?: () => void
}

export function ProgressReporting({ 
  implementationPlanId: _implementationPlanId, 
  reports, 
  onGenerateReport 
}: ProgressReportingProps) {
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)

  const handleViewReport = (report: ProgressReport) => {
    setSelectedReport(report)
    setShowReportModal(true)
  }

  const getVarianceColor = (variance: number, isSchedule: boolean = false) => {
    if (isSchedule) {
      if (variance <= 0) return 'text-green-600 dark:text-green-400'
      if (variance <= 3) return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    } else {
      if (Math.abs(variance) <= 5) return 'text-green-600 dark:text-green-400'
      if (Math.abs(variance) <= 15) return 'text-yellow-600 dark:text-yellow-400'
      return 'text-red-600 dark:text-red-400'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Progress Reports</h3>
        <button
          onClick={onGenerateReport}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Generate Report
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                    Progress Report - {formatDate(report.report_date)}
                  </h4>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">{report.overall_progress}%</span>
                      <span className="text-gray-500 dark:text-slate-400">complete</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium">{report.completed_tasks}/{report.total_tasks}</span>
                      <span className="text-gray-500 dark:text-slate-400">tasks</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                    <span className="text-gray-600 dark:text-slate-400">Schedule Variance:</span>
                    <span className={`font-medium ${getVarianceColor(report.schedule_variance_days, true)}`}>
                      {report.schedule_variance_days > 0 ? '+' : ''}{report.schedule_variance_days} days
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                    <span className="text-gray-600 dark:text-slate-400">Cost Variance:</span>
                    <span className={`font-medium ${getVarianceColor(report.cost_variance_percentage)}`}>
                      {report.cost_variance_percentage > 0 ? '+' : ''}{report.cost_variance_percentage}%
                    </span>
                  </div>
                </div>

                {/* Key Highlights */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-slate-300">Key Achievements:</span>
                    <ul className="list-disc list-inside text-gray-600 dark:text-slate-400 ml-2">
                      {report.key_achievements.slice(0, 2).map((achievement, index) => (
                        <li key={index}>{achievement}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-slate-300">Upcoming Milestones:</span>
                    <ul className="list-disc list-inside text-gray-600 dark:text-slate-400 ml-2">
                      {report.upcoming_milestones.slice(0, 2).map((milestone, index) => (
                        <li key={index}>{milestone}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleViewReport(report)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  View Full Report
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-slate-100">No progress reports</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Generate your first progress report to track implementation status.
          </p>
        </div>
      )}

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white dark:bg-slate-800">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900 dark:text-slate-100">
                  Progress Report - {formatDate(selectedReport.report_date)}
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-slate-400"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Summary */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Progress Summary</h4>
                  
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedReport.overall_progress}%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-slate-400">Overall Progress</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedReport.completed_tasks}/{selectedReport.total_tasks}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-slate-400">Tasks Completed</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Schedule Variance:</span>
                      <span className={`text-sm font-medium ${getVarianceColor(selectedReport.schedule_variance_days, true)}`}>
                        {selectedReport.schedule_variance_days > 0 ? '+' : ''}{selectedReport.schedule_variance_days} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Cost Variance:</span>
                      <span className={`text-sm font-medium ${getVarianceColor(selectedReport.cost_variance_percentage)}`}>
                        {selectedReport.cost_variance_percentage > 0 ? '+' : ''}{selectedReport.cost_variance_percentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Achievements */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Key Achievements</h4>
                  <ul className="space-y-2">
                    {selectedReport.key_achievements.map((achievement, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{achievement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Upcoming Milestones */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Upcoming Milestones</h4>
                  <ul className="space-y-2">
                    {selectedReport.upcoming_milestones.map((milestone, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{milestone}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks and Issues */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Risks and Issues</h4>
                  <ul className="space-y-2">
                    {selectedReport.risks_and_issues.map((risk, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Period Focus */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">Next Period Focus</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedReport.next_period_focus.map((focus, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <PlayCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{focus}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md"
                >
                  Close
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}