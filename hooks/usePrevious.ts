import { useEffect, useRef } from 'react'

/**
 * Hook that returns the previous value of a state or prop
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  
  useEffect(() => {
    ref.current = value
  })
  
  return ref.current
}

/**
 * Hook that compares current and previous values
 */
export function useCompare<T>(value: T, compare?: (prev: T | undefined, current: T) => boolean) {
  const prevValue = usePrevious(value)
  
  if (compare) {
    return compare(prevValue, value)
  }
  
  return prevValue !== value
}