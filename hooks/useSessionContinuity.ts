/**
 * React Hook for Session Continuity
 * Provides easy integration with React components for task continuity
 * Requirements: 11.2, 11.5
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  sessionContinuityService, 
  ContinuitySnapshot, 
  TaskContext, 
  WorkspaceState 
} from '../lib/sync/session-continuity'

export interface UseSessionContinuityReturn {
  // Snapshots
  availableSnapshots: ContinuitySnapshot[]
  latestSnapshot: ContinuitySnapshot | null
  restoreFromDevice: (deviceId: string) => Promise<ContinuitySnapshot | null>
  restoreLatest: () => Promise<ContinuitySnapshot | null>
  
  // Tasks
  activeTasks: TaskContext[]
  startTask: (taskId: string, taskType: TaskContext['taskType'], totalSteps?: number) => void
  updateTask: (taskId: string, updates: Partial<TaskContext>) => void
  completeTask: (taskId: string) => void
  
  // Workspace
  workspaceState: WorkspaceState | null
  updateWorkspace: (updates: Partial<WorkspaceState>) => void
  
  // State
  isRestoring: boolean
  lastRestoreTime: Date | null
  
  // Utilities
  initialize: (userId: string) => Promise<void>
  createSnapshot: () => Promise<void>
  refreshSnapshots: () => Promise<void>
}

/**
 * Hook for session continuity
 */
export function useSessionContinuity(): UseSessionContinuityReturn {
  const [availableSnapshots, setAvailableSnapshots] = useState<ContinuitySnapshot[]>([])
  const [latestSnapshot, setLatestSnapshot] = useState<ContinuitySnapshot | null>(null)
  const [activeTasks, setActiveTasks] = useState<TaskContext[]>([])
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [lastRestoreTime, setLastRestoreTime] = useState<Date | null>(null)
  
  const serviceRef = useRef(sessionContinuityService)
  const isInitialized = useRef(false)

  // Initialize service
  const initialize = useCallback(async (userId: string) => {
    if (isInitialized.current) return
    
    try {
      await serviceRef.current.initialize(userId)
      isInitialized.current = true
      
      // Load initial data
      await refreshSnapshots()
      loadActiveTasks()
      loadWorkspaceState()
    } catch (error) {
      console.error('Failed to initialize session continuity:', error)
    }
  }, [])

  // Load active tasks
  const loadActiveTasks = useCallback(() => {
    const tasks = serviceRef.current.getActiveTasks()
    setActiveTasks(tasks)
  }, [])

  // Load workspace state
  const loadWorkspaceState = useCallback(() => {
    const stored = localStorage.getItem('workspace-state')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setWorkspaceState({
          ...parsed,
          lastModified: new Date(parsed.lastModified)
        })
      } catch (error) {
        console.error('Failed to load workspace state:', error)
      }
    }
  }, [])

  // Refresh available snapshots
  const refreshSnapshots = useCallback(async () => {
    try {
      const snapshots = await serviceRef.current.getAvailableSnapshots()
      setAvailableSnapshots(snapshots)
      
      if (snapshots.length > 0) {
        const snapshot = snapshots[0]
        if (snapshot) {
          setLatestSnapshot(snapshot) // Assuming sorted by timestamp desc
        }
      }
    } catch (error) {
      console.error('Failed to refresh snapshots:', error)
    }
  }, [])

  // Restore from specific device
  const restoreFromDevice = useCallback(async (deviceId: string) => {
    try {
      setIsRestoring(true)
      const snapshot = await serviceRef.current.restoreFromDevice(deviceId)
      
      if (snapshot) {
        setLastRestoreTime(new Date())
        loadActiveTasks()
        loadWorkspaceState()
      }
      
      return snapshot
    } catch (error) {
      console.error('Failed to restore from device:', error)
      return null
    } finally {
      setIsRestoring(false)
    }
  }, [loadActiveTasks, loadWorkspaceState])

  // Restore latest snapshot
  const restoreLatest = useCallback(async () => {
    try {
      setIsRestoring(true)
      const snapshot = await serviceRef.current.getLatestSnapshot()
      
      if (snapshot) {
        await serviceRef.current.applySnapshot(snapshot)
        setLastRestoreTime(new Date())
        loadActiveTasks()
        loadWorkspaceState()
      }
      
      return snapshot
    } catch (error) {
      console.error('Failed to restore latest snapshot:', error)
      return null
    } finally {
      setIsRestoring(false)
    }
  }, [loadActiveTasks, loadWorkspaceState])

  // Start a new task
  const startTask = useCallback((
    taskId: string, 
    taskType: TaskContext['taskType'], 
    totalSteps: number = 1
  ) => {
    serviceRef.current.startTask(taskId, taskType, totalSteps)
    loadActiveTasks()
  }, [loadActiveTasks])

  // Update task progress
  const updateTask = useCallback((taskId: string, updates: Partial<TaskContext>) => {
    serviceRef.current.updateTask(taskId, updates)
    loadActiveTasks()
  }, [loadActiveTasks])

  // Complete a task
  const completeTask = useCallback((taskId: string) => {
    serviceRef.current.completeTask(taskId)
    loadActiveTasks()
  }, [loadActiveTasks])

  // Update workspace state
  const updateWorkspace = useCallback((updates: Partial<WorkspaceState>) => {
    serviceRef.current.updateWorkspaceState(updates)
    loadWorkspaceState()
  }, [loadWorkspaceState])

  // Create snapshot manually
  const createSnapshot = useCallback(async () => {
    try {
      await serviceRef.current.createSnapshot()
      await refreshSnapshots()
    } catch (error) {
      console.error('Failed to create snapshot:', error)
    }
  }, [refreshSnapshots])

  // Listen for session restoration events
  useEffect(() => {
    const handleSessionRestored = () => {
      setLastRestoreTime(new Date())
      loadActiveTasks()
      loadWorkspaceState()
    }
    
    window.addEventListener('session-restored', handleSessionRestored as EventListener)
    
    return () => {
      window.removeEventListener('session-restored', handleSessionRestored as EventListener)
    }
  }, [loadActiveTasks, loadWorkspaceState])

  // Periodic refresh of snapshots
  useEffect(() => {
    if (!isInitialized.current) return
    
    const interval = setInterval(() => {
      refreshSnapshots()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [refreshSnapshots])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current.cleanup()
    }
  }, [])

  return {
    availableSnapshots,
    latestSnapshot,
    restoreFromDevice,
    restoreLatest,
    activeTasks,
    startTask,
    updateTask,
    completeTask,
    workspaceState,
    updateWorkspace,
    isRestoring,
    lastRestoreTime,
    initialize,
    createSnapshot,
    refreshSnapshots
  }
}

