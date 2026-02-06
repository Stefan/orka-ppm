'use client'

import React, { useState, useEffect } from 'react'
import { getNetworkInfo } from '../../lib/performance'

export interface OfflineIndicatorProps {
  className?: string
  showNetworkInfo?: boolean
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showNetworkInfo = false
}) => {
  const [isOnline, setIsOnline] = useState(true)
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false
  })
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine)
    setNetworkInfo(getNetworkInfo())

    // Event listeners for online/offline
    const handleOnline = () => {
      setIsOnline(true)
      setNetworkInfo(getNetworkInfo())
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    // Network change listener
    const handleNetworkChange = () => {
      setNetworkInfo(getNetworkInfo())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for network changes if supported
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', handleNetworkChange)
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        connection.removeEventListener('change', handleNetworkChange)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getConnectionQuality = () => {
    const { effectiveType, downlink, saveData } = networkInfo
    
    if (!isOnline) return 'offline'
    if (saveData) return 'save-data'
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'poor'
    if (effectiveType === '3g' || downlink < 1.5) return 'fair'
    if (effectiveType === '4g' && downlink > 2) return 'good'
    return 'unknown'
  }

  const getStatusColor = () => {
    const quality = getConnectionQuality()
    switch (quality) {
      case 'offline': return 'bg-red-500'
      case 'poor': return 'bg-red-400'
      case 'save-data': return 'bg-yellow-500'
      case 'fair': return 'bg-yellow-400'
      case 'good': return 'bg-green-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusText = () => {
    const quality = getConnectionQuality()
    switch (quality) {
      case 'offline': return 'Offline'
      case 'poor': return 'Poor Connection'
      case 'save-data': return 'Save Data Mode'
      case 'fair': return 'Fair Connection'
      case 'good': return 'Good Connection'
      default: return 'Unknown'
    }
  }

  const getStatusIcon = () => {
    const quality = getConnectionQuality()
    switch (quality) {
      case 'offline':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
          </svg>
        )
      case 'poor':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'save-data':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )
      case 'fair':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        )
      case 'good':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  // Don't show indicator if connection is good and user doesn't want network info
  if (getConnectionQuality() === 'good' && !showNetworkInfo) {
    return null
  }

  return (
    <div className={`fixed top-4 right-20 z-50 ${className}`}>
      <div
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg text-white text-sm
          cursor-pointer transition-all duration-200 hover:shadow-xl
          ${getStatusColor()}
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        
        {showNetworkInfo && (
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              showDetails ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Detailed network info */}
      {showDetails && showNetworkInfo && (
        <div className="absolute top-12 right-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-4 w-64 text-sm">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Network Information</h3>
          
          <div className="space-y-2 text-gray-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-medium ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {isOnline && (
              <>
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className="font-medium">{networkInfo.effectiveType.toUpperCase()}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Speed:</span>
                  <span className="font-medium">{networkInfo.downlink.toFixed(1)} Mbps</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="font-medium">{networkInfo.rtt}ms</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Save Data:</span>
                  <span className={`font-medium ${networkInfo.saveData ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-slate-400'}`}>
                    {networkInfo.saveData ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </>
            )}
          </div>

          {!isOnline && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-300 text-xs">
              Some features may be limited while offline. Changes will sync when connection is restored.
            </div>
          )}

          {networkInfo.saveData && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-300 text-xs">
              Save Data mode is enabled. Some images and features may be reduced to save bandwidth.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Hook for network status
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  const [networkInfo, setNetworkInfo] = useState(getNetworkInfo())

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleNetworkChange = () => setNetworkInfo(getNetworkInfo())

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', handleNetworkChange)
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        connection.removeEventListener('change', handleNetworkChange)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, networkInfo }
}

export default OfflineIndicator