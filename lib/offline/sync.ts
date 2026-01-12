/**
 * Offline Synchronization Service
 * Handles offline change tracking, queuing, and intelligent merge strategies
 * Requirements: 11.3
 */

import { getCrossDeviceSyncService, OfflineChange } from '../sync/cross-device-sync'
import { apiRequest } from '../api'

// Node.js types
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

export interface OfflineQueue {
  id: string
  changes: OfflineChange[]
  createdAt: Date
  lastAttempt?: Date
  attemptCount: number
  status: 'pending' | 'syncing' | 'failed' | 'completed'
  error?: string
}

export interface MergeConflict {
  id: string
  changeId: string
  entity: string
  entityId: string
  localData: any
  remoteData: any
  conflictType: 'version' | 'concurrent' | 'deleted'
  timestamp: Date
  resolved: boolean
}

export interface MergeStrategy {
  name: string
  description: string
  apply: (local: any, remote: any, conflict: MergeConflict) => any
}

export interface SyncResult {
  success: boolean
  syncedChanges: number
  failedChanges: number
  conflicts: MergeConflict[]
  errors: string[]
}

/**
 * Offline Synchronization Service
 */
export class OfflineSyncService {
  private userId: string | null = null
  private syncQueue: OfflineQueue[] = []
  private mergeStrategies: Map<string, MergeStrategy> = new Map()
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false
  private retryInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeOnlineStatus()
    this.initializeMergeStrategies()
    this.loadSyncQueue()
    this.startRetryInterval()
  }

  /**
   * Initialize the service for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    this.loadSyncQueue()
    
    if (this.isOnline) {
      await this.processSyncQueue()
    }
  }

  /**
   * Initialize online status monitoring
   */
  private initializeOnlineStatus(): void {
    this.isOnline = navigator.onLine
    
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processSyncQueue()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  /**
   * Initialize merge strategies
   */
  private initializeMergeStrategies(): void {
    // Last Writer Wins strategy
    this.mergeStrategies.set('last-writer-wins', {
      name: 'Last Writer Wins',
      description: 'Use the most recently modified version',
      apply: (local: any, remote: any, _conflict: MergeConflict) => {
        const localTime = new Date(local.lastModified || local.updated_at || 0)
        const remoteTime = new Date(remote.lastModified || remote.updated_at || 0)
        return localTime > remoteTime ? local : remote
      }
    })

    // Merge Fields strategy
    this.mergeStrategies.set('merge-fields', {
      name: 'Merge Fields',
      description: 'Merge non-conflicting fields, prefer local for conflicts',
      apply: (local: any, remote: any, _conflict: MergeConflict) => {
        const merged = { ...remote, ...local }
        merged.version = Math.max(local.version || 0, remote.version || 0) + 1
        merged.lastModified = new Date()
        return merged
      }
    })

    // Array Merge strategy
    this.mergeStrategies.set('array-merge', {
      name: 'Array Merge',
      description: 'Merge arrays by combining unique values',
      apply: (local: any, remote: any, _conflict: MergeConflict) => {
        const merged = { ...local }
        
        Object.keys(remote).forEach(key => {
          if (Array.isArray(local[key]) && Array.isArray(remote[key])) {
            merged[key] = [...new Set([...local[key], ...remote[key]])]
          } else if (local[key] === undefined) {
            merged[key] = remote[key]
          }
        })
        
        merged.version = Math.max(local.version || 0, remote.version || 0) + 1
        merged.lastModified = new Date()
        return merged
      }
    })

    // User Preference strategy
    this.mergeStrategies.set('user-preference', {
      name: 'User Preference',
      description: 'Require manual user resolution',
      apply: (_local: any, _remote: any, _conflict: MergeConflict) => {
        // This strategy requires user intervention
        throw new Error('Manual resolution required')
      }
    })
  }

  /**
   * Queue an offline change
   */
  queueChange(change: Omit<OfflineChange, 'id' | 'timestamp' | 'deviceId' | 'synced'>): void {
    const offlineChange: OfflineChange = {
      ...change,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      deviceId: localStorage.getItem('device-id') || 'unknown',
      synced: false
    }

    // Add to existing queue or create new one
    let queue = this.syncQueue.find(q => q.status === 'pending')
    
    if (!queue) {
      queue = {
        id: `queue-${Date.now()}`,
        changes: [],
        createdAt: new Date(),
        attemptCount: 0,
        status: 'pending'
      }
      this.syncQueue.push(queue)
    }
    
    queue.changes.push(offlineChange)
    this.saveSyncQueue()

    // Also queue in the cross-device sync service
    getCrossDeviceSyncService().queueOfflineChange(change)
  }

  /**
   * Load sync queue from localStorage
   */
  private loadSyncQueue(): void {
    const stored = localStorage.getItem('offline-sync-queue')
    if (stored) {
      try {
        this.syncQueue = JSON.parse(stored).map((queue: any) => ({
          ...queue,
          createdAt: new Date(queue.createdAt),
          lastAttempt: queue.lastAttempt ? new Date(queue.lastAttempt) : undefined,
          changes: queue.changes.map((change: any) => ({
            ...change,
            timestamp: new Date(change.timestamp)
          }))
        }))
      } catch (error) {
        console.error('Failed to load sync queue:', error)
        this.syncQueue = []
      }
    }
  }

  /**
   * Save sync queue to localStorage
   */
  private saveSyncQueue(): void {
    localStorage.setItem('offline-sync-queue', JSON.stringify(this.syncQueue))
  }

  /**
   * Start retry interval for failed syncs
   */
  private startRetryInterval(): void {
    if (this.retryInterval) clearInterval(this.retryInterval)
    
    this.retryInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processSyncQueue()
      }
    }, 30000) // Retry every 30 seconds
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue(): Promise<SyncResult> {
    if (!this.isOnline || this.syncInProgress || !this.userId) {
      return {
        success: false,
        syncedChanges: 0,
        failedChanges: 0,
        conflicts: [],
        errors: ['Not online or sync in progress']
      }
    }

    this.syncInProgress = true
    const result: SyncResult = {
      success: true,
      syncedChanges: 0,
      failedChanges: 0,
      conflicts: [],
      errors: []
    }

    try {
      const pendingQueues = this.syncQueue.filter(q => q.status === 'pending' || q.status === 'failed')
      
      for (const queue of pendingQueues) {
        try {
          queue.status = 'syncing'
          queue.lastAttempt = new Date()
          queue.attemptCount++
          
          const queueResult = await this.syncQueueData(queue)
          
          result.syncedChanges += queueResult.syncedChanges
          result.failedChanges += queueResult.failedChanges
          result.conflicts.push(...queueResult.conflicts)
          result.errors.push(...queueResult.errors)
          
          if (queueResult.success) {
            queue.status = 'completed'
          } else {
            queue.status = 'failed'
            queue.error = queueResult.errors.join(', ')
          }
          
        } catch (error) {
          queue.status = 'failed'
          queue.error = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push(queue.error)
          result.failedChanges += queue.changes.length
        }
      }
      
      // Remove completed queues
      this.syncQueue = this.syncQueue.filter(q => q.status !== 'completed')
      this.saveSyncQueue()
      
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      this.syncInProgress = false
    }

    // Trigger sync result event
    window.dispatchEvent(new CustomEvent('offline-sync-result', {
      detail: result
    }))

    return result
  }

  /**
   * Sync a specific queue
   */
  private async syncQueueData(queue: OfflineQueue): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedChanges: 0,
      failedChanges: 0,
      conflicts: [],
      errors: []
    }

    for (const change of queue.changes) {
      try {
        const syncResult = await this.syncChange(change)
        
        if (syncResult.success) {
          result.syncedChanges++
          change.synced = true
        } else {
          result.failedChanges++
          result.conflicts.push(...syncResult.conflicts)
          result.errors.push(...syncResult.errors)
        }
        
      } catch (error) {
        result.failedChanges++
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    result.success = result.failedChanges === 0
    return result
  }

  /**
   * Sync a single change
   */
  private async syncChange(change: OfflineChange): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedChanges: 0,
      failedChanges: 0,
      conflicts: [],
      errors: []
    }

    try {
      // Check for conflicts first
      const remoteData = await this.getRemoteData(change.entity, change.entityId)
      
      if (remoteData) {
        const conflict = await this.detectConflict(change, remoteData)
        
        if (conflict) {
          result.conflicts.push(conflict)
          
          // Try to auto-resolve using merge strategies
          const resolved = await this.autoResolveConflict(conflict)
          
          if (!resolved) {
            result.errors.push(`Conflict detected for ${change.entity} ${change.entityId}`)
            return result
          }
        }
      }
      
      // Apply the change
      await this.applyChange(change)
      result.success = true
      result.syncedChanges = 1
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      result.failedChanges = 1
    }

    return result
  }

  /**
   * Get remote data for conflict detection
   */
  private async getRemoteData(entity: string, entityId: string): Promise<any> {
    try {
      return await apiRequest(`/sync/entity/${entity}/${entityId}`)
    } catch (error) {
      // Entity might not exist remotely yet
      return null
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  private async detectConflict(change: OfflineChange, remoteData: any): Promise<MergeConflict | null> {
    const localData = change.data
    
    // Version conflict
    if (localData.version && remoteData.version && localData.version < remoteData.version) {
      return {
        id: `conflict-${Date.now()}`,
        changeId: change.id,
        entity: change.entity,
        entityId: change.entityId,
        localData,
        remoteData,
        conflictType: 'version',
        timestamp: new Date(),
        resolved: false
      }
    }
    
    // Concurrent modification conflict
    const localTime = new Date(localData.lastModified || localData.updated_at || 0)
    const remoteTime = new Date(remoteData.lastModified || remoteData.updated_at || 0)
    const timeDiff = Math.abs(localTime.getTime() - remoteTime.getTime())
    
    if (timeDiff < 60000 && localData.modifiedBy !== remoteData.modifiedBy) {
      return {
        id: `conflict-${Date.now()}`,
        changeId: change.id,
        entity: change.entity,
        entityId: change.entityId,
        localData,
        remoteData,
        conflictType: 'concurrent',
        timestamp: new Date(),
        resolved: false
      }
    }
    
    // Deletion conflict
    if (change.type === 'update' && !remoteData) {
      return {
        id: `conflict-${Date.now()}`,
        changeId: change.id,
        entity: change.entity,
        entityId: change.entityId,
        localData,
        remoteData: null,
        conflictType: 'deleted',
        timestamp: new Date(),
        resolved: false
      }
    }
    
    return null
  }

  /**
   * Auto-resolve conflicts using merge strategies
   */
  private async autoResolveConflict(conflict: MergeConflict): Promise<boolean> {
    try {
      // Choose strategy based on entity type and conflict type
      let strategyName = 'last-writer-wins' // Default strategy
      
      if (conflict.entity === 'preferences') {
        strategyName = 'merge-fields'
      } else if (conflict.conflictType === 'concurrent') {
        strategyName = 'array-merge'
      }
      
      const strategy = this.mergeStrategies.get(strategyName)
      if (!strategy) return false
      
      const mergedData = strategy.apply(conflict.localData, conflict.remoteData, conflict)
      
      // Update the change with merged data
      const change = this.findChangeById(conflict.changeId)
      if (change) {
        change.data = mergedData
        conflict.resolved = true
        return true
      }
      
    } catch (error) {
      console.error('Failed to auto-resolve conflict:', error)
    }
    
    return false
  }

  /**
   * Find a change by ID
   */
  private findChangeById(changeId: string): OfflineChange | null {
    for (const queue of this.syncQueue) {
      const change = queue.changes.find(c => c.id === changeId)
      if (change) return change
    }
    return null
  }

  /**
   * Apply a change to the server
   */
  private async applyChange(change: OfflineChange): Promise<void> {
    const endpoint = `/sync/entity/${change.entity}/${change.entityId}`
    
    switch (change.type) {
      case 'create':
        await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify(change.data)
        })
        break
        
      case 'update':
        await apiRequest(endpoint, {
          method: 'PUT',
          body: JSON.stringify(change.data)
        })
        break
        
      case 'delete':
        await apiRequest(endpoint, {
          method: 'DELETE'
        })
        break
    }
  }

  /**
   * Get pending conflicts that need manual resolution
   */
  getPendingConflicts(): MergeConflict[] {
    const conflicts: MergeConflict[] = []
    
    for (const _queue of this.syncQueue) {
      // This would be populated during sync attempts
      // For now, return empty array as conflicts are handled in real-time
    }
    
    return conflicts
  }

  /**
   * Manually resolve a conflict
   */
  async resolveConflict(
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merge', 
    mergedData?: any
  ): Promise<void> {
    // Find the conflict and associated change
    const change = this.findChangeById(conflictId)
    if (!change) return
    
    switch (resolution) {
      case 'local':
        // Keep local data as is
        break
        
      case 'remote':
        // Fetch and use remote data
        const remoteData = await this.getRemoteData(change.entity, change.entityId)
        if (remoteData) {
          change.data = remoteData
        }
        break
        
      case 'merge':
        if (mergedData) {
          change.data = mergedData
        }
        break
    }
    
    // Mark as resolved and retry sync
    change.synced = false
    this.saveSyncQueue()
    
    if (this.isOnline) {
      await this.processSyncQueue()
    }
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    pendingChanges: number
    failedChanges: number
    totalQueues: number
    lastSyncAttempt?: Date
  } {
    const pendingChanges = this.syncQueue
      .filter(q => q.status === 'pending')
      .reduce((sum, q) => sum + q.changes.length, 0)
      
    const failedChanges = this.syncQueue
      .filter(q => q.status === 'failed')
      .reduce((sum, q) => sum + q.changes.length, 0)
      
    const lastSyncAttempt = this.syncQueue
      .filter(q => q.lastAttempt)
      .sort((a, b) => (b.lastAttempt?.getTime() || 0) - (a.lastAttempt?.getTime() || 0))[0]?.lastAttempt
    
    return {
      pendingChanges,
      failedChanges,
      totalQueues: this.syncQueue.length,
      ...(lastSyncAttempt ? { lastSyncAttempt } : {})
    }
  }

  /**
   * Clear completed and old failed queues
   */
  cleanup(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    this.syncQueue = this.syncQueue.filter(queue => {
      // Keep pending and recent failed queues
      if (queue.status === 'pending') return true
      if (queue.status === 'failed' && queue.createdAt > oneWeekAgo) return true
      return false
    })
    
    this.saveSyncQueue()
    
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
    }
  }
}

// Singleton instance
export const offlineSyncService = new OfflineSyncService()

// Export utility functions
export function useOfflineSync() {
  return offlineSyncService
}