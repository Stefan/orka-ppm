'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  MessageCircle, 
  X, 
  Lightbulb, 
  AlertCircle,
  HelpCircle,
  Zap,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { cn } from '../../lib/utils/design-system'
import { useHelpChat } from '../../app/providers/HelpChatProvider'

interface AIInsight {
  id: string
  type: 'tip' | 'warning' | 'suggestion' | 'help'
  title: string
  message: string
  context: string // Current page/feature context
  priority: 'low' | 'medium' | 'high'
  actionable?: {
    label: string
    action: () => void
  }
  dismissible: boolean
  timestamp: Date
}

interface UserStruggleIndicators {
  repeatedClicks: number
  timeOnPage: number
  errorEncounters: number
  helpSearches: string[]
  lastActivity: Date
}

export interface FloatingAIAssistantProps {
  isEnabled?: boolean
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  proactiveThreshold?: number // Time in ms before showing proactive help
  className?: string
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  isEnabled = true,
  position = 'bottom-right',
  proactiveThreshold = 30000, // 30 seconds
  className
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentInsights, setCurrentInsights] = useState<AIInsight[]>([])
  const [userStruggle, setUserStruggle] = useState<UserStruggleIndicators>({
    repeatedClicks: 0,
    timeOnPage: 0,
    errorEncounters: 0,
    helpSearches: [],
    lastActivity: new Date()
  })
  const [currentContext, setCurrentContext] = useState<string>('')
  
  const { sendMessage } = useHelpChat()
  const pageStartTime = useRef(Date.now())
  const proactiveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Detect current page context
  useEffect(() => {
    const path = window.location.pathname
    const contextMap: Record<string, string> = {
      '/': 'dashboard',
      '/resources': 'resource-management',
      '/risks': 'risk-management',
      '/reports': 'reporting',
      '/scenarios': 'scenario-planning',
      '/monte-carlo': 'monte-carlo-simulation',
      '/changes': 'change-management',
      '/dashboards': 'dashboard-management'
    }
    
    setCurrentContext(contextMap[path] || 'general')
  }, [])

  // Track user activity and struggle indicators
  useEffect(() => {
    if (!isEnabled) return

    let clickCount = 0
    let lastClickTarget: Element | null = null
    let lastClickTime = 0

    const trackClick = (e: MouseEvent) => {
      const now = Date.now()
      const target = e.target as Element
      
      // Detect repeated clicks on same element
      if (target === lastClickTarget && now - lastClickTime < 1000) {
        clickCount++
        if (clickCount >= 3) {
          setUserStruggle(prev => ({
            ...prev,
            repeatedClicks: prev.repeatedClicks + 1,
            lastActivity: new Date()
          }))
        }
      } else {
        clickCount = 1
        lastClickTarget = target
      }
      lastClickTime = now

      // Reset proactive timer on activity
      if (proactiveTimeoutRef.current) {
        clearTimeout(proactiveTimeoutRef.current)
      }
      proactiveTimeoutRef.current = setTimeout(() => {
        checkForProactiveHelp()
      }, proactiveThreshold)
    }

    const trackError = () => {
      setUserStruggle(prev => ({
        ...prev,
        errorEncounters: prev.errorEncounters + 1,
        lastActivity: new Date()
      }))
    }

    // Track time on page
    const updateTimeOnPage = () => {
      setUserStruggle(prev => ({
        ...prev,
        timeOnPage: Date.now() - pageStartTime.current,
        lastActivity: new Date()
      }))
    }

    document.addEventListener('click', trackClick)
    window.addEventListener('error', trackError)
    
    const timeInterval = setInterval(updateTimeOnPage, 5000)

    return () => {
      document.removeEventListener('click', trackClick)
      window.removeEventListener('error', trackError)
      clearInterval(timeInterval)
      if (proactiveTimeoutRef.current) {
        clearTimeout(proactiveTimeoutRef.current)
      }
    }
  }, [isEnabled, proactiveThreshold])

  // Generate contextual insights based on current page and user behavior
  const generateContextualInsights = useCallback((): AIInsight[] => {
    const insights: AIInsight[] = []
    const now = new Date()

    // Context-specific tips
    const contextTips: Record<string, AIInsight[]> = {
      'dashboard': [
        {
          id: 'dashboard-customization',
          type: 'tip',
          title: 'Customize Your Dashboard',
          message: 'You can drag and drop widgets to rearrange your dashboard layout. Try it!',
          context: 'dashboard',
          priority: 'medium',
          dismissible: true,
          timestamp: now,
          actionable: {
            label: 'Show me how',
            action: () => {
              // Trigger dashboard customization tour
              console.log('Starting dashboard customization tour')
            }
          }
        }
      ],
      'resource-management': [
        {
          id: 'ai-optimization',
          type: 'suggestion',
          title: 'AI Resource Optimization',
          message: 'I notice you\'re viewing resources. Would you like me to analyze optimization opportunities?',
          context: 'resource-management',
          priority: 'high',
          dismissible: true,
          timestamp: now,
          actionable: {
            label: 'Analyze now',
            action: () => {
              sendMessage('Analyze resource optimization opportunities for current projects')
            }
          }
        }
      ],
      'risk-management': [
        {
          id: 'risk-patterns',
          type: 'suggestion',
          title: 'Risk Pattern Analysis',
          message: 'I can help identify risk patterns in your projects. Want me to run an analysis?',
          context: 'risk-management',
          priority: 'high',
          dismissible: true,
          timestamp: now,
          actionable: {
            label: 'Run analysis',
            action: () => {
              sendMessage('Analyze risk patterns in current projects and suggest mitigation strategies')
            }
          }
        }
      ]
    }

    // Add context-specific insights
    if (contextTips[currentContext]) {
      insights.push(...contextTips[currentContext])
    }

    // Struggle-based insights
    if (userStruggle.repeatedClicks > 2) {
      insights.push({
        id: 'repeated-clicks-help',
        type: 'help',
        title: 'Need Help?',
        message: 'I noticed you\'re clicking repeatedly. Can I help you find what you\'re looking for?',
        context: currentContext,
        priority: 'high',
        dismissible: true,
        timestamp: now,
        actionable: {
          label: 'Get help',
          action: () => {
            setIsVisible(true)
            setIsMinimized(false)
          }
        }
      })
    }

    if (userStruggle.timeOnPage > 60000 && userStruggle.timeOnPage < 120000) { // 1-2 minutes
      insights.push({
        id: 'extended-time-tip',
        type: 'tip',
        title: 'Quick Tip',
        message: 'Taking your time to explore? Use Ctrl+K to quickly search for any feature.',
        context: currentContext,
        priority: 'low',
        dismissible: true,
        timestamp: now
      })
    }

    if (userStruggle.errorEncounters > 0) {
      insights.push({
        id: 'error-recovery',
        type: 'warning',
        title: 'Error Recovery',
        message: 'I noticed some errors occurred. Would you like help troubleshooting?',
        context: currentContext,
        priority: 'high',
        dismissible: true,
        timestamp: now,
        actionable: {
          label: 'Get help',
          action: () => {
            sendMessage('Help me troubleshoot recent errors')
          }
        }
      })
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }, [currentContext, userStruggle, sendMessage])

  // Check for proactive help opportunities
  const checkForProactiveHelp = useCallback(() => {
    const insights = generateContextualInsights()
    if (insights.length > 0) {
      setCurrentInsights(insights)
      setIsVisible(true)
    }
  }, [generateContextualInsights])

  // Dismiss insight
  const dismissInsight = useCallback((insightId: string) => {
    setCurrentInsights(prev => prev.filter(insight => insight.id !== insightId))
  }, [])

  // Get icon for insight type
  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'tip':
        return Lightbulb
      case 'warning':
        return AlertCircle
      case 'suggestion':
        return Zap
      case 'help':
      default:
        return HelpCircle
    }
  }

  // Get color classes for insight type
  const getInsightColors = (type: AIInsight['type']) => {
    switch (type) {
      case 'tip':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'suggestion':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'help':
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'top-left':
        return 'top-4 left-4'
      case 'bottom-right':
      default:
        return 'bottom-4 right-4'
    }
  }

  if (!isEnabled || currentInsights.length === 0) return null

  return (
    <div
      className={cn(
        "fixed z-50 max-w-sm transition-all duration-300",
        getPositionClasses(),
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
        className
      )}
    >
      {/* Main Assistant Card */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-100 rounded-full">
              <MessageCircle className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={isMinimized ? "Expand assistant" : "Minimize assistant"}
            >
              {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="max-h-96 overflow-y-auto">
            {currentInsights.map((insight, index) => {
              const Icon = getInsightIcon(insight.type)
              const colors = getInsightColors(insight.type)
              
              return (
                <div
                  key={insight.id}
                  className={cn(
                    "p-4 border-l-4",
                    colors,
                    index < currentInsights.length - 1 && "border-b border-gray-100"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium mb-1">
                        {insight.title}
                      </h4>
                      <p className="text-sm opacity-90 mb-3">
                        {insight.message}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div>
                          {insight.actionable && (
                            <button
                              onClick={insight.actionable.action}
                              className="text-sm font-medium underline hover:no-underline transition-all"
                            >
                              {insight.actionable.label}
                            </button>
                          )}
                        </div>
                        
                        {insight.dismissible && (
                          <button
                            onClick={() => dismissInsight(insight.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => {
              // Open main help chat
              setIsVisible(false)
              // Trigger help chat opening logic here
            }}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Open Full Chat</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FloatingAIAssistant