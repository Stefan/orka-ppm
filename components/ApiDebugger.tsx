'use client'

import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../lib/api'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface ApiStatus {
  url: string
  status: 'checking' | 'success' | 'error'
  message: string
  responseTime?: number
}

export default function ApiDebugger() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    url: '',
    status: 'checking',
    message: 'Initializing...'
  })

  const checkApiConnection = useCallback(async () => {
    const startTime = Date.now()
    
    try {
      const url = getApiUrl('/')
      setApiStatus({
        url,
        status: 'checking',
        message: 'Checking API connection...'
      })

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        setApiStatus({
          url,
          status: 'success',
          message: `API connected successfully: ${data.message || 'OK'}`,
          responseTime
        })
      } else {
        setApiStatus({
          url,
          status: 'error',
          message: `API error: ${response.status} ${response.statusText}`,
          responseTime
        })
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime
      setApiStatus({
        url: getApiUrl('/'),
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime
      })
    }
  }, [])

  useEffect(() => {
    checkApiConnection()
  }, [checkApiConnection])

  const getStatusIcon = () => {
    switch (apiStatus.status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (apiStatus.status) {
      case 'checking':
        return 'border-blue-200 bg-blue-50'
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
        return 'border-red-200 bg-red-50'
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center space-x-2 mb-2">
        {getStatusIcon()}
        <h3 className="font-medium text-gray-900">API Connection Status</h3>
        <button
          onClick={checkApiConnection}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Retry
        </button>
      </div>
      
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">URL:</span> {apiStatus.url}
        </div>
        <div>
          <span className="font-medium">Status:</span> {apiStatus.message}
        </div>
        {apiStatus.responseTime && (
          <div>
            <span className="font-medium">Response Time:</span> {apiStatus.responseTime}ms
          </div>
        )}
      </div>

      {apiStatus.status === 'error' && (
        <div className="mt-3 p-3 bg-red-100 rounded border border-red-200">
          <h4 className="font-medium text-red-800 mb-2">Troubleshooting:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• Check if the backend API is running</li>
            <li>• Verify NEXT_PUBLIC_API_URL environment variable</li>
            <li>• Check network connectivity</li>
            <li>• Ensure CORS is properly configured on the backend</li>
          </ul>
        </div>
      )}
    </div>
  )
}