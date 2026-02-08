'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { FileText, Loader, Send, Bot, User, AlertTriangle, RefreshCw, Sparkles, CheckCircle, XCircle } from 'lucide-react'
import AppLayout from '../../components/shared/AppLayout'
import { getApiUrl } from '@/lib/api/client'
import { useTranslations } from '@/lib/i18n/context'
import { useToast } from '@/components/shared/Toast'
import { formatTime } from '@/lib/utils/formatting'
import { 
  ResourceOptimizerChart, 
  RiskForecastChart, 
  ValidationIssuesDisplay,
  ConfidenceBadge 
} from '@/components/ai/AIResultVisualizations'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{type: string, count?: number, data?: string}>
  confidence?: number
  action?: string
  actionData?: Record<string, any>
  suggestedChanges?: Array<{
    id: string
    section: string
    changeType: string
    content: string
    reason: string
    confidence: number
    applied: boolean
  }>
  // AI Agent Results
  optimizerResults?: {
    recommendations: Array<{
      resource_id: string
      resource_name: string
      project_id: string
      project_name: string
      allocated_hours: number
      cost_savings: number
      confidence: number
    }>
    total_cost_savings: number
    model_confidence: number
  }
  riskForecastResults?: {
    forecasts: Array<{
      period: string
      risk_probability: number
      risk_impact: number
      confidence_lower: number
      confidence_upper: number
    }>
    model_confidence: number
  }
  validationResults?: {
    issues: Array<{
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
      category: string
      entity_type: string
      entity_id: string
      description: string
      recommendation?: string
    }>
    total_issues: number
    critical_count: number
    high_count: number
    medium_count: number
    low_count: number
  }
}

interface RAGResponse {
  response: string
  sources: Array<{type: string, id: string, similarity: number}>
  confidence_score: number
  conversation_id: string
  response_time_ms: number
  status?: string
}

interface ChatError {
  timestamp: Date
  errorType: 'network' | 'server' | 'timeout' | 'auth' | 'unknown'
  message: string
  statusCode?: number
  retryable: boolean
}

interface ErrorRecoveryState {
  lastQuery: string
  conversationId: string | null
  retryCount: number
  maxRetries: number
  errorHistory: ChatError[]
}

