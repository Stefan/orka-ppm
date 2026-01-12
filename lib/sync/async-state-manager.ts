/**
 * Async state management utilities for optimal loading states and progress indicators
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { performanceMonitor } from '../monitoring/performance'

interface AsyncState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  progress: number
  stage: string
}

interface AsyncOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
  onProgress?: (progress: number, stage: string) => void
  onStageChange?: (stage: string) => void
  cacheKey?: string
  cacheTTL?: number
}

interface ProgressStage {
  name: string
  weight: number
  description?: string
}

class AsyncStateManager<T = any> {
  private state: AsyncState<T>
  private listeners: Set<(state: AsyncState<T>) => void> = new Set()
  private cache: Map<string, { data: T; timestamp: number; ttl: number }> = new Map()
  private abortController: AbortController | null = null

  constructor(initialData: T | null = null) {
    this.state = {
      data: initialData,
      isLoading: false,
      error: null,
      progress: 0,
      stage: 'idle'
    }
  }

  subscribe(listener: (state: AsyncState<T>) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state))
  }

  private updateState(updates: Partial<AsyncState<T>>) {
    this.state = { ...this.state, ...updates }
    this.notify()
  }

  async execute<R = T>(
    asyncFn: (signal: AbortSignal, updateProgress: (progress: number, stage: string) => void) => Promise<R>,
    options: AsyncOptions = {}
  ): Promise<R> {
    const {
      timeout = 30000,
      retries = 0,
      retryDelay = 1000,
      onProgress,
      onStageChange,
      cacheKey,
      cacheTTL = 300000 // 5 minutes
    } = options

    // Check cache first
    if (cacheKey) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        this.updateState({ data: cached.data as T, isLoading: false, error: null })
        return cached.data as unknown as R
      }
    }

    // Cancel any existing operation
    if (this.abortController) {
      this.abortController.abort()
    }

    this.abortController = new AbortController()
    const signal = this.abortController.signal

    const updateProgress = (progress: number, stage: string) => {
      this.updateState({ progress, stage })
      onProgress?.(progress, stage)
      onStageChange?.(stage)
    }

    this.updateState({ isLoading: true, error: null, progress: 0, stage: 'starting' })

    const startTime = performance.now()
    let attempt = 0

    while (attempt <= retries) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), timeout)
        })

        const result = await Promise.race([
          asyncFn(signal, updateProgress),
          timeoutPromise
        ])

        // Cache result if cache key provided
        if (cacheKey) {
          this.cache.set(cacheKey, {
            data: result as T,
            timestamp: Date.now(),
            ttl: cacheTTL
          })
        }

        const duration = performance.now() - startTime
        performanceMonitor.recordMetric('async_operation_success', duration, 'custom', {
          cacheKey,
          attempts: attempt + 1,
          stage: this.state.stage
        })

        this.updateState({
          data: result as T,
          isLoading: false,
          error: null,
          progress: 100,
          stage: 'completed'
        })

        return result
      } catch (error) {
        attempt++
        
        if (signal.aborted) {
          throw new Error('Operation was cancelled')
        }

        if (attempt > retries) {
          const duration = performance.now() - startTime
          performanceMonitor.recordMetric('async_operation_error', duration, 'custom', {
            cacheKey,
            attempts: attempt,
            error: (error as Error).message
          })

          this.updateState({
            isLoading: false,
            error: error as Error,
            progress: 0,
            stage: 'error'
          })
          throw error
        }

        // Wait before retry
        updateProgress(0, `retrying (${attempt}/${retries})`)
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), retryDelay * attempt)
        })
      }
    }

    throw new Error('Max retries exceeded')
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort()
      this.updateState({
        isLoading: false,
        progress: 0,
        stage: 'cancelled'
      })
    }
  }

  reset() {
    this.cancel()
    this.updateState({
      data: null,
      isLoading: false,
      error: null,
      progress: 0,
      stage: 'idle'
    })
  }

  getState(): AsyncState<T> {
    return { ...this.state }
  }

  clearCache(key?: string) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }
}

// React hook for async state management
export const useAsyncState = <T = any>(initialData: T | null = null) => {
  const managerRef = useRef<AsyncStateManager<T>>(new AsyncStateManager(initialData))
  const [state, setState] = useState<AsyncState<T>>(managerRef.current.getState())

  useEffect(() => {
    const unsubscribe = managerRef.current.subscribe(setState)
    return unsubscribe
  }, [])

  const execute = useCallback(
    <R = T>(
      asyncFn: (signal: AbortSignal, updateProgress: (progress: number, stage: string) => void) => Promise<R>,
      options?: AsyncOptions
    ) => managerRef.current.execute(asyncFn, options),
    []
  )

  const cancel = useCallback(() => managerRef.current.cancel(), [])
  const reset = useCallback(() => managerRef.current.reset(), [])
  const clearCache = useCallback((key?: string) => managerRef.current.clearCache(key), [])

  return {
    ...state,
    execute,
    cancel,
    reset,
    clearCache
  }
}

// Multi-stage progress tracker
export const useMultiStageProgress = (stages: ProgressStage[]) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [stageProgress, setStageProgress] = useState(0)

  const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0)

  const overallProgress = useMemo(() => {
    const completedWeight = stages
      .slice(0, currentStageIndex)
      .reduce((sum, stage) => sum + stage.weight, 0)
    
    const currentStageWeight = stages[currentStageIndex]?.weight || 0
    const currentStageContribution = (stageProgress / 100) * currentStageWeight

    return ((completedWeight + currentStageContribution) / totalWeight) * 100
  }, [currentStageIndex, stageProgress, stages, totalWeight])

  const nextStage = useCallback(() => {
    if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex(prev => prev + 1)
      setStageProgress(0)
    }
  }, [currentStageIndex, stages.length])

  const updateStageProgress = useCallback((progress: number) => {
    setStageProgress(Math.max(0, Math.min(100, progress)))
  }, [])

  const reset = useCallback(() => {
    setCurrentStageIndex(0)
    setStageProgress(0)
  }, [])

  const currentStage = stages[currentStageIndex]

  return {
    currentStage,
    currentStageIndex,
    stageProgress,
    overallProgress,
    nextStage,
    updateStageProgress,
    reset,
    isComplete: currentStageIndex >= stages.length - 1 && stageProgress >= 100
  }
}

// Batch operation manager
export const useBatchOperation = <T, R>(
  items: T[],
  operation: (item: T, index: number, signal: AbortSignal) => Promise<R>,
  options: {
    batchSize?: number
    concurrency?: number
    onProgress?: (completed: number, total: number, currentItem: T) => void
    onItemComplete?: (result: R, item: T, index: number) => void
    onItemError?: (error: Error, item: T, index: number) => void
  } = {}
) => {
  const {
    batchSize = 10,
    concurrency = 3,
    onProgress,
    onItemComplete,
    onItemError
  } = options

  const { execute, ...state } = useAsyncState<R[]>([])

  const executeBatch = useCallback(async () => {
    return execute(async (signal, updateProgress) => {
      const results: R[] = []
      const errors: Array<{ index: number; error: Error }> = []
      let completed = 0

      updateProgress(0, 'preparing batch')

      // Process items in batches
      for (let batchStart = 0; batchStart < items.length; batchStart += batchSize) {
        if (signal.aborted) throw new Error('Operation cancelled')

        const batch = items.slice(batchStart, Math.min(batchStart + batchSize, items.length))
        updateProgress((batchStart / items.length) * 100, `processing batch ${Math.floor(batchStart / batchSize) + 1}`)

        // Process batch items with limited concurrency
        const batchPromises = batch.map(async (item, batchIndex) => {
          const globalIndex = batchStart + batchIndex
          
          try {
            const result = await operation(item, globalIndex, signal)
            results[globalIndex] = result
            completed++
            
            onItemComplete?.(result, item, globalIndex)
            onProgress?.(completed, items.length, item)
            
            return result
          } catch (error) {
            errors.push({ index: globalIndex, error: error as Error })
            onItemError?.(error as Error, item, globalIndex)
            throw error
          }
        })

        // Limit concurrency within batch
        const chunks = []
        for (let i = 0; i < batchPromises.length; i += concurrency) {
          chunks.push(batchPromises.slice(i, i + concurrency))
        }

        for (const chunk of chunks) {
          await Promise.allSettled(chunk)
        }
      }

      updateProgress(100, 'completed')

      if (errors.length > 0) {
        throw new Error(`Batch operation completed with ${errors.length} errors`)
      }

      return results
    })
  }, [items, operation, batchSize, concurrency, onProgress, onItemComplete, onItemError, execute])

  return {
    ...state,
    executeBatch
  }
}

export { AsyncStateManager }
export default useAsyncState