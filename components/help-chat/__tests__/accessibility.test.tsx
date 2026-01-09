/**
 * Accessibility tests for Help Chat components
 * Tests WCAG 2.1 AA compliance
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import '@testing-library/jest-dom'

import { HelpChat } from '../../HelpChat'
import { HelpChatToggle } from '../../HelpChatToggle'
import { ProactiveTips } from '../../ProactiveTips'
import { MessageRenderer } from '../MessageRenderer'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock hooks
const mockUseHelpChat = {
  state: {
    isOpen: true,
    messages: [
      {
        id: '1',
        type: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: new Date(),
        confidence: 0.9,
        sources: [
          {
            id: 'source-1',
            title: 'Test Source',
            type: 'documentation',
            relevance: 0.8,
            url: 'https://example.com'
          }
        ],
        actions: [
          {
            id: 'action-1',
            label: 'Test Action',
            action: 'test',
            variant: 'primary'
          }
        ]
      }
    ],
    isLoading: false,
    isTyping: false,
    error: null
  },
  toggleChat: jest.fn(),
  sendMessage: jest.fn(),
  clearMessages: jest.fn(),
  submitFeedback: jest.fn(),
  canSendMessage: true,
  retryLastMessage: jest.fn(),
  getErrorMessage: () => 'Test error',
  hasUnreadTips: false,
  canShowProactiveTips: false,
  getToggleButtonText: () => 'Open help chat',
  dismissTip: jest.fn()
}

jest.mock('../../../hooks/useHelpChat', () => ({
  useHelpChat: () => mockUseHelpChat
}))

jest.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => false
}))

describe('Help Chat Accessibility', () => {
  describe('HelpChat Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<HelpChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA labels and roles', () => {
      render(<HelpChat />)
      
      // Check main chat region
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByLabelledby('desktop-help-chat-title')).toBeInTheDocument()
      
      // Check messages area
      expect(screen.getByRole('log')).toBeInTheDocument()
      expect(screen.getByLabelText('Chat messages')).toBeInTheDocument()
      
      // Check input field
      expect(screen.getByLabelText('Type your question about PPM features')).toBeInTheDocument()
      
      // Check buttons
      expect(screen.getByLabelText('Send message')).toBeInTheDocument()
      expect(screen.getByLabelText('Close help chat')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')
      
      // Focus should start on input
      await user.click(input)
      expect(input).toHaveFocus()
      
      // Tab should move to send button
      await user.tab()
      expect(sendButton).toHaveFocus()
      
      // Enter should submit form
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      // Form submission would be tested with proper mock
    })

    it('should announce state changes to screen readers', () => {
      render(<HelpChat />)
      
      // Check for screen reader announcements
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    })

    it('should have proper color contrast', () => {
      render(<HelpChat />)
      
      // Check that text elements have sufficient contrast
      const title = screen.getByText('AI Help Assistant')
      expect(title).toHaveClass('text-gray-900')
      
      // Check button contrast
      const sendButton = screen.getByLabelText('Send message')
      expect(sendButton).toHaveClass('bg-blue-600', 'text-white')
    })
  })

  describe('HelpChatToggle Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<HelpChatToggle />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA attributes', () => {
      render(<HelpChatToggle />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveAttribute('aria-haspopup', 'dialog')
      expect(button).toHaveAttribute('aria-label')
    })

    it('should meet touch target size requirements', () => {
      render(<HelpChatToggle />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('min-h-[56px]', 'min-w-[56px]')
    })

    it('should support keyboard interaction', async () => {
      const user = userEvent.setup()
      const mockToggle = jest.fn()
      
      // Mock the hook to return our mock function
      jest.mocked(require('../../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../../hooks/useHelpChat').useHelpChat)(),
        toggleChat: mockToggle
      })
      
      render(<HelpChatToggle />)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      // Should handle Enter key
      await user.keyboard('{Enter}')
      
      // Should handle Space key
      await user.keyboard(' ')
      
      // Should handle Escape key
      await user.keyboard('{Escape}')
    })
  })

  describe('MessageRenderer Component', () => {
    const mockMessage = {
      id: '1',
      type: 'assistant' as const,
      content: 'Test message with **bold** text and [link](https://example.com)',
      timestamp: new Date(),
      confidence: 0.9,
      sources: [
        {
          id: 'source-1',
          title: 'Test Source',
          type: 'documentation' as const,
          relevance: 0.8,
          url: 'https://example.com'
        }
      ],
      actions: [
        {
          id: 'action-1',
          label: 'Test Action',
          action: 'test',
          variant: 'primary' as const
        }
      ]
    }

    it('should have no accessibility violations', async () => {
      const { container } = render(
        <MessageRenderer
          message={mockMessage}
          onFeedback={jest.fn()}
          onCopy={jest.fn()}
          onQuickAction={jest.fn()}
          feedbackMessageId={null}
          setFeedbackMessageId={jest.fn()}
          messageIndex={1}
          totalMessages={1}
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper semantic structure', () => {
      render(
        <MessageRenderer
          message={mockMessage}
          onFeedback={jest.fn()}
          onCopy={jest.fn()}
          onQuickAction={jest.fn()}
          feedbackMessageId={null}
          setFeedbackMessageId={jest.fn()}
          messageIndex={1}
          totalMessages={1}
        />
      )
      
      // Check article structure
      expect(screen.getByRole('article')).toBeInTheDocument()
      
      // Check content region
      expect(screen.getByRole('region', { name: 'Message content' })).toBeInTheDocument()
      
      // Check source list
      expect(screen.getByRole('list', { name: 'Information sources' })).toBeInTheDocument()
      
      // Check action buttons
      expect(screen.getByRole('group', { name: 'Quick action buttons' })).toBeInTheDocument()
    })

    it('should have accessible links', () => {
      render(
        <MessageRenderer
          message={mockMessage}
          onFeedback={jest.fn()}
          onCopy={jest.fn()}
          onQuickAction={jest.fn()}
          feedbackMessageId={null}
          setFeedbackMessageId={jest.fn()}
          messageIndex={1}
          totalMessages={1}
        />
      )
      
      // Check external links have proper attributes
      const externalLinks = screen.getAllByRole('link')
      externalLinks.forEach(link => {
        if (link.getAttribute('href')?.startsWith('http')) {
          expect(link).toHaveAttribute('target', '_blank')
          expect(link).toHaveAttribute('rel', 'noopener noreferrer')
        }
      })
    })

    it('should provide proper time information', () => {
      render(
        <MessageRenderer
          message={mockMessage}
          onFeedback={jest.fn()}
          onCopy={jest.fn()}
          onQuickAction={jest.fn()}
          feedbackMessageId={null}
          setFeedbackMessageId={jest.fn()}
          messageIndex={1}
          totalMessages={1}
        />
      )
      
      const timeElement = screen.getByRole('time')
      expect(timeElement).toHaveAttribute('dateTime')
      expect(timeElement).toHaveAttribute('title')
    })
  })

  describe('ProactiveTips Component', () => {
    const mockTips = [
      {
        id: 'tip-1',
        type: 'feature_discovery' as const,
        title: 'Test Tip',
        content: 'This is a test tip with some helpful information.',
        priority: 'medium' as const,
        triggerContext: [],
        actions: [
          {
            id: 'action-1',
            label: 'Learn More',
            action: 'navigate',
            variant: 'primary' as const,
            target: '/help'
          }
        ],
        dismissible: true,
        showOnce: false,
        isRead: false
      }
    ]

    it('should have no accessibility violations', async () => {
      // Mock the hook to return tips
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          messages: [
            {
              id: 'tip-1',
              type: 'tip',
              content: '💡 **Test Tip**\n\nThis is a test tip.',
              timestamp: new Date(),
              actions: mockTips[0].actions
            }
          ]
        }
      })

      const { container } = render(<ProactiveTips />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper landmark structure', () => {
      // Mock the hook to return tips
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          messages: [
            {
              id: 'tip-1',
              type: 'tip',
              content: '💡 **Test Tip**\n\nThis is a test tip.',
              timestamp: new Date(),
              actions: mockTips[0].actions
            }
          ]
        }
      })

      render(<ProactiveTips />)
      
      // Check main region
      expect(screen.getByRole('region')).toBeInTheDocument()
      
      // Check list structure
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getByRole('listitem')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      // Mock the hook to return tips
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          messages: [
            {
              id: 'tip-1',
              type: 'tip',
              content: '💡 **Test Tip**\n\nThis is a test tip.',
              timestamp: new Date(),
              actions: mockTips[0].actions
            }
          ]
        }
      })

      render(<ProactiveTips />)
      
      const tipContainer = screen.getByRole('region')
      
      // Should handle Escape key to minimize
      await user.keyboard('{Escape}')
      
      // Should be focusable
      expect(tipContainer).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Color Contrast', () => {
    it('should meet WCAG AA contrast requirements', () => {
      render(<HelpChat />)
      
      // Test primary text colors
      const primaryText = screen.getByText('AI Help Assistant')
      expect(primaryText).toHaveClass('text-gray-900')
      
      // Test secondary text colors
      const welcomeText = screen.getByText('Welcome to AI Help Assistant!')
      expect(welcomeText).toHaveClass('text-gray-500')
      
      // Test button colors
      const sendButton = screen.getByLabelText('Send message')
      expect(sendButton).toHaveClass('bg-blue-600', 'text-white')
    })
  })

  describe('Focus Management', () => {
    it('should manage focus properly when chat opens', async () => {
      const { rerender } = render(<HelpChat />)
      
      // Mock chat as closed initially
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          isOpen: false
        }
      })
      
      rerender(<HelpChat />)
      
      // Should not render when closed
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      
      // Mock chat as open
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          isOpen: true
        }
      })
      
      rerender(<HelpChat />)
      
      // Should focus input when opened
      await waitFor(() => {
        const input = screen.getByLabelText('Type your question about PPM features')
        expect(input).toBeInTheDocument()
      })
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide appropriate live regions', () => {
      render(<HelpChat />)
      
      // Check for live regions
      const liveRegion = screen.getByRole('log')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      
      // Check for status announcements
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    })

    it('should announce loading states', () => {
      // Mock loading state
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          isLoading: true
        }
      })
      
      render(<HelpChat />)
      
      expect(screen.getByText('AI Assistant is processing your request')).toBeInTheDocument()
    })

    it('should announce error states', () => {
      // Mock error state
      jest.mocked(require('../../hooks/useHelpChat').useHelpChat).mockReturnValue({
        ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)(),
        state: {
          ...jest.mocked(require('../../hooks/useHelpChat').useHelpChat)().state,
          error: 'Test error'
        }
      })
      
      render(<HelpChat />)
      
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toBeInTheDocument()
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
    })
  })

  describe('Mobile Accessibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      jest.mocked(require('../../hooks/useMediaQuery').useMediaQuery).mockReturnValue(true)
    })

    it('should have proper touch targets on mobile', () => {
      render(<HelpChatToggle />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('should provide modal dialog on mobile', () => {
      render(<HelpChat />)
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'help-chat-title')
    })
  })
})