export default function Reports() {
  const { session } = useAuth()
  const { t } = useTranslations()
  const toast = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      confidence: 1.0
    }
  ])
  const [currentQuery, setCurrentQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reportFormat, setReportFormat] = useState('text')
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [errorRecovery, setErrorRecovery] = useState<ErrorRecoveryState>({
    lastQuery: '',
    conversationId: null,
    retryCount: 0,
    maxRetries: 3,
    errorHistory: []
  })
  const [showError, setShowError] = useState(false)
  const [currentError, setCurrentError] = useState<ChatError | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPMRMode, setIsPMRMode] = useState(false)
  const [pmrContext, setPMRContext] = useState<{
    reportId?: string
    projectId?: string
    currentSection?: string
  }>({})
  const [pendingChanges, setPendingChanges] = useState<Array<{
    id: string
    section: string
    changeType: string
    content: string
    reason: string
    confidence: number
    applied: boolean
  }>>([])
  const [showPMRActions, setShowPMRActions] = useState(false)

  // Handle window size detection on client side only
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const createChatError = (error: unknown, statusCode?: number): ChatError => {
    let errorType: ChatError['errorType'] = 'unknown'
    let message = 'Ein unerwarteter Fehler ist aufgetreten'
    let retryable = true

    // Log error to console for debugging
    console.error('AI Chat Error:', error, { statusCode })

    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorType = 'network'
      message = 'Netzwerkverbindung fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.'
    } else if (statusCode === 401 || statusCode === 403) {
      errorType = 'auth'
      message = 'Authentifizierung fehlgeschlagen. Bitte aktualisieren Sie die Seite und versuchen Sie es erneut.'
      retryable = false
    } else if (statusCode === 408 || statusCode === 504) {
      errorType = 'timeout'
      message = 'Anfrage-Zeitüberschreitung. Der Server braucht zu lange zum Antworten.'
    } else if (statusCode && statusCode >= 500) {
      errorType = 'server'
      message = 'Serverfehler aufgetreten. Unser Team wurde benachrichtigt.'
    } else if (statusCode && statusCode >= 400) {
      errorType = 'server'
      message = 'Anfrage fehlgeschlagen. Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.'
      retryable = false
    } else if (error instanceof Error) {
      // Handle other Error types
      message = `Fehler: ${error.message}`
      console.error('Detailed error:', error.stack)
    }

    return {
      timestamp: new Date(),
      errorType,
      message,
      statusCode: statusCode || 0,
      retryable
    }
  }

  const handleRetry = async () => {
    if (!errorRecovery.lastQuery || errorRecovery.retryCount >= errorRecovery.maxRetries) {
      return
    }

    setShowError(false)
    setCurrentError(null)
    
    // Update retry count
    setErrorRecovery(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1
    }))

    // Retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, errorRecovery.retryCount), 10000)
    await new Promise(resolve => setTimeout(resolve, delay))

    // Retry the last query
    await sendMessage(errorRecovery.lastQuery, errorRecovery.conversationId)
  }

  const resetErrorState = () => {
    setErrorRecovery(prev => ({
      ...prev,
      retryCount: 0,
      errorHistory: []
    }))
    setShowError(false)
    setCurrentError(null)
  }

  const suggestAlternatives = (): string[] => {
    const alternatives = [
      "Versuchen Sie eine einfachere Frage zu stellen",
      "Überprüfen Sie das Dashboard für den aktuellen Projektstatus",
      "Schauen Sie auf der Finanztracking-Seite für Budgetinformationen",
      "Besuchen Sie die Ressourcen-Seite für Team-Zuweisungsdetails",
      "Kontaktieren Sie den Support, wenn das Problem weiterhin besteht"
    ]

    // Add specific suggestions based on error history
    if (errorRecovery.errorHistory.some(e => e.errorType === 'network')) {
      alternatives.unshift("Check your internet connection")
    }
    
    if (errorRecovery.errorHistory.some(e => e.errorType === 'auth')) {
      alternatives.unshift("Refresh the page to re-authenticate")
    }

    return alternatives.slice(0, 3) // Return top 3 suggestions
  }

  const sendMessage = async (query: string, convId: string | null = null) => {
    if (!session?.access_token) return

    setIsLoading(true)

    try {
      const response = await fetch(getApiUrl('/ai/rag/query'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          query: query,
          conversation_id: convId || conversationId
        }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`HTTP ${response.status}: ${response.statusText}`, errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: RAGResponse = await response.json()

      // Store conversation ID for context
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id)
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources.map(s => ({
          type: s.type,
          count: 1,
          data: `${s.type}:${s.id} (${(s.similarity * 100).toFixed(1)}% match)`
        })),
        confidence: data.confidence_score,
        action: data.action,
        actionData: data.actionData,
        suggestedChanges: data.suggestedChanges
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Handle PMR-specific suggested changes
      if (data.suggestedChanges && data.suggestedChanges.length > 0) {
        setPendingChanges(prev => [...prev, ...data.suggestedChanges])
        toast.info(
          'Suggestions Available',
          `${data.suggestedChanges.length} content suggestions are ready for review`,
          { duration: 5000 }
        )
      }
      
      // Show AI status if in mock mode
      if (data.status === 'ai_unavailable') {
        const statusMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: '⚠️ Hinweis: KI-Features sind derzeit im Mock-Modus. Für volle Funktionalität stellen Sie sicher, dass der OpenAI API-Schlüssel konfiguriert ist.',
          timestamp: new Date(),
          confidence: 1.0
        }
        setMessages(prev => [...prev, statusMessage])
        
        toast.warning(
          'AI Mock Mode',
          'AI features are running in mock mode. Configure OpenAI API key for full functionality.',
          { duration: 6000 }
        )
      }

      // Reset error state on successful response
      resetErrorState()
      
    } catch (error: unknown) {
      // Enhanced error handling with better status code extraction
      let statusCode: number | undefined
      
      if (error instanceof Error && 'status' in error) {
        statusCode = (error as any).status
      } else if (error instanceof Response) {
        statusCode = error.status
      }
      
      const chatError = createChatError(error, statusCode)
      
      // Show toast notification for error
      toast.error(
        chatError.errorType === 'network' ? 'Connection Error' :
        chatError.errorType === 'auth' ? 'Authentication Error' :
        chatError.errorType === 'timeout' ? 'Request Timeout' :
        chatError.errorType === 'server' ? 'Server Error' : 'Error',
        chatError.message,
        {
          duration: 7000,
          action: chatError.retryable && errorRecovery.retryCount < errorRecovery.maxRetries ? {
            label: 'Retry',
            onClick: handleRetry
          } : undefined
        }
      )
      
      // Update error recovery state
      setErrorRecovery(prev => ({
        ...prev,
        lastQuery: query,
        conversationId: convId || conversationId,
        errorHistory: [...prev.errorHistory, chatError]
      }))

      setCurrentError(chatError)
      setShowError(true)

      // Don't add error message to chat if it's retryable and we haven't exceeded max retries
      if (!chatError.retryable || errorRecovery.retryCount >= errorRecovery.maxRetries) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `❌ ${chatError.message} ${chatError.retryable ? 'Sie können es erneut versuchen oder den Support kontaktieren, wenn das Problem weiterhin besteht.' : 'Bitte kontaktieren Sie den Support für Unterstützung.'}`,
          timestamp: new Date(),
          confidence: 0
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!currentQuery.trim() || !session?.access_token) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentQuery,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const queryToSend = currentQuery
    setCurrentQuery('')

    await sendMessage(queryToSend)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const applySuggestedChange = useCallback((changeId: string) => {
    setPendingChanges(prev => 
      prev.map(change => 
        change.id === changeId 
          ? { ...change, applied: true }
          : change
      )
    )
  }, [])

  const rejectSuggestedChange = useCallback((changeId: string) => {
    setPendingChanges(prev => 
      prev.filter(change => change.id !== changeId)
    )
  }, [])

  const sendPMRAction = useCallback(async (
    action: string,
    message: string
  ) => {
    if (!session?.access_token) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
      action
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentQuery('')
    setIsLoading(true)

    try {
      const response = await fetch(getApiUrl('/api/reports/pmr/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message,
          action,
          context: pmrContext,
          conversation_id: conversationId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        action: data.action,
        actionData: data.actionData,
        suggestedChanges: data.suggestedChanges,
        confidence: data.confidence_score,
        sources: data.sources?.map((s: any) => ({
          type: s.type,
          count: 1,
          data: `${s.type}:${s.id} (${(s.similarity * 100).toFixed(1)}% match)`
        }))
      }

      setMessages(prev => [...prev, assistantMessage])

      if (data.suggestedChanges && data.suggestedChanges.length > 0) {
        setPendingChanges(prev => [...prev, ...data.suggestedChanges])
      }

      resetErrorState()
    } catch (error) {
      const chatError = createChatError(error)
      
      // Show toast notification for error
      toast.error(
        'PMR Action Failed',
        chatError.message,
        {
          duration: 7000,
          action: chatError.retryable ? {
            label: 'Retry',
            onClick: () => sendPMRAction(action, message)
          } : undefined
        }
      )
      
      setCurrentError(chatError)
      setShowError(true)
    } finally {
      setIsLoading(false)
    }
  }, [session, pmrContext, conversationId, resetErrorState, createChatError])

  const formatTimestamp = (date: Date) => {
    return formatTime(date)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <AppLayout>
      <div data-testid="reports-page" className="h-full flex flex-col chrome-flex-gap-prevention chrome-background-coverage">
        {/* Header */}
        <div data-testid="reports-header" className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-4 chrome-flex-item">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 chrome-flex-gap-prevention">
            <div className="flex items-center space-x-3 min-w-0">
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <h1 data-testid="reports-title" className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">{t('reports.title')}</h1>
                <p className="text-sm text-gray-700 dark:text-slate-300 hidden sm:block">{t('reports.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setIsPMRMode(!isPMRMode)}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-sm ${
                  isPMRMode 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-gray-200 text-gray-700 dark:text-slate-300 hover:bg-gray-300'
                }`}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t('reports.pmrMode')}</span>
              </button>
              <button
                onClick={() => setShowReportOptions(!showReportOptions)}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t('reports.generateReport')}</span>
                <span className="sm:hidden">{t('common.export')}</span>
              </button>
            </div>
          </div>
        </div>

      {/* Report Options Panel */}
      {showReportOptions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <span className="text-sm font-medium text-blue-900">{t('reports.format')}:</span>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                className="px-3 py-1 border border-blue-300 rounded text-sm flex-1 sm:flex-none text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-800"
              >
                <option value="text">{t('reports.text')}</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={handleSendMessage}
                disabled={!currentQuery.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {t('reports.generateReport')}
              </button>
              <button
                onClick={() => setShowReportOptions(false)}
                className="text-blue-600 dark:text-blue-400 text-sm hover:text-blue-800 dark:hover:text-blue-300"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PMR Actions Panel */}
      {isPMRMode && (
        <div className="bg-purple-50 border-b border-purple-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-900">PMR AI Actions</span>
            </div>
            <button
              onClick={() => setShowPMRActions(!showPMRActions)}
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800"
            >
              {showPMRActions ? 'Hide' : 'Show'} Actions
            </button>
          </div>
          
          {showPMRActions && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => sendPMRAction('update_section', 'Update executive summary with latest data')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Update Section
              </button>
              <button
                onClick={() => sendPMRAction('generate_insight', 'Generate budget insights')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Generate Insights
              </button>
              <button
                onClick={() => sendPMRAction('analyze_data', 'Analyze schedule performance')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Analyze Data
              </button>
              <button
                onClick={() => sendPMRAction('suggest_content', 'Suggest improvements for risk section')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Suggest Content
              </button>
              <button
                onClick={() => sendPMRAction('modify_content', 'Make executive summary more concise')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Modify Content
              </button>
              <button
                onClick={() => sendPMRAction('add_visualization', 'Add budget variance chart')}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 text-sm rounded hover:bg-purple-100 disabled:opacity-50"
              >
                Add Visualization
              </button>
            </div>
          )}

          {/* Pending Changes */}
          {pendingChanges.length > 0 && (
            <div className="mt-4 space-y-2">
              <span className="text-sm font-medium text-purple-900">Pending Changes ({pendingChanges.filter(c => !c.applied).length})</span>
              {pendingChanges.filter(c => !c.applied).map((change) => (
                <div key={change.id} className="bg-white dark:bg-slate-800 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-purple-700">{change.section}</span>
                        <span className="text-xs text-gray-500 dark:text-slate-400">({change.changeType})</span>
                        <span className="text-xs text-gray-500 dark:text-slate-400">{Math.round(change.confidence * 100)}% confidence</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300 mb-1">{change.content}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{change.reason}</p>
                    </div>
                    <div className="flex space-x-2 ml-3">
                      <button
                        onClick={() => applySuggestedChange(change.id)}
                        className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                        title="Apply change"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rejectSuggestedChange(change.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        title="Reject change"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        {/* Error Recovery Panel */}
        {showError && currentError && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-600 p-4 mx-4 sm:mx-6 mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  {currentError.errorType === 'network' ? 'Verbindungsfehler' :
                   currentError.errorType === 'auth' ? 'Authentifizierungsfehler' :
                   currentError.errorType === 'timeout' ? 'Zeitüberschreitung' :
                   currentError.errorType === 'server' ? 'Serverfehler' : 'Fehler'}
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p className="break-words">{currentError.message}</p>
                  {errorRecovery.retryCount > 0 && (
                    <p className="mt-1">Retry attempt {errorRecovery.retryCount} of {errorRecovery.maxRetries}</p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {currentError.retryable && errorRecovery.retryCount < errorRecovery.maxRetries && (
                    <button
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Erneut versuchen</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowError(false)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Schließen
                  </button>
                </div>
                {errorRecovery.retryCount >= errorRecovery.maxRetries && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Alternative Aktionen:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {suggestAlternatives().map((suggestion, index) => (
                        <li key={index} className="flex items-start">
                          <span className="mr-2 flex-shrink-0">•</span>
                          <span className="break-words">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
      <div data-testid="reports-list" className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-full sm:max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              <div className="flex items-start space-x-2 sm:space-x-3">
                {message.type === 'assistant' && (
                  <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-sm sm:text-base text-gray-900 dark:text-slate-100">{(message.id === '1' && message.type === 'assistant') ? t('reports.welcomeMessage') : message.content}</div>
                    
                    {/* AI Agent Visualizations */}
                    {message.optimizerResults && (
                      <div className="mt-4">
                        <ResourceOptimizerChart
                          recommendations={message.optimizerResults.recommendations}
                          totalCostSavings={message.optimizerResults.total_cost_savings}
                          modelConfidence={message.optimizerResults.model_confidence}
                        />
                      </div>
                    )}

                    {message.riskForecastResults && (
                      <div className="mt-4">
                        <RiskForecastChart
                          forecasts={message.riskForecastResults.forecasts}
                          modelConfidence={message.riskForecastResults.model_confidence}
                        />
                      </div>
                    )}

                    {message.validationResults && (
                      <div className="mt-4">
                        <ValidationIssuesDisplay
                          issues={message.validationResults.issues}
                          totalIssues={message.validationResults.total_issues}
                          criticalCount={message.validationResults.critical_count}
                          highCount={message.validationResults.high_count}
                          mediumCount={message.validationResults.medium_count}
                          lowCount={message.validationResults.low_count}
                        />
                      </div>
                    )}
                    
                    {/* PMR Action Indicator */}
                    {message.action && (
                      <div className="mt-2 flex items-center space-x-2">
                        <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          Action: {message.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}

                    {/* Suggested Changes */}
                    {message.suggestedChanges && message.suggestedChanges.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Suggested Changes:</span>
                        {message.suggestedChanges.map((change) => (
                          <div key={change.id} className="bg-purple-50 border border-purple-200 rounded p-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-medium text-purple-700">{change.section}</span>
                                  <span className="text-xs text-gray-500 dark:text-slate-400">({change.changeType})</span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-slate-300">{change.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Sources and Confidence for Assistant Messages */}
                    {message.type === 'assistant' && (message.sources || message.confidence !== undefined) && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                        {message.confidence !== undefined && (
                          <div className="flex items-center space-x-2 text-xs mb-2">
                            <span className="text-gray-700 dark:text-slate-300">{t('reports.confidence')}</span>
                            <ConfidenceBadge confidence={message.confidence} />
                          </div>
                        )}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-700 dark:text-slate-300">{t('reports.sources')}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {message.sources.map((source, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs rounded"
                                >
                                  {source.type} {source.count && `(${source.count})`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                {message.type === 'user' && (
                  <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center space-x-2">
                  <Loader className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-slate-300 text-sm sm:text-base">{t('common.loading')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-end space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('reports.typeMessage')}
              className="textarea-field w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-slate-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              rows={isMobile ? 2 : 3}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!currentQuery.trim() || isLoading}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            <Send className="w-4 h-4 flex-shrink-0" />
            <span>{t('reports.send')}</span>
          </button>
        </div>
        
        {/* Quick Examples */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{t('reports.tryAsking')}</p>
          <div className="flex flex-wrap gap-2">
            {(isPMRMode ? [
              t('reports.pmrSuggestion1'),
              t('reports.pmrSuggestion2'),
              t('reports.pmrSuggestion3'),
              t('reports.pmrSuggestion4'),
              t('reports.pmrSuggestion5')
            ] : [
              t('reports.suggestion1'),
              t('reports.suggestion2'),
              t('reports.suggestion3'),
              t('reports.suggestion4'),
              t('reports.suggestion5')
            ]).map((example, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuery(example)}
                className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-slate-600 break-words text-left"
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </AppLayout>
  )
}