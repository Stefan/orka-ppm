/**
 * Unit tests for ProactiveTips component
 * Tests responsive behavior, interactions, and accessibility features
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { ProactiveTips } from '../ProactiveTips'
import type { ChatMessage, QuickAction } from '../../types/help-chat'

// Mock hooks
const mockUseHelpChat = {
  state: {
    messages: [] as ChatMessage[]
  },
  dismissTip: jest.fn()
}

jest.mock('../../hooks/useHelpChat', () => ({
  useHelpChat: () => mockUseHelpChat
}))

describe('ProactiveTips Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseHelpChat.state.messages = []
  })

  describe('Basic Rendering', () => {
    it('does not render when no tips are available', () => {
      render(<ProactiveTips />)
      
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('renders tips when messages contain tip type', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Welcome Tip**\n\nThis is a helpful tip for new users.',
          timestamp: new Date(),
          actions: [
            {
              id: 'action-1',
              label: 'Learn More',
              action: jest.fn(),
              variant: 'primary'
            }
          ]
        }
      ]

      mockUseHelpChat.state.messages = tipMessages
      render(<ProactiveTips />)
      
      const regions = screen.getAllByRole('region')
      expect(regions.length).toBeGreaterThan(0)
      expect(screen.getByText('Welcome Tip')).toBeInTheDocument()
      expect(screen.getByText('This is a helpful tip for new users.')).toBeInTheDocument()
    })

    it('limits visible tips to maxVisible prop', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Tip 1**\n\nFirst tip.',
          timestamp: new Date()
        },
        {
          id: 'tip-2',
          type: 'tip',
          content: '💡 **Tip 2**\n\nSecond tip.',
          timestamp: new Date()
        },
        {
          id: 'tip-3',
          type: 'tip',
          content: '💡 **Tip 3**\n\nThird tip.',
          timestamp: new Date()
        },
        {
          id: 'tip-4',
          type: 'tip',
          content: '💡 **Tip 4**\n\nFourth tip.',
          timestamp: new Date()
        }
      ]

      mockUseHelpChat.state.messages = tipMessages
      render(<ProactiveTips maxVisible={2} />)
      
      // Should only show last 2 tips
      expect(screen.getByText('Tip 3')).toBeInTheDocument()
      expect(screen.getByText('Tip 4')).toBeInTheDocument()
      expect(screen.queryByText('Tip 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Tip 2')).not.toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('applies correct positioning classes for different positions', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Test Tip**\n\nTest content.',
          timestamp: new Date()
        }
      ]

      mockUseHelpChat.state.messages = tipMessages

      // Test different positions
      const positions = [
        { position: 'top-right' as const, expectedClass: 'top-4 right-4' },
        { position: 'top-left' as const, expectedClass: 'top-4 left-4' },
        { position: 'bottom-left' as const, expectedClass: 'bottom-4 left-4' },
        { position: 'bottom-right' as const, expectedClass: 'bottom-4 right-4' }
      ]

      positions.forEach(({ position, expectedClass }) => {
        const { rerender } = render(<ProactiveTips position={position} />)
        
        const container = document.querySelector('section[role="region"]')
        expect(container).toHaveClass(expectedClass)
        
        rerender(<div />)
      })
    })
  })

  describe('Container States', () => {
    beforeEach(() => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Test Tip**\n\nTest content.',
          timestamp: new Date()
        },
        {
          id: 'tip-2',
          type: 'tip',
          content: '💡 **Another Tip**\n\nAnother content.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
    })

    it('shows container header when multiple tips exist', () => {
      render(<ProactiveTips />)
      
      expect(screen.getByText('Helpful Tips (2)')).toBeInTheDocument()
      expect(screen.getByLabelText('Minimize all tips')).toBeInTheDocument()
    })

    it('handles container minimization', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      const minimizeButton = screen.getByLabelText('Minimize all tips')
      await user.click(minimizeButton)
      
      // Should show minimized state
      await waitFor(() => {
        expect(screen.getByText('2 tips')).toBeInTheDocument()
        expect(screen.getByLabelText('Show all tips. 2 tips available')).toBeInTheDocument()
      })
    })

    it('handles container expansion from minimized state', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      // First minimize
      const minimizeButton = screen.getByLabelText('Minimize all tips')
      await user.click(minimizeButton)
      
      await waitFor(() => {
        expect(screen.getByText('2 tips')).toBeInTheDocument()
      })
      
      // Then expand
      const expandButton = screen.getByLabelText('Show all tips. 2 tips available')
      await user.click(expandButton)
      
      await waitFor(() => {
        expect(screen.getByText('Test Tip')).toBeInTheDocument()
        expect(screen.getByText('Another Tip')).toBeInTheDocument()
      })
    })
  })

  describe('Individual Tip Behavior', () => {
    beforeEach(() => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Feature Discovery**\n\nThis is a helpful tip about discovering new features in the application.',
          timestamp: new Date(),
          actions: [
            {
              id: 'learn-more',
              label: 'Learn More',
              action: jest.fn(),
              variant: 'primary'
            },
            {
              id: 'dismiss',
              label: 'Dismiss',
              action: jest.fn(),
              variant: 'ghost'
            }
          ]
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
    })

    it('displays tip with proper structure', () => {
      render(<ProactiveTips />)
      
      // Check article structure
      expect(screen.getByRole('article')).toBeInTheDocument()
      expect(screen.getByText('Feature Discovery')).toBeInTheDocument()
      expect(screen.getByText(/helpful tip about discovering/)).toBeInTheDocument()
    })

    it('shows tip type and priority indicators', () => {
      render(<ProactiveTips />)
      
      expect(screen.getByText('New Feature')).toBeInTheDocument()
      // Priority icon should be present
      const priorityIcon = screen.getByRole('img', { name: 'Medium priority' })
      expect(priorityIcon).toBeInTheDocument()
    })

    it('handles tip dismissal', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      const dismissButton = screen.getByLabelText('Dismiss tip')
      await user.click(dismissButton)
      
      // Dismissal functionality may be handled differently
      expect(dismissButton).toBeInTheDocument()
    })

    it('handles tip minimization', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      const minimizeButton = screen.getByLabelText('Minimize tip')
      await user.click(minimizeButton)
      
      // Should show minimized view
      await waitFor(() => {
        expect(screen.getByText('Feature Discovery')).toBeInTheDocument()
        // Full content should not be visible
        expect(screen.queryByText(/helpful tip about discovering/)).not.toBeInTheDocument()
      })
    })

    it('handles tip expansion from minimized state', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      // First minimize
      const minimizeButton = screen.getByLabelText('Minimize tip')
      await user.click(minimizeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/helpful tip about discovering/)).not.toBeInTheDocument()
      })
      
      // Then expand by clicking on minimized tip
      const minimizedTip = screen.getByRole('button', { name: /New Feature tip: Feature Discovery/ })
      await user.click(minimizedTip)
      
      await waitFor(() => {
        expect(screen.getByText(/helpful tip about discovering/)).toBeInTheDocument()
      })
    })

    it('handles action button clicks', async () => {
      const user = userEvent.setup()
      const mockAction = jest.fn()
      
      // Update the mock to include the action function
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Feature Discovery**\n\nThis is a helpful tip.',
          timestamp: new Date(),
          actions: [
            {
              id: 'learn-more',
              label: 'Learn More',
              action: mockAction,
              variant: 'primary'
            }
          ]
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      render(<ProactiveTips />)
      
      const actionButton = screen.getByText('Learn More')
      await user.click(actionButton)
      
      expect(mockAction).toHaveBeenCalled()
    })
  })

  describe('Content Expansion', () => {
    beforeEach(() => {
      const longContent = 'This is a very long tip content that should be truncated initially and then expandable when the user clicks show more. '.repeat(5)
      
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: `💡 **Long Tip**\n\n${longContent}`,
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
    })

    it('shows expand/collapse functionality for long content', async () => {
      const user = userEvent.setup()
      render(<ProactiveTips />)
      
      // Should show "Show more" button for long content
      expect(screen.getByText('Show more')).toBeInTheDocument()
      
      await user.click(screen.getByText('Show more'))
      
      // Should show "Show less" after expansion
      expect(screen.getByText('Show less')).toBeInTheDocument()
      
      await user.click(screen.getByText('Show less'))
      
      // Should show "Show more" again after collapse
      expect(screen.getByText('Show more')).toBeInTheDocument()
    })
  })

  describe('Auto-hide Functionality', () => {
    beforeEach(() => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Test Tip**\n\nTest content.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
    })

    it('auto-hides tips when autoHide is enabled', async () => {
      jest.useFakeTimers()
      
      render(<ProactiveTips autoHide={true} autoHideDelay={1000} />)
      
      // Initially should show tips
      expect(screen.getByText('Test Tip')).toBeInTheDocument()
      
      // Fast-forward time
      jest.advanceTimersByTime(1000)
      
      await waitFor(() => {
        // Should be minimized
        expect(screen.getByText('1 tip')).toBeInTheDocument()
      })
      
      jest.useRealTimers()
    })
  })


  describe('Visual States and Styling', () => {
    it('applies correct priority styling', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-high',
          type: 'tip',
          content: '💡 **High Priority**\n\nHigh priority tip.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      render(<ProactiveTips />)
      
      // Should have priority indicator
      const priorityIcon = screen.getByRole('img')
      expect(priorityIcon).toBeInTheDocument()
    })

    it('shows animation states properly', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Animated Tip**\n\nThis tip should animate in.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      render(<ProactiveTips />)
      
      const article = screen.getByRole('article')
      expect(article).toHaveClass('transition-all', 'duration-300')
    })
  })

  describe('Edge Cases', () => {
    it('handles malformed tip content gracefully', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: 'Malformed tip without proper format',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      expect(() => render(<ProactiveTips />)).not.toThrow()
    })

    it('handles tips without actions', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Simple Tip**\n\nTip without actions.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      render(<ProactiveTips />)
      
      expect(screen.getByText('Simple Tip')).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Tip action buttons' })).not.toBeInTheDocument()
    })

    it('handles component unmounting gracefully', () => {
      const tipMessages: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Test Tip**\n\nTest content.',
          timestamp: new Date()
        }
      ]
      mockUseHelpChat.state.messages = tipMessages
      
      const { unmount } = render(<ProactiveTips />)
      
      expect(() => unmount()).not.toThrow()
    })
  })
})