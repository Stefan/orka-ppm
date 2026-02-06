'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Pause,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Database,
  Loader2,
  X,
  Settings
} from 'lucide-react'
import {
  SyncStatus,
  ExternalSystemConfig,
  getSyncStatus,
  triggerSync,
  formatRelativeSyncTime,
  formatDuration,
  SYNC_STATUS_CONFIG,
  SYSTEM_TYPE_LABELS
} from '@/lib/external-sync'

export interface SyncStatusIndicatorProps {
  /** Show expanded view by default */
  expanded?: boolean
  /** Show in compact mode */
  compact?: boolean
  /** Refresh interval in milliseconds (default 30000) */
  refreshInterval?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Get icon component for status
 */
function getStatusIcon(status: SyncStatus, className: string = 'w-4 h-4') {
  const icons = {
    idle: <Pause className={className} />,
    syncing: <RefreshCw className={`${className} animate-spin`} />,
    success: <CheckCircle className={className} />,
    error: <AlertCircle className={className} />,
    partial: <AlertTriangle className={className} />,
    pending: <Clock className={className} />
  }
  return icons[status]
}

/**
 * Sync Status Indicator component
 */
export function SyncStatusIndicator({
  expanded: initialExpanded = false,
  compact = false,
  refreshInterval = 30000,
  className = ''
}: SyncStatusIndicatorProps) {
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(initialExpanded)
  const [syncingSystem, setSyncingSystem] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    systems: Array<{ system: ExternalSystemConfig; currentStatus: SyncStatus }>
    overallStatus: SyncStatus
    pendingChanges: number
  } | null>(null)
  
  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await getSyncStatus()
      setStatus(data)
    } catch (err) {
      console.error('Error fetching sync status:', err)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Initial load and refresh interval
  useEffect(() => {
    fetchStatus()
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStatus, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchStatus, refreshInterval])
  
  // Handle manual sync
  const handleSync = async (systemId: string) => {
    try {
      setSyncingSystem(systemId)
      await triggerSync(systemId)
      await fetchStatus()
    } catch (err) {
      console.error('Error triggering sync:', err)
    } finally {
      setSyncingSystem(null)
    }
  }
  
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 dark:text-slate-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        {!compact && <span className="text-xs">Loading...</span>}
      </div>
    )
  }
  
  if (!status) {
    return null
  }
  
  const config = SYNC_STATUS_CONFIG[status.overallStatus]
  const enabledSystems = status.systems.filter(s => s.system.enabled)
  
  // Compact mode - just show status indicator
  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
          ${config.bgColor} ${config.color}
          hover:opacity-80 transition-opacity
          ${className}
        `}
        title={`Sync Status: ${config.label}${status.pendingChanges > 0 ? ` (${status.pendingChanges} pending)` : ''}`}
      >
        {getStatusIcon(status.overallStatus, 'w-3 h-3')}
        {status.pendingChanges > 0 && (
          <span className="font-medium">{status.pendingChanges}</span>
        )}
      </button>
    )
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Main indicator */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border
          ${config.bgColor} ${config.color} border-current/20
          hover:shadow-sm transition-all
        `}
      >
        {getStatusIcon(status.overallStatus)}
        <span className="text-sm font-medium">{config.label}</span>
        {status.pendingChanges > 0 && (
          <span className="px-1.5 py-0.5 bg-white dark:bg-slate-800/50 rounded text-xs font-medium">
            {status.pendingChanges}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-1" />
        )}
      </button>
      
      {/* Expanded panel */}
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <span className="font-medium text-gray-900 dark:text-slate-100">System Integrations</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Systems list */}
          <div className="max-h-64 overflow-y-auto">
            {enabledSystems.length === 0 ? (
              <div className="p-4 text-center text-gray-400 dark:text-slate-500 text-sm">
                No integrations configured
              </div>
            ) : (
              enabledSystems.map(({ system, currentStatus }) => {
                const systemConfig = SYNC_STATUS_CONFIG[currentStatus]
                const isSyncing = syncingSystem === system.id
                
                return (
                  <div
                    key={system.id}
                    className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                            {system.name}
                          </span>
                          <span className={`
                            px-1.5 py-0.5 text-xs rounded-full
                            ${systemConfig.bgColor} ${systemConfig.color}
                          `}>
                            {systemConfig.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {SYSTEM_TYPE_LABELS[system.type]} • {system.syncSchedule}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleSync(system.id)}
                        disabled={isSyncing}
                        className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                        title="Sync now"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    
                    {/* Last sync info */}
                    {system.lastSync && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Last sync:</span>
                          <span>{formatRelativeSyncTime(system.lastSync.timestamp)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Records:</span>
                          <span>
                            {system.lastSync.recordsSucceeded}/{system.lastSync.recordsProcessed}
                            {system.lastSync.recordsFailed > 0 && (
                              <span className="text-red-500 dark:text-red-400 ml-1">
                                ({system.lastSync.recordsFailed} failed)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span>{formatDuration(system.lastSync.duration)}</span>
                        </div>
                        
                        {/* Errors */}
                        {system.lastSync.errors.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded text-red-800 dark:text-red-200">
                            <div className="font-medium mb-1">Errors:</div>
                            {system.lastSync.errors.slice(0, 2).map((error, idx) => (
                              <div key={idx} className="truncate">
                                {error.message}
                              </div>
                            ))}
                            {system.lastSync.errors.length > 2 && (
                              <div className="text-red-400 mt-1">
                                +{system.lastSync.errors.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
          
          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between">
            {status.pendingChanges > 0 && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {status.pendingChanges} change{status.pendingChanges !== 1 ? 's' : ''} pending
              </span>
            )}
            <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1">
              <Settings className="w-3 h-3" />
              Configure
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Simple sync badge for headers
 */
export interface SyncBadgeProps {
  /** Click handler */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

export function SyncBadge({ onClick, className = '' }: SyncBadgeProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  
  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await getSyncStatus()
        setStatus(data.overallStatus)
        setPendingCount(data.pendingChanges)
      } catch (err) {
        console.error('Error fetching sync status:', err)
      }
    }
    
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000)
    return () => clearInterval(interval)
  }, [])
  
  const config = SYNC_STATUS_CONFIG[status]
  
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-full text-xs
        ${config.bgColor} ${config.color}
        hover:opacity-80 transition-opacity
        ${className}
      `}
      title={`Sync: ${config.label}`}
    >
      {getStatusIcon(status, 'w-3 h-3')}
      {pendingCount > 0 && (
        <span className="font-medium">{pendingCount}</span>
      )}
    </button>
  )
}

export default SyncStatusIndicator
