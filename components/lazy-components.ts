/**
 * Lazy-loaded components for code splitting
 * This file centralizes all dynamic imports for better bundle optimization
 */

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

// Chart Components (recharts is heavy ~400KB)
export const LazyMobileOptimizedChart = dynamic(
  () => import('./charts/MobileOptimizedChart'),
  {
    loading: () => <LoadingFallback />,
    ssr: false // Charts don't need SSR
  }
)

export const LazyInteractiveChart = dynamic(
  () => import('./charts/InteractiveChart'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyRealTimeChart = dynamic(
  () => import('./charts/RealTimeChart'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyPMRChart = dynamic(
  () => import('./pmr/PMRChart'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// PMR Editor (TipTap is heavy ~500KB with all extensions)
export const LazyPMREditor = dynamic(
  () => import('./pmr/PMREditor'),
  {
    loading: () => <LoadingFallback />,
    ssr: false // Rich text editor doesn't need SSR
  }
)

// AI Components
export const LazyAIResourceOptimizer = dynamic(
  () => import('./ai/AIResourceOptimizer'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyAIRiskManagement = dynamic(
  () => import('./ai/AIRiskManagement'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyPredictiveAnalyticsDashboard = dynamic(
  () => import('./ai/PredictiveAnalyticsDashboard'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyFloatingAIAssistant = dynamic(
  () => import('./ai/FloatingAIAssistant'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// PMR Components
export const LazyAIInsightsPanel = dynamic(
  () => import('./pmr/AIInsightsPanel'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyCollaborationPanel = dynamic(
  () => import('./pmr/CollaborationPanel'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazyMonteCarloAnalysisComponent = dynamic(
  () => import('./pmr/MonteCarloAnalysisComponent'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Monte Carlo Visualization (heavy computation)
export const LazyMonteCarloVisualization = dynamic(
  () => import('./MonteCarloVisualization'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Adaptive Dashboard (complex UI)
export const LazyAdaptiveDashboard = dynamic(
  () => import('./ui/organisms/AdaptiveDashboard').then(mod => ({ default: mod.AdaptiveDashboard })),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Help Chat (markdown rendering is heavy)
export const LazyHelpChat = dynamic(
  () => import('./HelpChat'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Device Management
export const LazyDeviceManager = dynamic(
  () => import('./device-management/DeviceManager'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazySessionRestoration = dynamic(
  () => import('./device-management/SessionRestoration'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Offline Components
export const LazyOfflineSyncStatus = dynamic(
  () => import('./offline/OfflineSyncStatus'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

export const LazySyncConflictResolver = dynamic(
  () => import('./offline/SyncConflictResolver'),
  {
    loading: () => <LoadingFallback />,
    ssr: false
  }
)

// Type exports for better TypeScript support
export type LazyComponentType<P = {}> = ComponentType<P>
