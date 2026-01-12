'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  BookOpen, 
  Camera, 
  Play, 
  Search, 
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  User,
  Tag
} from 'lucide-react'
import { cn } from '../../lib/design-system'
import { VisualGuideSystem, type VisualGuide } from './VisualGuideSystem'
import { screenshotService, VisualGuideBuilder } from '../../lib/screenshot-service'

// Types
interface VisualGuideManagerProps {
  onGuideSelect?: (guide: VisualGuide) => void
  onGuideComplete?: (guide: VisualGuide) => void
  currentContext?: {
    route: string
    pageTitle: string
    userRole: string
  }
  className?: string
}

interface GuideFilter {
  category?: VisualGuide['category']
  difficulty?: VisualGuide['difficulty']
  tags?: string[]
  searchQuery?: string
  showOutdated?: boolean
}

/**
 * Visual Guide Manager Component
 * Manages visual guides, creation, and integration with help chat
 */
export function VisualGuideManager({
  onGuideSelect,
  onGuideComplete,
  currentContext,
  className
}: VisualGuideManagerProps) {
  const [guides, setGuides] = useState<VisualGuide[]>([])
  const [selectedGuide, setSelectedGuide] = useState<VisualGuide | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<GuideFilter>({})
  const [view, setView] = useState<'list' | 'grid' | 'player'>('list')

  // Load guides on mount
  useEffect(() => {
    loadGuides()
  }, [])

  // Filter guides based on current context
  useEffect(() => {
    if (currentContext) {
      // Auto-filter guides relevant to current page
      const contextTags = [
        currentContext.route.split('/')[1], // First path segment
        currentContext.userRole,
        'general'
      ].filter(Boolean) as string[]

      setFilter(prev => ({
        ...prev,
        tags: contextTags
      }))
    }
  }, [currentContext])

  const loadGuides = useCallback(async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would load from API
      const mockGuides = await generateMockGuides()
      setGuides(mockGuides)
    } catch (error) {
      console.error('Failed to load guides:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const filteredGuides = guides.filter(guide => {
    // Search query filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      const matchesTitle = guide.title.toLowerCase().includes(query)
      const matchesDescription = guide.description.toLowerCase().includes(query)
      const matchesTags = guide.tags.some(tag => tag.toLowerCase().includes(query))
      
      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false
      }
    }

    // Category filter
    if (filter.category && guide.category !== filter.category) {
      return false
    }

    // Difficulty filter
    if (filter.difficulty && guide.difficulty !== filter.difficulty) {
      return false
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some(tag => 
        guide.tags.some(guideTag => guideTag.toLowerCase().includes(tag.toLowerCase()))
      )
      if (!hasMatchingTag) {
        return false
      }
    }

    // Outdated filter
    if (!filter.showOutdated && guide.isOutdated) {
      return false
    }

    return true
  })

  const handleGuideSelect = useCallback((guide: VisualGuide) => {
    setSelectedGuide(guide)
    setView('player')
    onGuideSelect?.(guide)
  }, [onGuideSelect])

  const handleGuideComplete = useCallback((guide: VisualGuide) => {
    onGuideComplete?.(guide)
    setSelectedGuide(null)
    setView('list')
  }, [onGuideComplete])

  const handleCreateGuide = useCallback(async () => {
    setIsCreating(true)
    try {
      // Create a new guide based on current context
      const builder = new VisualGuideBuilder(screenshotService)
        .startGuide(
          `How to use ${currentContext?.pageTitle || 'this feature'}`,
          `Step-by-step guide for ${currentContext?.pageTitle || 'this feature'}`,
          'feature'
        )
        .setDifficulty('beginner')
        .setEstimatedTime(5)
        .addTags(currentContext?.route.split('/')[1] || 'general')

      // Add a sample step
      await builder.addStep(
        'Getting Started',
        'Click on the main action button to begin',
        {
          captureScreenshot: true,
          element: 'button[type="submit"], .btn-primary, [role="button"]',
          action: 'click'
        }
      )

      const newGuide = builder.build()
      
      // Convert to the expected format
      const convertedGuide: VisualGuide = {
        ...newGuide,
        lastUpdated: newGuide.updatedAt,
        category: newGuide.category as 'feature' | 'workflow' | 'troubleshooting' | 'onboarding',
        steps: newGuide.steps.map(step => ({
          id: step.id,
          title: step.title,
          description: step.description,
          ...(step.screenshot?.dataUrl && { screenshot: step.screenshot.dataUrl }),
          annotations: [],
          ...(step.element && { targetElement: step.element }),
          ...(step.action && { action: step.action }),
          actionData: step.text ? { text: step.text } : undefined,
          ...(step.duration && { duration: step.duration }),
          isOptional: false
        }))
      }
      
      setGuides(prev => [convertedGuide, ...prev])
      setSelectedGuide(convertedGuide)
      setView('player')
    } catch (error) {
      console.error('Failed to create guide:', error)
    } finally {
      setIsCreating(false)
    }
  }, [currentContext])

  const handleDeleteGuide = useCallback(async (guideId: string) => {
    if (confirm('Are you sure you want to delete this guide?')) {
      setGuides(prev => prev.filter(g => g.id !== guideId))
      if (selectedGuide?.id === guideId) {
        setSelectedGuide(null)
        setView('list')
      }
    }
  }, [selectedGuide])

  const handleRefreshGuide = useCallback(async (guide: VisualGuide) => {
    try {
      // For now, just return the guide as-is with updated timestamp
      // In a real implementation, you might regenerate screenshots
      const refreshedGuide = { ...guide, lastUpdated: new Date() }

      setGuides(prev => prev.map(g => g.id === guide.id ? refreshedGuide : g))
      
      if (selectedGuide?.id === guide.id) {
        setSelectedGuide(refreshedGuide)
      }
    } catch (error) {
      console.error('Failed to refresh guide:', error)
    }
  }, [selectedGuide])

  if (view === 'player' && selectedGuide) {
    return (
      <div className={cn('h-full', className)}>
        <VisualGuideSystem
          guide={selectedGuide}
          isInteractive={true}
          onComplete={() => handleGuideComplete(selectedGuide)}
          onStepChange={(stepIndex) => {
            // Track step progress
            console.log(`Guide ${selectedGuide.id} - Step ${stepIndex + 1}`)
          }}
        />
        
        {/* Back button */}
        <button
          onClick={() => {
            setSelectedGuide(null)
            setView('list')
          }}
          className="absolute top-4 left-4 p-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors z-10"
        >
          ← Back to Guides
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Visual Guides</h2>
            <p className="text-sm text-gray-600">
              {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCreateGuide}
            disabled={isCreating}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Guide
          </button>

          <button
            onClick={() => setView(view === 'list' ? 'grid' : 'list')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            {view === 'list' ? '⊞' : '☰'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search guides..."
                value={filter.searchQuery || ''}
                onChange={(e) => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Category filter */}
          <select
            value={filter.category || ''}
            onChange={(e) => setFilter(prev => ({ 
              ...prev, 
              category: e.target.value as VisualGuide['category'] || undefined 
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            <option value="feature">Features</option>
            <option value="workflow">Workflows</option>
            <option value="troubleshooting">Troubleshooting</option>
            <option value="onboarding">Onboarding</option>
          </select>

          {/* Difficulty filter */}
          <select
            value={filter.difficulty || ''}
            onChange={(e) => setFilter(prev => ({ 
              ...prev, 
              difficulty: e.target.value as VisualGuide['difficulty'] || undefined 
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Show outdated toggle */}
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={filter.showOutdated || false}
              onChange={(e) => setFilter(prev => ({ ...prev, showOutdated: e.target.checked }))}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show outdated
          </label>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredGuides.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No guides found</h3>
            <p className="text-gray-600 mb-4">
              {guides.length === 0 
                ? "No visual guides have been created yet."
                : "No guides match your current filters."
              }
            </p>
            <button
              onClick={handleCreateGuide}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Guide
            </button>
          </div>
        ) : (
          <div className={cn(
            view === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          )}>
            {filteredGuides.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                view={view === 'player' ? 'list' : view}
                onSelect={() => handleGuideSelect(guide)}
                onDelete={() => handleDeleteGuide(guide.id)}
                onRefresh={() => handleRefreshGuide(guide)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Guide Card Component
 */
interface GuideCardProps {
  guide: VisualGuide
  view: 'list' | 'grid'
  onSelect: () => void
  onDelete: () => void
  onRefresh: () => void
}

function GuideCard({ guide, view, onSelect, onDelete, onRefresh }: GuideCardProps) {
  const isGrid = view === 'grid'

  return (
    <div className={cn(
      'border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow',
      isGrid ? 'p-4' : 'p-3'
    )}>
      <div className={cn(
        'flex',
        isGrid ? 'flex-col space-y-3' : 'items-center space-x-4'
      )}>
        {/* Thumbnail */}
        <div className={cn(
          'flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center',
          isGrid ? 'w-full h-32' : 'w-16 h-16'
        )}>
          {guide.steps[0]?.screenshot ? (
            <img
              src={guide.steps[0].screenshot}
              alt={guide.title}
              className="w-full h-full object-cover rounded-md"
              width={isGrid ? "100%" : "64"}
              height={isGrid ? "128" : "64"}
              style={{ aspectRatio: isGrid ? '16/9' : '1/1' }}
              loading="lazy"
            />
          ) : (
            <Camera className={cn(
              'text-gray-400',
              isGrid ? 'h-8 w-8' : 'h-6 w-6'
            )} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={cn(
                'font-medium text-gray-900 truncate',
                isGrid ? 'text-base' : 'text-sm'
              )}>
                {guide.title}
                {guide.isOutdated && (
                  <AlertTriangle className="inline h-4 w-4 text-amber-500 ml-2" />
                )}
              </h3>
              
              <p className={cn(
                'text-gray-600 mt-1',
                isGrid ? 'text-sm line-clamp-2' : 'text-xs truncate'
              )}>
                {guide.description}
              </p>

              {/* Metadata */}
              <div className={cn(
                'flex items-center text-xs text-gray-500 mt-2',
                isGrid ? 'flex-wrap gap-2' : 'space-x-3'
              )}>
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {guide.estimatedTime} min
                </span>
                
                <span className="flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  {guide.difficulty}
                </span>
                
                <span className="flex items-center">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {guide.steps.length} steps
                </span>

                {guide.category && (
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    guide.category === 'feature' && 'bg-blue-100 text-blue-800',
                    guide.category === 'workflow' && 'bg-green-100 text-green-800',
                    guide.category === 'troubleshooting' && 'bg-red-100 text-red-800',
                    guide.category === 'onboarding' && 'bg-purple-100 text-purple-800'
                  )}>
                    {guide.category}
                  </span>
                )}
              </div>

              {/* Tags */}
              {guide.tags.length > 0 && (
                <div className={cn(
                  'flex flex-wrap gap-1 mt-2',
                  !isGrid && 'hidden sm:flex'
                )}>
                  {guide.tags.slice(0, isGrid ? 4 : 2).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                  {guide.tags.length > (isGrid ? 4 : 2) && (
                    <span className="text-xs text-gray-500">
                      +{guide.tags.length - (isGrid ? 4 : 2)} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className={cn(
              'flex items-center',
              isGrid ? 'mt-3 justify-between w-full' : 'space-x-2 ml-4'
            )}>
              <button
                onClick={onSelect}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </button>

              <div className="flex items-center space-x-1">
                <button
                  onClick={onRefresh}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="Refresh screenshots"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>

                <button
                  onClick={onDelete}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete guide"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Generate mock guides for demonstration
 */
async function generateMockGuides(): Promise<VisualGuide[]> {
  const mockGuides: VisualGuide[] = [
    {
      id: 'guide-1',
      title: 'Creating Your First Project',
      description: 'Learn how to create and set up a new project in the PPM platform',
      category: 'onboarding',
      difficulty: 'beginner',
      estimatedTime: 5,
      steps: [
        {
          id: 'step-1',
          title: 'Navigate to Projects',
          description: 'Click on the Projects menu item in the sidebar',
          annotations: [
            {
              id: 'nav-highlight',
              type: 'highlight',
              position: { x: 10, y: 30 },
              size: { width: 20, height: 8 },
              content: 'Projects menu'
            }
          ],
          targetElement: 'nav a[href="/projects"]',
          action: 'click'
        },
        {
          id: 'step-2',
          title: 'Click New Project',
          description: 'Click the "New Project" button to start creating a project',
          annotations: [
            {
              id: 'button-highlight',
              type: 'click',
              position: { x: 80, y: 20 },
              content: 'Click here'
            }
          ],
          targetElement: 'button[data-testid="new-project"]',
          action: 'click'
        }
      ],
      tags: ['projects', 'getting-started', 'beginner'],
      version: '1.0.0',
      lastUpdated: new Date(),
      prerequisites: ['Account setup completed']
    },
    {
      id: 'guide-2',
      title: 'Managing Project Resources',
      description: 'How to assign and manage resources for your projects',
      category: 'feature',
      difficulty: 'intermediate',
      estimatedTime: 8,
      steps: [
        {
          id: 'step-1',
          title: 'Open Resource Management',
          description: 'Navigate to the resource management section',
          annotations: [],
          targetElement: '.resource-section',
          action: 'click'
        }
      ],
      tags: ['resources', 'management', 'projects'],
      version: '1.0.0',
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      isOutdated: true
    }
  ]

  return mockGuides
}

export default VisualGuideManager