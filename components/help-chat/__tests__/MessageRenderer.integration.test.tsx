import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageRenderer } from '../MessageRenderer'
import type { ChatMessage } from '../../../types/help-chat'

// Mock react-markdown and related modules
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }: { children: string }) {
    // Simple markdown parsing for testing
    const content = children
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
    
    return <div data-testid="markdown-content" dangerouslySetInnerHTML={{ __html: content }} />
  }
})

jest.mock('remark-gfm', () => ({}))
jest.mock('rehype-highlight', () => ({}))

describe('MessageRenderer Integration', () => {
  const mockProps = {
    onFeedback: jest.fn(),
    onCopy: jest.fn(),
    onQuickAction: jest.fn(),
    feedbackMessageId: null,
    setFeedbackMessageId: jest.fn(),
  }

  it('renders complete assistant message with all features', () => {
    const message: ChatMessage = {
      id: 'test-message',
      type: 'assistant',
      content: '# How to Create a Project\n\nTo create a new project:\n\n1. Click **New Project** button\n2. Fill in the required details\n3. Click `Save`\n\nThis will create your project successfully.',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      confidence: 0.92,
      sources: [
        {
          id: 'source1',
          title: 'Project Management Guide',
          url: 'https://example.com/guide',
          type: 'documentation',
          relevance: 0.95,
        },
        {
          id: 'source2',
          title: 'Creating Projects FAQ',
          type: 'faq',
          relevance: 0.87,
        },
      ],
      actions: [
        {
          id: 'action1',
          label: 'Create New Project',
          action: jest.fn(),
          variant: 'primary',
        },
        {
          id: 'action2',
          label: 'View Documentation',
          action: jest.fn(),
          variant: 'secondary',
        },
      ],
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    // Check message type indicator
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()

    // Check markdown content is rendered
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()

    // Check confidence score
    expect(screen.getByText('Confidence:')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()

    // Check sources
    expect(screen.getByText('Sources (2)')).toBeInTheDocument()
    expect(screen.getByText('Project Management Guide')).toBeInTheDocument()
    expect(screen.getByText('Creating Projects FAQ')).toBeInTheDocument()

    // Check quick actions
    expect(screen.getByText('Quick Actions:')).toBeInTheDocument()
    expect(screen.getByText('Create New Project')).toBeInTheDocument()
    expect(screen.getByText('View Documentation')).toBeInTheDocument()

    // Check action buttons (copy, feedback)
    expect(screen.getByLabelText('Copy message')).toBeInTheDocument()
    expect(screen.getByLabelText('Provide feedback')).toBeInTheDocument()

    // Check timestamp
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
  })

  it('renders user message correctly', () => {
    const message: ChatMessage = {
      id: 'user-message',
      type: 'user',
      content: 'How do I create a new project in the system?',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    expect(screen.getByText('How do I create a new project in the system?')).toBeInTheDocument()
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
    
    // User messages should not have copy/feedback buttons
    expect(screen.queryByLabelText('Copy message')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Provide feedback')).not.toBeInTheDocument()
  })

  it('renders tip message with special styling', () => {
    const message: ChatMessage = {
      id: 'tip-message',
      type: 'tip',
      content: '💡 **Pro Tip:** Use keyboard shortcuts Ctrl+N to quickly create new projects!',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    expect(screen.getByText('Tip')).toBeInTheDocument()
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
  })

  it('renders system message with special styling', () => {
    const message: ChatMessage = {
      id: 'system-message',
      type: 'system',
      content: 'System will undergo maintenance in 10 minutes. Please save your work.',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('System will undergo maintenance in 10 minutes. Please save your work.')).toBeInTheDocument()
  })

  it('handles low confidence messages appropriately', () => {
    const message: ChatMessage = {
      id: 'low-confidence-message',
      type: 'assistant',
      content: 'I think this might be the answer, but I am not very sure.',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      confidence: 0.45,
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Low confidence - please verify')).toBeInTheDocument()
  })

  it('shows streaming indicator when message is being streamed', () => {
    const message: ChatMessage = {
      id: 'streaming-message',
      type: 'assistant',
      content: 'This message is currently being streamed...',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      isStreaming: true,
    }

    render(<MessageRenderer message={message} {...mockProps} />)

    // Check for streaming dots
    const streamingDots = document.querySelectorAll('.animate-pulse')
    expect(streamingDots.length).toBeGreaterThan(0)
  })
})