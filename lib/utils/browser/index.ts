/**
 * Browser / Chrome utilities barrel
 * Re-export from single sources to avoid duplicate symbol errors (BrowserInfo, detectBrowser, isChromeBasedBrowser, ChromeScrollMetrics).
 */
export * from './browser-detection'
export * from './chrome-css-validation'
export type { ChromeOptimizationConfig } from './chrome-detection-optimization'
export {
  ChromeOptimizationManager,
  chromeOptimizationManager,
  applyBrowserOptimizations,
  applyOptimizationsToElements,
  removeBrowserOptimizations,
  featureDetection,
  BROWSER_CLASSES,
  isChrome,
  isWebkit,
} from './chrome-detection-optimization'
export * from './chrome-scroll-integration-example'
export type { ChromeScrollEvent, ChromeScrollLoggerConfig } from './chrome-scroll-logger'
export { chromeScrollLogger, ChromeScrollLogger } from './chrome-scroll-logger'
export type { ChromeScrollConfig } from './chrome-scroll-performance'
export {
  ChromeScrollPerformanceManager,
  chromeScrollPerformanceManager,
  applyChromeOptimizationsToElements,
  CHROME_SCROLL_CLASSES,
} from './chrome-scroll-performance'
