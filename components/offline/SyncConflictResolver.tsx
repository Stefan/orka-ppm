/**
 * Sync Conflict Resolver Component
 * Provides UI for resolving synchronization conflicts between devices
 * Requirements: 11.3, 11.4
 */

import React, { useState, useCallback } from 'react'
import { AlertTriangle, Smartphone, Monitor, Tablet, X, GitMerge } from 'lucide-react'
import { useCrossDeviceSync } from '../../hooks/useCrossDeviceSync'
import { SyncConflict } from '../../lib/sync/cross-device-sync'

export interface SyncConflictResolverProps {
  isOpen: boolean
  onClose: () => void
}

export const SyncConflictResolver: React.FC<SyncConflictResolverProps> = ({
  isOpen,
  onClose
}) => {
  const { conflicts, resolveConflict } = useCrossDeviceSync()
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null)
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

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />
      case 'tablet':
        return <Tablet className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const formatConflictField = (value: any) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const createMergedData = (conflict: SyncConflict) => {
    // Simple merge strategy - prefer local for most fields, remote for timestamps
    const merged = { ...conflict.localData }
    
    // Always use the latest timestamp
    if (conflict.remoteData.lastModified > conflict.localData.lastModified) {
      merged.lastModified = conflict.remoteData.lastModified
    }
    
    // Merge arrays by combining unique values
    conflict.conflictFields.forEach(field => {
      const localValue = getNestedValue(conflict.localData, field)
      const remoteValue = getNestedValue(conflict.remoteData, field)
      
      if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        const mergedArray = [...new Set([...localValue, ...remoteValue])]
        setNestedValue(merged, field, mergedArray)
      }
    })
    
    merged.version = Math.max(conflict.localVersion, conflict.remoteVersion) + 1
    
    return merged
  }

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  if (!isOpen || conflicts.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Sync Conflicts Detected
              </h2>
              <p className="text-sm text-gray-600">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need{conflicts.length === 1 ? 's' : ''} resolution
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
          {/* Conflict List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Conflicts</h3>
              <div className="space-y-2">
                {conflicts.map((conflict) => (
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
                      <span className="font-medium text-sm capitalize">
                        {conflict.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {conflict.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {conflict.conflictFields.length} field{conflict.conflictFields.length !== 1 ? 's' : ''} affected
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedConflict.type.charAt(0).toUpperCase() + selectedConflict.type.slice(1)} Conflict
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Changes were made on different devices at similar times. Choose how to resolve this conflict.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Local Version */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">This Device</h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          {getDeviceIcon('desktop')}
                          <span>Version {selectedConflict.localVersion}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedConflict.conflictFields.map((field) => (
                          <div key={field} className="text-sm">
                            <span className="font-medium text-gray-700">{field}:</span>
                            <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono">
                              {formatConflictField(getNestedValue(selectedConflict.localData, field))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Remote Version */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Other Device</h4>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          {getDeviceIcon('mobile')}
                          <span>Version {selectedConflict.remoteVersion}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedConflict.conflictFields.map((field) => (
                          <div key={field} className="text-sm">
                            <span className="font-medium text-gray-700">{field}:</span>
                            <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono">
                              {formatConflictField(getNestedValue(selectedConflict.remoteData, field))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Options */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Resolution Options</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => handleResolveConflict(selectedConflict.id, 'local')}
                        disabled={isResolving}
                        className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <Monitor className="h-4 w-4" />
                        <span className="text-sm font-medium">Keep This Device</span>
                      </button>
                      
                      <button
                        onClick={() => handleResolveConflict(selectedConflict.id, 'remote')}
                        disabled={isResolving}
                        className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <Smartphone className="h-4 w-4" />
                        <span className="text-sm font-medium">Keep Other Device</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          const merged = createMergedData(selectedConflict)
                          setMergedData(merged)
                          handleResolveConflict(selectedConflict.id, 'merge')
                        }}
                        disabled={isResolving}
                        className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
                      >
                        <GitMerge className="h-4 w-4" />
                        <span className="text-sm font-medium">Smart Merge</span>
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
            Conflicts occur when the same data is modified on different devices simultaneously.
          </div>
          <div className="flex items-center space-x-3">
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

export default SyncConflictResolver