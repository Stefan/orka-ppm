/**
 * Session Restoration Component
 * Provides UI for restoring sessions from other devices
 * Requirements: 11.2, 11.5
 */

import React, { useState, useEffect } from 'react'
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Clock, 
  Play, 
  RefreshCw, 
  X,
  FileText,
  Settings,
  BarChart3
} from 'lucide-react'
import { useSessionContinuity } from '../hooks/useSessionContinuity'
import { ContinuitySnapshot, TaskContext } from '../../lib/sync/session-continuity'

interface SessionRestorationProps {
  isOpen: boolean
  onClose: () => void
  onRestore?: (snapshot: ContinuitySnapshot) => void
}

export const SessionRestoration: React.FC<SessionRestorationProps> = ({
  isOpen,
  onClose,
  onRestore
}) => {
  const { 
    availableSnapshots, 
    restoreFromDevice, 
    restoreLatest, 
    isRestoring,
    refreshSnapshots
  } = useSessionContinuity()
  
  const [selectedSnapshot, setSelectedSnapshot] = useState<ContinuitySnapshot | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      refreshSnapshots()
    }
  }, [isOpen, refreshSnapshots])

  const handleRestore = async (snapshot: ContinuitySnapshot) => {
    try {
      const restored = await restoreFromDevice(snapshot.deviceId)
      if (restored && onRestore) {
        onRestore(restored)
      }
      onClose()
    } catch (error) {
      console.error('Failed to restore session:', error)
    }
  }

  const handleRestoreLatest = async () => {
    try {
      const restored = await restoreLatest()
      if (restored && onRestore) {
        onRestore(restored)
      }
      onClose()
    } catch (error) {
      console.error('Failed to restore latest session:', error)
    }
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await refreshSnapshots()
    } catch (error) {
      console.error('Failed to refresh snapshots:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-5 w-5 text-blue-500" />
      case 'tablet':
        return <Tablet className="h-5 w-5 text-blue-500" />
      default:
        return <Monitor className="h-5 w-5 text-blue-500" />
    }
  }

  const getTaskIcon = (taskType: TaskContext['taskType']) => {
    switch (taskType) {
      case 'form':
        return <FileText className="h-4 w-4" />
      case 'workflow':
        return <Settings className="h-4 w-4" />
      case 'analysis':
        return <BarChart3 className="h-4 w-4" />
      case 'report':
        return <FileText className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return timestamp.toLocaleDateString()
  }

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search
    } catch {
      return url
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Continue Where You Left Off
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Restore your session from another device
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Snapshots List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              {/* Quick Restore Latest */}
              {availableSnapshots.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={handleRestoreLatest}
                    disabled={isRestoring}
                    className="w-full flex items-center justify-center space-x-2 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Play className="h-5 w-5" />
                    <span className="font-medium">Continue Latest Session</span>
                  </button>
                </div>
              )}

              <h3 className="font-medium text-gray-900 mb-3">Available Sessions</h3>
              
              {availableSnapshots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No sessions found</p>
                  <p className="text-sm mt-1">Sessions from other devices will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSnapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      onClick={() => setSelectedSnapshot(snapshot)}
                      className={`w-full text-left p-4 border rounded-lg transition-colors ${
                        selectedSnapshot?.id === snapshot.id
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getDeviceIcon(snapshot.metadata.deviceType)}
                          <span className="font-medium text-sm">
                            {snapshot.metadata.deviceName}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(snapshot.timestamp)}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-2">
                        {formatUrl(snapshot.browserState.url)}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {snapshot.activeTasks.length > 0 && (
                          <span>{snapshot.activeTasks.length} active task{snapshot.activeTasks.length !== 1 ? 's' : ''}</span>
                        )}
                        {snapshot.workspaceState.activeWidgets.length > 0 && (
                          <span>{snapshot.workspaceState.activeWidgets.length} widget{snapshot.workspaceState.activeWidgets.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Snapshot Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedSnapshot ? (
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getDeviceIcon(selectedSnapshot.metadata.deviceType)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedSnapshot.metadata.deviceName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatTimestamp(selectedSnapshot.timestamp)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(selectedSnapshot)}
                      disabled={isRestoring}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      <span>Restore Session</span>
                    </button>
                  </div>

                  {/* Session Details */}
                  <div className="space-y-4">
                    {/* Current Page */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Current Page</h4>
                      <p className="text-sm text-gray-600">
                        {formatUrl(selectedSnapshot.browserState.url)}
                      </p>
                      {selectedSnapshot.browserState.scrollPosition > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Scrolled to position {selectedSnapshot.browserState.scrollPosition}px
                        </p>
                      )}
                    </div>

                    {/* Active Tasks */}
                    {selectedSnapshot.activeTasks.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Active Tasks</h4>
                        <div className="space-y-2">
                          {selectedSnapshot.activeTasks.map((task) => (
                            <div key={task.taskId} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {getTaskIcon(task.taskType)}
                                <span className="text-sm text-gray-700">{task.taskId}</span>
                                <span className="text-xs text-gray-500 capitalize">({task.taskType})</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Step {task.currentStep} of {task.totalSteps}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Workspace Configuration */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Workspace</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Layout:</span>
                          <span className="ml-2 capitalize">{selectedSnapshot.workspaceState.layout}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Sidebar:</span>
                          <span className="ml-2">
                            {selectedSnapshot.workspaceState.sidebarCollapsed ? 'Collapsed' : 'Expanded'}
                          </span>
                        </div>
                        {selectedSnapshot.workspaceState.activeWidgets.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Active Widgets:</span>
                            <span className="ml-2">{selectedSnapshot.workspaceState.activeWidgets.length}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Form Data */}
                    {Object.keys(selectedSnapshot.browserState.formData).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Unsaved Form Data</h4>
                        <div className="space-y-2">
                          {Object.entries(selectedSnapshot.browserState.formData).map(([formId, data]) => (
                            <div key={formId} className="text-sm">
                              <span className="text-gray-600">Form {formId}:</span>
                              <span className="ml-2 text-gray-700">
                                {Object.keys(data as any).length} field{Object.keys(data as any).length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a session to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Sessions are automatically saved when you switch devices or close the app.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionRestoration