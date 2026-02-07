'use client'

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

/** Catches markdown parse errors (e.g. micromark list parser) and falls back to plain text so one bad message does not crash the page. */
class MarkdownErrorBoundary extends React.Component<
  { content: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError = () => ({ hasError: true })
  render() {
    if (this.state.hasError) {
      const text = typeof this.props.content === 'string' ? this.props.content : String(this.props.content ?? '')
      return <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{text}</p>
    }
    return this.props.children
  }
}
import {
  ExternalLink,
  Star,
  AlertCircle,
  Info,
  Lightbulb,
  MessageSquare,
  Copy,
  MessageCircle
} from 'lucide-react'
import { cn } from '../../lib/design-system'
import { FeedbackInterface } from './FeedbackInterface'
import type { 
  ChatMessage, 
  QuickAction, 
  SourceReference,
  HelpFeedbackRequest 
} from '../../types/help-chat'

interface MessageRendererProps {
  message: ChatMessage
  onFeedback: (messageId: string, feedback: HelpFeedbackRequest) => Promise<void>
  onCopy: (content: string) => void
  onQuickAction: (action: QuickAction) => void
  feedbackMessageId: string | null
  setFeedbackMessageId: (id: string | null) => void
  messageIndex?: number
  totalMessages?: number
  ragData?: {
    citations?: any[]
    sources?: any[]
    confidence?: number
    cache_hit?: boolean
    is_fallback?: boolean
    error_message?: string
  }
  className?: string
}

