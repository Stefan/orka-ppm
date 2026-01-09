'use client'

import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { 
  Copy, 
  Check, 
  ExternalLink, 
  ThumbsUp, 
  ThumbsDown, 
  Star,
  AlertCircle,
  Info,
  Lightbulb,
  MessageSquare
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
  className?: string
}

/**
 * Enhanced message renderer with markdown support, source attribution,
 * confidence scores, quick actions, copy-to-clipboard functionality,
 * and WCAG 2.1 AA accessibility compliance
 */
export function MessageRenderer({
  message,
  onFeedback,
  onCopy,
  onQuickAction,
  feedbackMessageId,
  setFeedbackMessageId,
  messageIndex = 1,
  totalMessages = 1,
  className
}: MessageRendererProps) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [expandedSources, setExpandedSources] = useState(false)

  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'
  const isTip = message.type === 'tip'
  const isAssistant = message.type === 'assistant'

  // Generate unique IDs for accessibility
  const messageId = `message-${message.id}`
  const contentId = `content-${message.id}`
  const actionsId = `actions-${message.id}`

  // Handle copy to clipboard with visual feedback and announcements
  const handleCopy = useCallback(async () => {
    try {
      await onCopy(message.content)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }, [message.content, onCopy])

  // Get message icon based on type
  const getMessageIcon = () => {
    switch (message.type) {
      case 'tip':
        return <Lightbulb className="h-4 w-4 text-yellow-500" aria-hidden="true" />
      case 'system':
        return <Info className="h-4 w-4 text-blue-500" aria-hidden="true" />
      case 'assistant':
        return <MessageSquare className="h-4 w-4 text-green-500" aria-hidden="true" />
      default:
        return null
    }
  }

  // Get confidence color based on score with better contrast
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-700 bg-green-50 border-green-200'
    if (confidence >= 0.6) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  // Get message type label for screen readers
  const getMessageTypeLabel = () => {
    switch (message.type) {
      case 'tip':
        return 'Tip message'
      case 'system':
        return 'System message'
      case 'assistant':
        return 'AI Assistant response'
      case 'user':
        return 'Your message'
      default:
        return 'Message'
    }
  }

  // Custom markdown components for better styling and accessibility
  const markdownComponents = {
    // Style code blocks with better contrast
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      return !inline ? (
        <pre 
          className="bg-gray-100 rounded-md p-3 overflow-x-auto text-sm border border-gray-200"
          role="region"
          aria-label="Code block"
        >
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code 
          className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono border border-gray-200" 
          {...props}
        >
          {children}
        </code>
      )
    },
    // Style links with better accessibility
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        aria-label={`External link: ${children}`}
        {...props}
      >
        {children}
        <ExternalLink className="inline h-3 w-3 ml-1" aria-hidden="true" />
      </a>
    ),
    // Style lists with better spacing
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1 ml-4" role="list" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1 ml-4" role="list" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li role="listitem" {...props}>
        {children}
      </li>
    ),
    // Style blockquotes with better contrast
    blockquote: ({ children, ...props }: any) => (
      <blockquote 
        className="border-l-4 border-gray-400 pl-4 italic text-gray-700 bg-gray-50 py-2 rounded-r" 
        role="blockquote"
        {...props}
      >
        {children}
      </blockquote>
    ),
    // Style tables with better accessibility
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto">
        <table 
          className="min-w-full border-collapse border-2 border-gray-300" 
          role="table"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th 
        className="border-2 border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900" 
        role="columnheader"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td 
        className="border-2 border-gray-300 px-3 py-2 text-gray-800" 
        role="cell"
        {...props}
      >
        {children}
      </td>
    ),
    // Style headings with better hierarchy
    h1: ({ children, ...props }: any) => (
      <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),
    h2: ({ children, ...props }: any) => (
      <h4 className="text-base font-semibold text-gray-900 mt-3 mb-2" {...props}>
        {children}
      </h4>
    ),
    h3: ({ children, ...props }: any) => (
      <h5 className="text-sm font-semibold text-gray-900 mt-2 mb-1" {...props}>
        {children}
      </h5>
    )
  }

  return (
    <article 
      id={messageId}
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
      role="article"
      aria-labelledby={`${messageId}-type`}
      aria-describedby={contentId}
    >
      <div className={cn(
        'max-w-[85%] rounded-lg px-4 py-3 relative',
        'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
        isUser && 'bg-blue-600 text-white',
        isAssistant && 'bg-gray-100 text-gray-900 border-2 border-gray-200',
        isTip && 'bg-yellow-50 text-yellow-900 border-2 border-yellow-200',
        isSystem && 'bg-blue-50 text-blue-900 border-2 border-blue-200'
      )}>
        {/* Message header with icon and type indicator */}
        {!isUser && (
          <header className="flex items-center space-x-2 mb-2">
            {getMessageIcon()}
            <span 
              id={`${messageId}-type`}
              className="text-xs font-medium uppercase tracking-wide opacity-75"
            >
              {message.type === 'tip' ? 'Tip' : 
               message.type === 'system' ? 'System' : 
               'AI Assistant'}
            </span>
            <span className="sr-only">
              {getMessageTypeLabel()}, message {messageIndex} of {totalMessages}
            </span>
            {message.isStreaming && (
              <div 
                className="flex space-x-1"
                role="status"
                aria-label="Message is being generated"
              >
                <div className="w-1 h-1 bg-current rounded-full animate-pulse" aria-hidden="true"></div>
                <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} aria-hidden="true"></div>
                <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} aria-hidden="true"></div>
              </div>
            )}
          </header>
        )}

        {/* User message type for screen readers */}
        {isUser && (
          <div className="sr-only">
            {getMessageTypeLabel()}, message {messageIndex} of {totalMessages}
          </div>
        )}

        {/* Message content with markdown rendering */}
        <div 
          id={contentId}
          className="prose prose-sm max-w-none markdown-content"
          role="region"
          aria-label="Message content"
        >
          {isUser ? (
            <p className="mb-0 whitespace-pre-wrap text-white">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Confidence score indicator with better accessibility */}
        {message.confidence && message.confidence > 0 && (
          <div className="mt-3 pt-3 border-t-2 border-gray-200">
            <div 
              className="flex items-center space-x-2"
              role="region"
              aria-label="Response confidence information"
            >
              <Star className="h-3 w-3" aria-hidden="true" />
              <span className="text-xs font-medium">Confidence:</span>
              <div className={cn(
                'px-2 py-1 rounded-full text-xs font-medium border',
                getConfidenceColor(message.confidence)
              )}>
                <span className="sr-only">Confidence level: </span>
                {Math.round(message.confidence * 100)}%
              </div>
              {message.confidence < 0.6 && (
                <div 
                  className="flex items-center space-x-1 text-xs text-gray-600"
                  role="alert"
                  aria-label="Low confidence warning"
                >
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  <span>Low confidence - please verify</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Source attribution with enhanced accessibility */}
        {message.sources && message.sources.length > 0 && (
          <section className="mt-3 pt-3 border-t-2 border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700">
                Sources ({message.sources.length})
              </h3>
              {message.sources.length > 2 && (
                <button
                  onClick={() => setExpandedSources(!expandedSources)}
                  className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  aria-expanded={expandedSources}
                  aria-controls={`${messageId}-sources`}
                >
                  {expandedSources ? 'Show less' : 'Show all'}
                </button>
              )}
            </div>
            <div 
              id={`${messageId}-sources`}
              className="space-y-2"
              role="list"
              aria-label="Information sources"
            >
              {(expandedSources ? message.sources : message.sources.slice(0, 2)).map((source, index) => (
                <div key={source.id} role="listitem">
                  <SourceCard source={source} index={index + 1} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick action buttons with enhanced accessibility */}
        {message.actions && message.actions.length > 0 && (
          <section className="mt-3 pt-3 border-t-2 border-gray-200">
            <h3 className="text-xs font-medium text-gray-700 mb-2">Quick Actions:</h3>
            <div 
              id={actionsId}
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Quick action buttons"
            >
              {message.actions.map((action) => (
                <QuickActionButton
                  key={action.id}
                  action={action}
                  onClick={() => onQuickAction(action)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Message actions (copy, feedback, timestamp) with enhanced accessibility */}
        {!isUser && (
          <footer className="mt-3 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2" role="group" aria-label="Message actions">
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={copySuccess ? "Message copied to clipboard" : "Copy message to clipboard"}
                title={copySuccess ? "Copied!" : "Copy to clipboard"}
              >
                {copySuccess ? (
                  <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
              
              {/* Feedback button */}
              <button
                onClick={() => setFeedbackMessageId(
                  feedbackMessageId === message.id ? null : message.id
                )}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Provide feedback on this response"
                aria-expanded={feedbackMessageId === message.id}
                title="Rate this response"
              >
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            
            {/* Timestamp */}
            <time 
              className="text-xs text-gray-500"
              dateTime={message.timestamp.toISOString()}
              title={message.timestamp.toLocaleString()}
            >
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </time>
          </footer>
        )}

        {/* User message timestamp */}
        {isUser && (
          <footer className="mt-2">
            <time 
              className="text-xs text-blue-200"
              dateTime={message.timestamp.toISOString()}
              title={message.timestamp.toLocaleString()}
            >
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </time>
          </footer>
        )}

        {/* Feedback interface */}
        {feedbackMessageId === message.id && (
          <div className="mt-3 pt-3 border-t-2 border-gray-200">
            <FeedbackInterface
              message={message}
              onSubmitFeedback={onFeedback}
              onClose={() => setFeedbackMessageId(null)}
            />
          </div>
        )}
      </div>
    </article>
  )
}

/**
 * Source card component for displaying source attribution with accessibility
 */
interface SourceCardProps {
  source: SourceReference
  index: number
}

function SourceCard({ source, index }: SourceCardProps) {
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

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return 'bg-green-100 text-green-800 border-green-200'
    if (relevance >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getRelevanceLabel = (relevance: number) => {
    if (relevance >= 0.8) return 'High relevance'
    if (relevance >= 0.6) return 'Medium relevance'
    return 'Low relevance'
  }

  return (
    <article 
      className="flex items-start space-x-2 p-2 bg-white rounded border-2 border-gray-200 hover:border-gray-300 transition-colors"
      role="article"
      aria-labelledby={`source-${source.id}-title`}
    >
      <span 
        className="text-sm" 
        role="img" 
        aria-label={`${source.type} source`}
      >
        {getSourceIcon(source.type)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 
            id={`source-${source.id}-title`}
            className="text-xs font-medium text-gray-900 truncate"
          >
            Source {index}: {source.title}
          </h4>
          <span 
            className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-medium border',
              getRelevanceColor(source.relevance)
            )}
            aria-label={`${getRelevanceLabel(source.relevance)}: ${Math.round(source.relevance * 100)} percent`}
          >
            {Math.round(source.relevance * 100)}%
          </span>
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            aria-label={`View source: ${source.title} (opens in new tab)`}
          >
            <span>View source</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  )
}

/**
 * Quick action button component with enhanced accessibility
 */
interface QuickActionButtonProps {
  action: QuickAction
  onClick: () => void
}

function QuickActionButton({ action, onClick }: QuickActionButtonProps) {
  const getVariantStyles = (variant: QuickAction['variant'] = 'secondary') => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border-2 border-blue-600'
      case 'ghost':
        return 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border-2 border-transparent hover:border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-500 border-2 border-gray-200'
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200',
        'flex items-center space-x-1 min-h-[32px]',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        getVariantStyles(action.variant)
      )}
      title={action.label}
      aria-label={action.label}
    >
      {action.icon && (
        <span 
          className="text-xs" 
          role="img" 
          aria-hidden="true"
        >
          {action.icon}
        </span>
      )}
      <span>{action.label}</span>
    </button>
  )
}

export default MessageRenderer