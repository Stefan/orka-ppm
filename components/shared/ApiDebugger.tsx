'use client'

import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '@/lib/api/client'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context';

interface ApiStatus {
  url: string
  status: 'checking' | 'success' | 'error'
  message: string
  responseTime?: number
}

export default function ApiDebugger() {
  const t = useTranslations();
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
        message: t('shared.apiDebugger.checking')
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
          message: t('shared.apiDebugger.connectedSuccessfully', { message: data.message || 'OK' }),
          responseTime
        })
      } else {
        setApiStatus({
          url,
          status: 'error',
          message: t('shared.apiDebugger.apiError', { status: response.status, statusText: response.statusText }),
          responseTime
        })
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime
      setApiStatus({
        url: getApiUrl('/'),
        status: 'error',
        message: t('shared.apiDebugger.connectionFailed', { error: error instanceof Error ? error.message : 'Unknown error' }),
        responseTime
      })
    }
  }, [t])

  useEffect(() => {
    checkApiConnection()
  }, [checkApiConnection])

  const getStatusIcon = () => {
    switch (apiStatus.status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500 dark:text-blue-400" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
    }
  }

  const getStatusColor = () => {
    switch (apiStatus.status) {
      case 'checking':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
      case 'success':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
      case 'error':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    }
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center space-x-2 mb-2">
        {getStatusIcon()}
        <h3 className="font-medium text-gray-900 dark:text-slate-100">{t('shared.apiDebugger.title')}</h3>
        <button
          onClick={checkApiConnection}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          {t('shared.apiDebugger.retry')}
        </button>
      </div>
      
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">{t('shared.apiDebugger.url')}:</span> {apiStatus.url}
        </div>
        <div>
          <span className="font-medium">{t('shared.apiDebugger.status')}:</span> {apiStatus.message}
        </div>
        {apiStatus.responseTime && (
          <div>
            <span className="font-medium">{t('shared.apiDebugger.responseTime')}:</span> {apiStatus.responseTime}ms
          </div>
        )}
      </div>

      {apiStatus.status === 'error' && (
        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
          <h4 className="font-medium text-red-800 dark:text-red-300 mb-2">{t('shared.apiDebugger.troubleshooting.title')}</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• {t('shared.apiDebugger.troubleshooting.checkBackend')}</li>
            <li>• {t('shared.apiDebugger.troubleshooting.verifyEnvVar')}</li>
            <li>• {t('shared.apiDebugger.troubleshooting.checkNetwork')}</li>
            <li>• {t('shared.apiDebugger.troubleshooting.ensureCors')}</li>
          </ul>
        </div>
      )}
    </div>
  )
}