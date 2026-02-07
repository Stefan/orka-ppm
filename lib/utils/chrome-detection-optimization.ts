/**
 * Re-export for backward compatibility and Jest resolution.
 * Implementation lives in ./browser/chrome-detection-optimization.
 */
export {
  ChromeOptimizationManager,
  chromeOptimizationManager,
  detectBrowser,
  isChromeBasedBrowser,
  isWebkitBasedBrowser,
  applyBrowserOptimizations,
  applyOptimizationsToElements,
  removeBrowserOptimizations,
  featureDetection,
  BROWSER_CLASSES,
  isChrome,
  isWebkit,
  type BrowserInfo,
  type ChromeOptimizationConfig,
} from './browser/chrome-detection-optimization'
