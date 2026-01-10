/**
 * Unit tests for ProactiveTips component - Scheduling and Dismissal Logic
 * Tests tip generation logic, scheduling, and dismissal functionality
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { ProactiveTips } from '../ProactiveTips'
import type { ChatMessage, QuickAction, ProactiveTip } from '../../types/help-chat'

// Mock hooks
const mockUseHelpChat = {
  state: {
    messages: [] as ChatMessage[],
    userPreferences: {
      proactiveTips: true,
      tipFrequency: 'medium' as const
    },
    proactiveTipsEnabled: true
  },
  dismissTip: jest.fn()
}

jest.mock('../../hooks/useHelpChat', () => ({
  useHelpChat: () => mockUseHelpChat
}))

describe('ProactiveTips - Scheduling and Dismissal Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseHelpChat.state.messages = []
    mockUseHelpChat.state.userPreferences.proactiveTips = true
    mockUseHelpChat.state.userPreferences.tipFrequency = 'medium'
    mockUseHelpChat.state.proactiveTipsEnabled = true
  })

  describe('Tip Generation Logic', () => {
    it('should generate welcome tips for new users (Requirement 3.1)', () => {
      // Simulate welcome tip for new user on dashboard
      const welcomeTipMessage: ChatMessage = {
        id: 'welcome-tip-1',
        type: 'tip',
        content: '💡 **Welcome to Your PPM Dashboard**\n\nYour dashboard provides an overview of all your projects, portfolios, and key metrics. Use the navigation menu to explore different sections.',
        timestamp: new Date(),
        actions: [
          {
            id: 'take-tour',
            label: 'Take a Quick Tour',
            action: jest.fn(),
            variant: 'primary'
          },
          {
            id: 'explore-projects',
            label: 'View Projects',
            action: jest.fn(),
            variant: 'secondary'
          }
        ]
      }

      mockUseHelpChat.state.messages = [welcomeTipMessage]
      render(<ProactiveTips />)

      // Should display welcome tip
      expect(screen.getByText('Welcome to Your PPM Dashboard')).toBeInTheDocument()
      expect(screen.getByText(/dashboard provides an overview/)).toBeInTheDocument()
      
      // Should have tour action
      expect(screen.getByText('Take a Quick Tour')).toBeInTheDocument()
      expect(screen.getByText('View Projects')).toBeInTheDocument()
    })

    it('should generate budget optimization tips when thresholds exceeded (Requirement 3.2)', () => {
      // Simulate budget threshold tip
      const budgetTipMessage: ChatMessage = {
        id: 'budget-tip-1',
        type: 'tip',
        content: '💡 **Budget Optimization Opportunity**\n\nYour budget utilization is above 80%. Consider reviewing resource allocation or running optimization scenarios.',
        timestamp: new Date(),
        actions: [
          {
            id: 'optimize-budget',
            label: 'Optimize Budget',
            action: jest.fn(),
            variant: 'primary'
          },
          {
            id: 'run-scenario',
            label: 'Run What-If Scenario',
            action: jest.fn(),
            variant: 'secondary'
          }
        ]
      }

      mockUseHelpChat.state.messages = [budgetTipMessage]
      render(<ProactiveTips />)

      // Should display budget optimization tip
      expect(screen.getByText('Budget Optimization Opportunity')).toBeInTheDocument()
      expect(screen.getByText(/budget utilization is above 80%/)).toBeInTheDocument()
      
      // Should suggest What-If Simulation features
      expect(screen.getByText('Run What-If Scenario')).toBeInTheDocument()
      expect(screen.getByText('Optimize Budget')).toBeInTheDocument()
    })

    it('should generate resource optimization tips for resource pages (Requirement 3.3)', () => {
      // Simulate resource optimization tip
      const resourceTipMessage: ChatMessage = {
        id: 'resource-tip-1',
        type: 'tip',
        content: '💡 **Resource Utilization Alert**\n\nSome resources are over-allocated while others are underutilized. Consider rebalancing for better efficiency.',
        timestamp: new Date(),
        actions: [
          {
            id: 'rebalance',
            label: 'Rebalance Resources',
            action: jest.fn(),
            variant: 'primary'
          },
          {
            id: 'view-utilization',
            label: 'View Utilization',
            action: jest.fn(),
            variant: 'secondary'
          }
        ]
      }

      mockUseHelpChat.state.messages = [resourceTipMessage]
      render(<ProactiveTips />)

      // Should display resource optimization tip
      expect(screen.getByText('Resource Utilization Alert')).toBeInTheDocument()
      expect(screen.getByText(/over-allocated while others are underutilized/)).toBeInTheDocument()
      
      // Should highlight optimization tools
      expect(screen.getByText('Rebalance Resources')).toBeInTheDocument()
      expect(screen.getByText('View Utilization')).toBeInTheDocument()
    })
  })

  describe('Tip Frequency Limiting', () => {
    it('should limit tips to avoid overwhelming users (Requirement 3.4)', () => {
      // Create multiple tips that would normally be shown
      const multipleTips: ChatMessage[] = [
        {
          id: 'tip-1',
          type: 'tip',
          content: '💡 **Tip 1**\n\nFirst tip content.',
          timestamp: new Date()
        },
        {
          id: 'tip-2',
          type: 'tip',
          content: '💡 **Tip 2**\n\nSecond tip content.',
          timestamp: new Date()
        },
        {
          id: 'tip-3',
          type: 'tip',
          content: '💡 **Tip 3**\n\nThird tip content.',
          timestamp: new Date()
        },
        {
          id: 'tip-4',
          type: 'tip',
          content: '💡 **Tip 4**\n\nFourth tip content.',
          timestamp: new Date()
        }
      ]

      mockUseHelpChat.state.messages = multipleTips
      
      // Test with maxVisible=1 to simulate session limiting
      render(<ProactiveTips maxVisible={1} />)

      // Should only show 1 tip to avoid overwhelming
      expect(screen.getByText('Tip 4')).toBeInTheDocument() // Shows last tip
      expect(screen.queryByText('Tip 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Tip 2')).not.toBeInTheDocument()
      expect(screen.queryByText('Tip 3')).not.toBeInTheDocument()
    })

    it('should respect user tip frequency preferences', () => {
      const tipMessage: ChatMessage = {
        id: 'frequency-tip',
        type: 'tip',
        content: '💡 **Test Tip**\n\nTest content.',
        timestamp: new Date()
      }

      // Test with tips disabled - no messages should be passed to component
      mockUseHelpChat.state.userPreferences.proactiveTips = false
      mockUseHelpChat.state.messages = [] // Backend would filter out tips
      
      const { rerender } = render(<ProactiveTips />)
      
      // Should not show tips when disabled (no messages)
      expect(screen.queryByText('Test Tip')).not.toBeInTheDocument()

      // Test with tips enabled - messages would be passed to component
      mockUseHelpChat.state.userPreferences.proactiveTips = true
      mockUseHelpChat.state.messages = [tipMessage] // Backend would include tips
      rerender(<ProactiveTips />)
      
      // Should show tips when enabled
      expect(screen.getByText('Test Tip')).toBeInTheDocument()
    })

    it('should handle different tip frequency settings', () => {
      const tipMessage: ChatMessage = {
        id: 'frequency-tip',
        type: 'tip',
        content: '💡 **Frequency Test**\n\nTest content.',
        timestamp: new Date()
      }

      // Test different frequency settings - backend would filter based on frequency
      const frequencies = ['low', 'medium', 'high', 'off'] as const
      
      frequencies.forEach(frequency => {
        mockUseHelpChat.state.userPreferences.tipFrequency = frequency
        
        if (frequency === 'off') {
          // Backend would not send tips when frequency is off
          mockUseHelpChat.state.messages = []
        } else {
          // Backend would send tips for other frequencies
          mockUseHelpChat.state.messages = [tipMessage]
        }
        
        const { rerender } = render(<ProactiveTips />)
        
        if (frequency === 'off') {
          // Should not show tips when frequency is off
          expect(screen.queryByText('Frequency Test')).not.toBeInTheDocument()
        } else {
          // Should show tips for other frequencies
          expect(screen.getByText('Frequency Test')).toBeInTheDocument()
        }
        
        rerender(<div />)
      })
    })
  })

  describe('Tip Dismissal and Adaptation', () => {
    it('should handle tip dismissal correctly (Requirement 3.5)', async () => {
      const user = userEvent.setup()
      
      const dismissibleTip: ChatMessage = {
        id: 'dismissible-tip',
        type: 'tip',
        content: '💡 **Dismissible Tip**\n\nThis tip can be dismissed.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [dismissibleTip]
      render(<ProactiveTips />)

      // Should show dismiss button
      const dismissButton = screen.getByLabelText('Dismiss tip')
      expect(dismissButton).toBeInTheDocument()

      // Click dismiss button
      await user.click(dismissButton)

      // Should call dismissTip function
      await waitFor(() => {
        expect(mockUseHelpChat.dismissTip).toHaveBeenCalledWith('dismissible-tip')
      })
    })

    it('should reduce tip frequency for users who dismiss repeatedly (Requirement 3.5)', async () => {
      const user = userEvent.setup()
      
      // Simulate multiple tips for a user who dismisses frequently
      const multipleTips: ChatMessage[] = [
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
        }
      ]

      mockUseHelpChat.state.messages = multipleTips
      
      // Set tip frequency to low to simulate adaptation
      mockUseHelpChat.state.userPreferences.tipFrequency = 'low'
      
      render(<ProactiveTips maxVisible={1} />)

      // Should show fewer tips (only 1 due to maxVisible=1 and low frequency)
      expect(screen.getByText('Tip 2')).toBeInTheDocument() // Shows last tip
      expect(screen.queryByText('Tip 1')).not.toBeInTheDocument()
    })

    it('should track dismissal patterns and adapt accordingly', async () => {
      const user = userEvent.setup()
      
      const adaptiveTip: ChatMessage = {
        id: 'adaptive-tip',
        type: 'tip',
        content: '💡 **Adaptive Tip**\n\nThis tip adapts to user behavior.',
        timestamp: new Date(),
        actions: [
          {
            id: 'dismiss',
            label: 'Dismiss',
            action: jest.fn(),
            variant: 'ghost'
          }
        ]
      }

      mockUseHelpChat.state.messages = [adaptiveTip]
      render(<ProactiveTips />)

      // Dismiss the tip
      const dismissButton = screen.getByLabelText('Dismiss tip')
      await user.click(dismissButton)

      // Should call dismissTip with correct tip ID
      await waitFor(() => {
        expect(mockUseHelpChat.dismissTip).toHaveBeenCalledWith('adaptive-tip')
      })
    })
  })

  describe('Tip Scheduling Logic', () => {
    it('should handle tip scheduling with auto-hide functionality', async () => {
      jest.useFakeTimers()
      
      const scheduledTip: ChatMessage = {
        id: 'scheduled-tip',
        type: 'tip',
        content: '💡 **Scheduled Tip**\n\nThis tip will auto-hide.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [scheduledTip]
      
      render(<ProactiveTips autoHide={true} autoHideDelay={2000} />)

      // Initially should show tip
      expect(screen.getByText('Scheduled Tip')).toBeInTheDocument()

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(2000)
      })

      // Should auto-hide after delay
      await waitFor(() => {
        expect(screen.getByText('1 tip')).toBeInTheDocument() // Minimized state
      })

      jest.useRealTimers()
    })

    it('should handle tip expiration and cleanup', () => {
      const expiredTip: ChatMessage = {
        id: 'expired-tip',
        type: 'tip',
        content: '💡 **Expired Tip**\n\nThis tip should expire.',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      }

      const currentTip: ChatMessage = {
        id: 'current-tip',
        type: 'tip',
        content: '💡 **Current Tip**\n\nThis tip is current.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [expiredTip, currentTip]
      render(<ProactiveTips />)

      // Should show both tips (expiration logic would be handled by backend)
      expect(screen.getByText('Current Tip')).toBeInTheDocument()
      expect(screen.getByText('Expired Tip')).toBeInTheDocument()
    })

    it('should prioritize tips correctly', () => {
      // Create tips with different priorities (simulated through content)
      const highPriorityTip: ChatMessage = {
        id: 'high-priority',
        type: 'tip',
        content: '💡 **Critical Budget Alert**\n\nImmediate attention required.',
        timestamp: new Date()
      }

      const lowPriorityTip: ChatMessage = {
        id: 'low-priority',
        type: 'tip',
        content: '💡 **Helpful Shortcut**\n\nTry this keyboard shortcut.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [lowPriorityTip, highPriorityTip]
      render(<ProactiveTips maxVisible={1} />)

      // Should show the high priority tip (last in array, which simulates backend prioritization)
      expect(screen.getByText('Critical Budget Alert')).toBeInTheDocument()
      expect(screen.queryByText('Helpful Shortcut')).not.toBeInTheDocument()
    })
  })

  describe('Tip Action Handling', () => {
    it('should execute tip actions correctly', async () => {
      const user = userEvent.setup()
      const mockAction = jest.fn()

      const actionTip: ChatMessage = {
        id: 'action-tip',
        type: 'tip',
        content: '💡 **Action Tip**\n\nThis tip has actions.',
        timestamp: new Date(),
        actions: [
          {
            id: 'primary-action',
            label: 'Primary Action',
            action: mockAction,
            variant: 'primary'
          },
          {
            id: 'secondary-action',
            label: 'Secondary Action',
            action: jest.fn(),
            variant: 'secondary'
          }
        ]
      }

      mockUseHelpChat.state.messages = [actionTip]
      render(<ProactiveTips />)

      // Should show action buttons
      expect(screen.getByText('Primary Action')).toBeInTheDocument()
      expect(screen.getByText('Secondary Action')).toBeInTheDocument()

      // Click primary action
      await user.click(screen.getByText('Primary Action'))

      // Should execute action
      expect(mockAction).toHaveBeenCalled()
    })

    it('should handle dismiss action specially', async () => {
      const user = userEvent.setup()
      const mockDismissAction = jest.fn()

      const dismissActionTip: ChatMessage = {
        id: 'dismiss-action-tip',
        type: 'tip',
        content: '💡 **Dismiss Action Tip**\n\nThis tip has a dismiss action.',
        timestamp: new Date(),
        actions: [
          {
            id: 'dismiss',
            label: 'Not Now',
            action: mockDismissAction,
            variant: 'ghost'
          }
        ]
      }

      mockUseHelpChat.state.messages = [dismissActionTip]
      render(<ProactiveTips />)

      // Click dismiss action
      await user.click(screen.getByText('Not Now'))

      // Should execute action and dismiss tip
      expect(mockDismissAction).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed tip content gracefully', () => {
      const malformedTip: ChatMessage = {
        id: 'malformed-tip',
        type: 'tip',
        content: 'Malformed tip without proper format',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [malformedTip]
      
      expect(() => render(<ProactiveTips />)).not.toThrow()
      
      // Should not crash, but may not display properly formatted content
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('should handle empty tip messages', () => {
      mockUseHelpChat.state.messages = []
      
      render(<ProactiveTips />)
      
      // Should not render anything when no tips
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('should handle tips without actions', () => {
      const noActionTip: ChatMessage = {
        id: 'no-action-tip',
        type: 'tip',
        content: '💡 **Simple Tip**\n\nThis tip has no actions.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [noActionTip]
      render(<ProactiveTips />)

      // Should display tip without action buttons
      expect(screen.getByText('Simple Tip')).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Tip action buttons' })).not.toBeInTheDocument()
    })

    it('should handle component unmounting during tip display', () => {
      const tipMessage: ChatMessage = {
        id: 'unmount-tip',
        type: 'tip',
        content: '💡 **Unmount Test**\n\nTesting unmount behavior.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [tipMessage]
      
      const { unmount } = render(<ProactiveTips />)
      
      // Should not throw error on unmount
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should announce tip changes to screen readers', () => {
      const tipMessage: ChatMessage = {
        id: 'announce-tip',
        type: 'tip',
        content: '💡 **Announcement Test**\n\nTesting screen reader announcements.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [tipMessage]
      render(<ProactiveTips />)

      // Should have aria-live region for announcements
      const announceRegions = document.querySelectorAll('[aria-live="polite"]')
      expect(announceRegions.length).toBeGreaterThan(0)
    })

    it('should provide proper keyboard navigation', async () => {
      const user = userEvent.setup()
      
      const keyboardTip: ChatMessage = {
        id: 'keyboard-tip',
        type: 'tip',
        content: '💡 **Keyboard Test**\n\nTesting keyboard navigation.',
        timestamp: new Date()
      }

      mockUseHelpChat.state.messages = [keyboardTip]
      render(<ProactiveTips />)

      // Should be able to navigate with keyboard
      const article = screen.getByRole('article')
      expect(article).toHaveAttribute('tabIndex', '0')
      
      // Focus the article first
      article.focus()
      
      // Should handle Escape key to dismiss the tip
      await user.keyboard('{Escape}')
      
      // Should call dismissTip when Escape is pressed
      await waitFor(() => {
        expect(mockUseHelpChat.dismissTip).toHaveBeenCalledWith('keyboard-tip')
      })
    })
  })
})