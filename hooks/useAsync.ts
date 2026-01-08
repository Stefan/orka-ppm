import { useCallback, useEffect, useReducer } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

type AsyncAction<T> =
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; payload: T }
  | { type: 'ERROR'; payload: Error }
  | { type: 'RESET' }

function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null }
    case 'SUCCESS':
      return { data: action.payload, loading: false, error: null }
    case 'ERROR':
      return { ...state, loading: false, error: action.payload }
    case 'RESET':
      return { data: null, loading: false, error: null }
    default:
      return state
  }
}

/**
 * Hook for managing async operations
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, dispatch] = useReducer(asyncReducer<T>, {
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async () => {
    dispatch({ type: 'LOADING' })
    try {
      const result = await asyncFunction()
      dispatch({ type: 'SUCCESS', payload: result })
      return result
    } catch (error) {
      dispatch({ type: 'ERROR', payload: error as Error })
      throw error
    }
  }, [asyncFunction])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * Hook for managing async operations with manual trigger
 */
export function useAsyncCallback<T, Args extends unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>
) {
  const [state, dispatch] = useReducer(asyncReducer<T>, {
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: Args) => {
      dispatch({ type: 'LOADING' })
      try {
        const result = await asyncFunction(...args)
        dispatch({ type: 'SUCCESS', payload: result })
        return result
      } catch (error) {
        dispatch({ type: 'ERROR', payload: error as Error })
        throw error
      }
    },
    [asyncFunction]
  )

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}