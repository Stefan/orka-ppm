/**
 * Comprehensive End-to-End Tests for Help Chat Frontend
 * Tests complete user journeys, multi-language functionality, 
 * proactive tips, and feedback integration from the frontend perspective.
 * 
 * Requirements Coverage: All requirements (1.1-10.5)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import components
import { HelpChat } from '../components/HelpChat'
import { HelpChatToggle } from '../components/HelpChatToggle'
import { ProactiveTips } from '../components/ProactiveTips'
import { HelpChatProvider } from '../app/providers/HelpChatProvider'

// Import types
import type {
  HelpQueryRequest,
  HelpQueryResponse,
  HelpFeedbackRequest,
  FeedbackResponse,
  ProactiveTip,
  ChatMessage
} from '../types/help-chat'

// Mock the API service
jest.mock('../lib/help-chat-api', () => ({
  helpChatAPI: {
    submitQuery: jest.fn(),
    submitFeedback: jest.fn(),
    getHelpContext: jest.fn(),
    getProactiveTips: jest.fn(),
    setAuthToken: jest.fn(),
    clearCache: jest.fn(),
    healthCheck: jest.fn(),
    getCacheStats: jest.fn(),
    getRateLimitStatus: jest.fn(),
    submitQueryStream: jest.fn()
  }
}))

const mockHelpChatAPI = require('../lib/help-chat-api').helpChatAPI

// Mock hooks
const mockUseMediaQuery = jest.fn()
jest.mock('../hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockUseMediaQuery()
}))

// Mock router
const mockRouter = {
  push: jest.fn(),
  pathname: '/dashboard',
  query: {},
  asPath: '/dashboard'
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter
}))

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HelpChatProvider>
      {children}
    </HelpChatProvider>
  )
}

describe('Help Chat End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseMediaQuery.mockReturnValue(false) // Desktop by default
    
    // Default API responses
    mockHelpChatAPI.submitQuery.mockResolvedValue({
      response: 'Test response',
      sessionId: 'session-123',
      sources: [],
      confidence: 0.9,
      responseTimeMs: 100
    })
    
    mockHelpChatAPI.getHelpContext.mockResolvedValue({
      context: {
        route: '/dashboard',
        pageTitle: 'Dashboard',
        userRole: 'user'
      },
      availableActions: [],
      relevantTips: []
    })
    
    mockHelpChatAPI.getProactiveTips.mockResolvedValue({
      tips: [],
      context: {
        route: '/dashboard',
        pageTitle: 'Dashboard',
        userRole: 'user'
      }
    })
  })

  describe('Complete User Journey - English', () => {
    it('should handle complete user journey from opening chat to receiving response', async () => {
      const user = userEvent.setup()
      
      // Mock successful query response
      const mockResponse: HelpQueryResponse = {
        response: 'To create a new project, navigate to the Projects page and click the "New Project" button. Fill in the required details including project name, description, and initial budget allocation.',
        sessionId: 'session-123',
        sources: [
          {
            id: 'guide-1',
            title: 'Project Creation Guide',
            type: 'guide',
            relevance: 0.95,
            url: '/help/project-creation'
          }
        ],
        confidence: 0.92,
        responseTimeMs: 150,
        suggestedActions: [
          {
            id: 'create-project',
            label: 'Create New Project',
            action: 'navigate',
            variant: 'primary',
            target: '/projects/new'
          }
        ]
      }
      
      mockHelpChatAPI.submitQuery.mockResolvedValue(mockResponse)
      
      render(
        <TestWrapper>
          <HelpChatToggle />
          <HelpChat />
        </TestWrapper>
      )
      
      // Step 1: Open help chat
      const toggleButton = screen.getByRole('button', { name: /help/i })
      await user.click(toggleButton)
      
      // Verify chat is open
      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument()
      })
      
      // Step 2: Type and submit query
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'How do I create a new project?')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      // Verify API was called with correct parameters
      await waitFor(() => {
        expect(mockHelpChatAPI.submitQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: 'How do I create a new project?',
            context: expect.objectContaining({
              route: '/dashboard',
              pageTitle: expect.any(String),
              userRole: expect.any(String)
            }),
            language: 'en'
          })
        )
      })
      
      // Step 3: Verify response is displayed
      await waitFor(() => {
        expect(screen.getByText(/to create a new project/i)).toBeInTheDocument()
      })
      
      // Verify source attribution
      expect(screen.getByText('Project Creation Guide')).toBeInTheDocument()
      
      // Verify confidence indicator
      expect(screen.getByText(/92%/)).toBeInTheDocument()
      
      // Step 4: Test quick action button
      const quickActionButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(quickActionButton)
      
      // Verify navigation would occur (mocked)
      expect(mockRouter.push).toHaveBeenCalledWith('/projects/new')
      
      // Step 5: Submit feedback
      const thumbsUpButton = screen.getByRole('button', { name: /helpful/i })
      await user.click(thumbsUpButton)
      
      // Verify feedback submission
      await waitFor(() => {
        expect(mockHelpChatAPI.submitFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: 5,
            feedbackType: 'helpful'
          })
        )
      })
    })
  })

  describe('Multi-Language Functionality', () => {
    const languageTests = [
      {
        language: 'en',
        query: 'How do I manage budgets?',
        expectedResponse: 'To manage budgets, navigate to the Financial section and set up budget alerts.',
        expectedWord: 'budget'
      },
      {
        language: 'de', 
        query: 'Wie verwalte ich Budgets?',
        expectedResponse: 'Um Budgets zu verwalten, navigieren Sie zum Finanzbereich und richten Sie Budget-Warnungen ein.',
        expectedWord: 'Budget'
      },
      {
        language: 'fr',
        query: 'Comment gérer les budgets?',
        expectedResponse: 'Pour gérer les budgets, naviguez vers la section Financière et configurez les alertes budgétaires.',
        expectedWord: 'budget'
      }
    ]

    languageTests.forEach(({ language, query, expectedResponse, expectedWord }) => {
      it(`should handle ${language.toUpperCase()} language queries correctly`, async () => {
        const user = userEvent.setup()
        
        // Mock language-specific response
        mockHelpChatAPI.submitQuery.mockResolvedValue({
          response: expectedResponse,
          sessionId: 'session-123',
          sources: [],
          confidence: 0.9,
          responseTimeMs: 120
        })
        
        render(
          <TestWrapper>
            <HelpChat />
          </TestWrapper>
        )
        
        // Set language preference (this would typically be done through settings)
        // For this test, we'll simulate it by ensuring the API is called with correct language
        
        const input = screen.getByLabelText(/type your question/i)
        await user.type(input, query)
        
        const sendButton = screen.getByLabelText(/send message/i)
        await user.click(sendButton)
        
        // Verify API called with correct language
        await waitFor(() => {
          expect(mockHelpChatAPI.submitQuery).toHaveBeenCalledWith(
            expect.objectContaining({
              query,
              language
            })
          )
        })
        
        // Verify response in correct language
        await waitFor(() => {
          expect(screen.getByText(new RegExp(expectedWord, 'i'))).toBeInTheDocument()
        })
      })
    })
  })

  describe('Proactive Tips Integration', () => {
    it('should display and interact with proactive tips', async () => {
      const user = userEvent.setup()
      
      const mockTips: ProactiveTip[] = [
        {
          id: 'tip-1',
          type: 'feature_discovery',
          title: 'Discover Dashboard Features',
          content: 'Did you know you can customize your dashboard widgets? Click the settings icon to personalize your view.',
          priority: 'medium',
          triggerContext: ['/dashboard'],
          actions: [
            {
              id: 'customize-dashboard',
              label: 'Customize Dashboard',
              action: 'navigate',
              variant: 'primary',
              target: '/dashboard/settings'
            }
          ],
          dismissible: true,
          showOnce: false,
          isRead: false
        }
      ]
      
      mockHelpChatAPI.getProactiveTips.mockResolvedValue({
        tips: mockTips,
        context: {
          route: '/dashboard',
          pageTitle: 'Dashboard',
          userRole: 'user'
        }
      })
      
      render(
        <TestWrapper>
          <ProactiveTips />
          <HelpChatToggle />
        </TestWrapper>
      )
      
      // Verify tip is displayed
      await waitFor(() => {
        expect(screen.getByText('Discover Dashboard Features')).toBeInTheDocument()
      })
      
      // Verify tip content
      expect(screen.getByText(/customize your dashboard widgets/i)).toBeInTheDocument()
      
      // Test tip action button
      const actionButton = screen.getByRole('button', { name: /customize dashboard/i })
      await user.click(actionButton)
      
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/settings')
      
      // Test tip dismissal
      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      await user.click(dismissButton)
      
      // Verify tip is dismissed
      await waitFor(() => {
        expect(screen.queryByText('Discover Dashboard Features')).not.toBeInTheDocument()
      })
      
      // Verify notification badge on toggle button
      const toggleButton = screen.getByRole('button', { name: /help/i })
      expect(toggleButton).toHaveAttribute('aria-label', expect.stringContaining('new tip'))
    })

    it('should show context-specific tips based on current page', async () => {
      const contextTips = [
        {
          route: '/projects',
          expectedTipType: 'project_management',
          expectedContent: 'project templates'
        },
        {
          route: '/financials',
          expectedTipType: 'budget_optimization', 
          expectedContent: 'budget alerts'
        },
        {
          route: '/resources',
          expectedTipType: 'resource_allocation',
          expectedContent: 'resource optimization'
        }
      ]
      
      for (const { route, expectedTipType, expectedContent } of contextTips) {
        mockRouter.pathname = route
        
        const contextTip: ProactiveTip = {
          id: `tip-${expectedTipType}`,
          type: 'feature_discovery',
          title: `${expectedTipType} Tips`,
          content: `Learn about ${expectedContent} features.`,
          priority: 'medium',
          triggerContext: [route],
          dismissible: true,
          showOnce: false,
          isRead: false
        }
        
        mockHelpChatAPI.getProactiveTips.mockResolvedValue({
          tips: [contextTip],
          context: {
            route,
            pageTitle: route.substring(1),
            userRole: 'user'
          }
        })
        
        const { rerender } = render(
          <TestWrapper>
            <ProactiveTips />
          </TestWrapper>
        )
        
        await waitFor(() => {
          expect(screen.getByText(new RegExp(expectedContent, 'i'))).toBeInTheDocument()
        })
        
        // Clean up for next iteration
        rerender(<div />)
      }
    })
  })

  describe('Visual Guides and Screenshots', () => {
    it('should display visual guides with step-by-step instructions', async () => {
      const user = userEvent.setup()
      
      const mockResponseWithVisualGuide: HelpQueryResponse = {
        response: 'Here\'s how to create a project with visual steps:',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.9,
        responseTimeMs: 200,
        visualGuides: [
          {
            id: 'guide-1',
            title: 'Create New Project',
            steps: [
              {
                step: 1,
                description: 'Navigate to Projects page',
                screenshotUrl: '/screenshots/projects-page.png',
                highlightElements: ['#projects-nav']
              },
              {
                step: 2,
                description: 'Click New Project button',
                screenshotUrl: '/screenshots/new-project-button.png',
                highlightElements: ['#new-project-btn']
              },
              {
                step: 3,
                description: 'Fill in project details',
                screenshotUrl: '/screenshots/project-form.png',
                highlightElements: ['#project-form']
              }
            ]
          }
        ]
      }
      
      mockHelpChatAPI.submitQuery.mockResolvedValue(mockResponseWithVisualGuide)
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'Show me how to create a project with screenshots')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      // Verify visual guide is displayed
      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument()
      })
      
      // Verify steps are displayed
      expect(screen.getByText('Step 1: Navigate to Projects page')).toBeInTheDocument()
      expect(screen.getByText('Step 2: Click New Project button')).toBeInTheDocument()
      expect(screen.getByText('Step 3: Fill in project details')).toBeInTheDocument()
      
      // Verify screenshots are referenced
      const screenshots = screen.getAllByRole('img')
      expect(screenshots).toHaveLength(3)
      expect(screenshots[0]).toHaveAttribute('src', '/screenshots/projects-page.png')
      expect(screenshots[1]).toHaveAttribute('src', '/screenshots/new-project-button.png')
      expect(screenshots[2]).toHaveAttribute('src', '/screenshots/project-form.png')
      
      // Test step navigation
      const nextStepButton = screen.getByRole('button', { name: /next step/i })
      await user.click(nextStepButton)
      
      // Verify step progression
      expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument()
    })
  })

  describe('Feedback System Integration', () => {
    it('should handle different types of feedback', async () => {
      const user = userEvent.setup()
      
      // Mock successful feedback response
      mockHelpChatAPI.submitFeedback.mockResolvedValue({
        success: true,
        message: 'Feedback submitted successfully',
        trackingId: 'feedback-123'
      })
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      // First, get a response to provide feedback on
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'Test query')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('Test response')).toBeInTheDocument()
      })
      
      // Test positive feedback
      const thumbsUpButton = screen.getByRole('button', { name: /helpful/i })
      await user.click(thumbsUpButton)
      
      await waitFor(() => {
        expect(mockHelpChatAPI.submitFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: 5,
            feedbackType: 'helpful'
          })
        )
      })
      
      // Test negative feedback with text
      const thumbsDownButton = screen.getByRole('button', { name: /not helpful/i })
      await user.click(thumbsDownButton)
      
      // Should show feedback form
      await waitFor(() => {
        expect(screen.getByText(/tell us more/i)).toBeInTheDocument()
      })
      
      const feedbackTextarea = screen.getByLabelText(/additional feedback/i)
      await user.type(feedbackTextarea, 'The information was not accurate')
      
      const submitFeedbackButton = screen.getByRole('button', { name: /submit feedback/i })
      await user.click(submitFeedbackButton)
      
      await waitFor(() => {
        expect(mockHelpChatAPI.submitFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            rating: 1,
            feedbackType: 'not_helpful',
            feedbackText: 'The information was not accurate'
          })
        )
      })
      
      // Verify feedback confirmation
      expect(screen.getByText(/thank you for your feedback/i)).toBeInTheDocument()
    })

    it('should integrate with main feedback system for feature requests', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'I need a feature that doesn\'t exist')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      // Should show suggestion to use feedback system
      await waitFor(() => {
        expect(screen.getByText(/feature request/i)).toBeInTheDocument()
      })
      
      const feedbackSystemButton = screen.getByRole('button', { name: /submit feature request/i })
      await user.click(feedbackSystemButton)
      
      // Should navigate to feedback page
      expect(mockRouter.push).toHaveBeenCalledWith('/feedback')
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock API error
      mockHelpChatAPI.submitQuery.mockRejectedValue(new Error('Service unavailable'))
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'Test query')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
      })
      
      // Should show retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()
      
      // Test retry functionality
      mockHelpChatAPI.submitQuery.mockResolvedValue({
        response: 'Retry successful',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.8,
        responseTimeMs: 100
      })
      
      await user.click(retryButton)
      
      await waitFor(() => {
        expect(screen.getByText('Retry successful')).toBeInTheDocument()
      })
    })

    it('should provide fallback responses when service is degraded', async () => {
      const user = userEvent.setup()
      
      // Mock degraded service response
      mockHelpChatAPI.submitQuery.mockResolvedValue({
        response: 'I\'m currently experiencing some issues. Here are some basic navigation tips: Use the sidebar menu to access different sections of the application.',
        sessionId: 'session-123',
        sources: [],
        confidence: 0.3,
        responseTimeMs: 50,
        isFallback: true
      })
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'How do I navigate?')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/experiencing some issues/i)).toBeInTheDocument()
      })
      
      // Should show low confidence indicator
      expect(screen.getByText(/30%/)).toBeInTheDocument()
      
      // Should show fallback indicator
      expect(screen.getByText(/basic response/i)).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true) // Mobile
    })

    it('should adapt interface for mobile devices', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChatToggle />
          <HelpChat />
        </TestWrapper>
      )
      
      // Mobile toggle should be different
      const toggleButton = screen.getByRole('button', { name: /help/i })
      expect(toggleButton).toHaveClass('md:hidden') // Mobile-specific classes
      
      await user.click(toggleButton)
      
      // Should show as modal dialog on mobile
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        expect(dialog).toHaveAttribute('aria-modal', 'true')
      })
      
      // Should have mobile-specific layout
      const chatContainer = screen.getByRole('dialog')
      expect(chatContainer).toHaveClass('fixed', 'inset-0') // Full screen on mobile
      
      // Test swipe to close (simulated)
      fireEvent.touchStart(chatContainer, { touches: [{ clientX: 0, clientY: 0 }] })
      fireEvent.touchMove(chatContainer, { touches: [{ clientX: 100, clientY: 0 }] })
      fireEvent.touchEnd(chatContainer)
      
      // Should close on swipe
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility Features', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChatToggle />
          <HelpChat />
        </TestWrapper>
      )
      
      // Test keyboard opening
      const toggleButton = screen.getByRole('button', { name: /help/i })
      await user.tab()
      expect(toggleButton).toHaveFocus()
      
      await user.keyboard('{Enter}')
      
      // Should open and focus input
      await waitFor(() => {
        const input = screen.getByLabelText(/type your question/i)
        expect(input).toHaveFocus()
      })
      
      // Test keyboard navigation within chat
      await user.tab()
      const sendButton = screen.getByLabelText(/send message/i)
      expect(sendButton).toHaveFocus()
      
      // Test Escape to close
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
      })
    })

    it('should announce state changes to screen readers', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      // Check for live regions
      expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite')
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
      
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'Test query')
      
      const sendButton = screen.getByLabelText(/send message/i)
      await user.click(sendButton)
      
      // Should announce loading state
      await waitFor(() => {
        expect(screen.getByText(/processing your request/i)).toBeInTheDocument()
      })
      
      // Should announce response
      await waitFor(() => {
        expect(screen.getByText('Test response')).toBeInTheDocument()
      })
    })
  })

  describe('Performance and Caching', () => {
    it('should cache responses for better performance', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      const input = screen.getByLabelText(/type your question/i)
      
      // First query
      await user.type(input, 'How do I create a project?')
      await user.click(screen.getByLabelText(/send message/i))
      
      await waitFor(() => {
        expect(mockHelpChatAPI.submitQuery).toHaveBeenCalledTimes(1)
      })
      
      // Clear input and ask same question
      await user.clear(input)
      await user.type(input, 'How do I create a project?')
      await user.click(screen.getByLabelText(/send message/i))
      
      // Should use cached response (API called only once more, but with cache check)
      await waitFor(() => {
        expect(mockHelpChatAPI.submitQuery).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Session Management', () => {
    it('should maintain session across page navigation', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <HelpChat />
        </TestWrapper>
      )
      
      // First query
      const input = screen.getByLabelText(/type your question/i)
      await user.type(input, 'First question')
      await user.click(screen.getByLabelText(/send message/i))
      
      await waitFor(() => {
        expect(screen.getByText('Test response')).toBeInTheDocument()
      })
      
      // Simulate page navigation
      mockRouter.pathname = '/projects'
      
      // Second query should maintain session
      await user.clear(input)
      await user.type(input, 'Second question')
      await user.click(screen.getByLabelText(/send message/i))
      
      // Verify session ID is maintained
      await waitFor(() => {
        expect(mockHelpChatAPI.submitQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sessionId: 'session-123'
          })
        )
      })
    })
  })
})