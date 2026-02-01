// External System Sync Utilities
// Phase 3: Integration with ERP and other external systems

import { ProjectWithFinancials, Currency } from '@/types/costbook'

/**
 * Supported external system types
 */
export type ExternalSystemType = 
  | 'sap'
  | 'oracle'
  | 'dynamics'
  | 'workday'
  | 'netsuite'
  | 'custom'

/**
 * Sync status
 */
export type SyncStatus = 
  | 'idle'
  | 'syncing'
  | 'success'
  | 'error'
  | 'partial'
  | 'pending'

/**
 * Sync direction
 */
export type SyncDirection = 
  | 'import'
  | 'export'
  | 'bidirectional'

/**
 * External system configuration
 */
export interface ExternalSystemConfig {
  id: string
  name: string
  type: ExternalSystemType
  enabled: boolean
  endpoint?: string
  apiKey?: string
  syncDirection: SyncDirection
  syncSchedule: 'manual' | 'hourly' | 'daily' | 'realtime'
  lastSync?: SyncResult
  fieldMappings: FieldMapping[]
}

/**
 * Field mapping between systems
 */
export interface FieldMapping {
  externalField: string
  internalField: keyof ProjectWithFinancials | string
  transform?: 'none' | 'currency' | 'date' | 'percentage' | 'custom'
  required: boolean
}

/**
 * Sync result
 */
export interface SyncResult {
  id: string
  timestamp: string
  status: SyncStatus
  direction: SyncDirection
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  errors: SyncError[]
  duration: number
  systemId: string
}

/**
 * Sync error
 */
export interface SyncError {
  code: string
  message: string
  recordId?: string
  field?: string
  timestamp: string
}

/**
 * Data change for sync
 */
export interface DataChange {
  id: string
  entityType: 'project' | 'commitment' | 'actual' | 'vendor'
  entityId: string
  changeType: 'create' | 'update' | 'delete'
  changedFields: string[]
  oldValue?: any
  newValue?: any
  timestamp: string
  synced: boolean
}

/**
 * Sync queue item
 */
export interface SyncQueueItem {
  id: string
  change: DataChange
  targetSystem: string
  priority: 'low' | 'normal' | 'high'
  attempts: number
  lastAttempt?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Sync statistics
 */
export interface SyncStatistics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  lastSuccessfulSync?: string
  averageDuration: number
  pendingChanges: number
  errorRate: number
}

/**
 * System status configuration for UI
 */
export interface SystemStatusConfig {
  status: SyncStatus
  label: string
  color: string
  bgColor: string
  icon: string
}

/**
 * Status configurations
 */
export const SYNC_STATUS_CONFIG: Record<SyncStatus, SystemStatusConfig> = {
  idle: {
    status: 'idle',
    label: 'Idle',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: 'Pause'
  },
  syncing: {
    status: 'syncing',
    label: 'Syncing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'RefreshCw'
  },
  success: {
    status: 'success',
    label: 'Synced',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle'
  },
  error: {
    status: 'error',
    label: 'Error',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: 'AlertCircle'
  },
  partial: {
    status: 'partial',
    label: 'Partial',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: 'AlertTriangle'
  },
  pending: {
    status: 'pending',
    label: 'Pending',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Clock'
  }
}

/**
 * System type labels
 */
export const SYSTEM_TYPE_LABELS: Record<ExternalSystemType, string> = {
  sap: 'SAP',
  oracle: 'Oracle',
  dynamics: 'Microsoft Dynamics',
  workday: 'Workday',
  netsuite: 'NetSuite',
  custom: 'Custom Integration'
}

// ============================================
// Mock Data and Service Functions
// ============================================

