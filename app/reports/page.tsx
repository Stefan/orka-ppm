'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useState } from 'react'
import { MessageCircle, FileText, Download, Loader, Send, Bot, User } from 'lucide-react'
import AppLayout from '../../components/AppLayout'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Array<{type: string, count?: number, data?: string}>
  confidence?: number
}

interface RAGResponse {
  answer: string
  sources: Array<{type: string, count?: number, data?: string}>
  confidence: number
  query_type: string
  generated_at: string
}

export default function Reports() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI assistant for project portfolio management. I can help you analyze projects, resources, budgets, risks, and generate custom reports. What would you like to know?',
      timestamp: new Date(),
      confidence: 1.0
    }
  ])
  const [currentQuery, setCurrentQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reportFormat, setReportFormat] = useState('text')
  const [showReportOptions, setShowReportOptions] = useState(false)

  const handleSendMessage = async () => {
    if (!currentQuery.trim() || !session) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentQuery,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentQuery('')
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          query: currentQuery,
          context_type: null
        })
      })

      if (!response.ok) throw new Error('Query failed')

      const data: RAGResponse = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        sources: data.sources,
        confidence: data.confidence
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        confidence: 0
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!currentQuery.trim() || !session) return

    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          query: currentQuery,
          include_charts: false,
          format: reportFormat
        })
      })

      if (!response.ok) throw new Error('Report generation failed')

      const data = await response.json()

      const reportMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**Generated Report:**\n\n${data.report}`,
        timestamp: new Date(),
        confidence: 0.9
      }

      setMessages(prev => [...prev, reportMessage])
      setCurrentQuery('')
      setShowReportOptions(false)
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Failed to generate report. Please try again.',
        timestamp: new Date(),
        confidence: 0
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
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
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bot className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI-Powered Reports</h1>
                <p className="text-sm text-gray-600">Ask questions about your portfolio, get instant insights</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowReportOptions(!showReportOptions)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Report</span>
              </button>
            </div>
          </div>
        </div>

      {/* Report Options Panel */}
      {showReportOptions && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-blue-900">Report Format:</span>
            <select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value)}
              className="px-3 py-1 border border-blue-300 rounded text-sm"
            >
              <option value="text">Text</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleGenerateReport}
              disabled={!currentQuery.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Generate
            </button>
            <button
              onClick={() => setShowReportOptions(false)}
              className="text-blue-600 text-sm hover:text-blue-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              <div className="flex items-start space-x-3">
                {message.type === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <div
                    className={`px-4 py-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {/* Sources and Confidence for Assistant Messages */}
                    {message.type === 'assistant' && (message.sources || message.confidence !== undefined) && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {message.confidence !== undefined && (
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-gray-500">Confidence:</span>
                            <span className={`font-medium ${getConfidenceColor(message.confidence)}`}>
                              {Math.round(message.confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Sources:</span>
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
                  <div className="mt-1 text-xs text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                {message.type === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <Loader className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-gray-600">Analyzing your request...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <textarea
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your projects, resources, budgets, risks, or request a custom report..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!currentQuery.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        
        {/* Quick Examples */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "What's the current status of all projects?",
              "Which resources are overallocated?",
              "Show me budget utilization across projects",
              "Generate a risk assessment report",
              "What skills are most in demand?"
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuery(example)}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}