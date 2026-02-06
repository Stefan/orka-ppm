'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Camera, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  X, 
  ArrowRight, 
  ArrowDown, 
  ArrowUp, 
  ArrowLeft,
  MousePointer,
  Eye,
  Edit3,
  Check,
  AlertTriangle
} from 'lucide-react'
import { cn } from '../../lib/design-system'

// Types for visual guide system
export interface ScreenshotAnnotation {
  id: string
  type: 'arrow' | 'callout' | 'highlight' | 'click' | 'text'
  position: { x: number; y: number }
  size?: { width: number; height: number }
  content?: string
  direction?: 'up' | 'down' | 'left' | 'right'
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
}

export interface VisualGuideStep {
  id: string
  title: string
  description: string
  screenshot?: string
  annotations: ScreenshotAnnotation[]
  targetElement?: string
  action?: 'click' | 'type' | 'hover' | 'scroll' | 'wait'
  actionData?: any
  duration?: number
  isOptional?: boolean
}

export interface VisualGuide {
  id: string
  title: string
  description: string
  category: 'feature' | 'workflow' | 'troubleshooting' | 'onboarding'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number
  steps: VisualGuideStep[]
  prerequisites?: string[]
  tags: string[]
  version: string
  lastUpdated: Date
  isOutdated?: boolean
}

interface VisualGuideSystemProps {
  guide?: VisualGuide
  isInteractive?: boolean
  onComplete?: () => void
  onStepChange?: (stepIndex: number) => void
  className?: string
}

/**
 * Visual Guide System Component
 * Provides screenshot-based step-by-step guides with interactive overlays
 */
export function VisualGuideSystem({
  guide,
  isInteractive = false,
  onComplete,
  onStepChange,
  className
}: VisualGuideSystemProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  
  const containerRef = useRef<HTMLDivElement>(null)
  const screenshotRef = useRef<HTMLImageElement>(null)

  const currentStep = guide?.steps[currentStepIndex]

  // Auto-advance for interactive guides
  useEffect(() => {
    if (isPlaying && isInteractive && currentStep?.duration) {
      const timer = setTimeout(() => {
        nextStep()
      }, currentStep.duration * 1000)

      return () => clearTimeout(timer)
    }
    
    // Return cleanup function for when condition is not met
    return () => {}
  }, [currentStepIndex, isPlaying, isInteractive, currentStep])

  // Handle step navigation
  const nextStep = useCallback(() => {
    if (!guide) return

    if (currentStepIndex < guide.steps.length - 1) {
      const newIndex = currentStepIndex + 1
      setCurrentStepIndex(newIndex)
      onStepChange?.(newIndex)
      
      // Mark current step as completed
      setCompletedSteps(prev => new Set([...prev, currentStepIndex]))
    } else {
      // Guide completed
      setIsPlaying(false)
      setCompletedSteps(prev => new Set([...prev, currentStepIndex]))
      onComplete?.()
    }
  }, [currentStepIndex, guide, onStepChange, onComplete])

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1
      setCurrentStepIndex(newIndex)
      onStepChange?.(newIndex)
    }
  }, [currentStepIndex, onStepChange])

  const goToStep = useCallback((stepIndex: number) => {
    if (guide && stepIndex >= 0 && stepIndex < guide.steps.length) {
      setCurrentStepIndex(stepIndex)
      onStepChange?.(stepIndex)
    }
  }, [guide, onStepChange])

  // Handle play/pause
  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.()
      setIsFullscreen(true)
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [isFullscreen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!guide) return

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          previousStep()
          break
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen()
          }
          break
        case 'p':
        case 'P':
          if (isInteractive) {
            e.preventDefault()
            togglePlayback()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [guide, nextStep, previousStep, toggleFullscreen, togglePlayback, isFullscreen, isInteractive])

  if (!guide) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-slate-400">
        <div className="text-center">
          <Camera className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No visual guide available</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        'bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none border-none',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{guide.title}</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Step {currentStepIndex + 1} of {guide.steps.length}
            {guide.estimatedTime && (
              <span className="ml-2">• ~{guide.estimatedTime} min</span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {guide.isOutdated && (
            <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span>May be outdated</span>
            </div>
          )}
          
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={cn(
              'p-2 rounded-md transition-colors',
              showAnnotations 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
            )}
            title="Toggle annotations"
          >
            <Eye className="h-4 w-4" />
          </button>
          
          {isInteractive && (
            <button
              onClick={togglePlayback}
              className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-md hover:bg-blue-200 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentStepIndex + 1) / guide.steps.length) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row h-full">
        {/* Screenshot area */}
        <div className="flex-1 relative bg-gray-100 dark:bg-slate-700 min-h-[400px]">
          {currentStep?.screenshot ? (
            <div className="relative w-full h-full">
              <img
                ref={screenshotRef}
                src={currentStep.screenshot}
                alt={`Step ${currentStepIndex + 1}: ${currentStep.title}`}
                className="w-full h-full object-contain"
                style={{ aspectRatio: '16/9', minHeight: '400px' }}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              
              {/* Annotations overlay */}
              {showAnnotations && (
                <AnnotationOverlay 
                  annotations={currentStep.annotations}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-slate-400">
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Screenshot not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Step details sidebar */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="p-4 h-full flex flex-col">
            {/* Current step info */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                  {currentStep?.title}
                </h4>
                {currentStep?.isOptional && (
                  <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-1 rounded">
                    Optional
                  </span>
                )}
              </div>
              
              <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed">
                {currentStep?.description}
              </p>

              {/* Action indicator */}
              {currentStep?.action && (
                <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 mb-4">
                  <ActionIcon action={currentStep.action} />
                  <span className="ml-2 capitalize">
                    {currentStep.action} {currentStep.actionData?.text && `"${currentStep.actionData.text}"`}
                  </span>
                </div>
              )}

              {/* Step list */}
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">All Steps</h5>
                {guide.steps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={cn(
                      'w-full text-left p-2 rounded-md text-sm transition-colors',
                      index === currentStepIndex
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 border border-blue-200 dark:border-blue-800'
                        : completedSteps.has(index)
                        ? 'bg-green-50 text-green-800 dark:text-green-300 hover:bg-green-100 dark:bg-green-900/30'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700'
                    )}
                  >
                    <div className="flex items-center">
                      <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mr-3 text-xs">
                        {completedSteps.has(index) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="flex-1 truncate">{step.title}</span>
                      {step.isOptional && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">opt</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation controls */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={previousStep}
                  disabled={currentStepIndex === 0}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    currentStepIndex === 0
                      ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700'
                  )}
                >
                  <SkipBack className="h-4 w-4 mr-1" />
                  Previous
                </button>

                <button
                  onClick={nextStep}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {currentStepIndex === guide.steps.length - 1 ? (
                    <>
                      Complete
                      <Check className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next
                      <SkipForward className="h-4 w-4 ml-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Keyboard shortcuts hint */}
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-3 text-center">
                Use ← → arrow keys or spacebar to navigate
                {isInteractive && ' • P to play/pause'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Annotation Overlay Component
 * Renders visual annotations on top of screenshots
 */

function AnnotationOverlay({ annotations }: { annotations: ScreenshotAnnotation[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {annotations.map((annotation) => (
        <AnnotationElement
          key={annotation.id}
          annotation={annotation}
        />
      ))}
    </div>
  )
}

/**
 * Individual Annotation Element
 */

function AnnotationElement({ annotation }: { annotation: ScreenshotAnnotation }) {
  const { type, position, size, content, direction, color = '#3B82F6', style = 'solid' } = annotation

  const baseClasses = "absolute transition-all duration-300"
  const colorStyle = { color, borderColor: color, backgroundColor: `${color}20` }

  switch (type) {
    case 'arrow':
      return (
        <div
          className={cn(baseClasses, "flex items-center justify-center")}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)',
            ...colorStyle
          }}
        >
          <ArrowIcon direction={direction || 'right'} className="h-8 w-8" />
        </div>
      )

    case 'callout':
      return (
        <div
          className={cn(baseClasses, "bg-white dark:bg-slate-800 border-2 rounded-lg p-3 shadow-lg max-w-xs")}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -100%)',
            borderColor: color,
            borderStyle: style
          }}
        >
          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{content}</div>
          {/* Callout pointer */}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${color}`
            }}
          />
        </div>
      )

    case 'highlight':
      return (
        <div
          className={cn(baseClasses, "border-2 rounded")}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${size?.width || 10}%`,
            height: `${size?.height || 5}%`,
            borderColor: color,
            borderStyle: style,
            backgroundColor: `${color}20`
          }}
        />
      )

    case 'click':
      return (
        <div
          className={cn(baseClasses, "flex items-center justify-center")}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full border-2 animate-ping"
              style={{ borderColor: color }}
            />
            <MousePointer 
              className="absolute inset-0 h-6 w-6 m-1"
              style={{ color }}
            />
          </div>
        </div>
      )

    case 'text':
      return (
        <div
          className={cn(baseClasses, "bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm")}
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          {content}
        </div>
      )

    default:
      return null
  }
}

/**
 * Arrow Icon Component
 */
interface ArrowIconProps {
  direction: 'up' | 'down' | 'left' | 'right'
  className?: string
}

function ArrowIcon({ direction, className }: ArrowIconProps) {
  switch (direction) {
    case 'up':
      return <ArrowUp className={className} />
    case 'down':
      return <ArrowDown className={className} />
    case 'left':
      return <ArrowLeft className={className} />
    case 'right':
    default:
      return <ArrowRight className={className} />
  }
}

/**
 * Action Icon Component
 */
interface ActionIconProps {
  action: string
  className?: string
}

function ActionIcon({ action, className = "h-4 w-4" }: ActionIconProps) {
  switch (action) {
    case 'click':
      return <MousePointer className={className} />
    case 'type':
      return <Edit3 className={className} />
    case 'hover':
      return <Eye className={className} />
    case 'scroll':
      return <ArrowDown className={className} />
    case 'wait':
      return <Pause className={className} />
    default:
      return <MousePointer className={className} />
  }
}

export default VisualGuideSystem