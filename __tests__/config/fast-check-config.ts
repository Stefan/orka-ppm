/**
 * Fast-check configuration for property-based testing
 * 
 * This configuration allows us to control the number of test runs
 * for different environments (development, CI, validation)
 */

export const FAST_CHECK_CONFIG = {
  // Default configuration - 100 runs for thorough testing
  default: {
    numRuns: 100,
    verbose: false,
  },
  
  // Fast configuration - 5 runs for quick validation
  fast: {
    numRuns: 5,
    verbose: false,
  },
  
  // Development configuration - 10 runs for quick feedback
  dev: {
    numRuns: 10,
    verbose: true,
  },
  
  // CI configuration - 1000 runs for comprehensive testing
  ci: {
    numRuns: 1000,
    verbose: true,
  },
};

// Get configuration based on environment variable
export function getFastCheckConfig() {
  const profile = process.env.FAST_CHECK_PROFILE || 'default';
  return FAST_CHECK_CONFIG[profile as keyof typeof FAST_CHECK_CONFIG] || FAST_CHECK_CONFIG.default;
}

// Export the current configuration
export const currentConfig = getFastCheckConfig();
