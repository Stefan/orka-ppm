import { useEffect } from 'react'

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboard(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
    preventDefault?: boolean
  } = {}
) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const { ctrl = false, alt = false, shift = false, meta = false, preventDefault = true } = options

      // Check if the pressed key matches
      if (event.key.toLowerCase() !== key.toLowerCase()) return

      // Check modifier keys
      if (ctrl && !event.ctrlKey) return
      if (alt && !event.altKey) return
      if (shift && !event.shiftKey) return
      if (meta && !event.metaKey) return

      // Check if we should NOT have modifier keys when they're pressed
      if (!ctrl && event.ctrlKey) return
      if (!alt && event.altKey) return
      if (!shift && event.shiftKey) return
      if (!meta && event.metaKey) return

      if (preventDefault) {
        event.preventDefault()
      }

      callback(event)
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [key, callback, options])
}

/**
 * Hook for handling multiple keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: Array<{
    key: string
    callback: (event: KeyboardEvent) => void
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
    preventDefault?: boolean
  }>
) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      shortcuts.forEach(({ key, callback, ctrl = false, alt = false, shift = false, meta = false, preventDefault = true }) => {
        // Check if the pressed key matches
        if (event.key.toLowerCase() !== key.toLowerCase()) return

        // Check modifier keys
        if (ctrl && !event.ctrlKey) return
        if (alt && !event.altKey) return
        if (shift && !event.shiftKey) return
        if (meta && !event.metaKey) return

        // Check if we should NOT have modifier keys when they're pressed
        if (!ctrl && event.ctrlKey) return
        if (!alt && event.altKey) return
        if (!shift && event.shiftKey) return
        if (!meta && event.metaKey) return

        if (preventDefault) {
          event.preventDefault()
        }

        callback(event)
      })
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [shortcuts])
}