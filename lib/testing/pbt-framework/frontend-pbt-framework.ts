/**
 * Frontend Property-Based Testing Framework
 * 
 * Provides a comprehensive framework for property-based testing in TypeScript/React
 * using fast-check and Jest. Includes:
 * - Property test setup and execution
 * - Domain-specific generators
 * - Seed management for CI/CD reproducibility
 * - Test reporting and debugging support
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.1, 3.4**
 */

import * as fc from 'fast-check';
import {
  DomainGenerators,
  domainGenerators,
  GeneratedProject,
  GeneratedUser,
  GeneratedFilterState,
  GeneratedFinancialRecord,
} from './domain-generators';
import {
  PBTConfig,
  getConfig,
  getFastCheckOptions,
  SeedManager,
  globalSeedManager,
  TestReporter,
  ConsoleTestReporter,
  TestResult,
} from './test-config';

/**
 * Options for property test setup
 */
export interface PropertyTestOptions {
  /** Number of test iterations (minimum 100 recommended) */
  numRuns?: number;
  /** Seed for reproducible test execution */
  seed?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom test reporter */
  reporter?: TestReporter;
}

/**
 * Result of a property test execution
 */
export interface PropertyTestResult {
  passed: boolean;
  iterations: number;
  seed: number;
  duration: number;
  error?: Error;
  counterExample?: unknown;
}

/**
 * Frontend Property-Based Testing Framework
 * 
 * Main class for setting up and running property-based tests in the frontend.
 * Integrates fast-check with Jest and provides domain-specific generators.
 * 
 * @example
 * ```typescript
 * const framework = new FrontendPBTFramework();
 * 
 * // Run a property test
 * framework.setupPropertyTest(
 *   framework.generators.projectGenerator,
 *   (project) => {
 *     expect(project.id).toBeDefined();
 *     expect(project.name.length).toBeGreaterThan(0);
 *   },
 *   { numRuns: 100 }
 * );
 * ```
 */
export class FrontendPBTFramework {
  /** Domain-specific generators for PPM objects */
  readonly generators: DomainGenerators;
  
  /** Seed manager for reproducible tests */
  readonly seedManager: SeedManager;
  
  /** Test reporter for logging results */
  private reporter: TestReporter;
  
  /** Configuration for property tests */
  private config: PBTConfig;

  constructor(options?: Partial<PBTConfig>) {
    this.generators = domainGenerators;
    this.seedManager = globalSeedManager;
    this.config = getConfig(options);
    this.reporter = new ConsoleTestReporter();
  }

  /**
   * Sets a custom test reporter
   */
  setReporter(reporter: TestReporter): void {
    this.reporter = reporter;
  }

  /**
   * Updates the framework configuration
   */
  setConfig(config: Partial<PBTConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): PBTConfig {
    return { ...this.config };
  }

  /**
   * Sets up and runs a property test with the given generator and test function
   * 
   * @param generator - fast-check arbitrary to generate test data
   * @param testFunction - Function that tests the property (should throw on failure)
   * @param options - Optional configuration overrides
   * 
   * @example
   * ```typescript
   * framework.setupPropertyTest(
   *   fc.array(framework.generators.projectGenerator),
   *   (projects) => {
   *     // Property: All projects should have valid IDs
   *     projects.forEach(p => expect(p.id).toMatch(/^[0-9a-f-]{36}$/));
   *   }
   * );
   * ```
   */
  setupPropertyTest<T>(
    generator: fc.Arbitrary<T>,
    testFunction: (data: T) => void | Promise<void>,
    options: PropertyTestOptions = {}
  ): void {
    const mergedConfig = {
      ...this.config,
      numRuns: options.numRuns ?? this.config.numRuns,
      seed: options.seed ?? this.config.seed,
      timeout: options.timeout ?? this.config.timeout,
      verbose: options.verbose ?? this.config.verbose,
    };

    const fcOptions = getFastCheckOptions(mergedConfig);

    fc.assert(
      fc.property(generator, testFunction),
      fcOptions
    );
  }

  /**
   * Runs a property test and returns detailed results
   * 
   * @param name - Name of the test for reporting
   * @param generator - fast-check arbitrary to generate test data
   * @param testFunction - Function that tests the property
   * @param options - Optional configuration overrides
   * @returns Detailed test result
   */
  runPropertyTest<T>(
    name: string,
    generator: fc.Arbitrary<T>,
    testFunction: (data: T) => void | Promise<void>,
    options: PropertyTestOptions = {}
  ): PropertyTestResult {
    const mergedConfig = {
      ...this.config,
      numRuns: options.numRuns ?? this.config.numRuns,
      seed: options.seed ?? this.config.seed,
      timeout: options.timeout ?? this.config.timeout,
      verbose: options.verbose ?? this.config.verbose,
    };

    const fcOptions = getFastCheckOptions(mergedConfig);
    const startTime = Date.now();
    const seed = fcOptions.seed ?? this.seedManager.getSeed();

    this.reporter.onTestStart(name, mergedConfig);

    try {
      fc.assert(
        fc.property(generator, testFunction),
        { ...fcOptions, seed }
      );

      const duration = Date.now() - startTime;
      this.reporter.onTestPass(name, mergedConfig.numRuns, duration);

      return {
        passed: true,
        iterations: mergedConfig.numRuns,
        seed,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error & { counterexample?: unknown[] };
      
      // fast-check stores counterexample as an array on the error object
      // or we can parse it from the error message
      let counterExample: unknown = err.counterexample?.[0];
      
      // If not available directly, try to parse from error message
      if (counterExample === undefined && err.message) {
        const match = err.message.match(/Counterexample: \[([^\]]+)\]/);
        if (match) {
          try {
            counterExample = JSON.parse(match[1]);
          } catch {
            counterExample = match[1];
          }
        }
      }
      
      this.reporter.onTestFail(name, err, counterExample, seed);

      return {
        passed: false,
        iterations: 0,
        seed,
        duration,
        error: err,
        counterExample,
      };
    }
  }

