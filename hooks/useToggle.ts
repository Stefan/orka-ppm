import { useCallback, useState } from 'react'

/**
 * Hook for managing boolean toggle state
 */
export function useToggle(initialValue = false): [boolean, () => void, (value?: boolean) => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(prev => !prev)
  }, [])

  const setToggle = useCallback((newValue?: boolean) => {
    if (typeof newValue === 'boolean') {
      setValue(newValue)
    } else {
      setValue(prev => !prev)
    }
  }, [])

  return [value, toggle, setToggle]
}

/**
 * Hook for managing multiple toggle states
 */
export function useMultiToggle<T extends string>(
  keys: T[],
  initialValues: Partial<Record<T, boolean>> = {}
): [Record<T, boolean>, (key: T) => void, (key: T, value?: boolean) => void] {
  const [values, setValues] = useState<Record<T, boolean>>(() => {
    const initial = {} as Record<T, boolean>
    keys.forEach(key => {
      initial[key] = initialValues[key] ?? false
    })
    return initial
  })

  const toggle = useCallback((key: T) => {
    setValues(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }, [])

  const setToggle = useCallback((key: T, value?: boolean) => {
    setValues(prev => ({
      ...prev,
      [key]: typeof value === 'boolean' ? value : !prev[key]
    }))
  }, [])

  return [values, toggle, setToggle]
}