// Mock external systems
const MOCK_SYSTEMS: ExternalSystemConfig[] = [
  {
    id: 'sys-sap-001',
    name: 'SAP S/4HANA',
    type: 'sap',
    enabled: true,
    syncDirection: 'bidirectional',
    syncSchedule: 'hourly',
    fieldMappings: [
      { externalField: 'PROJECT_ID', internalField: 'id', transform: 'none', required: true },
      { externalField: 'PROJECT_NAME', internalField: 'name', transform: 'none', required: true },
      { externalField: 'BUDGET_AMOUNT', internalField: 'budget', transform: 'currency', required: true },
      { externalField: 'ACTUAL_COST', internalField: 'total_spend', transform: 'currency', required: true }
    ],
    lastSync: {
      id: 'sync-001',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'success',
      direction: 'bidirectional',
      recordsProcessed: 45,
      recordsSucceeded: 45,
      recordsFailed: 0,
      errors: [],
      duration: 3500,
      systemId: 'sys-sap-001'
    }
  },
  {
    id: 'sys-oracle-001',
    name: 'Oracle Cloud',
    type: 'oracle',
    enabled: true,
    syncDirection: 'import',
    syncSchedule: 'daily',
    fieldMappings: [
      { externalField: 'PROJ_CODE', internalField: 'id', transform: 'none', required: true },
      { externalField: 'PROJ_TITLE', internalField: 'name', transform: 'none', required: true },
      { externalField: 'BUDGET_USD', internalField: 'budget', transform: 'currency', required: true }
    ],
    lastSync: {
      id: 'sync-002',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'partial',
      direction: 'import',
      recordsProcessed: 28,
      recordsSucceeded: 25,
      recordsFailed: 3,
      errors: [
        { code: 'MAPPING_ERROR', message: 'Invalid currency format for project P-123', recordId: 'P-123', timestamp: new Date().toISOString() },
        { code: 'VALIDATION_ERROR', message: 'Budget cannot be negative', recordId: 'P-456', timestamp: new Date().toISOString() },
        { code: 'MISSING_FIELD', message: 'Required field BUDGET_USD is empty', recordId: 'P-789', timestamp: new Date().toISOString() }
      ],
      duration: 5200,
      systemId: 'sys-oracle-001'
    }
  },
  {
    id: 'sys-custom-001',
    name: 'Internal Finance API',
    type: 'custom',
    enabled: false,
    syncDirection: 'export',
    syncSchedule: 'realtime',
    fieldMappings: [],
    lastSync: {
      id: 'sync-003',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'error',
      direction: 'export',
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [
        { code: 'CONNECTION_FAILED', message: 'Unable to connect to endpoint', timestamp: new Date().toISOString() }
      ],
      duration: 150,
      systemId: 'sys-custom-001'
    }
  }
]

// Mock sync queue
let mockSyncQueue: SyncQueueItem[] = [
  {
    id: 'queue-001',
    change: {
      id: 'change-001',
      entityType: 'project',
      entityId: 'proj-001',
      changeType: 'update',
      changedFields: ['budget', 'total_spend'],
      timestamp: new Date().toISOString(),
      synced: false
    },
    targetSystem: 'sys-sap-001',
    priority: 'high',
    attempts: 0,
    status: 'pending'
  },
  {
    id: 'queue-002',
    change: {
      id: 'change-002',
      entityType: 'commitment',
      entityId: 'commit-042',
      changeType: 'create',
      changedFields: ['amount', 'vendor_id'],
      timestamp: new Date().toISOString(),
      synced: false
    },
    targetSystem: 'sys-sap-001',
    priority: 'normal',
    attempts: 0,
    status: 'pending'
  }
]

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get all configured external systems
 */
export async function getExternalSystems(): Promise<ExternalSystemConfig[]> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return [...MOCK_SYSTEMS]
}

/**
 * Get a specific external system by ID
 */
export async function getExternalSystem(
  systemId: string
): Promise<ExternalSystemConfig | null> {
  await new Promise(resolve => setTimeout(resolve, 50))
  return MOCK_SYSTEMS.find(s => s.id === systemId) || null
}

/**
 * Get sync status for all systems
 */
export async function getSyncStatus(): Promise<{
  systems: Array<{ system: ExternalSystemConfig; currentStatus: SyncStatus }>
  overallStatus: SyncStatus
  pendingChanges: number
}> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const systems = MOCK_SYSTEMS.map(system => ({
    system,
    currentStatus: system.lastSync?.status || 'idle' as SyncStatus
  }))
  
  // Determine overall status
  let overallStatus: SyncStatus = 'success'
  
  if (systems.some(s => s.currentStatus === 'error')) {
    overallStatus = 'error'
  } else if (systems.some(s => s.currentStatus === 'partial')) {
    overallStatus = 'partial'
  } else if (systems.some(s => s.currentStatus === 'syncing')) {
    overallStatus = 'syncing'
  } else if (systems.every(s => s.currentStatus === 'idle')) {
    overallStatus = 'idle'
  }
  
  return {
    systems,
    overallStatus,
    pendingChanges: mockSyncQueue.filter(q => q.status === 'pending').length
  }
}

