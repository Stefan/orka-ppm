/**
 * ORKA-PPM Custom Hooks
 * Reusable React hooks for common functionality
 */

// Core hooks
export { useLocalStorage } from './useLocalStorage'
export { useDebounce } from './useDebounce'
export { useMediaQuery } from './useMediaQuery'
export { useClickOutside } from './useClickOutside'
export { useKeyboard } from './useKeyboard'
export { useIntersectionObserver } from './useIntersectionObserver'
export { useAsync } from './useAsync'
export { usePrevious } from './usePrevious'
export { useToggle } from './useToggle'
export { useWindowSize } from './useWindowSize'

// Performance monitoring hooks
export {
  useComponentPerformance,
  usePageLoadPerformance,
  useApiPerformanceMonitoring,
  useMemoryMonitoring,
  useInteractionPerformance,
  useDashboardPerformance
} from './usePerformanceMonitoring'

// Scroll performance hooks
export {
  useScrollPerformance,
  useGlobalScrollPerformance,
  useScrollLazyLoading,
  useScrollPosition
} from './useScrollPerformance'

// Help chat hooks
export { 
  useHelpChat,
  useHelpChatUI,
  useHelpChatMessages,
  useHelpChatPreferences
} from './useHelpChat'