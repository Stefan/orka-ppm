/**
 * Session Continuity Service
 * Handles seamless task handoff between devices and workspace restoration
 * Requirements: 11.2, 11.5
 */

import { SessionState } from './cross-device-sync'
import { apiRequest } from '../api'

// Node.js types
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

export interface WorkspaceState {
  userId: string
  workspaceId: string
  layout: 'grid' | 'masonry' | 'list'
  activeWidgets: string[]
  widgetPositions: Record<string, { x: number; y: number; w: number; h: number }>
  sidebarCollapsed: boolean
  activeFilters: Record<string, any>
  sortSettings: Record<string, { field: string; direction: 'asc' | 'desc' }>
  viewSettings: Record<string, any>
  lastModified: Date
  deviceId: string
}

export interface TaskContext {
  taskId: string
  taskType: 'form' | 'workflow' | 'analysis' | 'report'
  currentStep: number
  totalSteps: number
  formData: Record<string, any>
  completedSteps: number[]
  context: Record<string, any>
  startedAt: Date
  lastActivity: Date
  deviceId: string
}

export interface ContinuitySnapshot {
  id: string
  userId: string
  deviceId: string
  timestamp: Date
  sessionState: SessionState
  workspaceState: WorkspaceState
  activeTasks: TaskContext[]
  browserState: {
    url: string
    scrollPosition: number
    formData: Record<string, any>
    selectedItems: string[]
  }
  metadata: {
    deviceName: string
    deviceType: string
    appVersion: string
  }
}

/**
 * Session Continuity Service
 */
export class SessionContinuityService {
  private userId: string | null = null
  private deviceId: string
  private snapshotInterval: NodeJS.Timeout | null = null
  private activeTasks: Map<string, TaskContext> = new Map()
  private workspaceState: WorkspaceState | null = null
  
  // Store bound event handlers for proper cleanup
  private boundHandlers = {
    handleFormInput: this.handleFormInput.bind(this),
    handleFormChange: this.handleFormChange.bind(this),
    handleScroll: this.throttle(this.handleScroll.bind(this), 1000),
    handleNavigation: this.handleNavigation.bind(this),
    handleBeforeUnload: this.handleBeforeUnload.bind(this),
    handleVisibilityChange: this.handleVisibilityChange.bind(this)
  }

  constructor() {
    this.deviceId = localStorage.getItem('device-id') || 'unknown'
    // Skip event listeners in test environment to avoid interference
    if (process.env.NODE_ENV !== 'test') {
      this.initializeEventListeners()
    }
  }

  /**
   * Initialize the service for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    await this.loadWorkspaceState()
    this.startSnapshotInterval()
  }

  /**
   * Initialize event listeners for state tracking
   */
  private initializeEventListeners(): void {
    // Track form changes
    document.addEventListener('input', this.boundHandlers.handleFormInput)
    document.addEventListener('change', this.boundHandlers.handleFormChange)
    
    // Track scroll position
    window.addEventListener('scroll', this.boundHandlers.handleScroll)
    
    // Track page navigation
    window.addEventListener('popstate', this.boundHandlers.handleNavigation)
    
    // Track before unload for final snapshot
    window.addEventListener('beforeunload', this.boundHandlers.handleBeforeUnload)
    
    // Track visibility changes
    document.addEventListener('visibilitychange', this.boundHandlers.handleVisibilityChange)
  }

