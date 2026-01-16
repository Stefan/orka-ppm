/**
 * Hook for running Monte Carlo simulations using Web Workers
 * Provides an alternative to API-based simulations for better performance
 */

import { useState, useCallback, useEffect } from 'react'
import { 
  monteCarloWorker, 
  type MonteCarloConfig, 
  type MonteCarloResult 
} from '@/lib/workers'

interface UseMonteCarloWorkerOptions {
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  onComplete?: (result: MonteCarloResult) => void
  onError?: (error: Error) => void
}

export function useMonteCarloWorker(options: UseMonteCarloWorkerOptions = {}) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const runSimulation = useCallback(async (config: MonteCarloConfig) => {
    setIsRunning(true)
    setError(null)
    setProgress({ current: 0, total: config.iterations || 10000, percentage: 0 })

    try {
      const simulationResult = await monteCarloWorker.runSimulation(
        config,
        (progressUpdate) => {
          setProgress(progressUpdate)
          options.onProgress?.(progressUpdate)
        }
      )

      setResult(simulationResult)
      options.onComplete?.(simulationResult)
      return simulationResult
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Simulation failed')
      setError(error)
      options.onError?.(error)
      throw error
    } finally {
      setIsRunning(false)
    }
  }, [options])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Note: We don't terminate the worker here as it's a singleton
      // and may be used by other components
    }
  }, [])

  return {
    runSimulation,
    isRunning,
    progress,
    result,
    error,
    isSupported: typeof Worker !== 'undefined'
  }
}
