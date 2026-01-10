/**
 * Device Manager Component
 * Manages connected devices and session continuity
 * Requirements: 11.2, 11.5
 */

import React, { useState, useEffect } from 'react'
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Wifi, 
  WifiOff, 
  Clock, 
  Play, 
  MoreVertical,
  RefreshCw
} from 'lucide-react'
import { useCrossDeviceSync, useSessionContinuity } from '../hooks/useCrossDeviceSync'
import { DeviceInfo } from '../../lib/sync/cross-device-sync'

interface DeviceManagerProps {
  isOpen: boolean
  onClose: () => void
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({
  isOpen,
  onClose
}) => {
  const { availableDevices, refreshDevices, isOnline, isSyncing } = useCrossDeviceSync()
  const { recentDevices, continueFromDevice, sessionState } = useSessionContinuity()
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      refreshDevices()
    }
  }, [isOpen, refreshDevices])

  const getDeviceIcon = (deviceType: string, isActive: boolean = true) => {
    const iconClass = `h-5 w-5 ${isActive ? 'text-green-500' : 'text-gray-400'}`
    
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className={iconClass} />
      case 'tablet':
        return <Tablet className={iconClass} />
      default:
        return <Monitor className={iconClass} />
    }
  }

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const handleContinueFromDevice = async (deviceId: string) => {
    try {
      setIsLoading(true)
      await continueFromDevice(deviceId)
      onClose()
    } catch (error) {
      console.error('Failed to continue from device:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshDevices = async () => {
    try {
      setIsLoading(true)
      await refreshDevices()
    } catch (error) {
      console.error('Failed to refresh devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <h2 className="text-xl font-semibold text-gray-900">
                Device Manager
              </h2>
            </div>
            {isSyncing && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefreshDevices}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Current Session */}
          {sessionState && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Current Session</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getDeviceIcon('desktop')}
                    <div>
                      <div className="font-medium text-gray-900">This Device</div>
                      <div className="text-sm text-gray-600">
                        Active on {sessionState.currentWorkspace}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatLastSeen(sessionState.lastActivity)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Devices for Session Continuity */}
          {recentDevices.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Continue From Other Device</h3>
              <div className="space-y-3">
                {recentDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {getDeviceIcon(device.type, device.isActive)}
                      <div>
                        <div className="font-medium text-gray-900">{device.name}</div>
                        <div className="text-sm text-gray-600 flex items-center space-x-2">
                          <Clock className="h-3 w-3" />
                          <span>Last seen {formatLastSeen(device.lastSeen)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleContinueFromDevice(device.id)}
                      disabled={isLoading || !device.isActive}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="h-4 w-4" />
                      <span className="text-sm">Continue</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Connected Devices */}
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-3">All Connected Devices</h3>
            {availableDevices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No devices found</p>
                <button
                  onClick={handleRefreshDevices}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Refresh to check for devices
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {availableDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      device.isActive 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {getDeviceIcon(device.type, device.isActive)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{device.name}</span>
                          {device.isActive && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center space-x-4">
                          <span>{device.platform}</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatLastSeen(device.lastSeen)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {device.isActive && recentDevices.some(d => d.id === device.id) && (
                        <button
                          onClick={() => handleContinueFromDevice(device.id)}
                          disabled={isLoading}
                          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" />
                          <span className="text-sm">Continue</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedDevice(device)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {isOnline ? (
              <span className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-green-500" />
                <span>Connected - Auto-sync enabled</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-red-500" />
                <span>Offline - Changes will sync when connected</span>
              </span>
            )}
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

export default DeviceManager