/**
 * Hook for processing large datasets using Web Workers
 * Offloads CPU-intensive data operations from the main thread
 */

import { useState, useCallback, useEffect } from 'react'
import { dataProcessorWorker } from '@/lib/workers'

export function useDataProcessor() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const processData = useCallback(async <T, R = T>(
    operation: () => Promise<R>
  ): Promise<R | null> => {
    setIsProcessing(true)
    setError(null)

    try {
      const result = await operation()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Data processing failed')
      setError(error)
      console.error('Data processing error:', error)
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const filter = useCallback(async <T>(
    items: T[],
    predicate: (item: T, index: number) => boolean
  ) => {
    return processData(() => dataProcessorWorker.filter(items, predicate))
  }, [processData])

  const sort = useCallback(async <T>(
    items: T[],
    compareFn: (a: T, b: T) => number,
    direction: 'asc' | 'desc' = 'asc'
  ) => {
    return processData(() => dataProcessorWorker.sort(items, compareFn, direction))
  }, [processData])

  const transform = useCallback(async <T, R>(
    items: T[],
    transformFn: (item: T, index: number) => R
  ) => {
    return processData(() => dataProcessorWorker.transform(items, transformFn))
  }, [processData])

  const search = useCallback(async <T>(
    items: T[],
    query: string,
    fields: string[]
  ) => {
    return processData(() => dataProcessorWorker.search(items, query, fields))
  }, [processData])

  const deduplicate = useCallback(async <T>(
    items: T[],
    keyFields: string[]
  ) => {
    return processData(() => dataProcessorWorker.deduplicate(items, keyFields))
  }, [processData])

  const normalize = useCallback(async <T>(
    items: T[],
    fields: string[],
    method: 'minmax' | 'zscore' | 'decimal' = 'minmax'
  ) => {
    return processData(() => dataProcessorWorker.normalize(items, fields, method))
  }, [processData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Note: We don't terminate the worker here as it's a singleton
      // and may be used by other components
    }
  }, [])

  return {
    filter,
    sort,
    transform,
    search,
    deduplicate,
    normalize,
    isProcessing,
    error,
    isSupported: typeof Worker !== 'undefined'
  }
}
