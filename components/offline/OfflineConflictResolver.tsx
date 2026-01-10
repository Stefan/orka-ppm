/**
 * Offline Conflict Resolver Component
 * Provides UI for resolving offline synchronization conflicts
 * Requirements: 11.3
 */

import React, { useState, useCallback } from 'react'
import { 
  AlertTriangle, 
  GitMerge, 
  Monitor, 
  Cloud, 
  Check, 
  X, 
  Clock,
  FileText,
  Settings,
  Database
} from 'lucide-react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { MergeConflict } from '../../lib/offline/offline-sync'

interface OfflineConflictResolverProps {
  isOpen: boolean
  onClose: () => void
}

export const OfflineConflictResolver: React.FC<OfflineConflictResolverProps> = ({
  isOpen,
  onClose
}) => {
  const { pendingConflicts, resolveConflict, isSyncing } = useOfflineSync()
  const [selectedConflict, setSelectedConflict] = useState<MergeConflict | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [mergedData, setMergedData] = useState<any>(null)

  const handleResolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    try {
      setIsResolving(true)
      await resolveConflict(conflictId, resolution, mergedData)
      setSelectedConflict(null)
      setMergedData(null)
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setIsResolving(false)
    }
  }, [resolveConflict, mergedData])

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'preferences':
        return <Settings className="h-4 w-4" />
      case 'form-submission':
        return <FileText className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const getConflictTypeColor = (type: string) => {
    switch (type) {
      case 'version':
        return 'text-amber-600 bg-amber-100'
      case 'concurrent':
        return 'text-red-600 bg-red-100'
      case 'deleted':
        return 'text-purple-600 bg-purple-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatConflictType = (type: string) => {
    switch (type) {
      case 'version':
        return 'Version Conflict'
      case 'concurrent':
        return 'Concurrent Modification'
      case 'deleted':
        return 'Deletion Conflict'
      default:
        return 'Unknown Conflict'
    }
  }

  const formatData = (data: any) => {
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data, null, 2)
    }
    return String(data)
  }

  const createSmartMerge = (conflict: MergeConflict) => {
    if (!conflict.localData || !conflict.remoteData) return conflict.localData || conflict.remoteData

    const merged = { ...conflict.remoteData }
    
    // Merge strategy based on conflict type
    if (conflict.conflictType === 'concurrent') {
      // For concurrent conflicts, merge non-conflicting fields
      Object.keys(conflict.localData).forEach(key => {
        if (conflict.localData[key] !== conflict.remoteData[key]) {
          // Keep local changes for user-specific fields
          if (key.includes('preference') || key.includes('setting') || key.includes('custom')) {
            merged[key] = conflict.localData[key]
          }
        }
      })
    }
    
    // Always use latest timestamp and increment version
    merged.lastModified = new Date()
    merged.version = Math.max(
      conflict.localData.version || 0, 
      conflict.remoteData.version || 0
    ) + 1
    
    return merged
  }

  if (!isOpen || pendingConflicts.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Sync Conflicts Detected
              </h2>
              <p className="text-sm text-gray-600">
                {pendingConflicts.length} conflict{pendingConflicts.length !== 1 ? 's' : ''} need resolution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Conflicts List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Conflicts</h3>
              <div className="space-y-2">
                {pendingConflicts.map((conflict) => (
                  <button
                    key={conflict.id}
                    onClick={() => setSelectedConflict(conflict)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedConflict?.id === conflict.id
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getEntityIcon(conflict.entity)}
                        <span className="font-medium text-sm capitalize">
                          {conflict.entity}
                        </span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConflictTypeColor(conflict.conflictType)}`}>
                        {formatConflictType(conflict.conflictType)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      ID: {conflict.entityId}
                    </div>
                    <div className="text-xs text-gray-500">
                      {conflict.timestamp.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conflict Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedConflict ? (
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {formatConflictType(selectedConflict.conflictType)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedConflict.entity} • {selectedConflict.entityId}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {selectedConflict.timestamp.toLocaleString()}
                    </span>
                  </div>

                  {/* Conflict Description */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        {selectedConflict.conflictType === 'version' && (
                          <p>The local version is older than the remote version. Changes were made on another device.</p>
                        )}
                        {selectedConflict.conflictType === 'concurrent' && (
                          <p>Both local and remote versions were modified at nearly the same time on different devices.</p>
                        )}
                        {selectedConflict.conflictType === 'deleted' && (
                          <p>You tried to update an item that was deleted on another device.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Data Comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Local Version */}
                    <div className="border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-2">
                          <Monitor className="h-4 w-4 text-blue-600" />
                          <h4 className="font-medium text-gray-900">Local Version</h4>
                        </div>
                        <span className="text-sm text-gray-600">This Device</span>
                      </div>
                      <div className="p-4">
                        <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
                          {formatData(selectedConflict.localData)}
                        </pre>
                      </div>
                    </div>

                    {/* Remote Version */}
                    <div className="border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-2">
                          <Cloud className="h-4 w-4 text-green-600" />
                          <h4 className="font-medium text-gray-900">Remote Version</h4>
                        </div>
                        <span className="text-sm text-gray-600">Other Device</span>
                      </div>
                      <div className="p-4">
                        {selectedConflict.remoteData ? (
                          <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-60">
                            {formatData(selectedConflict.remoteData)}
                          </pre>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <X className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-sm">Item was deleted</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Options */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Choose Resolution</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => handleResolveConflict(selectedConflict.id, 'local')}
                        disabled={isResolving || isSyncing}
                        className="flex flex-col items-center justify-center p-4 border border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <Monitor className="h-6 w-6 text-blue-600 mb-2" />
                        <span className="font-medium text-sm">Keep Local</span>
                        <span className="text-xs text-gray-600 text-center mt-1">
                          Use the version from this device
                        </span>
                      </button>
                      
                      <button
                        onClick={() => handleResolveConflict(selectedConflict.id, 'remote')}
                        disabled={isResolving || isSyncing || !selectedConflict.remoteData}
                        className="flex flex-col items-center justify-center p-4 border border-gray-300 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        <Cloud className="h-6 w-6 text-green-600 mb-2" />
                        <span className="font-medium text-sm">Keep Remote</span>
                        <span className="text-xs text-gray-600 text-center mt-1">
                          Use the version from other device
                        </span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const merged = createSmartMerge(selectedConflict)
                          setMergedData(merged)
                          handleResolveConflict(selectedConflict.id, 'merge')
                        }}
                        disabled={isResolving || isSyncing}
                        className="flex flex-col items-center justify-center p-4 border border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors disabled:opacity-50"
                      >
                        <GitMerge className="h-6 w-6 text-purple-600 mb-2" />
                        <span className="font-medium text-sm">Smart Merge</span>
                        <span className="text-xs text-gray-600 text-center mt-1">
                          Automatically combine both versions
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a conflict to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Conflicts occur when the same data is modified offline and online simultaneously.
          </div>
          <div className="flex items-center space-x-3">
            {(isResolving || isSyncing) && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span className="text-sm">Resolving...</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfflineConflictResolver