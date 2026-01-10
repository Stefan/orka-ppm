'use client'

import { useState, useEffect, useCallback } from 'react'
import { OnboardingTour } from '../components/onboarding/OnboardingTour'

interface OnboardingProgress {
  tourId: string
  completedSteps: number[]
  isCompleted: boolean
  lastAccessedAt: Date
  completedAt?: Date
  skippedAt?: Date
}

interface UseOnboardingTourReturn {
  // Current tour state
  activeTour: OnboardingTour | null
  isActive: boolean
  currentStepIndex: number
  
  // Tour management
  startTour: (tour: OnboardingTour) => void
  completeTour: () => void
  skipTour: () => void
  pauseTour: () => void
  resumeTour: () => void
  
  // Progress tracking
  getProgress: (tourId: string) => OnboardingProgress | null
  getAllProgress: () => OnboardingProgress[]
  isTourCompleted: (tourId: string) => boolean
  shouldShowTour: (tour: OnboardingTour) => boolean
  
  // Personalization
  getRecommendedTours: (userRole?: string) => OnboardingTour[]
  markStepCompleted: (stepIndex: number) => void
}

// Default tours for different user roles
const DEFAULT_TOURS: OnboardingTour[] = [
  {
    id: 'first-time-user',
    title: 'Welcome to PPM Dashboard',
    description: 'Get started with the basics of project management',
    category: 'first-time',
    estimatedTime: 5,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome!',
        description: 'Welcome to your project management dashboard. Let\'s take a quick tour to get you started.',
        target: 'body',
        position: 'center',
        duration: 3000
      },
      {
        id: 'navigation',
        title: 'Navigation Menu',
        description: 'Use this sidebar to navigate between different sections of the application.',
        target: '[data-testid="sidebar"], nav[role="navigation"], .sidebar',
        position: 'right',
        actionDescription: 'Try clicking on different menu items to explore'
      },
      {
        id: 'dashboard',
        title: 'Your Dashboard',
        description: 'This is your main dashboard where you can see project overviews and key metrics.',
        target: '[data-testid="dashboard"], .dashboard, main',
        position: 'top',
        actionDescription: 'Scroll down to see more widgets and information'
      },
      {
        id: 'search',
        title: 'Smart Search',
        description: 'Use the search bar to quickly find projects, tasks, or any information you need.',
        target: '[data-testid="search"], input[type="search"], .search-bar',
        position: 'bottom',
        actionDescription: 'Try typing something to see intelligent suggestions'
      },
      {
        id: 'help',
        title: 'Get Help Anytime',
        description: 'Click the help button to access our AI assistant for instant support.',
        target: '[data-testid="help-chat"], .help-chat-toggle, button[aria-label*="help"]',
        position: 'left',
        actionDescription: 'Click to open the help chat and ask a question'
      }
    ],
    completionReward: 'You\'re all set! Enjoy using the dashboard.'
  },
  {
    id: 'project-manager-advanced',
    title: 'Advanced Project Management',
    description: 'Learn advanced features for project managers',
    category: 'workflow',
    userRole: ['project-manager', 'admin'],
    estimatedTime: 8,
    steps: [
      {
        id: 'resource-management',
        title: 'Resource Management',
        description: 'Learn how to optimize resource allocation using AI-powered suggestions.',
        target: '[href="/resources"], .resource-management',
        position: 'right',
        actionDescription: 'Navigate to the Resources page to see optimization features'
      },
      {
        id: 'risk-analysis',
        title: 'Risk Analysis',
        description: 'Use AI-powered risk analysis to identify and mitigate project risks early.',
        target: '[href="/risks"], .risk-management',
        position: 'right',
        actionDescription: 'Check out the risk dashboard for predictive insights'
      },
      {
        id: 'reporting',
        title: 'Advanced Reporting',
        description: 'Generate comprehensive reports and analytics for stakeholders.',
        target: '[href="/reports"], .reporting',
        position: 'right',
        actionDescription: 'Explore different report types and customization options'
      }
    ]
  },
  {
    id: 'mobile-features',
    title: 'Mobile Features Tour',
    description: 'Discover mobile-optimized features and gestures',
    category: 'feature',
    estimatedTime: 4,
    steps: [
      {
        id: 'touch-gestures',
        title: 'Touch Gestures',
        description: 'Use swipe gestures to interact with cards and lists on mobile devices.',
        target: '.swipeable-card, [data-swipeable="true"]',
        position: 'top',
        actionDescription: 'Try swiping left or right on cards to see actions'
      },
      {
        id: 'pull-refresh',
        title: 'Pull to Refresh',
        description: 'Pull down on lists to refresh data, just like in native mobile apps.',
        target: '.data-list, [data-pull-refresh="true"]',
        position: 'top',
        actionDescription: 'Pull down on any list to refresh the data'
      },
      {
        id: 'offline-mode',
        title: 'Offline Support',
        description: 'The app works offline and syncs your changes when you\'re back online.',
        target: '.offline-indicator, [data-testid="offline-indicator"]',
        position: 'bottom',
        optional: true
      }
    ]
  }
]