/**
 * Hook for task management with continuity
 */
export function useTaskContinuity(taskId: string, taskType: TaskContext['taskType']) {
  const { activeTasks, startTask, updateTask, completeTask } = useSessionContinuity()
  
  const currentTask = activeTasks.find(task => task.taskId === taskId)
  
  const start = useCallback((totalSteps: number = 1) => {
    startTask(taskId, taskType, totalSteps)
  }, [taskId, taskType, startTask])
  
  const update = useCallback((updates: Partial<TaskContext>) => {
    updateTask(taskId, updates)
  }, [taskId, updateTask])
  
  const complete = useCallback(() => {
    completeTask(taskId)
  }, [taskId, completeTask])
  
  const setStep = useCallback((step: number) => {
    update({ currentStep: step })
  }, [update])
  
  const setFormData = useCallback((formData: Record<string, any>) => {
    update({ formData })
  }, [update])
  
  const addCompletedStep = useCallback((step: number) => {
    if (currentTask) {
      const completedSteps = [...currentTask.completedSteps, step]
      update({ completedSteps })
    }
  }, [currentTask, update])
  
  return {
    task: currentTask,
    isActive: !!currentTask,
    start,
    update,
    complete,
    setStep,
    setFormData,
    addCompletedStep
  }
}

/**
 * Hook for workspace state management
 */
export function useWorkspaceState() {
  const { workspaceState, updateWorkspace } = useSessionContinuity()
  
  const setLayout = useCallback((layout: 'grid' | 'masonry' | 'list') => {
    updateWorkspace({ layout })
  }, [updateWorkspace])
  
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    updateWorkspace({ sidebarCollapsed: collapsed })
  }, [updateWorkspace])
  
  const setActiveWidgets = useCallback((widgets: string[]) => {
    updateWorkspace({ activeWidgets: widgets })
  }, [updateWorkspace])
  
  const setWidgetPosition = useCallback((
    widgetId: string, 
    position: { x: number; y: number; w: number; h: number }
  ) => {
    if (workspaceState) {
      const widgetPositions = {
        ...workspaceState.widgetPositions,
        [widgetId]: position
      }
      updateWorkspace({ widgetPositions })
    }
  }, [workspaceState, updateWorkspace])
  
  const setActiveFilters = useCallback((filters: Record<string, any>) => {
    updateWorkspace({ activeFilters: filters })
  }, [updateWorkspace])
  
  const setSortSettings = useCallback((
    key: string, 
    settings: { field: string; direction: 'asc' | 'desc' }
  ) => {
    if (workspaceState) {
      const sortSettings = {
        ...workspaceState.sortSettings,
        [key]: settings
      }
      updateWorkspace({ sortSettings })
    }
  }, [workspaceState, updateWorkspace])
  
  return {
    workspaceState,
    setLayout,
    setSidebarCollapsed,
    setActiveWidgets,
    setWidgetPosition,
    setActiveFilters,
    setSortSettings,
    updateWorkspace
  }
}