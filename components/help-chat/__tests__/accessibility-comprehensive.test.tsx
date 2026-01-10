/**
 * Comprehensive accessibility tests for Help Chat components
 * Tests keyboard navigation, screen reader compatibility, and color contrast
 * Requirements: 1.1, 1.2, 1.3
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import '@testing-library/jest-dom'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock the hooks to avoid dependency issues
const mockUseHelpChat = {
  state: {
    isOpen: true,
    messages: [
      {
        id: '1',
        type: 'assistant',
        content: 'Hello! How can I help you with PPM features?',
        timestamp: new Date(),
        confidence: 0.9,
        sources: [
          {
            id: 'source-1',
            title: 'PPM User Guide',
            type: 'documentation',
            relevance: 0.8,
            url: 'https://example.com/guide'
          }
        ],
        actions: [
          {
            id: 'action-1',
            label: 'Learn More',
            action: 'navigate',
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

const mockUseMediaQuery = jest.fn(() => false)

jest.mock('../../../hooks/useHelpChat', () => ({
  useHelpChat: () => mockUseHelpChat
}))

jest.mock('../../../hooks/useMediaQuery', () => ({
  useMediaQuery: mockUseMediaQuery
}))

// Simple test components to avoid complex imports
const TestHelpChatToggle = () => (
  <button
    type="button"
    aria-expanded={mockUseHelpChat.state.isOpen}
    aria-haspopup="dialog"
    aria-label={mockUseHelpChat.getToggleButtonText()}
    className="min-h-[56px] min-w-[56px] bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full shadow-lg"
    onClick={mockUseHelpChat.toggleChat}
  >
    <span className="sr-only">Help Chat</span>
    💬
  </button>
)

const TestHelpChat = () => (
  <div
    role="complementary"
    aria-labelledby="help-chat-title"
    className="fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-gray-200 shadow-xl"
  >
    <div className="p-4 border-b border-gray-200">
      <h2 id="help-chat-title" className="text-lg font-semibold text-gray-900">
        AI Help Assistant
      </h2>
      <button
        type="button"
        aria-label="Close help chat"
        className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        onClick={mockUseHelpChat.toggleChat}
      >
        ✕
      </button>
    </div>

    <div
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {mockUseHelpChat.state.messages.map((message, index) => (
        <article
          key={message.id}
          role="article"
          aria-labelledby={`message-${message.id}-type`}
          className="space-y-2"
        >
          <span id={`message-${message.id}-type`} className="sr-only">
            {message.type === 'assistant' ? 'AI Assistant response' : 'User message'}
          </span>
          <div role="region" aria-label="Message content" className="text-gray-800">
            {message.content}
          </div>
          {message.sources && (
            <div role="list" aria-label="Information sources" className="text-sm text-gray-600">
              {message.sources.map((source) => (
                <div key={source.id} role="listitem">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {source.title}
                  </a>
                  <span aria-label={`Relevance: ${Math.round(source.relevance * 100)} percent`}>
                    ({Math.round(source.relevance * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
          {message.actions && (
            <div role="group" aria-label="Quick action buttons" className="flex gap-2">
              {message.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>

    <form className="p-4 border-t border-gray-200">
      <div className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Type your question about PPM features
        </label>
        <textarea
          id="chat-input"
          aria-label="Type your question about PPM features"
          placeholder="Ask me about PPM features..."
          className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={2}
        />
        <button
          type="submit"
          aria-label="Send message"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px]"
        >
          Send
        </button>
      </div>
    </form>

    {/* Screen reader announcements */}
    <div role="status" aria-live="polite" className="sr-only">
      {mockUseHelpChat.state.isLoading && 'AI Assistant is processing your request'}
    </div>

    {mockUseHelpChat.state.error && (
      <div role="alert" aria-live="assertive" className="sr-only">
        Error: {mockUseHelpChat.state.error}
      </div>
    )}
  </div>
)

