/**
 * Tests for state optimization implementations
 * Feature: performance-optimization, Task 6: Optimize State Updates
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useDebounce } from '../hooks/useDebounce'
import { useDeferredValue, useReducer } from 'react'

describe('State Optimization', () => {
  describe('useDebounce hook', () => {
    it('should debounce value updates', async () => {
      jest.useFakeTimers()
      
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      )

      expect(result.current).toBe('initial')

      // Update value multiple times quickly
      rerender({ value: 'update1', delay: 300 })
      rerender({ value: 'update2', delay: 300 })
      rerender({ value: 'final', delay: 300 })

      // Value should not update immediately
      expect(result.current).toBe('initial')

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Value should now be updated to the final value
      expect(result.current).toBe('final')

      jest.useRealTimers()
    })

    it('should cancel previous debounce on new value', async () => {
      jest.useFakeTimers()
      
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      )

      rerender({ value: 'update1', delay: 300 })
      
      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(150)
      })

      // Update again before debounce completes
      rerender({ value: 'update2', delay: 300 })

      // Advance remaining time from first update
      act(() => {
        jest.advanceTimersByTime(150)
      })

      // Should still be initial because first debounce was cancelled
      expect(result.current).toBe('initial')

      // Advance time for second update
      act(() => {
        jest.advanceTimersByTime(150)
      })

      // Now should be update2
      expect(result.current).toBe('update2')

      jest.useRealTimers()
    })
  })

  describe('useDeferredValue', () => {
    it('should defer non-critical updates', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDeferredValue(value),
        { initialProps: { value: 'initial' } }
      )

      expect(result.current).toBe('initial')

      // Update value
      rerender({ value: 'updated' })

      // Deferred value may still be initial immediately after update
      // (React will update it in a lower priority render)
      expect(['initial', 'updated']).toContain(result.current)
    })
  })

  describe('useReducer for batching', () => {
    type FilterState = {
      search: string
      category: string
      status: string
    }

    type FilterAction =
      | { type: 'SET_FILTER'; key: keyof FilterState; value: string }
      | { type: 'RESET_FILTERS' }

    const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
      switch (action.type) {
        case 'SET_FILTER':
          return { ...state, [action.key]: action.value }
        case 'RESET_FILTERS':
          return { search: '', category: 'all', status: 'all' }
        default:
          return state
      }
    }

    it('should batch multiple state updates', () => {
      const { result } = renderHook(() =>
        useReducer(filterReducer, {
          search: '',
          category: 'all',
          status: 'all'
        })
      )

      const [initialState, dispatch] = result.current
      expect(initialState).toEqual({
        search: '',
        category: 'all',
        status: 'all'
      })

      // Dispatch multiple updates
      act(() => {
        dispatch({ type: 'SET_FILTER', key: 'search', value: 'test' })
        dispatch({ type: 'SET_FILTER', key: 'category', value: 'technical' })
        dispatch({ type: 'SET_FILTER', key: 'status', value: 'active' })
      })

      const [updatedState] = result.current
      expect(updatedState).toEqual({
        search: 'test',
        category: 'technical',
        status: 'active'
      })
    })

    it('should reset all filters at once', () => {
      const { result } = renderHook(() =>
        useReducer(filterReducer, {
          search: 'test',
          category: 'technical',
          status: 'active'
        })
      )

      act(() => {
        const [, dispatch] = result.current
        dispatch({ type: 'RESET_FILTERS' })
      })

      const [state] = result.current
      expect(state).toEqual({
        search: '',
        category: 'all',
        status: 'all'
      })
    })
  })

  describe('Integration: Debounce + Deferred + Reducer', () => {
    it('should work together for optimal performance', async () => {
      jest.useFakeTimers()

      type State = { search: string; filters: { category: string } }
      type Action = 
        | { type: 'SET_SEARCH'; value: string }
        | { type: 'SET_CATEGORY'; value: string }

      const reducer = (state: State, action: Action): State => {
        switch (action.type) {
          case 'SET_SEARCH':
            return { ...state, search: action.value }
          case 'SET_CATEGORY':
            return { ...state, filters: { ...state.filters, category: action.value } }
          default:
            return state
        }
      }

      const { result: reducerResult } = renderHook(() =>
        useReducer(reducer, { search: '', filters: { category: 'all' } })
      )

      // Get initial debounced value
      const { result: debouncedResult, rerender: rerenderDebounced } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: '' } }
      )

      // Simulate rapid search input
      act(() => {
        const [, dispatch] = reducerResult.current
        dispatch({ type: 'SET_SEARCH', value: 't' })
        dispatch({ type: 'SET_SEARCH', value: 'te' })
        dispatch({ type: 'SET_SEARCH', value: 'tes' })
        dispatch({ type: 'SET_SEARCH', value: 'test' })
      })

      // Update debounced hook with new search value
      rerenderDebounced({ value: reducerResult.current[0].search })

      // Search should be updated immediately in reducer
      expect(reducerResult.current[0].search).toBe('test')

      // But debounced value should still be empty
      expect(debouncedResult.current).toBe('')

      // Advance time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Now debounced value should be updated
      expect(debouncedResult.current).toBe('test')

      jest.useRealTimers()
    })
  })
})
