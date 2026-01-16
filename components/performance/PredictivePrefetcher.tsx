'use client'

import { useSimplePredictivePrefetch } from '../../hooks/usePredictivePrefetch'

interface PredictivePrefetcherProps {
  enabled?: boolean
}

/**
 * Component that enables predictive route prefetching
 * Tracks user navigation patterns and prefetches likely next pages
 */
export default function PredictivePrefetcher({ enabled = true }: PredictivePrefetcherProps) {
  useSimplePredictivePrefetch(enabled)
  
  // This component doesn't render anything
  return null
}
