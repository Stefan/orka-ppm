/**
 * Cross-Device Synchronization Service
 * Handles user preference synchronization, task continuity, and offline sync
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */


// Helper function for API requests to Next.js API routes
async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Only make API calls in browser environment
  if (typeof window === 'undefined') {
    console.warn('apiRequest called in non-browser environment, skipping:', endpoint)
    throw new Error('API calls not available in server environment')
  }
  
  const baseUrl = window.location.origin
  const url = `${baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  
  console.log('Cross-device sync API request:', url)
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    // Log as warning, not error — sync failures are expected when backend is down
    console.warn('Cross-device sync API:', error instanceof Error ? error.message : error)
    throw error
  }
}

// Node.js types
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

// Types for cross-device synchronization
export interface DeviceInfo {
  id: string
  name: string
  type: 'mobile' | 'tablet' | 'desktop'
  platform: string
  lastSeen: Date
  isActive: boolean
}

export interface DashboardKPIs {
  successRateMethod: 'health' | 'completion'
  budgetMethod: 'spent' | 'remaining'
  resourceMethod: 'auto' | 'fixed'
  resourceFixedValue: number // 0-100, used if method is 'fixed'
}

export interface AISettings {
  enableSuggestions: boolean
  enablePredictiveText: boolean
  enableAutoOptimization: boolean
}

export interface UserPreferences {
  userId: string
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  currency: 'USD' | 'EUR' | 'CHF' | 'GBP'
  dashboardLayout: {
    widgets: any[]
    layout: 'grid' | 'masonry' | 'list'
  }
  dashboardKPIs: DashboardKPIs
  navigationPreferences: {
    collapsedSections: string[]
    pinnedItems: string[]
    recentItems: string[]
  }
  aiSettings: AISettings
  devicePreferences: {
    [deviceId: string]: {
      lastUsed: Date
      preferredLayout: string
      customizations: Record<string, any>
    }
  }
  version: number
  lastModified: Date
  modifiedBy: string // device ID that made the change
}

export interface SessionState {
  userId: string
  deviceId: string
  currentWorkspace: string
  openTabs: string[]
  activeFilters: Record<string, any>
  scrollPositions: Record<string, number>
  formData: Record<string, any>
  lastActivity: Date
  version: number
}

export interface SyncConflict {
  id: string
  type: 'preferences' | 'session' | 'data'
  localVersion: number
  remoteVersion: number
  localData: any
  remoteData: any
  conflictFields: string[]
  timestamp: Date
}

export interface OfflineChange {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: string
  entityId: string
  data: any
  timestamp: Date
  deviceId: string
  synced: boolean
}

/**
 * Cross-Device Synchronization Service
 */
export class CrossDeviceSyncService {
  private userId: string | null = null
  private deviceId: string
  private syncInterval: NodeJS.Timeout | null = null
  private offlineChanges: OfflineChange[] = []
  private isOnline: boolean = true

  constructor() {
    this.deviceId = this.generateDeviceId()
    this.initializeOnlineStatus()
    this.loadOfflineChanges()
  }

  /**
   * Initialize the sync service for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      await this.registerDevice()
      this.startSyncInterval()
    }
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return `device-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    
    const stored = localStorage.getItem('device-id')
    if (stored) return stored

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('device-id', deviceId)
    return deviceId
  }

  /**
   * Initialize online status monitoring
   */
  private initializeOnlineStatus(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      this.isOnline = true
      return
    }
    
    this.isOnline = navigator.onLine
    
    const handleOnline = () => {
      this.isOnline = true
      // Use setTimeout to prevent potential infinite loops
      setTimeout(() => {
        this.syncOfflineChanges().catch(error => {
          console.error('Failed to sync offline changes:', error)
        })
      }, 100)
    }
    
    const handleOffline = () => {
      this.isOnline = false
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  /**
   * Register this device with the backend
   */
  private async registerDevice(): Promise<void> {
    if (!this.userId || typeof window === 'undefined') return

    const deviceInfo: DeviceInfo = {
      id: this.deviceId,
      name: this.getDeviceName(),
      type: this.getDeviceType(),
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      lastSeen: new Date(),
      isActive: true
    }

    try {
      console.log('Registering device:', deviceInfo)
      await apiRequest('/sync/devices', {
        method: 'POST',
        body: JSON.stringify({
          userId: this.userId,
          device: deviceInfo
        })
      })
      console.log('Device registered successfully')
    } catch (error) {
      console.error('Failed to register device:', error)
      // Don't throw the error to prevent breaking the initialization
    }
  }

  /**
   * Get device name from user agent
   */
  private getDeviceName(): string {
    // Check if we're in a browser environment
    if (typeof navigator === 'undefined') {
      return 'Test Device'
    }
    
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Device'
    if (/Android/.test(ua)) return 'Android Device'
    if (/Windows/.test(ua)) return 'Windows PC'
    if (/Mac/.test(ua)) return 'Mac'
    return 'Unknown Device'
  }

  /**
   * Determine device type from screen size and user agent
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return 'desktop'
    }
    
    const width = window.screen.width
    const ua = navigator.userAgent

    if (/iPhone|iPod/.test(ua) || width < 768) return 'mobile'
    if (/iPad/.test(ua) || (width >= 768 && width < 1024)) return 'tablet'
    return 'desktop'
  }

  /**
   * Start periodic synchronization
   */
  private startSyncInterval(): void {
    // Don't start sync interval in test environments
    if (process.env.NODE_ENV === 'test' || typeof window === 'undefined') {
      return
    }
    
    if (this.syncInterval) clearInterval(this.syncInterval)
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncPreferences().catch(error => {
          console.error('Failed to sync preferences:', error)
        })
        this.syncSessionState().catch(error => {
          console.error('Failed to sync session state:', error)
        })
      }
    }, 30000) // Sync every 30 seconds
  }

  /**
   * Sync user preferences across devices
   */
  async syncPreferences(): Promise<void> {
    if (!this.userId || !this.isOnline) return

    try {
      // Get local preferences
      const localPrefs = this.getLocalPreferences()
      
      // Get remote preferences
      const remotePrefs = await this.getRemotePreferences()
      
      // Check for conflicts
      if (remotePrefs && this.hasConflict(localPrefs, remotePrefs)) {
        const conflict = this.createConflict('preferences', localPrefs, remotePrefs)
        await this.handleConflict(conflict)
        return
      }
      
      // Determine which version is newer
      if (!remotePrefs || localPrefs.version > remotePrefs.version) {
        // Upload local preferences
        await this.uploadPreferences(localPrefs)
      } else if (remotePrefs.version > localPrefs.version) {
        // Download remote preferences
        this.setLocalPreferences(remotePrefs)
      }
    } catch (error) {
      console.error('Failed to sync preferences:', error)
    }
  }

  /**
   * Get local preferences from localStorage
   */
  private getLocalPreferences(): UserPreferences {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return this.createDefaultPreferences()
    }
    
    const stored = localStorage.getItem('user-preferences')
    if (!stored) {
      return this.createDefaultPreferences()
    }
    
    try {
      const parsed = JSON.parse(stored)
      return {
        ...parsed,
        lastModified: new Date(parsed.lastModified)
      }
    } catch {
      return this.createDefaultPreferences()
    }
  }

  /**
   * Create default user preferences
   */
  private createDefaultPreferences(): UserPreferences {
    // Get timezone safely
    let timezone = 'UTC'
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    } catch {
      timezone = 'UTC'
    }
    
    return {
      userId: this.userId!,
      theme: 'auto',
      language: 'en',
      timezone,
      currency: 'USD',
      dashboardLayout: {
        widgets: [],
        layout: 'grid'
      },
      dashboardKPIs: {
        successRateMethod: 'health',
        budgetMethod: 'spent',
        resourceMethod: 'auto',
        resourceFixedValue: 85
      },
      navigationPreferences: {
        collapsedSections: [],
        pinnedItems: [],
        recentItems: []
      },
      aiSettings: {
        enableSuggestions: true,
        enablePredictiveText: true,
        enableAutoOptimization: false
      },
      devicePreferences: {},
      version: 1,
      lastModified: new Date(),
      modifiedBy: this.deviceId
    }
  }

  /**
   * Get remote preferences from server
   */
  private async getRemotePreferences(): Promise<UserPreferences | null> {
    try {
      const response = await apiRequest<UserPreferences>(`/sync/preferences?userId=${this.userId}`)
      return {
        ...response,
        lastModified: new Date(response.lastModified)
      }
    } catch (error) {
      console.error('Failed to get remote preferences:', error)
      return null
    }
  }

  /**
   * Upload preferences to server
   */
  private async uploadPreferences(preferences: UserPreferences): Promise<void> {
    await apiRequest('/sync/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    })
  }

  /**
   * Set local preferences
   */
  private setLocalPreferences(preferences: UserPreferences): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    
    localStorage.setItem('user-preferences', JSON.stringify(preferences))
    
    // Trigger preference change event
    window.dispatchEvent(new CustomEvent('preferences-updated', {
      detail: preferences
    }))
  }

  /**
   * Check if there's a conflict between local and remote preferences
   */
  private hasConflict(local: UserPreferences, remote: UserPreferences): boolean {
    // If both versions were modified by different devices at similar times
    const timeDiff = Math.abs(local.lastModified.getTime() - remote.lastModified.getTime())
    return timeDiff < 60000 && local.modifiedBy !== remote.modifiedBy
  }

  /**
   * Create a sync conflict object
   */
  private createConflict(type: string, localData: any, remoteData: any): SyncConflict {
    return {
      id: `conflict-${Date.now()}`,
      type: type as any,
      localVersion: localData.version,
      remoteVersion: remoteData.version,
      localData,
      remoteData,
      conflictFields: this.getConflictFields(localData, remoteData),
      timestamp: new Date()
    }
  }

  /**
   * Get fields that are in conflict
   */
  private getConflictFields(local: any, remote: any): string[] {
    const conflicts: string[] = []
    
    const compareObjects = (obj1: any, obj2: any, path = '') => {
      for (const key in obj1) {
        if (obj1.hasOwnProperty(key)) {
          const currentPath = path ? `${path}.${key}` : key
          
          if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
            compareObjects(obj1[key], obj2[key], currentPath)
          } else if (obj1[key] !== obj2[key]) {
            conflicts.push(currentPath)
          }
        }
      }
    }
    
    compareObjects(local, remote)
    return conflicts
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(conflict: SyncConflict): Promise<void> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    
    // Store conflict for user resolution
    const conflicts = JSON.parse(localStorage.getItem('sync-conflicts') || '[]')
    conflicts.push(conflict)
    localStorage.setItem('sync-conflicts', JSON.stringify(conflicts))
    
    // Trigger conflict event for UI to handle
    window.dispatchEvent(new CustomEvent('sync-conflict', {
      detail: conflict
    }))
  }

  /**
   * Sync session state across devices
   */
  async syncSessionState(): Promise<void> {
    if (!this.userId || !this.isOnline) return

    try {
      const sessionState = this.getCurrentSessionState()
      
      await apiRequest('/sync/session', {
        method: 'PUT',
        body: JSON.stringify(sessionState)
      })
    } catch (error) {
      console.error('Failed to sync session state:', error)
    }
  }

  /**
   * Get current session state
   */
  private getCurrentSessionState(): SessionState {
    // Check if we're in a browser environment
    let currentWorkspace = '/'
    let activeFilters = {}
    let scrollPositions = {}
    let formData = {}
    
    if (typeof window !== 'undefined') {
      currentWorkspace = window.location.pathname
      
      if (typeof sessionStorage !== 'undefined') {
        try {
          activeFilters = JSON.parse(sessionStorage.getItem('active-filters') || '{}')
          scrollPositions = JSON.parse(sessionStorage.getItem('scroll-positions') || '{}')
          formData = JSON.parse(sessionStorage.getItem('form-data') || '{}')
        } catch {
          // Ignore parsing errors
        }
      }
    }
    
    return {
      userId: this.userId!,
      deviceId: this.deviceId,
      currentWorkspace,
      openTabs: [currentWorkspace], // Simplified for single tab
      activeFilters,
      scrollPositions,
      formData,
      lastActivity: new Date(),
      version: Date.now()
    }
  }

  /**
   * Restore session state from another device
   */
  async restoreSessionState(deviceId?: string): Promise<SessionState | null> {
    if (!this.userId || !this.isOnline) return null

    try {
      const endpoint = deviceId 
        ? `/sync/session?userId=${this.userId}&deviceId=${deviceId}`
        : `/sync/session?userId=${this.userId}`
        
      const sessionState = await apiRequest<SessionState>(endpoint)
      
      // Apply session state only in browser environment
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('active-filters', JSON.stringify(sessionState.activeFilters))
        sessionStorage.setItem('scroll-positions', JSON.stringify(sessionState.scrollPositions))
        sessionStorage.setItem('form-data', JSON.stringify(sessionState.formData))
      }
      
      return sessionState
    } catch (error) {
      console.error('Failed to restore session state:', error)
      return null
    }
  }

  /**
   * Queue offline changes
   */
  queueOfflineChange(change: Omit<OfflineChange, 'id' | 'timestamp' | 'deviceId' | 'synced'>): void {
    const offlineChange: OfflineChange = {
      ...change,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      deviceId: this.deviceId,
      synced: false
    }
    
    this.offlineChanges.push(offlineChange)
    this.saveOfflineChanges()
  }

  /**
   * Load offline changes from localStorage
   */
  private loadOfflineChanges(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.offlineChanges = []
      return
    }
    
    const stored = localStorage.getItem('offline-changes')
    if (stored) {
      try {
        this.offlineChanges = JSON.parse(stored).map((change: any) => ({
          ...change,
          timestamp: new Date(change.timestamp)
        }))
      } catch (error) {
        console.error('Failed to load offline changes:', error)
        this.offlineChanges = []
      }
    }
  }

  /**
   * Save offline changes to localStorage
   */
  private saveOfflineChanges(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    
    localStorage.setItem('offline-changes', JSON.stringify(this.offlineChanges))
  }

  /**
   * Sync offline changes when back online
   */
  async syncOfflineChanges(): Promise<void> {
    if (!this.isOnline || this.offlineChanges.length === 0) return

    const unsyncedChanges = this.offlineChanges.filter(change => !change.synced)
    
    for (const change of unsyncedChanges) {
      try {
        await this.syncOfflineChange(change)
        change.synced = true
      } catch (error) {
        console.error('Failed to sync offline change:', error)
        // Keep the change for retry
      }
    }
    
    // Remove synced changes
    this.offlineChanges = this.offlineChanges.filter(change => !change.synced)
    this.saveOfflineChanges()
  }

  /**
   * Sync a single offline change
   */
  private async syncOfflineChange(change: OfflineChange): Promise<void> {
    const endpoint = `/sync/offline-changes`
    
    await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(change)
    })
  }

  /**
   * Get pending sync conflicts
   */
  getSyncConflicts(): SyncConflict[] {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return []
    }
    
    const stored = localStorage.getItem('sync-conflicts')
    if (!stored) return []
    
    try {
      return JSON.parse(stored).map((conflict: any) => ({
        ...conflict,
        timestamp: new Date(conflict.timestamp)
      }))
    } catch {
      return []
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveSyncConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge', mergedData?: any): Promise<void> {
    const conflicts = this.getSyncConflicts()
    const conflictIndex = conflicts.findIndex(c => c.id === conflictId)
    
    if (conflictIndex === -1) return
    
    const conflict = conflicts[conflictIndex]
    if (!conflict) return
    
    let resolvedData: any
    
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData
        break
      case 'remote':
        resolvedData = conflict.remoteData
        break
      case 'merge':
        resolvedData = mergedData || conflict.localData
        break
    }
    
    // Apply resolution based on conflict type
    if (conflict.type === 'preferences') {
      resolvedData.version = Math.max(conflict.localVersion, conflict.remoteVersion) + 1
      resolvedData.lastModified = new Date()
      resolvedData.modifiedBy = this.deviceId
      
      await this.uploadPreferences(resolvedData)
      this.setLocalPreferences(resolvedData)
    }
    
    // Remove resolved conflict
    conflicts.splice(conflictIndex, 1)
    
    // Check if we're in a browser environment before accessing localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('sync-conflicts', JSON.stringify(conflicts))
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    const currentPrefs = this.getLocalPreferences()
    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
      ...updates,
      version: currentPrefs.version + 1,
      lastModified: new Date(),
      modifiedBy: this.deviceId
    }
    
    this.setLocalPreferences(updatedPrefs)
    
    if (this.isOnline) {
      try {
        await this.uploadPreferences(updatedPrefs)
      } catch (error) {
        console.error('Failed to upload preferences:', error)
        // Queue for offline sync
        this.queueOfflineChange({
          type: 'update',
          entity: 'preferences',
          entityId: this.userId!,
          data: updatedPrefs
        })
      }
    } else {
      // Queue for offline sync
      this.queueOfflineChange({
        type: 'update',
        entity: 'preferences',
        entityId: this.userId!,
        data: updatedPrefs
      })
    }
  }

  /**
   * Get available devices for the user
   */
  async getAvailableDevices(): Promise<DeviceInfo[]> {
    if (!this.userId || !this.isOnline) return []
    
    try {
      return await apiRequest<DeviceInfo[]>(`/sync/devices?userId=${this.userId}`)
    } catch (error) {
      console.error('Failed to get available devices:', error)
      return []
    }
  }

  /**
   * Cleanup - stop sync interval
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
}

// Lazy-loaded singleton instance
let _crossDeviceSyncService: CrossDeviceSyncService | null = null

export function getCrossDeviceSyncService(): CrossDeviceSyncService {
  if (!_crossDeviceSyncService) {
    _crossDeviceSyncService = new CrossDeviceSyncService()
  }
  return _crossDeviceSyncService
}

// Export utility functions
export function useCrossDeviceSync() {
  return getCrossDeviceSyncService()
}