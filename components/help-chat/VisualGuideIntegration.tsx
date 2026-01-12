'use client'

import { useState, useCallback, useEffect } from 'react'
import { 
  BookOpen, 
  Camera, 
  ArrowRight,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { cn } from '../../lib/design-system'
import { VisualGuideSystem, type VisualGuide } from './VisualGuideSystem'
import { VisualGuideManager } from './VisualGuideManager'
import { ImageWithStabilizedLayout } from '../ui/LayoutStabilizer'
import type { ChatMessage, QuickAction } from '../../types/help-chat'

// Types
interface VisualGuideIntegrationProps {
  isOpen: boolean
  onClose: () => void
  currentContext?: {
    route: string
    pageTitle: string
    userRole: string
  }
  onGuideAction?: (action: QuickAction) => void
  className?: string
}

interface GuideRecommendation {
  guide: VisualGuide
  relevanceScore: number
  reason: string
}

/**
 * Visual Guide Integration Component
 * Integrates visual guides with the help chat system
 */
export function VisualGuideIntegration({
  isOpen,
  onClose,
  currentContext,
  onGuideAction,
  className
}: VisualGuideIntegrationProps) {
  const [currentView, setCurrentView] = useState<'manager' | 'player'>('manager')
  const [selectedGuide, setSelectedGuide] = useState<VisualGuide | null>(null)
  const [recommendations, setRecommendations] = useState<GuideRecommendation[]>([])
  const [isMinimized, setIsMinimized] = useState(false)

  // Load guide recommendations based on context
  useEffect(() => {
    if (currentContext && isOpen) {
      loadRecommendations(currentContext)
    }
  }, [currentContext, isOpen])

  const loadRecommendations = useCallback(async (context: typeof currentContext) => {
    if (!context) return

    try {
      // In a real implementation, this would call an API
      const mockRecommendations = await generateRecommendations(context)
      setRecommendations(mockRecommendations)
    } catch (error) {
      console.error('Failed to load guide recommendations:', error)
    }
  }, [])

  const handleGuideSelect = useCallback((guide: VisualGuide) => {
    setSelectedGuide(guide)
    setCurrentView('player')
  }, [])

  const handleGuideComplete = useCallback((guide: VisualGuide) => {
    // Track completion
    console.log('Guide completed:', guide.id)
    
    // Generate completion message for chat
    const completionAction: QuickAction = {
      id: `guide-completed-${guide.id}`,
      label: `✅ Completed: ${guide.title}`,
      action: () => {
        onGuideAction?.({
          id: 'guide-completion',
          label: 'Guide completed successfully!',
          action: () => {}
        })
      }
    }

    onGuideAction?.(completionAction)
    
    // Return to manager
    setSelectedGuide(null)
    setCurrentView('manager')
  }, [onGuideAction])

  const handleBackToManager = useCallback(() => {
    setSelectedGuide(null)
    setCurrentView('manager')
  }, [])

  if (!isOpen) {
    return null
  }

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4',
      className
    )}>
      <div className={cn(
        'bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col',
        isMinimized && 'max-h-16'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentView === 'player' && selectedGuide 
                  ? selectedGuide.title 
                  : 'Visual Guides'
                }
              </h2>
              {currentContext && (
                <p className="text-sm text-gray-600">
                  Context: {currentContext.pageTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {currentView === 'player' && (
              <button
                onClick={handleBackToManager}
                className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors text-sm"
              >
                ← Back to Guides
              </button>
            )}

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-hidden">
            {currentView === 'manager' ? (
              <div className="h-full flex flex-col">
                {/* Recommendations section */}
                {recommendations.length > 0 && (
                  <div className="border-b border-gray-200 bg-blue-50 p-4">
                    <h3 className="text-sm font-medium text-blue-900 mb-3">
                      Recommended for this page:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {recommendations.slice(0, 3).map((rec) => (
                        <RecommendationCard
                          key={rec.guide.id}
                          recommendation={rec}
                          onSelect={() => handleGuideSelect(rec.guide)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Guide manager */}
                <div className="flex-1">
                  <VisualGuideManager
                    onGuideSelect={handleGuideSelect}
                    onGuideComplete={handleGuideComplete}
                    currentContext={currentContext || { route: '', pageTitle: '', userRole: '' }}
                  />
                </div>
              </div>
            ) : (
              selectedGuide && (
                <VisualGuideSystem
                  guide={selectedGuide}
                  isInteractive={true}
                  onComplete={() => handleGuideComplete(selectedGuide)}
                  onStepChange={(stepIndex) => {
                    // Track step progress
                    console.log(`Guide ${selectedGuide.id} - Step ${stepIndex + 1}`)
                  }}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Recommendation Card Component
 */
interface RecommendationCardProps {
  recommendation: GuideRecommendation
  onSelect: () => void
}

function RecommendationCard({ recommendation, onSelect }: RecommendationCardProps) {
  const { guide, relevanceScore, reason } = recommendation

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
         onClick={onSelect}>
      <div className="flex items-start space-x-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
          {guide.steps[0]?.screenshot ? (
            <ImageWithStabilizedLayout
              src={guide.steps[0].screenshot}
              alt={guide.title}
              className="rounded-md"
              aspectRatio="1/1"
              fallbackHeight={48}
              fallbackWidth={48}
            />
          ) : (
            <Camera className="h-5 w-5 text-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {guide.title}
          </h4>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {reason}
          </p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center text-xs text-gray-500">
              <span>{guide.estimatedTime} min</span>
              <span className="mx-1">•</span>
              <span>{guide.steps.length} steps</span>
            </div>
            <div className="flex items-center text-xs text-blue-600">
              <span className="mr-1">{Math.round(relevanceScore * 100)}% match</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Generate guide recommendations based on context
 */
async function generateRecommendations(context: {
  route: string
  pageTitle: string
  userRole: string
}): Promise<GuideRecommendation[]> {
  // Mock recommendations based on context
  const mockGuides: VisualGuide[] = [
    {
      id: 'rec-1',
      title: `Getting Started with ${context.pageTitle}`,
      description: `Learn the basics of using ${context.pageTitle} effectively`,
      category: 'onboarding',
      difficulty: 'beginner',
      estimatedTime: 5,
      steps: [
        {
          id: 'step-1',
          title: 'Overview',
          description: 'Understanding the interface',
          annotations: []
        }
      ],
      tags: [context.route.split('/')[1] || 'general', 'getting-started'],
      version: '1.0.0',
      lastUpdated: new Date()
    },
    {
      id: 'rec-2',
      title: `Advanced ${context.pageTitle} Features`,
      description: `Explore advanced features and best practices`,
      category: 'feature',
      difficulty: 'intermediate',
      estimatedTime: 10,
      steps: [
        {
          id: 'step-1',
          title: 'Advanced Features',
          description: 'Using advanced functionality',
          annotations: []
        }
      ],
      tags: [context.route.split('/')[1] || 'general', 'advanced'],
      version: '1.0.0',
      lastUpdated: new Date()
    }
  ]

  // Calculate relevance scores
  const recommendations: GuideRecommendation[] = mockGuides.map(guide => {
    let relevanceScore = 0.5 // Base score

    // Route matching
    const routeSegment = context.route.split('/')[1]
    if (routeSegment && guide.tags.includes(routeSegment)) {
      relevanceScore += 0.3
    }

    // Role-based relevance
    if (context.userRole === 'admin' && guide.difficulty === 'advanced') {
      relevanceScore += 0.1
    } else if (context.userRole === 'user' && guide.difficulty === 'beginner') {
      relevanceScore += 0.1
    }

    // Page title matching
    if (guide.title.toLowerCase().includes(context.pageTitle.toLowerCase())) {
      relevanceScore += 0.2
    }

    return {
      guide,
      relevanceScore: Math.min(relevanceScore, 1.0),
      reason: `Recommended for ${context.pageTitle} users`
    }
  })

  // Sort by relevance score
  return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Hook for integrating visual guides with help chat
 */
export function useVisualGuideIntegration() {
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [currentGuide, setCurrentGuide] = useState<VisualGuide | null>(null)

  const openGuides = useCallback(() => {
    setIsGuideOpen(true)
  }, [])

  const closeGuides = useCallback(() => {
    setIsGuideOpen(false)
    setCurrentGuide(null)
  }, [])

  const selectGuide = useCallback((guide: VisualGuide) => {
    setCurrentGuide(guide)
    setIsGuideOpen(true)
  }, [])

  // Generate quick actions for chat integration
  const generateGuideActions = useCallback((context?: {
    route: string
    pageTitle: string
    userRole: string
  }): QuickAction[] => {
    const actions: QuickAction[] = [
      {
        id: 'open-visual-guides',
        label: '📖 Show Visual Guides',
        action: openGuides,
        icon: 'BookOpen'
      }
    ]

    if (context) {
      actions.push({
        id: 'context-guide',
        label: `🎯 Guide for ${context.pageTitle}`,
        action: openGuides,
        icon: 'Camera'
      })
    }

    return actions
  }, [openGuides])

  // Generate chat messages with guide suggestions
  const generateGuideSuggestions = useCallback((
    userQuery: string,
    context?: { route: string; pageTitle: string; userRole: string }
  ): ChatMessage[] => {
    const suggestions: ChatMessage[] = []

    // Check if user is asking for help that could benefit from visual guides
    const visualKeywords = ['how to', 'show me', 'guide', 'tutorial', 'step by step', 'walkthrough']
    const hasVisualKeyword = visualKeywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword)
    )

    if (hasVisualKeyword) {
      suggestions.push({
        id: `guide-suggestion-${Date.now()}`,
        type: 'system',
        content: `I can show you visual step-by-step guides! Would you like me to open the visual guide system?`,
        timestamp: new Date(),
        actions: generateGuideActions(context)
      })
    }

    return suggestions
  }, [generateGuideActions])

  return {
    isGuideOpen,
    currentGuide,
    openGuides,
    closeGuides,
    selectGuide,
    generateGuideActions,
    generateGuideSuggestions
  }
}

export default VisualGuideIntegration