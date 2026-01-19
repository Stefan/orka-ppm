'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { 
  ExternalLink, 
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
  className?: string
}

export function MessageRenderer({
  message,
  onFeedback,
  onCopy,
  onQuickAction,
  feedbackMessageId,
  setFeedbackMessageId,
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
        return <Lightbulb className="h-4 w-4 text-yellow-500" />
      case 'system':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'assistant':
        return <MessageSquare className="h-4 w-4 text-green-500" />
      default:
        return null
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-700 bg-green-50 border-green-200'
    if (confidence >= 0.6) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  const markdownComponents = {
    code: ({ node, inline, className, children, ...props }: any) => {
      if (inline) {
        return (
          <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        )
      }
      
      return (
        <pre className="bg-gray-100 rounded-md p-3 overflow-x-auto text-sm border border-gray-200">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      )
    },
    a: ({ children, href, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
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
        className="border-l-4 border-gray-400 pl-4 italic text-gray-700 bg-gray-50 py-2 rounded-r" 
        {...props}
      >
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }: any) => (
      <table 
        className="min-w-full border-collapse border-2 border-gray-300" 
        {...props}
      >
        {children}
      </table>
    ),
    th: ({ children, ...props }: any) => (
      <th 
        className="border-2 border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900" 
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td 
        className="border-2 border-gray-300 px-3 py-2 text-gray-800" 
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
          ? 'bg-blue-50 border-blue-200 ml-8' 
          : isSystem
          ? 'bg-gray-50 border-gray-200'
          : isTip
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-white border-gray-200 mr-8',
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
              <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
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

          {message.confidence && (
            <div className="flex items-center space-x-2">
              <Star className="h-3 w-3" />
              <span className="text-xs font-medium">Confidence:</span>
              <div className={cn(
                'px-2 py-1 rounded-full text-xs font-medium border',
                getConfidenceColor(message.confidence)
              )}>
                {Math.round(message.confidence * 100)}%
              </div>
              {message.confidence < 0.6 && (
                <div className="flex items-center space-x-1 text-xs text-gray-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Low confidence - please verify</span>
                </div>
              )}
            </div>
          )}

          {message.sources && message.sources.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-700">
                  Sources ({message.sources.length})
                </h4>
                {message.sources.length > 2 && (
                  <button
                    onClick={() => setExpandedSources(!expandedSources)}
                    className="text-xs text-blue-600 hover:text-blue-800"
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

          {message.actions && message.actions.length > 0 && (
            <div
              id={actionsId}
              className="flex flex-wrap gap-2"
            >
              {message.actions.map((action, index) => (
                <button
                  key={action.id || `action-${index}`}
                  onClick={() => onQuickAction(action)}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>


      </div>

      {feedbackMessageId === message.id && (
        <div className="mt-4 pt-4 border-t-2 border-gray-200">
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
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex items-start space-x-2">
        <span className="text-sm">{getSourceIcon(source.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h5 className="text-sm font-medium text-gray-900 truncate">
              {source.title}
            </h5>
            {source.relevance && (
              <span className="text-xs text-gray-500">
                {Math.round(source.relevance * 100)}%
              </span>
            )}
          </div>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center"
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