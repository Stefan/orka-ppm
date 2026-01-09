import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageRenderer } from '../MessageRenderer'
import type { ChatMessage, QuickAction, SourceReference } from '../../../types/help-chat'

// Mock react-markdown and related modules
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>
  }
})

jest.mock('remark-gfm', () => ({}))
jest.mock('rehype-highlight', () => ({}))

// Mock the clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
})

describe('MessageRenderer', () => {
  const mockOnFeedback = jest.fn()
  const mockOnCopy = jest.fn()
  const mockOnQuickAction = jest.fn()
  const mockSetFeedbackMessageId = jest.fn()

  const defaultProps = {
    onFeedback: mockOnFeedback,
    onCopy: mockOnCopy,
    onQuickAction: mockOnQuickAction,
    feedbackMessageId: null,
    setFeedbackMessageId: mockSetFeedbackMessageId,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders user message correctly', () => {
    const message: ChatMessage = {
      id: '1',
      type: 'user',
      content: 'Hello, how can I create a new project?',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Hello, how can I create a new project?')).toBeInTheDocument()
    // Check for time format (could be 10:00 AM or 11:00 AM depending on timezone)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
  })

  it('renders assistant message with markdown content', () => {
    const message: ChatMessage = {
      id: '2',
      type: 'assistant',
      content: '# Creating a Project\n\nTo create a new project:\n\n1. Click **New Project**\n2. Fill in the details\n3. Click `Save`',
      timestamp: new Date('2024-01-01T10:01:00Z'),
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('# Creating a Project')
  })

  it('displays confidence score when provided', () => {
    const message: ChatMessage = {
      id: '3',
      type: 'assistant',
      content: 'This is a response with confidence score.',
      timestamp: new Date(),
      confidence: 0.85,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Confidence:')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('displays low confidence warning', () => {
    const message: ChatMessage = {
      id: '4',
      type: 'assistant',
      content: 'This is a response with low confidence.',
      timestamp: new Date(),
      confidence: 0.45,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('Low confidence - please verify')).toBeInTheDocument()
  })

  it('renders source references', () => {
    const sources: SourceReference[] = [
      {
        id: 'source1',
        title: 'Project Management Guide',
        url: 'https://example.com/guide',
        type: 'documentation',
        relevance: 0.9,
      },
      {
        id: 'source2',
        title: 'FAQ: Creating Projects',
        type: 'faq',
        relevance: 0.7,
      },
    ]

    const message: ChatMessage = {
      id: '5',
      type: 'assistant',
      content: 'Here is information about creating projects.',
      timestamp: new Date(),
      sources,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Sources (2)')).toBeInTheDocument()
    expect(screen.getByText('Project Management Guide')).toBeInTheDocument()
    expect(screen.getByText('FAQ: Creating Projects')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    const actions: QuickAction[] = [
      {
        id: 'action1',
        label: 'Create Project',
        action: jest.fn(),
        variant: 'primary',
      },
      {
        id: 'action2',
        label: 'View Guide',
        action: jest.fn(),
        variant: 'secondary',
      },
    ]

    const message: ChatMessage = {
      id: '6',
      type: 'assistant',
      content: 'You can perform these actions:',
      timestamp: new Date(),
      actions,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Quick Actions:')).toBeInTheDocument()
    expect(screen.getByText('Create Project')).toBeInTheDocument()
    expect(screen.getByText('View Guide')).toBeInTheDocument()
  })

  it('handles copy functionality', async () => {
    const message: ChatMessage = {
      id: '7',
      type: 'assistant',
      content: 'Content to copy',
      timestamp: new Date(),
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    const copyButton = screen.getByLabelText('Copy message')
    fireEvent.click(copyButton)

    expect(mockOnCopy).toHaveBeenCalledWith('Content to copy')
  })

  it('shows feedback form when feedback button is clicked', () => {
    const message: ChatMessage = {
      id: '8',
      type: 'assistant',
      content: 'Test message',
      timestamp: new Date(),
    }

    render(<MessageRenderer message={message} {...defaultProps} feedbackMessageId="8" />)

    expect(screen.getByText('Rate this response:')).toBeInTheDocument()
    expect(screen.getByText('Helpful')).toBeInTheDocument()
    expect(screen.getByText('Not helpful')).toBeInTheDocument()
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Suggestion')).toBeInTheDocument()
  })

  it('handles feedback submission', () => {
    const message: ChatMessage = {
      id: '9',
      type: 'assistant',
      content: 'Test message',
      timestamp: new Date(),
    }

    render(<MessageRenderer message={message} {...defaultProps} feedbackMessageId="9" />)

    // Click 5-star rating
    const fiveStarButton = screen.getAllByLabelText(/Rate \d+ stars/)[4] // 5th star (index 4)
    fireEvent.click(fiveStarButton)

    // Click submit
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)

    expect(mockOnFeedback).toHaveBeenCalledWith('9', 5, 'helpful')
  })

  it('renders tip message with special styling', () => {
    const message: ChatMessage = {
      id: '10',
      type: 'tip',
      content: 'Pro tip: Use keyboard shortcuts to work faster!',
      timestamp: new Date(),
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Tip')).toBeInTheDocument()
    expect(screen.getByText('Pro tip: Use keyboard shortcuts to work faster!')).toBeInTheDocument()
  })

  it('renders system message with special styling', () => {
    const message: ChatMessage = {
      id: '11',
      type: 'system',
      content: 'System maintenance will begin in 5 minutes.',
      timestamp: new Date(),
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('System maintenance will begin in 5 minutes.')).toBeInTheDocument()
  })

  it('shows streaming indicator when message is streaming', () => {
    const message: ChatMessage = {
      id: '12',
      type: 'assistant',
      content: 'This message is being streamed...',
      timestamp: new Date(),
      isStreaming: true,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    // Check for animated dots (streaming indicator)
    const streamingDots = document.querySelectorAll('.animate-pulse')
    expect(streamingDots.length).toBeGreaterThan(0)
  })

  it('expands and collapses source list when there are many sources', () => {
    const sources: SourceReference[] = [
      { id: '1', title: 'Source 1', type: 'documentation', relevance: 0.9 },
      { id: '2', title: 'Source 2', type: 'guide', relevance: 0.8 },
      { id: '3', title: 'Source 3', type: 'faq', relevance: 0.7 },
      { id: '4', title: 'Source 4', type: 'feature', relevance: 0.6 },
    ]

    const message: ChatMessage = {
      id: '13',
      type: 'assistant',
      content: 'Message with many sources',
      timestamp: new Date(),
      sources,
    }

    render(<MessageRenderer message={message} {...defaultProps} />)

    expect(screen.getByText('Sources (4)')).toBeInTheDocument()
    expect(screen.getByText('Show all')).toBeInTheDocument()
    
    // Initially only shows first 2 sources
    expect(screen.getByText('Source 1')).toBeInTheDocument()
    expect(screen.getByText('Source 2')).toBeInTheDocument()
    expect(screen.queryByText('Source 3')).not.toBeInTheDocument()

    // Click show all
    fireEvent.click(screen.getByText('Show all'))
    
    expect(screen.getByText('Source 3')).toBeInTheDocument()
    expect(screen.getByText('Source 4')).toBeInTheDocument()
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })
})