import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook for managing focus within a component or container
 */
export function useFocusManagement() {
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors))
      .filter((element) => {
        const htmlElement = element as HTMLElement
        return htmlElement.offsetParent !== null && // Element is visible
               !htmlElement.hasAttribute('aria-hidden') &&
               htmlElement.tabIndex !== -1
      }) as HTMLElement[]
  }, [])

  /**
   * Focus the first focusable element
   */
  const focusFirst = useCallback(() => {
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }
  }, [getFocusableElements])

  /**
   * Focus the last focusable element
   */
  const focusLast = useCallback(() => {
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus()
    }
  }, [getFocusableElements])

  /**
   * Focus the next focusable element
   */
  const focusNext = useCallback(() => {
    const focusableElements = getFocusableElements()
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    
    if (currentIndex === -1) {
      focusFirst()
    } else if (currentIndex < focusableElements.length - 1) {
      focusableElements[currentIndex + 1].focus()
    } else {
      focusableElements[0].focus() // Wrap to first
    }
  }, [getFocusableElements, focusFirst])

  /**
   * Focus the previous focusable element
   */
  const focusPrevious = useCallback(() => {
    const focusableElements = getFocusableElements()
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    
    if (currentIndex === -1) {
      focusLast()
    } else if (currentIndex > 0) {
      focusableElements[currentIndex - 1].focus()
    } else {
      focusableElements[focusableElements.length - 1].focus() // Wrap to last
    }
  }, [getFocusableElements, focusLast])

  /**
   * Trap focus within the container
   */
  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }, [getFocusableElements])

  return {
    containerRef,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    trapFocus,
    getFocusableElements
  }
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore() {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && previousFocusRef.current.focus) {
      previousFocusRef.current.focus()
    }
  }, [])

  return { saveFocus, restoreFocus }
}

/**
 * Hook for skip links functionality
 */
export function useSkipLinks() {
  const skipLinksRef = useRef<HTMLDivElement>(null)

  const addSkipLink = useCallback((targetId: string, label: string) => {
    if (!skipLinksRef.current) return

    const skipLink = document.createElement('a')
    skipLink.href = `#${targetId}`
    skipLink.textContent = label
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50'
    
    skipLink.addEventListener('click', (e) => {
      e.preventDefault()
      const target = document.getElementById(targetId)
      if (target) {
        target.focus()
        target.scrollIntoView({ behavior: 'smooth' })
      }
    })

    skipLinksRef.current.appendChild(skipLink)
  }, [])

  return { skipLinksRef, addSkipLink }
}