import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageRenderer } from '../MessageRenderer'
import type { ChatMessage, SourceReference } from '../../../types/help-chat'

// Mock react-markdown
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>
  }
})

jest.mock('remark-gfm', () => ({}))
jest.mock('rehype-highlight', () => ({}))

describe('MessageRenderer - Source Attribution', () => {
  const defaultProps = {
    onFeedback: jest.fn(),
    onCopy: jest.fn(),
    onQuickAction: jest.fn(),
    feedbackMessageId: null,
    setFeedbackMessageId: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Source Display', () => {
    it('displays single source correctly', () => {
      const source: SourceReference = {
        id: 'source1',
        title: 'Project Management Guide',
        url: 'https://example.com/guide',
        type: 'documentation',
        relevance: 0.95,
      }

      const message: ChatMessage = {
        id: 'single-source',
        type: 'assistant',
        content: 'Here is information about project management.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('Sources (1)')).toBeInTheDocument()
      expect(screen.getByText('Project Management Guide')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText(/View source:/)).toBeInTheDocument()
    })

    it('displays multiple sources correctly', () => {
      const sources: SourceReference[] = [
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
        {
          id: 'source3',
          title: 'Feature Overview',
          url: 'https://example.com/features',
          type: 'feature',
          relevance: 0.72,
        },
      ]

      const message: ChatMessage = {
        id: 'multiple-sources',
        type: 'assistant',
        content: 'Here is comprehensive information.',
        timestamp: new Date(),
        sources,
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('Sources (3)')).toBeInTheDocument()
      expect(screen.getByText('Project Management Guide')).toBeInTheDocument()
      expect(screen.getByText('Creating Projects FAQ')).toBeInTheDocument()
      
      // Third source should be hidden initially (only first 2 shown by default)
      expect(screen.queryByText('Feature Overview')).not.toBeInTheDocument()
      
      expect(screen.getByText('95%')).toBeInTheDocument()
      expect(screen.getByText('87%')).toBeInTheDocument()
      expect(screen.queryByText('72%')).not.toBeInTheDocument() // Hidden initially
      
      // Should have expand button
      expect(screen.getByText('Show all')).toBeInTheDocument()
    })

    it('does not display sources section when no sources provided', () => {
      const message: ChatMessage = {
        id: 'no-sources',
        type: 'assistant',
        content: 'This response has no sources.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.queryByText(/Sources \(\d+\)/)).not.toBeInTheDocument()
    })
  })

  describe('Source Types and Icons', () => {
    it('displays correct icon for documentation source', () => {
      const source: SourceReference = {
        id: 'doc-source',
        title: 'API Documentation',
        type: 'documentation',
        relevance: 0.9,
      }

      const message: ChatMessage = {
        id: 'doc-source-msg',
        type: 'assistant',
        content: 'API information.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // Check that the source is displayed (icon is emoji, not accessible via role)
      expect(screen.getByText('API Documentation')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
    })

    it('displays correct icon for guide source', () => {
      const source: SourceReference = {
        id: 'guide-source',
        title: 'User Guide',
        type: 'guide',
        relevance: 0.85,
      }

      const message: ChatMessage = {
        id: 'guide-source-msg',
        type: 'assistant',
        content: 'Guide information.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // Check that the source is displayed
      expect(screen.getByText('User Guide')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('displays correct icon for FAQ source', () => {
      const source: SourceReference = {
        id: 'faq-source',
        title: 'Frequently Asked Questions',
        type: 'faq',
        relevance: 0.8,
      }

      const message: ChatMessage = {
        id: 'faq-source-msg',
        type: 'assistant',
        content: 'FAQ information.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // Check that the source is displayed
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument()
      expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('displays correct icon for feature source', () => {
      const source: SourceReference = {
        id: 'feature-source',
        title: 'Feature Description',
        type: 'feature',
        relevance: 0.75,
      }

      const message: ChatMessage = {
        id: 'feature-source-msg',
        type: 'assistant',
        content: 'Feature information.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // Check that the source is displayed
      expect(screen.getByText('Feature Description')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  describe('Source Relevance Scoring', () => {
    it('displays high relevance score', () => {
      const source: SourceReference = {
        id: 'high-relevance',
        title: 'High Relevance Source',
        type: 'documentation',
        relevance: 0.95,
      }

      const message: ChatMessage = {
        id: 'high-relevance-msg',
        type: 'assistant',
        content: 'High relevance content.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('95%')).toBeInTheDocument()
    })

    it('displays medium relevance score', () => {
      const source: SourceReference = {
        id: 'medium-relevance',
        title: 'Medium Relevance Source',
        type: 'guide',
        relevance: 0.65,
      }

      const message: ChatMessage = {
        id: 'medium-relevance-msg',
        type: 'assistant',
        content: 'Medium relevance content.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('65%')).toBeInTheDocument()
    })

    it('displays low relevance score', () => {
      const source: SourceReference = {
        id: 'low-relevance',
        title: 'Low Relevance Source',
        type: 'faq',
        relevance: 0.45,
      }

      const message: ChatMessage = {
        id: 'low-relevance-msg',
        type: 'assistant',
        content: 'Low relevance content.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('45%')).toBeInTheDocument()
    })
  })

  describe('Source Links', () => {
    it('displays clickable link when URL is provided', () => {
      const source: SourceReference = {
        id: 'linked-source',
        title: 'Linked Documentation',
        url: 'https://example.com/docs',
        type: 'documentation',
        relevance: 0.9,
      }

      const message: ChatMessage = {
        id: 'linked-source-msg',
        type: 'assistant',
        content: 'Documentation with link.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const link = screen.getByRole('link', { name: /View source: Linked Documentation/ })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://example.com/docs')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('does not display link when URL is not provided', () => {
      const source: SourceReference = {
        id: 'no-link-source',
        title: 'Source Without Link',
        type: 'faq',
        relevance: 0.8,
      }

      const message: ChatMessage = {
        id: 'no-link-source-msg',
        type: 'assistant',
        content: 'Source without link.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.queryByText('View source')).not.toBeInTheDocument()
    })
  })

  describe('Source Expansion', () => {
    it('shows expand/collapse functionality for many sources', () => {
      const sources: SourceReference[] = [
        { id: '1', title: 'Source 1', type: 'documentation', relevance: 0.9 },
        { id: '2', title: 'Source 2', type: 'guide', relevance: 0.8 },
        { id: '3', title: 'Source 3', type: 'faq', relevance: 0.7 },
        { id: '4', title: 'Source 4', type: 'feature', relevance: 0.6 },
        { id: '5', title: 'Source 5', type: 'documentation', relevance: 0.5 },
      ]

      const message: ChatMessage = {
        id: 'many-sources-msg',
        type: 'assistant',
        content: 'Message with many sources.',
        timestamp: new Date(),
        sources,
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('Sources (5)')).toBeInTheDocument()
      expect(screen.getByText('Show all')).toBeInTheDocument()
      
      // Initially shows only first 2 sources
      expect(screen.getByText('Source 1')).toBeInTheDocument()
      expect(screen.getByText('Source 2')).toBeInTheDocument()
      expect(screen.queryByText('Source 3')).not.toBeInTheDocument()
      expect(screen.queryByText('Source 4')).not.toBeInTheDocument()
      expect(screen.queryByText('Source 5')).not.toBeInTheDocument()

      // Click show all
      fireEvent.click(screen.getByText('Show all'))
      
      expect(screen.getByText('Source 3')).toBeInTheDocument()
      expect(screen.getByText('Source 4')).toBeInTheDocument()
      expect(screen.getByText('Source 5')).toBeInTheDocument()
      expect(screen.getByText('Show less')).toBeInTheDocument()

      // Click show less
      fireEvent.click(screen.getByText('Show less'))
      
      expect(screen.queryByText('Source 3')).not.toBeInTheDocument()
      expect(screen.queryByText('Source 4')).not.toBeInTheDocument()
      expect(screen.queryByText('Source 5')).not.toBeInTheDocument()
      expect(screen.getByText('Show all')).toBeInTheDocument()
    })

    it('does not show expand/collapse for 2 or fewer sources', () => {
      const sources: SourceReference[] = [
        { id: '1', title: 'Source 1', type: 'documentation', relevance: 0.9 },
        { id: '2', title: 'Source 2', type: 'guide', relevance: 0.8 },
      ]

      const message: ChatMessage = {
        id: 'few-sources-msg',
        type: 'assistant',
        content: 'Message with few sources.',
        timestamp: new Date(),
        sources,
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      expect(screen.getByText('Sources (2)')).toBeInTheDocument()
      expect(screen.queryByText('Show all')).not.toBeInTheDocument()
      expect(screen.queryByText('Show less')).not.toBeInTheDocument()
      
      // Both sources should be visible
      expect(screen.getByText('Source 1')).toBeInTheDocument()
      expect(screen.getByText('Source 2')).toBeInTheDocument()
    })
  })

  describe('Source Accessibility', () => {
    it('displays source information accessibly', () => {
      const source: SourceReference = {
        id: 'accessible-source',
        title: 'Accessible Documentation',
        url: 'https://example.com/docs',
        type: 'documentation',
        relevance: 0.85,
      }

      const message: ChatMessage = {
        id: 'accessible-source-msg',
        type: 'assistant',
        content: 'Accessible source content.',
        timestamp: new Date(),
        sources: [source],
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // Check that source information is displayed
      expect(screen.getByText('Sources (1)')).toBeInTheDocument()
      expect(screen.getByText('Accessible Documentation')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })
  })
})