/**
 * Get sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return [...mockSyncQueue]
}

/**
 * Trigger manual sync for a system
 */
export async function triggerSync(
  systemId: string,
  direction?: SyncDirection
): Promise<SyncResult> {
  // Simulate sync process
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const system = MOCK_SYSTEMS.find(s => s.id === systemId)
  if (!system) {
    throw new Error('System not found')
  }
  
  // Simulate random success/partial/error
  const rand = Math.random()
  let status: SyncStatus = 'success'
  let recordsFailed = 0
  const errors: SyncError[] = []
  
  if (rand > 0.9) {
    status = 'error'
    errors.push({
      code: 'SYNC_FAILED',
      message: 'Connection timeout',
      timestamp: new Date().toISOString()
    })
  } else if (rand > 0.7) {
    status = 'partial'
    recordsFailed = Math.floor(Math.random() * 5) + 1
    errors.push({
      code: 'PARTIAL_FAILURE',
      message: `${recordsFailed} records failed validation`,
      timestamp: new Date().toISOString()
    })
  }
  
  const recordsProcessed = Math.floor(Math.random() * 50) + 10
  
  const result: SyncResult = {
    id: `sync-${generateId()}`,
    timestamp: new Date().toISOString(),
    status,
    direction: direction || system.syncDirection,
    recordsProcessed,
    recordsSucceeded: recordsProcessed - recordsFailed,
    recordsFailed,
    errors,
    duration: Math.floor(Math.random() * 5000) + 1000,
    systemId
  }
  
  // Update system's last sync
  const systemIndex = MOCK_SYSTEMS.findIndex(s => s.id === systemId)
  if (systemIndex >= 0) {
    MOCK_SYSTEMS[systemIndex].lastSync = result
  }
  
  return result
}

/**
 * Get sync statistics for a system
 */
export async function getSyncStatistics(
  systemId: string
): Promise<SyncStatistics> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Mock statistics
  return {
    totalSyncs: Math.floor(Math.random() * 100) + 50,
    successfulSyncs: Math.floor(Math.random() * 80) + 40,
    failedSyncs: Math.floor(Math.random() * 10),
    lastSuccessfulSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    averageDuration: Math.floor(Math.random() * 3000) + 1000,
    pendingChanges: mockSyncQueue.filter(q => 
      q.targetSystem === systemId && q.status === 'pending'
    ).length,
    errorRate: Math.random() * 0.1
  }
}

/**
 * Add change to sync queue
 */
export async function queueChange(
  change: Omit<DataChange, 'id' | 'timestamp' | 'synced'>,
  targetSystems: string[],
  priority: SyncQueueItem['priority'] = 'normal'
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const fullChange: DataChange = {
    ...change,
    id: `change-${generateId()}`,
    timestamp: new Date().toISOString(),
    synced: false
  }
  
  for (const systemId of targetSystems) {
    mockSyncQueue.push({
      id: `queue-${generateId()}`,
      change: fullChange,
      targetSystem: systemId,
      priority,
      attempts: 0,
      status: 'pending'
    })
  }
}

/**
 * Process sync queue
 */
export async function processSyncQueue(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const pending = mockSyncQueue.filter(q => q.status === 'pending')
  let succeeded = 0
  let failed = 0
  
  for (const item of pending) {
    // Simulate processing
    const success = Math.random() > 0.1
    
    if (success) {
      item.status = 'completed'
      item.change.synced = true
      succeeded++
    } else {
      item.attempts++
      if (item.attempts >= 3) {
        item.status = 'failed'
        failed++
      } else {
        item.lastAttempt = new Date().toISOString()
      }
    }
  }
  
  // Remove completed items
  mockSyncQueue = mockSyncQueue.filter(q => q.status !== 'completed')
  
  return {
    processed: pending.length,
    succeeded,
    failed
  }
}

/**
 * Format relative time
 */
export function formatRelativeSyncTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  
  return date.toLocaleDateString()
}

/**
 * Format duration in milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export default getExternalSystems
