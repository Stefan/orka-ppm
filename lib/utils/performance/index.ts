/**
 * Performance utilities barrel
 * ScrollPerformanceConfig from scroll-performance only to avoid duplicate symbol.
 */
export * from './scroll-performance'
export type { HardwareAccelerationConfig } from './performance-optimization'
export {
  WillChangeManager,
  applyHardwareAcceleration,
  removeHardwareAcceleration,
  applyScrollPerformanceOptimization,
  removeScrollPerformanceOptimization,
  getHardwareAccelerationClasses,
  getScrollPerformanceClasses,
  applyAnimationPerformanceOptimization,
  createOptimizedElement,
  willChangeManager,
  cleanupPerformanceOptimizations,
} from './performance-optimization'
export * from './resource-preloader'
export * from './code-splitting'
