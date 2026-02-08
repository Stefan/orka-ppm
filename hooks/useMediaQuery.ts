import { useState, useEffect } from 'react'

/**
 * Hook for responsive design - detects media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Prevent SSR issues
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

// Predefined breakpoint hooks
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1280px)')
/** Tablet + mobile: use for stacking grids, wrapping toolbars (iPad Air ~820px gets compact layout) */
export const useIsCompactViewport = () => useMediaQuery('(max-width: 1023px)')