  /**
   * Handle form input changes
   */
  private handleFormInput(event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.form) {
      this.updateFormData(target.form)
    }
  }

  /**
   * Handle form changes
   */
  private handleFormChange(event: Event): void {
    const target = event.target as HTMLInputElement
    if (target.form) {
      this.updateFormData(target.form)
    }
  }

  /**
   * Handle scroll events
   */
  private handleScroll(): void {
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop
    sessionStorage.setItem('scroll-position', scrollPosition.toString())
  }

  /**
   * Handle navigation events
   */
  private handleNavigation(): void {
    this.createSnapshot()
  }

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    this.createSnapshot()
  }

  /**
   * Handle visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.createSnapshot()
    }
  }

  /**
   * Update form data in session storage
   */
  private updateFormData(form: HTMLFormElement): void {
    const formData = new FormData(form)
    const data: Record<string, any> = {}
    
    for (const [key, value] of formData.entries()) {
      data[key] = value
    }
    
    const formId = form.id || form.getAttribute('data-form-id') || 'default'
    const existingData = JSON.parse(sessionStorage.getItem('form-data') || '{}')
    existingData[formId] = data
    
    sessionStorage.setItem('form-data', JSON.stringify(existingData))
  }

  /**
   * Start periodic snapshot creation
   */
  private startSnapshotInterval(): void {
    if (this.snapshotInterval) clearInterval(this.snapshotInterval)
    
    this.snapshotInterval = setInterval(() => {
      this.createSnapshot()
    }, 60000) // Create snapshot every minute
  }

  /**
   * Create a continuity snapshot
   */
  async createSnapshot(): Promise<void> {
    if (!this.userId) return

    try {
      const snapshot = await this.buildSnapshot()
      await this.saveSnapshot(snapshot)
    } catch (error) {
      console.error('Failed to create continuity snapshot:', error)
    }
  }

  /**
   * Build a continuity snapshot
   */
  private async buildSnapshot(): Promise<ContinuitySnapshot> {
    const sessionState = this.getCurrentSessionState()
    const workspaceState = this.getCurrentWorkspaceState()
    const browserState = this.getCurrentBrowserState()
    
    return {
      id: `snapshot-${Date.now()}-${this.deviceId}`,
      userId: this.userId!,
      deviceId: this.deviceId,
      timestamp: new Date(),
      sessionState,
      workspaceState,
      activeTasks: Array.from(this.activeTasks.values()),
      browserState,
      metadata: {
        deviceName: this.getDeviceName(),
        deviceType: this.getDeviceType(),
        appVersion: '1.0.0'
      }
    }
  }

  /**
   * Get current session state
   */
  private getCurrentSessionState(): SessionState {
    return {
      userId: this.userId!,
      deviceId: this.deviceId,
      currentWorkspace: window.location.pathname,
      openTabs: [window.location.pathname],
      activeFilters: JSON.parse(sessionStorage.getItem('active-filters') || '{}'),
      scrollPositions: { [window.location.pathname]: window.pageYOffset },
      formData: JSON.parse(sessionStorage.getItem('form-data') || '{}'),
      lastActivity: new Date(),
      version: Date.now()
    }
  }

  /**
   * Get current workspace state
   */
  private getCurrentWorkspaceState(): WorkspaceState {
    if (this.workspaceState) {
      return {
        ...this.workspaceState,
        lastModified: new Date(),
        deviceId: this.deviceId
      }
    }

    return {
      userId: this.userId!,
      workspaceId: 'default',
      layout: 'grid',
      activeWidgets: [],
      widgetPositions: {},
      sidebarCollapsed: false,
      activeFilters: {},
      sortSettings: {},
      viewSettings: {},
      lastModified: new Date(),
      deviceId: this.deviceId
    }
  }

  /**
   * Get current browser state
   */
  private getCurrentBrowserState() {
    return {
      url: window.location.href,
      scrollPosition: window.pageYOffset || document.documentElement.scrollTop,
      formData: JSON.parse(sessionStorage.getItem('form-data') || '{}'),
      selectedItems: JSON.parse(sessionStorage.getItem('selected-items') || '[]')
    }
  }

  /**
   * Save snapshot to server
   */
  private async saveSnapshot(snapshot: ContinuitySnapshot): Promise<void> {
    try {
      await apiRequest('/sync/continuity/snapshot', {
        method: 'POST',
        body: JSON.stringify(snapshot)
      })
    } catch (error) {
      // If online save fails, store locally
      this.saveSnapshotLocally(snapshot)
    }
  }

  /**
   * Save snapshot locally
   */
  private saveSnapshotLocally(snapshot: ContinuitySnapshot): void {
    const snapshots = JSON.parse(localStorage.getItem('continuity-snapshots') || '[]')
    snapshots.push(snapshot)
    
    // Keep only last 10 snapshots
    if (snapshots.length > 10) {
      snapshots.splice(0, snapshots.length - 10)
    }
    
    localStorage.setItem('continuity-snapshots', JSON.stringify(snapshots))
  }

  /**
   * Restore session from another device
   */
  async restoreFromDevice(deviceId: string): Promise<ContinuitySnapshot | null> {
    try {
      const response = await apiRequest<ContinuitySnapshot>(
        `/sync/continuity/latest/${this.userId}?deviceId=${deviceId}`
      )
      
      const snapshot = response.data
      await this.applySnapshot(snapshot)
      return snapshot
    } catch (error) {
      console.error('Failed to restore from device:', error)
      return null
    }
  }

  /**
   * Get latest snapshot from any device
   */
  async getLatestSnapshot(): Promise<ContinuitySnapshot | null> {
    try {
      const response = await apiRequest<ContinuitySnapshot>(
        `/sync/continuity/latest/${this.userId}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to get latest snapshot:', error)
      return null
    }
  }

  /**
   * Apply a continuity snapshot
   */
  async applySnapshot(snapshot: ContinuitySnapshot): Promise<void> {
    try {
      // Apply session state
      sessionStorage.setItem('active-filters', JSON.stringify(snapshot.sessionState.activeFilters))
      sessionStorage.setItem('form-data', JSON.stringify(snapshot.sessionState.formData))
      
      // Apply workspace state
      this.workspaceState = snapshot.workspaceState
      
      // Apply browser state
      if (snapshot.browserState.formData) {
        sessionStorage.setItem('form-data', JSON.stringify(snapshot.browserState.formData))
      }
      
      if (snapshot.browserState.selectedItems) {
        sessionStorage.setItem('selected-items', JSON.stringify(snapshot.browserState.selectedItems))
      }
      
      // Restore active tasks - this is the critical part that was failing
      this.activeTasks.clear()
      snapshot.activeTasks.forEach(task => {
        // Ensure we preserve the original task data exactly as provided
        const restoredTask: TaskContext = {
          taskId: task.taskId, // Preserve original taskId
          taskType: task.taskType, // Preserve original taskType
          currentStep: task.currentStep,
          totalSteps: task.totalSteps, // Preserve original totalSteps
          formData: task.formData || {},
          completedSteps: task.completedSteps || [],
          context: task.context || {},
          startedAt: new Date(task.startedAt),
          lastActivity: new Date(task.lastActivity),
          deviceId: task.deviceId
        }
        this.activeTasks.set(task.taskId, restoredTask)
      })
      
      // Navigate to the same URL if different (skip in test environment)
      if (snapshot.browserState.url !== window.location.href && typeof window !== 'undefined' && window.history) {
        try {
          // Validate URL before attempting to parse it
          if (snapshot.browserState.url && typeof snapshot.browserState.url === 'string' && snapshot.browserState.url.startsWith('http')) {
            const url = new URL(snapshot.browserState.url)
            if (url.pathname !== window.location.pathname) {
              // Skip navigation in test environment to avoid JSDOM issues
              if (process.env.NODE_ENV !== 'test') {
                window.history.pushState({}, '', url.pathname + url.search)
              }
            }
          }
        } catch (urlError) {
          console.warn('Invalid URL in snapshot, skipping navigation:', snapshot.browserState.url)
        }
      }
      
      // Restore scroll position after a short delay (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => {
          window.scrollTo(0, snapshot.browserState.scrollPosition)
        }, 100)
      }
      
      // Trigger restoration event
      window.dispatchEvent(new CustomEvent('session-restored', {
        detail: snapshot
      }))
      
    } catch (error) {
      console.error('Failed to apply snapshot:', error)
      throw error
    }
  }

  /**
   * Start a new task context
   */
  startTask(taskId: string, taskType: TaskContext['taskType'], totalSteps: number = 1): void {
    const task: TaskContext = {
      taskId,
      taskType,
      currentStep: 1,
      totalSteps,
      formData: {},
      completedSteps: [],
      context: {},
      startedAt: new Date(),
      lastActivity: new Date(),
      deviceId: this.deviceId
    }
    
    this.activeTasks.set(taskId, task)
    this.createSnapshot() // Create snapshot when starting a task
  }

  /**
   * Update task progress
   */
  updateTask(taskId: string, updates: Partial<TaskContext>): void {
    const task = this.activeTasks.get(taskId)
    if (!task) return
    
    const updatedTask = {
      ...task,
      ...updates,
      lastActivity: new Date()
    }
    
    this.activeTasks.set(taskId, updatedTask)
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string): void {
    this.activeTasks.delete(taskId)
    this.createSnapshot() // Create snapshot when completing a task
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskContext[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * Update workspace configuration
   */
  updateWorkspaceState(updates: Partial<WorkspaceState>): void {
    if (!this.workspaceState) {
      this.workspaceState = this.getCurrentWorkspaceState()
    }
    
    this.workspaceState = {
      ...this.workspaceState,
      ...updates,
      lastModified: new Date(),
      deviceId: this.deviceId
    }
    
    // Save to localStorage for immediate access
    localStorage.setItem('workspace-state', JSON.stringify(this.workspaceState))
  }

  /**
   * Load workspace state
   */
  private async loadWorkspaceState(): Promise<void> {
    try {
      // Try to load from server first
      const response = await apiRequest<WorkspaceState>(
        `/sync/workspace/${this.userId}`
      )
      this.workspaceState = {
        ...response.data,
        lastModified: new Date(response.data.lastModified)
      }
    } catch (error) {
      // Fall back to localStorage
      const localState = localStorage.getItem('workspace-state')
      if (localState) {
        try {
          this.workspaceState = {
            ...JSON.parse(localState),
            lastModified: new Date(JSON.parse(localState).lastModified)
          }
        } catch (parseError) {
          console.error('Failed to parse local workspace state:', parseError)
        }
      }
    }
  }

  /**
   * Get available snapshots for restoration
   */
  async getAvailableSnapshots(): Promise<ContinuitySnapshot[]> {
    try {
      const response = await apiRequest<ContinuitySnapshot[]>(
        `/sync/continuity/snapshots/${this.userId}`
      )
      
      return response.data.map(snapshot => ({
        ...snapshot,
        timestamp: new Date(snapshot.timestamp)
      }))
    } catch (error) {
      console.error('Failed to get available snapshots:', error)
      return []
    }
  }

  /**
   * Utility functions
   */
  private getDeviceName(): string {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Device'
    if (/Android/.test(ua)) return 'Android Device'
    if (/Windows/.test(ua)) return 'Windows PC'
    if (/Mac/.test(ua)) return 'Mac'
    return 'Unknown Device'
  }

  private getDeviceType(): string {
    const width = window.screen.width
    const ua = navigator.userAgent

    if (/iPhone|iPod/.test(ua) || width < 768) return 'mobile'
    if (/iPad/.test(ua) || (width >= 768 && width < 1024)) return 'tablet'
    return 'desktop'
  }

  private throttle(func: Function, limit: number) {
    let inThrottle: boolean
    return function(this: any) {
      const args = arguments
      const context = this
      if (!inThrottle) {
        func.apply(context, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval)
      this.snapshotInterval = null
    }
    
    // Remove event listeners using the stored bound handlers
    document.removeEventListener('input', this.boundHandlers.handleFormInput)
    document.removeEventListener('change', this.boundHandlers.handleFormChange)
    window.removeEventListener('scroll', this.boundHandlers.handleScroll)
    window.removeEventListener('popstate', this.boundHandlers.handleNavigation)
    window.removeEventListener('beforeunload', this.boundHandlers.handleBeforeUnload)
    document.removeEventListener('visibilitychange', this.boundHandlers.handleVisibilityChange)
    
    // Clear all state
    this.activeTasks.clear()
    this.workspaceState = null
    this.userId = null
  }
}

// Singleton instance
export const sessionContinuityService = new SessionContinuityService()

// Export utility functions
export function useSessionContinuity() {
  return sessionContinuityService
}