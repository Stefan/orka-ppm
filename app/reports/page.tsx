'use client'

import React, { useState } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { MessageCircle, FileText, Download, Loader, Send, Bot, User, AlertTriangle, RefreshCw } from 'lucide-react'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{type: string, count?: number, data?: string}>
  confidence?: number
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hallo! Ich bin Ihr KI-Assistent für Projekt-Portfolio-Management. Ich kann Ihnen bei der Analyse von Projekten, Ressourcen, Budgets, Risiken helfen und benutzerdefinierte Berichte erstellen. Was möchten Sie wissen?',
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

  const createChatError = (error: unknown, statusCode?: number): ChatError => {
    let errorType: ChatError['errorType'] = 'unknown'
    let message = 'An unexpected error occurred'
    let retryable = true

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
    }

    return {
      timestamp: new Date(),
      errorType,
      message,
      statusCode,
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
      const response = await fetch(getApiUrl('/ai/rag-query'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          query: query,
          conversation_id: convId || conversationId
        })
      })

      if (!response.ok) {
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
        confidence: data.confidence_score
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Show AI status if in mock mode
      if (data.status === 'ai_unavailable') {
        const statusMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: '⚠️ Note: AI features are currently in mock mode. For full functionality, ensure OpenAI API key is configured.',
          timestamp: new Date(),
          confidence: 1.0
        }
        setMessages(prev => [...prev, statusMessage])
      }

      // Reset error state on successful response
      resetErrorState()
      
    } catch (error: unknown) {
      const chatError = createChatError(error, error instanceof Error && 'status' in error ? (error as any).status : undefined)
      
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
          content: `${chatError.message} ${chatError.retryable ? 'Sie können es erneut versuchen oder den Support kontaktieren, wenn das Problem weiterhin besteht.' : 'Bitte kontaktieren Sie den Support für Unterstützung.'}`,
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

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3 min-w-0">
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">AI-Powered Reports</h1>
                <p className="text-sm text-gray-700 hidden sm:block">Ask questions about your portfolio, get instant insights</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setShowReportOptions(!showReportOptions)}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Bericht erstellen</span>
                <span className="sm:hidden">Bericht</span>
              </button>
            </div>
          </div>
        </div>

      {/* Report Options Panel */}
      {showReportOptions && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <span className="text-sm font-medium text-blue-900">Berichtsformat:</span>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                className="px-3 py-1 border border-blue-300 rounded text-sm flex-1 sm:flex-none text-gray-900 bg-white"
              >
                <option value="text">Text</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={handleSendMessage}
                disabled={!currentQuery.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Erstellen
              </button>
              <button
                onClick={() => setShowReportOptions(false)}
                className="text-blue-600 text-sm hover:text-blue-800"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Error Recovery Panel */}
        {showError && currentError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 sm:mx-6 mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800">
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
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Erneut versuchen</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowError(false)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Schließen
                  </button>
                </div>
                {errorRecovery.retryCount >= errorRecovery.maxRetries && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">Alternative Aktionen:</h4>
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
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
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-sm sm:text-base text-gray-900">{message.content}</div>
                    
                    {/* Sources and Confidence for Assistant Messages */}
                    {message.type === 'assistant' && (message.sources || message.confidence !== undefined) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {message.confidence !== undefined && (
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-gray-700">Confidence:</span>
                            <span className={`font-medium ${getConfidenceColor(message.confidence)}`}>
                              {Math.round(message.confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-700">Sources:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {message.sources.map((source, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
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
                  <div className="mt-1 text-xs text-gray-600">
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
              <div className="bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center space-x-2">
                  <Loader className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                  <span className="text-gray-700 text-sm sm:text-base">Analysiere Ihre Anfrage...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-end space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Fragen Sie nach Ihren Projekten, Ressourcen, Budgets, Risiken oder fordern Sie einen benutzerdefinierten Bericht an..."
              className="textarea-field w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              rows={window.innerWidth < 640 ? 2 : 3}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!currentQuery.trim() || isLoading}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            <Send className="w-4 h-4 flex-shrink-0" />
            <span>Senden</span>
          </button>
        </div>
        
        {/* Quick Examples */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Versuchen Sie zu fragen:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Wie ist der aktuelle Status aller Projekte?",
              "Welche Ressourcen sind überbelastet?",
              "Zeige mir die Budgetnutzung aller Projekte",
              "Erstelle einen Risikobewertungsbericht",
              "Welche Fähigkeiten sind am meisten gefragt?"
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuery(example)}
                className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 break-words text-left"
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