/**
 * Property-Based Testing Configuration
 * 
 * Provides configuration management for property-based tests including:
 * - Seed management for CI/CD reproducibility
 * - Test iteration configuration
 * - Environment-specific settings
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.1, 3.4**
 */

/**
 * Configuration options for property-based tests
 */
export interface PBTConfig {
  /** Number of test iterations to run (minimum 100 for thorough coverage) */
  numRuns: number;
  /** Seed value for reproducible test execution */
  seed?: number;
  /** Maximum time in milliseconds for a single test run */
  timeout?: number;
  /** Whether to enable verbose logging */
  verbose?: boolean;
  /** Path for test reports */
  reportPath?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<PBTConfig, 'seed'>> & { seed?: number } = {
  numRuns: 100,
  seed: undefined,
  timeout: 30000,
  verbose: false,
  reportPath: './test-reports/pbt',
};

/**
 * CI/CD specific configuration with deterministic seed
 */
export const CI_CONFIG: Required<PBTConfig> = {
  numRuns: 100,
  seed: 42, // Fixed seed for reproducible CI/CD runs
  timeout: 60000,
  verbose: true,
  reportPath: './test-reports/pbt-ci',
};

/**
 * Development configuration with faster iteration
 */
export const DEV_CONFIG: Required<Omit<PBTConfig, 'seed'>> & { seed?: number } = {
  numRuns: 50,
  seed: undefined, // Random seed for development
  timeout: 10000,
  verbose: true,
  reportPath: './test-reports/pbt-dev',
};

/**
 * Determines if running in CI/CD environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.JENKINS_URL ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  );
}

/**
 * Gets the appropriate configuration based on environment
 */
export function getConfig(overrides?: Partial<PBTConfig>): PBTConfig {
  const baseConfig = isCI() ? CI_CONFIG : DEFAULT_CONFIG;
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Seed manager for reproducible test execution
 */
export class SeedManager {
  private currentSeed: number | undefined;
  private seedHistory: Array<{ seed: number; timestamp: Date; testName?: string }> = [];

  constructor(initialSeed?: number) {
    this.currentSeed = initialSeed;
  }

  /**
   * Gets the current seed, generating one if not set
   */
  getSeed(): number {
    if (this.currentSeed === undefined) {
      this.currentSeed = this.generateSeed();
    }
    return this.currentSeed;
  }

  /**
   * Sets a specific seed for reproducibility
   */
  setSeed(seed: number): void {
    this.currentSeed = seed;
    this.recordSeed(seed);
  }

  /**
   * Generates a new random seed
   */
  generateSeed(): number {
    const seed = Math.floor(Math.random() * 2147483647);
    this.recordSeed(seed);
    return seed;
  }

  /**
   * Records seed usage for debugging failed tests
   */
  private recordSeed(seed: number, testName?: string): void {
    this.seedHistory.push({
      seed,
      timestamp: new Date(),
      testName,
    });
  }

  /**
   * Gets the seed history for debugging
   */
  getSeedHistory(): Array<{ seed: number; timestamp: Date; testName?: string }> {
    return [...this.seedHistory];
  }

  /**
   * Resets the seed manager
   */
  reset(): void {
    this.currentSeed = undefined;
    this.seedHistory = [];
  }

  /**
   * Creates a seed from environment variable or generates new one
   */
  static fromEnvironment(): SeedManager {
    const envSeed = process.env.PBT_SEED;
    const seed = envSeed ? parseInt(envSeed, 10) : undefined;
    return new SeedManager(seed);
  }
}

/**
 * Global seed manager instance
 */
export const globalSeedManager = SeedManager.fromEnvironment();

/**
 * Gets fast-check options from PBT config
 */
export function getFastCheckOptions(config: PBTConfig): {
  numRuns: number;
  seed?: number;
  timeout?: number;
  verbose?: boolean;
} {
  return {
    numRuns: config.numRuns,
    seed: config.seed,
    timeout: config.timeout,
    verbose: config.verbose,
  };
}

/**
 * Creates a test reporter for property-based tests
 */
export interface TestReporter {
  onTestStart(testName: string, config: PBTConfig): void;
  onTestPass(testName: string, iterations: number, duration: number): void;
  onTestFail(testName: string, error: Error, counterExample: unknown, seed: number): void;
  onSuiteComplete(results: TestResult[]): void;
}

export interface TestResult {
  testName: string;
  passed: boolean;
  iterations: number;
  duration: number;
  seed?: number;
  error?: Error;
  counterExample?: unknown;
}

/**
 * Console-based test reporter
 */
export class ConsoleTestReporter implements TestReporter {
  private results: TestResult[] = [];

  onTestStart(testName: string, config: PBTConfig): void {
    if (config.verbose) {
      console.log(`[PBT] Starting: ${testName} (${config.numRuns} iterations, seed: ${config.seed ?? 'random'})`);
    }
  }

  onTestPass(testName: string, iterations: number, duration: number): void {
    this.results.push({
      testName,
      passed: true,
      iterations,
      duration,
    });
    console.log(`[PBT] ✓ ${testName} passed (${iterations} iterations in ${duration}ms)`);
  }

  onTestFail(testName: string, error: Error, counterExample: unknown, seed: number): void {
    this.results.push({
      testName,
      passed: false,
      iterations: 0,
      duration: 0,
      seed,
      error,
      counterExample,
    });
    console.error(`[PBT] ✗ ${testName} failed`);
    console.error(`  Seed: ${seed} (use this to reproduce)`);
    console.error(`  Counter-example: ${JSON.stringify(counterExample, null, 2)}`);
    console.error(`  Error: ${error.message}`);
  }

  onSuiteComplete(results: TestResult[]): void {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n[PBT] Suite complete: ${passed} passed, ${failed} failed`);
  }

  getResults(): TestResult[] {
    return [...this.results];
  }
}