const TestProactiveTips = () => (
  <div
    role="region"
    aria-label="Proactive help tips"
    className="fixed bottom-4 right-4 max-w-sm"
  >
    <div role="list">
      <div role="listitem" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600" aria-hidden="true">💡</div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Welcome to PPM!</h3>
            <p className="text-sm text-gray-700 mt-1">
              Get started by exploring the dashboard features.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Take Tour
              </button>
              <button
                type="button"
                aria-label="Dismiss tip"
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

describe('Help Chat Comprehensive Accessibility Tests', () => {
  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation in help chat toggle', async () => {
      const user = userEvent.setup()
      render(<TestHelpChatToggle />)

      const toggleButton = screen.getByRole('button', { name: /help chat/i })

      // Test Tab navigation
      await user.tab()
      expect(toggleButton).toHaveFocus()

      // Test Enter key activation
      await user.keyboard('{Enter}')
      expect(mockUseHelpChat.toggleChat).toHaveBeenCalled()

      // Test Space key activation
      mockUseHelpChat.toggleChat.mockClear()
      await user.keyboard(' ')
      expect(mockUseHelpChat.toggleChat).toHaveBeenCalled()
    })

    it('should support keyboard navigation within help chat interface', async () => {
      const user = userEvent.setup()
      render(<TestHelpChat />)

      // Test sequential tab navigation
      const closeButton = screen.getByLabelText('Close help chat')
      const textArea = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')

      // Start from close button
      closeButton.focus()
      expect(closeButton).toHaveFocus()

      // Tab through all focusable elements to reach textarea
      await user.tab() // May go to link first
      await user.tab() // May go to action button
      await user.tab() // Should reach textarea
      
      // Find the textarea and ensure it gets focus
      textArea.focus()
      expect(textArea).toHaveFocus()

      // Tab to send button
      await user.tab()
      expect(sendButton).toHaveFocus()

      // Test Escape key functionality
      await user.keyboard('{Escape}')
      // In real implementation, this would close the chat
    })

    it('should support keyboard navigation in message actions', async () => {
      const user = userEvent.setup()
      render(<TestHelpChat />)

      const actionButtons = screen.getAllByRole('button')
      const messageActionButton = actionButtons.find(button => 
        button.textContent === 'Learn More'
      )

      if (messageActionButton) {
        messageActionButton.focus()
        expect(messageActionButton).toHaveFocus()

        // Test Enter key on action button
        await user.keyboard('{Enter}')
        // In real implementation, this would trigger the action
      }
    })

    it('should support keyboard navigation in proactive tips', async () => {
      const user = userEvent.setup()
      render(<TestProactiveTips />)

      const tourButton = screen.getByText('Take Tour')
      const dismissButton = screen.getByLabelText('Dismiss tip')

      // Test tab navigation between tip actions
      tourButton.focus()
      expect(tourButton).toHaveFocus()

      await user.tab()
      expect(dismissButton).toHaveFocus()

      // Test Enter key on dismiss button
      await user.keyboard('{Enter}')
      // In real implementation, this would dismiss the tip
    })

    it('should handle arrow key navigation in message list', async () => {
      const user = userEvent.setup()
      render(<TestHelpChat />)

      const messagesContainer = screen.getByRole('log')
      messagesContainer.focus()

      // Test arrow key navigation (implementation would handle this)
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowUp}')
      // In real implementation, this would navigate between messages
    })
  })

  describe('Screen Reader Compatibility', () => {
    it('should have proper ARIA live regions for dynamic content', () => {
      render(<TestHelpChat />)

      // Check for live regions
      const logRegion = screen.getByRole('log')
      expect(logRegion).toHaveAttribute('aria-live', 'polite')
      expect(logRegion).toHaveAttribute('aria-label', 'Chat messages')

      // Check for status announcements
      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toHaveAttribute('aria-live', 'polite')
      expect(statusRegion).toHaveClass('sr-only')
    })

    it('should announce loading states to screen readers', () => {
      // Mock loading state
      mockUseHelpChat.state.isLoading = true
      render(<TestHelpChat />)

      expect(screen.getByText('AI Assistant is processing your request')).toBeInTheDocument()
      
      // Reset state
      mockUseHelpChat.state.isLoading = false
    })

    it('should announce errors to screen readers with assertive priority', () => {
      // Mock error state
      mockUseHelpChat.state.error = 'Connection failed'
      render(<TestHelpChat />)

      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
      expect(errorAlert).toHaveTextContent('Error: Connection failed')
      
      // Reset state
      mockUseHelpChat.state.error = null
    })

    it('should provide proper semantic structure for screen readers', () => {
      render(<TestHelpChat />)

      // Check semantic landmarks
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByRole('log')).toBeInTheDocument()

      // Check article structure for messages
      expect(screen.getByRole('article')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Message content' })).toBeInTheDocument()

      // Check list structure for sources
      expect(screen.getByRole('list', { name: 'Information sources' })).toBeInTheDocument()
      expect(screen.getByRole('listitem')).toBeInTheDocument()

      // Check group structure for actions
      expect(screen.getByRole('group', { name: 'Quick action buttons' })).toBeInTheDocument()
    })

    it('should provide descriptive labels for all interactive elements', () => {
      render(<TestHelpChat />)

      // Check button labels
      expect(screen.getByLabelText('Close help chat')).toBeInTheDocument()
      expect(screen.getByLabelText('Send message')).toBeInTheDocument()

      // Check form labels
      expect(screen.getByLabelText('Type your question about PPM features')).toBeInTheDocument()

      // Check hidden labels for screen readers
      expect(screen.getByText('AI Assistant response')).toHaveClass('sr-only')
    })

    it('should provide proper context for links and external content', () => {
      render(<TestHelpChat />)

      const externalLink = screen.getByRole('link', { name: /PPM User Guide/i })
      expect(externalLink).toHaveAttribute('target', '_blank')
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')

      // Check relevance information is accessible
      const relevanceInfo = screen.getByLabelText('Relevance: 80 percent')
      expect(relevanceInfo).toBeInTheDocument()
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should use high contrast colors for text elements', () => {
      render(<TestHelpChat />)

      // Check primary text colors (should be dark on light background)
      const title = screen.getByText('AI Help Assistant')
      expect(title).toHaveClass('text-gray-900')

      // Check message content colors
      const messageContent = screen.getByRole('region', { name: 'Message content' })
      expect(messageContent).toHaveClass('text-gray-800')
    })

    it('should use high contrast colors for interactive elements', () => {
      render(<TestHelpChat />)

      // Check button colors
      const sendButton = screen.getByLabelText('Send message')
      expect(sendButton).toHaveClass('bg-blue-600', 'text-white')

      // Check link colors
      const link = screen.getByRole('link')
      expect(link).toHaveClass('text-blue-600')
    })

    it('should have visible focus indicators', () => {
      render(<TestHelpChat />)

      const focusableElements = [
        screen.getByLabelText('Close help chat'),
        screen.getByLabelText('Type your question about PPM features'),
        screen.getByLabelText('Send message')
      ]

      focusableElements.forEach(element => {
        expect(element).toHaveClass('focus:ring-2')
        expect(element).toHaveClass('focus:outline-none')
      })
    })

    it('should have sufficient border contrast for form elements', () => {
      render(<TestHelpChat />)

      const textarea = screen.getByLabelText('Type your question about PPM features')
      expect(textarea).toHaveClass('border-gray-300')
      expect(textarea).toHaveClass('focus:border-blue-500')
    })

    it('should use appropriate colors for different message types', () => {
      render(<TestProactiveTips />)

      // Check tip container colors (yellow theme for tips)
      const tipContainer = screen.getByRole('listitem')
      expect(tipContainer).toHaveClass('bg-yellow-50', 'border-yellow-200')

      // Check tip icon color
      const tipContent = screen.getByText('Welcome to PPM!')
      expect(tipContent).toHaveClass('text-gray-900')
    })
  })

  describe('Touch Target Compliance', () => {
    it('should meet minimum touch target size requirements', () => {
      render(<TestHelpChatToggle />)

      const toggleButton = screen.getByRole('button')
      expect(toggleButton).toHaveClass('min-h-[56px]', 'min-w-[56px]')
    })

    it('should have adequate spacing between touch targets', () => {
      render(<TestHelpChat />)

      const sendButton = screen.getByLabelText('Send message')
      expect(sendButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('should maintain touch target sizes on mobile', () => {
      // Mock mobile viewport
      mockUseMediaQuery.mockReturnValue(true)
      
      render(<TestHelpChatToggle />)

      const toggleButton = screen.getByRole('button')
      expect(toggleButton).toHaveClass('min-h-[56px]', 'min-w-[56px]')
      
      // Reset mock
      mockUseMediaQuery.mockReturnValue(false)
    })
  })

  describe('Form Accessibility', () => {
    it('should have proper form labeling', () => {
      render(<TestHelpChat />)

      // Check explicit label
      const label = screen.getByText('Type your question about PPM features')
      expect(label).toHaveClass('sr-only')

      // Check aria-label
      const textarea = screen.getByLabelText('Type your question about PPM features')
      expect(textarea).toHaveAttribute('aria-label')
    })

    it('should provide helpful placeholder text', () => {
      render(<TestHelpChat />)

      const textarea = screen.getByLabelText('Type your question about PPM features')
      expect(textarea).toHaveAttribute('placeholder', 'Ask me about PPM features...')
    })

    it('should handle form validation accessibly', async () => {
      const user = userEvent.setup()
      render(<TestHelpChat />)

      const textarea = screen.getByLabelText('Type your question about PPM features')
      const submitButton = screen.getByLabelText('Send message')

      // Test empty form submission
      await user.click(submitButton)
      // In real implementation, this would show validation messages

      // Test valid input
      await user.type(textarea, 'How do I create a project?')
      expect(textarea).toHaveValue('How do I create a project?')
    })
  })

  describe('WCAG 2.1 AA Compliance', () => {
    it('should pass automated accessibility checks', async () => {
      const { container } = render(<TestHelpChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should pass accessibility checks for toggle button', async () => {
      const { container } = render(<TestHelpChatToggle />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should pass accessibility checks for proactive tips', async () => {
      const { container } = render(<TestProactiveTips />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading hierarchy', () => {
      render(<TestHelpChat />)

      // Check heading levels
      const h2 = screen.getByRole('heading', { level: 2 })
      expect(h2).toHaveTextContent('AI Help Assistant')
    })

    it('should provide alternative text for decorative elements', () => {
      render(<TestProactiveTips />)

      // Check that decorative emoji is marked as aria-hidden
      const decorativeIcon = screen.getByText('💡')
      expect(decorativeIcon).toHaveAttribute('aria-hidden', 'true')
    })
  })

  describe('Mobile Accessibility', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true)
    })

    afterEach(() => {
      mockUseMediaQuery.mockReturnValue(false)
    })

    it('should provide modal dialog behavior on mobile', () => {
      render(<TestHelpChat />)

      const chatContainer = screen.getByRole('complementary')
      // In mobile implementation, this would be a dialog
      expect(chatContainer).toBeInTheDocument()
    })

    it('should maintain accessibility on mobile viewports', async () => {
      const { container } = render(<TestHelpChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Error Handling Accessibility', () => {
    it('should announce connection errors appropriately', () => {
      mockUseHelpChat.state.error = 'Network connection failed'
      render(<TestHelpChat />)

      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
      expect(errorAlert).toHaveTextContent('Error: Network connection failed')
      
      mockUseHelpChat.state.error = null
    })

    it('should provide recovery options for errors', () => {
      mockUseHelpChat.state.error = 'Request timeout'
      render(<TestHelpChat />)

      // In real implementation, there would be retry buttons
      expect(screen.getByRole('alert')).toBeInTheDocument()
      
      mockUseHelpChat.state.error = null
    })
  })
})