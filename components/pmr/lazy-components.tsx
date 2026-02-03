/**
 * Lazy Loading Configuration for Enhanced PMR Components
 * Implements code splitting and dynamic imports for performance optimization
 */

import React from 'react'
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

// ============================================================================
// Loading Components
// ============================================================================

/**
 * Default loading component for lazy-loaded components
 */
export const DefaultLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">Loading...</span>
  </div>
)

/**
 * Section loading skeleton
 */
export const SectionLoader = () => (
  <div className="animate-pulse space-y-4 p-4">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    <div className="h-32 bg-gray-200 rounded"></div>
  </div>
)

/**
 * Chart loading skeleton
 */
export const ChartLoader = () => (
  <div className="animate-pulse p-4">
    <div className="h-64 bg-gray-200 rounded"></div>
  </div>
)

/**
 * Panel loading skeleton
 */
export const PanelLoader = () => (
  <div className="animate-pulse space-y-3 p-4">
    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      <div className="h-4 bg-gray-200 rounded w-4/6"></div>
    </div>
  </div>
)

// ============================================================================
// Lazy-Loaded PMR Components
// ============================================================================

/**
 * PMR Editor - Main editing interface
 * Heavy component with rich text editing capabilities
 */
export const LazyPMREditor = dynamic(
  () => import('./PMREditor').then(mod => mod.PMREditor),
  {
    loading: () => <DefaultLoader />,
    ssr: false // Disable SSR for editor
  }
)

/**
 * AI Insights Panel - AI-generated insights display
 * Loaded on-demand when user opens insights panel
 */
export const LazyAIInsightsPanel = dynamic(
  () => import('./AIInsightsPanel').then(mod => mod.AIInsightsPanel),
  {
    loading: () => <PanelLoader />,
    ssr: true
  }
)

/**
 * Collaboration Panel - Real-time collaboration features
 * Loaded when collaboration is enabled
 */
export const LazyCollaborationPanel = dynamic(
  () => import('./CollaborationPanel').then(mod => mod.CollaborationPanel),
  {
    loading: () => <PanelLoader />,
    ssr: false // Real-time features don't need SSR
  }
)

/**
 * Monte Carlo Analysis Component - Simulation interface
 * Heavy component with complex visualizations
 */
export const LazyMonteCarloAnalysis = dynamic(
  () => import('./MonteCarloAnalysisComponent').then(mod => mod.MonteCarloAnalysisComponent),
  {
    loading: () => <ChartLoader />,
    ssr: false // Complex calculations don't need SSR
  }
)

/**
 * PMR Export Manager - Export configuration interface
 * Loaded when user initiates export
 */
export const LazyPMRExportManager = dynamic(
  () => import('./PMRExportManager').then(mod => mod.PMRExportManager),
  {
    loading: () => <DefaultLoader />,
    ssr: false
  }
)

/**
 * PMR Template Selector - Template selection interface
 * Loaded during report creation
 */
export const LazyPMRTemplateSelector = dynamic(
  () => import('./PMRTemplateSelector').then(mod => mod.PMRTemplateSelector),
  {
    loading: () => <DefaultLoader />,
    ssr: true
  }
)

/**
 * Interactive Chart - Enhanced chart component
 * Loaded per section as needed
 */
export const LazyInteractiveChart = dynamic(
  () => import('../charts/InteractiveChart').then(mod => mod.InteractiveChart),
  {
    loading: () => <ChartLoader />,
    ssr: false // Charts don't need SSR
  }
)

// ============================================================================
// Section-Based Lazy Loading
// ============================================================================

/**
 * Lazy load a PMR section component
 * Sections are loaded on-demand as user scrolls or navigates
 */
export function lazyLoadSection(sectionType: string): ComponentType<any> {
  return dynamic(
    () => import(`./sections/${sectionType}Section`).then(mod => mod.default),
    {
      loading: () => <SectionLoader />,
      ssr: true
    }
  )
}

/**
 * Preload a component for better UX
 * Call this when user is likely to need the component soon
 */
export async function preloadComponent(componentName: string): Promise<void> {
  try {
    switch (componentName) {
      case 'editor':
        await import('./PMREditor')
        break
      case 'insights':
        await import('./AIInsightsPanel')
        break
      case 'collaboration':
        await import('./CollaborationPanel')
        break
      case 'monte-carlo':
        await import('./MonteCarloAnalysisComponent')
        break
      case 'export':
        await import('./PMRExportManager')
        break
      case 'templates':
        await import('./PMRTemplateSelector')
        break
      default:
        console.warn(`Unknown component for preload: ${componentName}`)
    }
  } catch (error) {
    console.error(`Failed to preload component ${componentName}:`, error)
  }
}

/**
 * Preload multiple components in parallel
 */
export async function preloadComponents(componentNames: string[]): Promise<void> {
  await Promise.all(componentNames.map(name => preloadComponent(name)))
}

// ============================================================================
// Intersection Observer for Lazy Loading
// ============================================================================

/**
 * Hook for lazy loading components when they enter viewport
 */
export function useLazyLoadOnView(
  ref: React.RefObject<HTMLElement>,
  onVisible: () => void,
  options: IntersectionObserverInit = {}
) {
  const [hasLoaded, setHasLoaded] = React.useState(false)

  React.useEffect(() => {
    if (hasLoaded || !ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            onVisible()
            setHasLoaded(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Load 50px before entering viewport
        threshold: 0.1,
        ...options
      }
    )

    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [ref, onVisible, hasLoaded, options])

  return hasLoaded
}

// ============================================================================
// Progressive Loading Strategy
// ============================================================================

/**
 * Load components in priority order
 * Critical components load first, then nice-to-have features
 */
export async function progressiveLoadPMRComponents(): Promise<void> {
  // Priority 1: Critical components (load immediately)
  await preloadComponents(['editor'])

  // Priority 2: Important components (load after 1 second)
  setTimeout(() => {
    preloadComponents(['insights', 'templates'])
  }, 1000)

  // Priority 3: Optional components (load after 3 seconds)
  setTimeout(() => {
    preloadComponents(['collaboration', 'export'])
  }, 3000)

  // Priority 4: Heavy components (load after 5 seconds or on-demand)
  setTimeout(() => {
    preloadComponents(['monte-carlo'])
  }, 5000)
}

// ============================================================================
// Bundle Size Optimization
// ============================================================================

/**
 * Get estimated bundle size for a component
 * Useful for monitoring and optimization
 */
export const COMPONENT_SIZES = {
  editor: '~150KB',
  insights: '~45KB',
  collaboration: '~35KB',
  'monte-carlo': '~120KB',
  export: '~40KB',
  templates: '~30KB',
  charts: '~80KB'
} as const

/**
 * Check if component should be lazy loaded based on size
 */
export function shouldLazyLoad(componentName: keyof typeof COMPONENT_SIZES): boolean {
  // Components over 50KB should be lazy loaded
  const sizeThreshold = 50
  const sizeStr = COMPONENT_SIZES[componentName]
  const sizeKB = parseInt(sizeStr.replace(/[^\d]/g, ''))
  
  return sizeKB > sizeThreshold
}

// ============================================================================
// Export All
// ============================================================================

export default {
  LazyPMREditor,
  LazyAIInsightsPanel,
  LazyCollaborationPanel,
  LazyMonteCarloAnalysis,
  LazyPMRExportManager,
  LazyPMRTemplateSelector,
  LazyInteractiveChart,
  lazyLoadSection,
  preloadComponent,
  preloadComponents,
  progressiveLoadPMRComponents,
  useLazyLoadOnView,
  shouldLazyLoad,
  COMPONENT_SIZES
}