export function useOnboardingTour(): UseOnboardingTourReturn {
  const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [progressData, setProgressData] = useState<Record<string, OnboardingProgress>>({})

  // Load progress from localStorage on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('onboarding-progress')
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress)
        // Convert date strings back to Date objects
        const processedProgress: Record<string, OnboardingProgress> = {}
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          processedProgress[key] = {
            ...value,
            lastAccessedAt: new Date(value.lastAccessedAt),
            completedAt: value.completedAt ? new Date(value.completedAt) : undefined,
            skippedAt: value.skippedAt ? new Date(value.skippedAt) : undefined
          }
        })
        setProgressData(processedProgress)
      } catch (error) {
        console.warn('Failed to load onboarding progress:', error)
      }
    }
  }, [])

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('onboarding-progress', JSON.stringify(progressData))
  }, [progressData])

  const updateProgress = useCallback((tourId: string, updates: Partial<OnboardingProgress>) => {
    setProgressData(prev => ({
      ...prev,
      [tourId]: {
        ...prev[tourId],
        tourId,
        completedSteps: [],
        isCompleted: false,
        lastAccessedAt: new Date(),
        ...updates
      }
    }))
  }, [])

  const startTour = useCallback((tour: OnboardingTour) => {
    setActiveTour(tour)
    setCurrentStepIndex(0)
    setIsActive(true)
    updateProgress(tour.id, {
      lastAccessedAt: new Date()
    })
  }, [updateProgress])

  const completeTour = useCallback(() => {
    if (activeTour) {
      updateProgress(activeTour.id, {
        isCompleted: true,
        completedAt: new Date(),
        completedSteps: activeTour.steps.map((_, index) => index)
      })
    }
    setActiveTour(null)
    setIsActive(false)
    setCurrentStepIndex(0)
  }, [activeTour, updateProgress])

  const skipTour = useCallback(() => {
    if (activeTour) {
      updateProgress(activeTour.id, {
        skippedAt: new Date()
      })
    }
    setActiveTour(null)
    setIsActive(false)
    setCurrentStepIndex(0)
  }, [activeTour, updateProgress])

  const pauseTour = useCallback(() => {
    setIsActive(false)
  }, [])

  const resumeTour = useCallback(() => {
    setIsActive(true)
  }, [])

  const markStepCompleted = useCallback((stepIndex: number) => {
    if (activeTour) {
      const currentProgress = progressData[activeTour.id]
      const completedSteps = currentProgress?.completedSteps || []
      
      if (!completedSteps.includes(stepIndex)) {
        updateProgress(activeTour.id, {
          completedSteps: [...completedSteps, stepIndex]
        })
      }
    }
    setCurrentStepIndex(stepIndex)
  }, [activeTour, progressData, updateProgress])

  const getProgress = useCallback((tourId: string): OnboardingProgress | null => {
    return progressData[tourId] || null
  }, [progressData])

  const getAllProgress = useCallback((): OnboardingProgress[] => {
    return Object.values(progressData)
  }, [progressData])

  const isTourCompleted = useCallback((tourId: string): boolean => {
    return progressData[tourId]?.isCompleted || false
  }, [progressData])

  const shouldShowTour = useCallback((tour: OnboardingTour): boolean => {
    const progress = progressData[tour.id]
    
    // Don't show if completed or recently skipped
    if (progress?.isCompleted || progress?.skippedAt) {
      return false
    }

    // For first-time users, always show the welcome tour
    if (tour.category === 'first-time' && !progress) {
      return true
    }

    // For other tours, check if prerequisites are met
    if (tour.prerequisites) {
      return tour.prerequisites.every(prereqId => isTourCompleted(prereqId))
    }

    return true
  }, [progressData, isTourCompleted])

  const getRecommendedTours = useCallback((userRole?: string): OnboardingTour[] => {
    return DEFAULT_TOURS.filter(tour => {
      // Check if tour should be shown
      if (!shouldShowTour(tour)) {
        return false
      }

      // Check role-based filtering
      if (tour.userRole && userRole) {
        return tour.userRole.includes(userRole)
      }

      // Show general tours to all users
      return !tour.userRole || tour.userRole.length === 0
    }).sort((a, b) => {
      // Prioritize first-time tours
      if (a.category === 'first-time' && b.category !== 'first-time') return -1
      if (b.category === 'first-time' && a.category !== 'first-time') return 1
      
      // Then by estimated time (shorter first)
      return a.estimatedTime - b.estimatedTime
    })
  }, [shouldShowTour])

  return {
    // Current tour state
    activeTour,
    isActive,
    currentStepIndex,
    
    // Tour management
    startTour,
    completeTour,
    skipTour,
    pauseTour,
    resumeTour,
    
    // Progress tracking
    getProgress,
    getAllProgress,
    isTourCompleted,
    shouldShowTour,
    
    // Personalization
    getRecommendedTours,
    markStepCompleted
  }
}

export default useOnboardingTour