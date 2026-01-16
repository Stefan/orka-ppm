/**
 * Unit tests for HelpChat component
 * Tests responsive behavior, interactions, and accessibility features
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { HelpChat } from '../HelpChat'
import type { ChatMessage } from '../../types/help-chat'

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true,
})

// Mock hooks
const mockUseHelpChat = {
  state: {
    isOpen: true,
    messages: [] as ChatMessage[],
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
  getErrorMessage: () => 'Test error'
}

const mockUseMediaQuery = jest.fn()

jest.mock('../../hooks/useHelpChat', () => ({
  useHelpChat: () => mockUseHelpChat
}))

jest.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockUseMediaQuery()
}))

// Mock MessageRenderer component
jest.mock('../help-chat/MessageRenderer', () => ({
  MessageRenderer: ({ message }: { message: ChatMessage }) => (
    <div data-testid={`message-${message.id}`}>
      {message.content}
    </div>
  )
}))

// Mock LanguageSelector component
jest.mock('../help-chat/LanguageSelector', () => ({
  LanguageSelector: ({ compact, className }: { compact?: boolean; className?: string }) => (
    <div data-testid="language-selector" className={className}>
      Language Selector {compact && '(compact)'}
    </div>
  )
}))

describe('HelpChat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMediaQuery.mockReturnValue(false) // Desktop by default
  })

  describe('Desktop Layout', () => {
    it('renders as sidebar on desktop', () => {
      render(<HelpChat />)
      
      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('fixed', 'right-0', 'w-96')
    })

    it('displays proper header elements', () => {
      render(<HelpChat />)
      
      expect(screen.getByText('AI Help Assistant')).toBeInTheDocument()
      expect(screen.getByLabelText('Close help chat')).toBeInTheDocument()
      expect(screen.getByTestId('language-selector')).toBeInTheDocument()
    })

    it('shows welcome message when no messages', () => {
      render(<HelpChat />)
      
      expect(screen.getByText('Welcome to AI Help Assistant!')).toBeInTheDocument()
      expect(screen.getByText(/Ask me anything about the PPM platform/)).toBeInTheDocument()
    })

    it('renders input area with proper elements', () => {
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')
      
      expect(input).toBeInTheDocument()
      expect(sendButton).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Ask me about PPM features...')
    })

    it('handles minimize/maximize functionality', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const minimizeButton = screen.getByLabelText('Minimize help chat')
      await user.click(minimizeButton)
      
      // After minimize, should show maximize button
      await waitFor(() => {
        expect(screen.getByLabelText('Maximize help chat')).toBeInTheDocument()
      })
    })
  })

  describe('Mobile Layout', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile
    })

    it('renders as modal dialog on mobile', () => {
      render(<HelpChat />)
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveClass('fixed', 'inset-0')
    })

    it('includes backdrop for mobile overlay', () => {
      render(<HelpChat />)
      
      const backdrop = document.querySelector('.bg-black.bg-opacity-50')
      expect(backdrop).toBeInTheDocument()
    })

    it('has larger touch targets on mobile', () => {
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')
      
      expect(input).toHaveClass('min-h-[44px]')
      expect(sendButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    })

    it('handles backdrop click to close', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const backdrop = document.querySelector('.bg-black.bg-opacity-50')
      if (backdrop) {
        await user.click(backdrop)
        expect(mockUseHelpChat.toggleChat).toHaveBeenCalled()
      }
    })
  })

  describe('Message Handling', () => {
    it('displays messages when present', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          type: 'user',
          content: 'Hello',
          timestamp: new Date()
        },
        {
          id: '2',
          type: 'assistant',
          content: 'Hi there!',
          timestamp: new Date()
        }
      ]

      mockUseHelpChat.state.messages = messages
      render(<HelpChat />)
      
      expect(screen.getByTestId('message-1')).toBeInTheDocument()
      expect(screen.getByTestId('message-2')).toBeInTheDocument()
    })

    it('handles message submission', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')
      
      await user.type(input, 'Test message')
      await user.click(sendButton)
      
      expect(mockUseHelpChat.sendMessage).toHaveBeenCalledWith('Test message')
    })

    it('handles Enter key submission', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      
      await user.type(input, 'Test message{enter}')
      
      expect(mockUseHelpChat.sendMessage).toHaveBeenCalledWith('Test message')
    })

    it('prevents submission of empty messages', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const sendButton = screen.getByLabelText('Send message')
      
      await user.click(sendButton)
      
      expect(mockUseHelpChat.sendMessage).not.toHaveBeenCalled()
    })

    it('clears input after successful submission', async () => {
      const user = userEvent.setup()
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      
      await user.type(input, 'Test message')
      await user.keyboard('{enter}')
      
      expect(input).toHaveValue('')
    })
  })

  describe('Loading States', () => {
    it('shows loading indicator when sending message', () => {
      mockUseHelpChat.state.isLoading = true
      render(<HelpChat />)
      
      const sendButton = screen.getByLabelText('Send message')
      expect(sendButton).toBeDisabled()
      
      // Check for loading spinner
      const spinner = sendButton.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('shows typing indicator when AI is typing', () => {
      mockUseHelpChat.state.isTyping = true
      render(<HelpChat />)
      
      expect(screen.getByText('AI is typing...')).toBeInTheDocument()
      expect(screen.getByLabelText('AI Assistant is typing a response')).toBeInTheDocument()
    })

    it('updates header title based on state', () => {
      mockUseHelpChat.state.isLoading = true
      render(<HelpChat />)
      
      const titleElements = screen.getAllByText('AI Assistant is processing your request')
      expect(titleElements.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('displays error message when error occurs', () => {
      mockUseHelpChat.state.error = 'Network error'
      render(<HelpChat />)
      
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('provides retry functionality on error', async () => {
      const user = userEvent.setup()
      mockUseHelpChat.state.error = 'Network error'
      render(<HelpChat />)
      
      const retryButton = screen.getByText('Try again')
      await user.click(retryButton)
      
      expect(mockUseHelpChat.retryLastMessage).toHaveBeenCalled()
    })
  })


  describe('Interactive Features', () => {
    it('handles clear messages functionality', async () => {
      const user = userEvent.setup()
      mockUseHelpChat.state.messages = [
        { id: '1', type: 'user', content: 'Test', timestamp: new Date() }
      ]
      
      render(<HelpChat />)
      
      const clearButton = screen.getByLabelText('Clear chat messages')
      await user.click(clearButton)
      
      expect(mockUseHelpChat.clearMessages).toHaveBeenCalled()
    })

    it('only shows clear button when messages exist', () => {
      // Test with messages first
      mockUseHelpChat.state.messages = [
        { id: '1', type: 'user', content: 'Test', timestamp: new Date() }
      ]
      
      const { rerender } = render(<HelpChat />)
      expect(screen.getByLabelText('Clear chat messages')).toBeInTheDocument()
      
      // Test without messages
      mockUseHelpChat.state.messages = []
      rerender(<HelpChat />)
      
      expect(screen.queryByLabelText('Clear chat messages')).not.toBeInTheDocument()
    })

    it('disables input when cannot send message', () => {
      mockUseHelpChat.canSendMessage = false
      render(<HelpChat />)
      
      const input = screen.getByLabelText('Type your question about PPM features')
      const sendButton = screen.getByLabelText('Send message')
      
      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Responsive Behavior', () => {
    it('adapts layout based on screen size', () => {
      // Desktop layout
      mockUseMediaQuery.mockReturnValue(false)
      const { rerender } = render(<HelpChat />)
      
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      
      // Mobile layout
      mockUseMediaQuery.mockReturnValue(true)
      rerender(<HelpChat />)
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })

    it('uses different input IDs for desktop and mobile', () => {
      // Desktop
      mockUseMediaQuery.mockReturnValue(false)
      const { rerender } = render(<HelpChat />)
      
      expect(screen.getByLabelText('Type your question about PPM features')).toHaveAttribute('id', 'desktop-chat-input')
      
      // Mobile
      mockUseMediaQuery.mockReturnValue(true)
      rerender(<HelpChat />)
      
      expect(screen.getByLabelText('Type your question about PPM features')).toHaveAttribute('id', 'mobile-chat-input')
    })
  })

  describe('Component Lifecycle', () => {
    it('does not render when chat is closed', () => {
      mockUseHelpChat.state.isOpen = false
      render(<HelpChat />)
      
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('handles component unmounting gracefully', () => {
      const { unmount } = render(<HelpChat />)
      
      expect(() => unmount()).not.toThrow()
    })
  })
})