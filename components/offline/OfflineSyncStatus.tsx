/**
 * Offline Sync Status Component
 * Shows offline changes and sync status
 * Requirements: 11.3
 */

import React, { useState } from 'react'
import { 
  Wifi, 
  WifiOff, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useCrossDeviceSync } from '../hooks/useCrossDeviceSync'
import { OfflineChange } from '../../lib/sync/cross-device-sync'

interface OfflineSyncStatusProps {
  className?: string
}

export const OfflineSyncStatus: React.FC<OfflineSyncStatusProps> = ({
  className = ''
}) => {
  const { 
    isOnline, 
    isSyncing, 
    lastSyncTime, 
    offlineChanges, 
    hasOfflineChanges,
    forceSync 
  } = useCrossDeviceSync()
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [isForceSync, setIsForceSync] = useState(false)

  const handleForceSync = async () => {
    try {
      setIsForceSync(true)
      await forceSync()
    } catch (error) {
      console.error('Failed to force sync:', error)
    } finally {
      setIsForceSync(false)
    }
  }

  const formatChangeType = (change: OfflineChange) => {
    const typeColors = {
      create: 'text-green-600 bg-green-100',
      update: 'text-blue-600 bg-blue-100',
      delete: 'text-red-600 bg-red-100'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeColors[change.type]}`}>
        {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
      </span>
    )
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return timestamp.toLocaleDateString()
  }

  // Don't show if online and no offline changes
  if (isOnline && !hasOfflineChanges && !isSyncing) {
    return null
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900">
                {isOnline ? 'Online' : 'Offline'}
              </h3>
              
              {isSyncing && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Syncing...</span>
                </div>
              )}
              
              {hasOfflineChanges && (
                <div className="flex items-center space-x-1 text-amber-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{offlineChanges.length} pending</span>
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-600">
              {lastSyncTime ? (
                `Last sync: ${formatTimestamp(lastSyncTime)}`
              ) : (
                'Never synced'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isOnline && hasOfflineChanges && (
            <button
              onClick={handleForceSync}
              disabled={isSyncing || isForceSync}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span className="text-sm">Sync Now</span>
            </button>
          )}
          
          {hasOfflineChanges && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Offline Changes List */}
      {isExpanded && hasOfflineChanges && (
        <div className="border-t border-gray-200">
          <div className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Pending Changes</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {offlineChanges.map((change) => (
                <div
                  key={change.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {formatChangeType(change)}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {change.entity} {change.entityId}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatTimestamp(change.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {change.synced ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {!isOnline && (
        <div className="border-t border-gray-200 p-4 bg-amber-50">
          <div className="flex items-center space-x-2 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              You're offline. Changes will sync automatically when you reconnect.
            </span>
          </div>
        </div>
      )}
      
      {isOnline && hasOfflineChanges && (
        <div className="border-t border-gray-200 p-4 bg-blue-50">
          <div className="flex items-center space-x-2 text-blue-800">
            <Upload className="h-4 w-4" />
            <span className="text-sm">
              You have {offlineChanges.length} change{offlineChanges.length !== 1 ? 's' : ''} waiting to sync.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default OfflineSyncStatus