export function MessageRenderer({
  message,
  onFeedback,
  onCopy,
  onQuickAction,
  feedbackMessageId,
  setFeedbackMessageId,
  messageIndex,
  totalMessages,
  ragData,
  className
}: MessageRendererProps) {
  const [expandedSources, setExpandedSources] = useState(false)

  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'
  const isTip = message.type === 'tip'

  const messageId = `message-${message.id}`
  const contentId = `content-${message.id}`
  const actionsId = `actions-${message.id}`

  const getMessageIcon = () => {
    switch (message.type) {
      case 'tip':
        return <Lightbulb className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
      case 'system':
        return <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      case 'assistant':
        return <MessageSquare className="h-4 w-4 text-green-500 dark:text-green-400" />
      default:
        return null
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-700 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    if (confidence >= 0.6) return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    return 'text-red-700 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }

  const markdownComponents = {
    code: ({ node, inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        )
      }
      
      return (
        <div className="my-2">
          <pre className="bg-gray-100 dark:bg-slate-700 rounded-md p-3 overflow-x-auto text-sm border border-gray-200 dark:border-slate-700">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      )
    },
    p: ({ children, ...props }: any) => {
      // Check if children contains pre/code blocks
      const hasCodeBlock = React.Children.toArray(children).some(
        (child: any) => child?.type === 'pre' || child?.props?.node?.tagName === 'pre'
      )
      
      // If it contains code blocks, render without p tag
      if (hasCodeBlock) {
        return <div {...props}>{children}</div>
      }
      
      return <p {...props}>{children}</p>
    },
    a: ({ children, href, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
        {...props}
      >
        {children}
        <ExternalLink className="inline h-3 w-3 ml-1" />
      </a>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1 ml-4" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1 ml-4" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote 
        className="border-l-4 border-gray-400 pl-4 italic text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 py-2 rounded-r" 
        {...props}
      >
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }: any) => (
      <table 
        className="min-w-full border-collapse border-2 border-gray-300 dark:border-slate-600" 
        {...props}
      >
        {children}
      </table>
    ),
    th: ({ children, ...props }: any) => (
      <th 
        className="border-2 border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-slate-100" 
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td 
        className="border-2 border-gray-300 dark:border-slate-600 px-3 py-2 text-gray-800 dark:text-slate-200" 
        {...props}
      >
        {children}
      </td>
    )
  }

  return (
    <div
      className={cn(
        'group relative p-4 rounded-lg border-2 transition-all duration-200',
        isUser 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ml-8' 
          : isSystem
          ? 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-700'
          : isTip
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 mr-8',
        className
      )}
    >
      <div className={cn(
        'flex items-start space-x-3',
        isUser && 'flex-row-reverse space-x-reverse'
      )}>
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            {getMessageIcon()}
            {message.isStreaming && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div
            id={contentId}
            className="prose prose-sm max-w-none markdown-content"
          >
            {isUser ? (
              <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownErrorBoundary content={message.content}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </MarkdownErrorBoundary>
            )}
          </div>

          {(message.confidence || ragData?.confidence) && (
            <div className="flex items-center space-x-2 mt-2">
              <Star className="h-3 w-3 text-gray-600 dark:text-slate-400" />
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Confidence:</span>
              <div className={cn(
                'px-2 py-1 rounded-full text-xs font-medium border',
                getConfidenceColor(message.confidence || ragData?.confidence || 0)
              )}>
                {Math.round((message.confidence || ragData?.confidence || 0) * 100)}%
              </div>
              {(message.confidence || ragData?.confidence) && (message.confidence || ragData?.confidence)! < 0.6 && (
                <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-slate-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Low confidence - please verify</span>
                </div>
              )}
              {ragData?.cache_hit && (
                <div className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400">
                  <Info className="h-3 w-3" />
                  <span>(cached)</span>
                </div>
              )}
              {ragData?.is_fallback && (
                <div className="flex items-center space-x-1 text-xs text-orange-600 dark:text-orange-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>(limited response)</span>
                </div>
              )}
            </div>
          )}

          {((message.sources && message.sources.length > 0) || (ragData?.citations && ragData.citations.length > 0) || (ragData?.sources && ragData.sources.length > 0)) && (
            <div className="mt-3">
              {/* Citations */}
              {ragData?.citations && ragData.citations.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">References</h4>
                  <div className="flex flex-wrap gap-1">
                    {ragData.citations.map((citation: any, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800"
                      >
                        [{citation.number}]
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Sources */}
              {ragData?.sources && ragData.sources.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-slate-300">
                      Referenced Documents ({ragData.sources.length})
                    </h4>
                    {ragData.sources.length > 2 && (
                      <button
                        onClick={() => setExpandedSources(!expandedSources)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {expandedSources ? 'Show less' : 'Show all'}
                      </button>
                    )}
                  </div>
                  <div
                    id={`${messageId}-rag-sources`}
                    className="space-y-2"
                  >
                    {(expandedSources ? ragData.sources : ragData.sources.slice(0, 2)).map((source: any, index: number) => (
                      <div key={`rag-source-${index}`} className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-slate-100 text-sm mb-1">{source.title}</div>
                            <div className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed mb-2">{source.content_preview}</div>
                            {source.category && (
                              <div className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                                {source.category}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider Sources (fallback) */}
              {message.sources && message.sources.length > 0 && (!ragData?.sources || ragData.sources.length === 0) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-slate-300">
                      Sources ({message.sources.length})
                    </h4>
                    {message.sources.length > 2 && (
                      <button
                        onClick={() => setExpandedSources(!expandedSources)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {expandedSources ? 'Show less' : 'Show all'}
                      </button>
                    )}
                  </div>
                  <div
                    id={`${messageId}-sources`}
                    className="space-y-2"
                  >
                    {(expandedSources ? message.sources : message.sources.slice(0, 2)).map((source, index) => (
                      <div key={source.id || `source-${index}`}>
                        <SourceCard source={source} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {message.actions && message.actions.length > 0 && (
            <div
              id={actionsId}
              className="flex flex-wrap gap-2"
            >
              {message.actions.map((action, index) => (
                <button
                  key={action.id || `action-${index}`}
                  onClick={() => onQuickAction(action)}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Action buttons for assistant messages */}
          {!isUser && !isSystem && (
            <div
              id={actionsId}
              className="flex items-center space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <button
                onClick={() => onCopy(message.content)}
                className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                aria-label="Copy message"
              >
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </button>
              <button
                onClick={() => setFeedbackMessageId(message.id)}
                className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                aria-label="Give feedback"
              >
                <MessageCircle className="h-3 w-3" />
                <span>Feedback</span>
              </button>
            </div>
          )}
        </div>


      </div>

      {feedbackMessageId === message.id && (
        <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-slate-700">
          <FeedbackInterface
            message={message}
            onSubmitFeedback={onFeedback}
            onClose={() => setFeedbackMessageId(null)}
          />
        </div>
      )}
    </div>
  )
}

// Simple source card component
function SourceCard({ source }: { source: SourceReference }) {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'documentation':
        return '📚'
      case 'guide':
        return '📖'
      case 'faq':
        return '❓'
      case 'feature':
        return '⚡'
      default:
        return '📄'
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
      <div className="flex items-start space-x-2">
        <span className="text-sm">{getSourceIcon(source.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
              {source.title}
            </h5>
            {source.relevance && (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {Math.round(source.relevance * 100)}%
              </span>
            )}
          </div>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-1 inline-flex items-center"
            >
              View source: {source.title}
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageRenderer