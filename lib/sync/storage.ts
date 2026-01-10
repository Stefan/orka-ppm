/**
 * Shared in-memory storage for cross-device sync
 * In production, this would be replaced with a database
 */

export interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  platform: string
  lastSeen: Date
  isActive: boolean
}

export interface UserPreferences {
  userId: string
  theme: 'light' | 'dark' | 'system'
  language: string
  dashboardLayout: {
    layout: 'grid' | 'masonry' | 'list'
    widgets: any[]
  }
  notifications: {
    email: boolean
    push: boolean
    desktop: boolean
  }
  accessibility: {
    highContrast: boolean
    largeText: boolean
    reducedMotion: boolean
  }
  lastUpdated: Date
}

export interface SessionState {
  userId: string
  deviceId: string
  currentPage: string
  scrollPosition: { [key: string]: number }
  formData: { [key: string]: any }
  openModals: string[]
  selectedItems: { [key: string]: string[] }
  filters: { [key: string]: any }
  searchQueries: { [key: string]: string }
  lastActivity: Date
  sessionId: string
}

export interface OfflineChange {
  id: string
  userId: string
  deviceId: string
  type: 'create' | 'update' | 'delete'
  entity: string
  entityId: string
  data: any
  timestamp: Date
  synced: boolean
}

// Shared in-memory storage
export const registeredDevices = new Map<string, DeviceInfo[]>()
export const userPreferences = new Map<string, UserPreferences>()
export const sessionStates = new Map<string, SessionState>()
export const offlineChanges = new Map<string, OfflineChange[]>()

// Helper functions
export function getDefaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    theme: 'system',
    language: 'en',
    dashboardLayout: {
      layout: 'grid',
      widgets: []
    },
    notifications: {
      email: true,
      push: true,
      desktop: true
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      reducedMotion: false
    },
    lastUpdated: new Date()
  }
}

export function getDefaultSessionState(userId: string): SessionState {
  return {
    userId,
    deviceId: '',
    currentPage: '/',
    scrollPosition: {},
    formData: {},
    openModals: [],
    selectedItems: {},
    filters: {},
    searchQueries: {},
    lastActivity: new Date(),
    sessionId: `session_${Date.now()}`
  }
}