  /**
   * Creates a property test for project data validation
   * 
   * @param testFunction - Function that validates project properties
   * @param options - Optional configuration
   */
  testProjectProperty(
    testFunction: (project: GeneratedProject) => void | Promise<void>,
    options?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(this.generators.projectGenerator, testFunction, options);
  }

  /**
   * Creates a property test for user data validation
   * 
   * @param testFunction - Function that validates user properties
   * @param options - Optional configuration
   */
  testUserProperty(
    testFunction: (user: GeneratedUser) => void | Promise<void>,
    options?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(this.generators.userGenerator, testFunction, options);
  }

  /**
   * Creates a property test for filter state validation
   * 
   * @param testFunction - Function that validates filter state properties
   * @param options - Optional configuration
   */
  testFilterStateProperty(
    testFunction: (filterState: GeneratedFilterState) => void | Promise<void>,
    options?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(this.generators.filterStateGenerator, testFunction, options);
  }

  /**
   * Creates a property test for financial record validation
   * 
   * @param testFunction - Function that validates financial record properties
   * @param options - Optional configuration
   */
  testFinancialRecordProperty(
    testFunction: (record: GeneratedFinancialRecord) => void | Promise<void>,
    options?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(this.generators.financialRecordGenerator, testFunction, options);
  }

  /**
   * Creates a property test for arrays of projects
   * 
   * @param testFunction - Function that validates project array properties
   * @param arrayOptions - Options for array generation
   * @param testOptions - Optional test configuration
   */
  testProjectArrayProperty(
    testFunction: (projects: GeneratedProject[]) => void | Promise<void>,
    arrayOptions?: { minLength?: number; maxLength?: number },
    testOptions?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(
      this.generators.projectArray(arrayOptions),
      testFunction,
      testOptions
    );
  }

  /**
   * Creates a property test for arrays of users
   * 
   * @param testFunction - Function that validates user array properties
   * @param arrayOptions - Options for array generation
   * @param testOptions - Optional test configuration
   */
  testUserArrayProperty(
    testFunction: (users: GeneratedUser[]) => void | Promise<void>,
    arrayOptions?: { minLength?: number; maxLength?: number },
    testOptions?: PropertyTestOptions
  ): void {
    this.setupPropertyTest(
      this.generators.userArray(arrayOptions),
      testFunction,
      testOptions
    );
  }

  /**
   * Creates a combined property test with projects and filter state
   * Useful for testing filter operations
   * 
   * @param testFunction - Function that validates filtering behavior
   * @param options - Optional test configuration
   */
  testFilterOperation(
    testFunction: (data: { projects: GeneratedProject[]; filterState: GeneratedFilterState }) => void | Promise<void>,
    options?: PropertyTestOptions
  ): void {
    const combinedGenerator = fc.record({
      projects: this.generators.projectArray({ minLength: 0, maxLength: 50 }),
      filterState: this.generators.filterStateGenerator,
    });

    this.setupPropertyTest(combinedGenerator, testFunction, options);
  }

  /**
   * Runs multiple property tests and aggregates results
   * 
   * @param tests - Array of test definitions
   * @returns Array of test results
   */
  runTestSuite<T>(
    tests: Array<{
      name: string;
      generator: fc.Arbitrary<T>;
      testFunction: (data: T) => void | Promise<void>;
      options?: PropertyTestOptions;
    }>
  ): TestResult[] {
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = this.runPropertyTest(
        test.name,
        test.generator,
        test.testFunction,
        test.options
      );

      results.push({
        testName: test.name,
        passed: result.passed,
        iterations: result.iterations,
        duration: result.duration,
        seed: result.seed,
        error: result.error,
        counterExample: result.counterExample,
      });
    }

    this.reporter.onSuiteComplete(results);
    return results;
  }

  /**
   * Helper to create a reproducible test with a specific seed
   * Useful for debugging failed tests
   * 
   * @param seed - The seed to use for reproduction
   * @param generator - fast-check arbitrary
   * @param testFunction - Test function
   */
  reproduceTest<T>(
    seed: number,
    generator: fc.Arbitrary<T>,
    testFunction: (data: T) => void | Promise<void>
  ): void {
    this.setupPropertyTest(generator, testFunction, { seed, numRuns: 1 });
  }

  /**
   * Gets the fast-check library for advanced usage
   */
  get fc(): typeof fc {
    return fc;
  }
}

/**
 * Creates a new FrontendPBTFramework instance
 * 
 * @param options - Optional configuration
 * @returns New framework instance
 */
export function createPBTFramework(options?: Partial<PBTConfig>): FrontendPBTFramework {
  return new FrontendPBTFramework(options);
}

/**
 * Default framework instance for convenience
 */
export const pbtFramework = new FrontendPBTFramework();

// Re-export fast-check for convenience
export { fc };
