/**
 * Tests for Frontend Property-Based Testing Framework
 * 
 * Verifies that the PBT framework correctly integrates fast-check with Jest
 * and provides stable test execution with proper seed management.
 * 
 * **Feature: property-based-testing**
 * **Property 10: Frontend Framework Integration**
 * **Validates: Requirements 3.1, 3.4**
 */

import {
  FrontendPBTFramework,
  createPBTFramework,
  pbtFramework,
  fc,
  domainGenerators,
  DomainGenerators,
  projectGenerator,
  userGenerator,
  filterStateGenerator,
  financialRecordGenerator,
  SeedManager,
  getConfig,
  isCI,
  DEFAULT_CONFIG,
  CI_CONFIG,
  PROJECT_STATUSES,
  PROJECT_HEALTH_VALUES,
  USER_ROLES,
  SORT_FIELDS,
  SORT_ORDERS,
  CURRENCIES,
} from '../index';

describe('Frontend PBT Framework', () => {
  describe('Framework Integration', () => {
    /**
     * Property 10: Frontend Framework Integration
     * For any frontend property test setup, fast-check and Jest must integrate correctly
     * to provide stable test execution with proper seed management
     * **Validates: Requirements 3.1, 3.4**
     */
    
    it('should create framework instance with default configuration', () => {
      const framework = new FrontendPBTFramework();
      
      expect(framework).toBeInstanceOf(FrontendPBTFramework);
      expect(framework.generators).toBeInstanceOf(DomainGenerators);
      expect(framework.seedManager).toBeInstanceOf(SeedManager);
      expect(framework.fc).toBe(fc);
    });

    it('should create framework with custom configuration', () => {
      const framework = createPBTFramework({
        numRuns: 200,
        seed: 12345,
        verbose: true,
      });

      const config = framework.getConfig();
      expect(config.numRuns).toBe(200);
      expect(config.seed).toBe(12345);
      expect(config.verbose).toBe(true);
    });

    it('should provide default framework instance', () => {
      expect(pbtFramework).toBeInstanceOf(FrontendPBTFramework);
    });

    it('should run property tests with minimum 100 iterations by default', () => {
      const config = getConfig();
      expect(config.numRuns).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Seed Management', () => {
    it('should create seed manager with initial seed', () => {
      const manager = new SeedManager(42);
      expect(manager.getSeed()).toBe(42);
    });

    it('should generate random seed when not provided', () => {
      const manager = new SeedManager();
      const seed = manager.getSeed();
      
      expect(typeof seed).toBe('number');
      expect(seed).toBeGreaterThan(0);
    });

    it('should record seed history', () => {
      const manager = new SeedManager();
      manager.setSeed(100);
      manager.setSeed(200);
      
      const history = manager.getSeedHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(h => h.seed === 100)).toBe(true);
      expect(history.some(h => h.seed === 200)).toBe(true);
    });

    it('should reset seed manager', () => {
      const manager = new SeedManager(42);
      manager.reset();
      
      const history = manager.getSeedHistory();
      expect(history.length).toBe(0);
    });

    it('should produce reproducible results with same seed', () => {
      const seed = 12345;
      const results1: number[] = [];
      const results2: number[] = [];

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (n) => {
          results1.push(n);
          return true;
        }),
        { numRuns: 10, seed }
      );

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (n) => {
          results2.push(n);
          return true;
        }),
        { numRuns: 10, seed }
      );

      expect(results1).toEqual(results2);
    });
  });

  describe('Configuration', () => {
    it('should provide default configuration', () => {
      expect(DEFAULT_CONFIG.numRuns).toBe(100);
      expect(DEFAULT_CONFIG.timeout).toBe(30000);
    });

    it('should provide CI configuration with fixed seed', () => {
      expect(CI_CONFIG.numRuns).toBe(100);
      expect(CI_CONFIG.seed).toBe(42);
      expect(CI_CONFIG.verbose).toBe(true);
    });

    it('should detect CI environment', () => {
      // isCI() checks for CI environment variables
      const result = isCI();
      expect(typeof result).toBe('boolean');
    });

    it('should merge configuration overrides', () => {
      const config = getConfig({ numRuns: 500 });
      expect(config.numRuns).toBe(500);
    });
  });

  describe('Property Test Execution', () => {
    it('should execute property test with generator', () => {
      let executionCount = 0;

      pbtFramework.setupPropertyTest(
        fc.integer({ min: 0, max: 100 }),
        (n) => {
          executionCount++;
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(100);
        },
        { numRuns: 50 }
      );

      expect(executionCount).toBe(50);
    });

    it('should run property test and return results', () => {
      const result = pbtFramework.runPropertyTest(
        'test-integers',
        fc.integer({ min: 0, max: 100 }),
        (n) => {
          expect(n).toBeGreaterThanOrEqual(0);
        },
        { numRuns: 20 }
      );

      expect(result.passed).toBe(true);
      expect(result.iterations).toBe(20);
      expect(typeof result.seed).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should detect failing property tests', () => {
      // Suppress expected PBT failure report (this test asserts the framework detects failures)
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = pbtFramework.runPropertyTest(
        'test-failing',
        fc.integer({ min: 0, max: 100 }),
        (n) => {
          if (n > 50) {
            throw new Error('Value too large');
          }
        },
        { numRuns: 100 }
      );
      spy.mockRestore();

      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
      // Counter example should be the failing value (> 50)
      expect(typeof result.counterExample).toBe('number');
      expect(result.counterExample).toBeGreaterThan(50);
    });
  });
});

describe('Domain Generators', () => {
  describe('Project Generator', () => {
    /**
     * Property 11: Mock Data Realism
     * For any generated test data for projects, the data must be realistic
     * and conform to expected domain constraints
     * **Validates: Requirements 3.2**
     */

    it('should generate valid project objects', () => {
      fc.assert(
        fc.property(projectGenerator, (project) => {
          // Verify required fields exist
          expect(project.id).toBeDefined();
          expect(project.name).toBeDefined();
          expect(project.status).toBeDefined();
          expect(project.health).toBeDefined();
          expect(project.created_at).toBeDefined();

          // Verify field types
          expect(typeof project.id).toBe('string');
          expect(typeof project.name).toBe('string');
          expect(typeof project.status).toBe('string');
          expect(typeof project.health).toBe('string');
          expect(typeof project.created_at).toBe('string');

          // Verify constraints
          expect(project.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
          expect(project.name.length).toBeGreaterThan(0);
          expect(PROJECT_STATUSES).toContain(project.status);
          expect(PROJECT_HEALTH_VALUES).toContain(project.health);
          
          // Budget should be null or positive number
          if (project.budget !== null) {
            expect(project.budget).toBeGreaterThanOrEqual(0);
          }

          // created_at should be valid ISO date
          expect(() => new Date(project.created_at)).not.toThrow();

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate projects with all valid statuses', () => {
      const generatedStatuses = new Set<string>();

      fc.assert(
        fc.property(projectGenerator, (project) => {
          generatedStatuses.add(project.status);
          return PROJECT_STATUSES.includes(project.status as any);
        }),
        { numRuns: 200 }
      );

      // Should generate multiple different statuses
      expect(generatedStatuses.size).toBeGreaterThan(1);
    });

    it('should generate projects with all valid health values', () => {
      const generatedHealth = new Set<string>();

      fc.assert(
        fc.property(projectGenerator, (project) => {
          generatedHealth.add(project.health);
          return PROJECT_HEALTH_VALUES.includes(project.health as any);
        }),
        { numRuns: 200 }
      );

      // Should generate all health values
      expect(generatedHealth.size).toBe(PROJECT_HEALTH_VALUES.length);
    });
  });

  describe('User Generator', () => {
    it('should generate valid user objects', () => {
      fc.assert(
        fc.property(userGenerator, (user) => {
          // Verify required fields
          expect(user.id).toBeDefined();
          expect(user.email).toBeDefined();
          expect(user.role).toBeDefined();
          expect(typeof user.is_active).toBe('boolean');

          // Verify constraints
          expect(user.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
          expect(user.email).toContain('@'); // Basic email validation
          expect(USER_ROLES).toContain(user.role);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate users with all valid roles', () => {
      const generatedRoles = new Set<string>();

      fc.assert(
        fc.property(userGenerator, (user) => {
          generatedRoles.add(user.role);
          return USER_ROLES.includes(user.role as any);
        }),
        { numRuns: 200 }
      );

      // Should generate multiple different roles
      expect(generatedRoles.size).toBeGreaterThan(1);
    });
  });

  describe('Filter State Generator', () => {
    it('should generate valid filter state objects', () => {
      fc.assert(
        fc.property(filterStateGenerator, (filterState) => {
          // Verify required fields
          expect(filterState.search).toBeDefined();
          expect(filterState.sortBy).toBeDefined();
          expect(filterState.sortOrder).toBeDefined();

          // Verify constraints
          expect(typeof filterState.search).toBe('string');
          expect(filterState.search.length).toBeLessThanOrEqual(50);
          expect(SORT_FIELDS).toContain(filterState.sortBy);
          expect(SORT_ORDERS).toContain(filterState.sortOrder);

          // Status should be null or valid status
          if (filterState.status !== null) {
            expect(PROJECT_STATUSES).toContain(filterState.status);
          }

          // Date range should be null or have valid structure
          if (filterState.dateRange !== null) {
            expect(filterState.dateRange).toHaveProperty('start');
            expect(filterState.dateRange).toHaveProperty('end');
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Financial Record Generator', () => {
    it('should generate valid financial record objects', () => {
      fc.assert(
        fc.property(financialRecordGenerator, (record) => {
          // Verify required fields
          expect(record.id).toBeDefined();
          expect(record.project_id).toBeDefined();
          expect(record.planned_amount).toBeDefined();
          expect(record.actual_amount).toBeDefined();
          expect(record.currency).toBeDefined();
          expect(record.exchange_rate).toBeDefined();

          // Verify constraints
          expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(record.project_id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(record.planned_amount).toBeGreaterThanOrEqual(0);
          expect(record.actual_amount).toBeGreaterThanOrEqual(0);
          expect(CURRENCIES).toContain(record.currency);
          expect(record.exchange_rate).toBeGreaterThan(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should generate monetary amounts with proper precision', () => {
      fc.assert(
        fc.property(financialRecordGenerator, (record) => {
          // Amounts should have at most 2 decimal places
          const plannedDecimals = (record.planned_amount.toString().split('.')[1] || '').length;
          const actualDecimals = (record.actual_amount.toString().split('.')[1] || '').length;
          
          expect(plannedDecimals).toBeLessThanOrEqual(2);
          expect(actualDecimals).toBeLessThanOrEqual(2);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Domain Generators Class', () => {
    it('should provide all generators through class instance', () => {
      const generators = new DomainGenerators();

      expect(generators.projectGenerator).toBeDefined();
      expect(generators.userGenerator).toBeDefined();
      expect(generators.filterStateGenerator).toBeDefined();
      expect(generators.financialRecordGenerator).toBeDefined();
    });

    it('should create project arrays with specified length', () => {
      fc.assert(
        fc.property(
          domainGenerators.projectArray({ minLength: 5, maxLength: 10 }),
          (projects) => {
            expect(projects.length).toBeGreaterThanOrEqual(5);
            expect(projects.length).toBeLessThanOrEqual(10);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create projects with specific status', () => {
      fc.assert(
        fc.property(
          domainGenerators.projectWithStatus('active'),
          (project) => {
            expect(project.status).toBe('active');
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create users with specific role', () => {
      fc.assert(
        fc.property(
          domainGenerators.userWithRole('admin'),
          (user) => {
            expect(user.role).toBe('admin');
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create active users only', () => {
      fc.assert(
        fc.property(
          domainGenerators.activeUser(),
          (user) => {
            expect(user.is_active).toBe(true);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create projects with budget in range', () => {
      fc.assert(
        fc.property(
          domainGenerators.projectWithBudgetRange(1000, 5000),
          (project) => {
            expect(project.budget).toBeGreaterThanOrEqual(1000);
            expect(project.budget).toBeLessThanOrEqual(5000);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('Framework Helper Methods', () => {
  describe('testProjectProperty', () => {
    it('should test project properties', () => {
      let tested = false;

      pbtFramework.testProjectProperty(
        (project) => {
          tested = true;
          expect(project.id).toBeDefined();
        },
        { numRuns: 10 }
      );

      expect(tested).toBe(true);
    });
  });

  describe('testUserProperty', () => {
    it('should test user properties', () => {
      let tested = false;

      pbtFramework.testUserProperty(
        (user) => {
          tested = true;
          expect(user.email).toContain('@');
        },
        { numRuns: 10 }
      );

      expect(tested).toBe(true);
    });
  });

  describe('testFilterStateProperty', () => {
    it('should test filter state properties', () => {
      let tested = false;

      pbtFramework.testFilterStateProperty(
        (filterState) => {
          tested = true;
          expect(filterState.sortBy).toBeDefined();
        },
        { numRuns: 10 }
      );

      expect(tested).toBe(true);
    });
  });

  describe('testFilterOperation', () => {
    it('should test filter operations with projects and filter state', () => {
      let tested = false;

      pbtFramework.testFilterOperation(
        ({ projects, filterState }) => {
          tested = true;
          expect(Array.isArray(projects)).toBe(true);
          expect(filterState.sortBy).toBeDefined();
        },
        { numRuns: 10 }
      );

      expect(tested).toBe(true);
    });
  });

  describe('reproduceTest', () => {
    it('should reproduce test with specific seed', () => {
      const seed = 42;
      let capturedValue: number | undefined;

      pbtFramework.reproduceTest(
        seed,
        fc.integer({ min: 0, max: 1000 }),
        (n) => {
          capturedValue = n;
        }
      );

      // Run again with same seed - should get same value
      let secondValue: number | undefined;
      pbtFramework.reproduceTest(
        seed,
        fc.integer({ min: 0, max: 1000 }),
        (n) => {
          secondValue = n;
        }
      );

      expect(capturedValue).toBe(secondValue);
    });
  });
});

describe('Property 10: Frontend Framework Integration - Comprehensive Tests', () => {
  /**
   * Additional comprehensive tests for Property 10 to ensure complete coverage
   * of Requirements 3.1 and 3.4
   */

  describe('Fast-check and Jest Integration', () => {
    it('should integrate fast-check assertions with Jest expectations', () => {
      // Property 10: Verify fast-check works seamlessly with Jest
      let executionCount = 0;

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
          executionCount++;
          // Jest expectations should work inside fast-check properties
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(100);
          return true;
        }),
        { numRuns: 100 }
      );

      expect(executionCount).toBe(100);
    });

    it('should handle async property tests with Jest', async () => {
      // Property 10: Async operations should work correctly
      let asyncExecutionCount = 0;

      await fc.assert(
        fc.asyncProperty(fc.integer(), async (n) => {
          asyncExecutionCount++;
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(typeof n).toBe('number');
        }),
        { numRuns: 50 }
      );

      expect(asyncExecutionCount).toBe(50);
    });

    it('should properly report failures to Jest', () => {
      // Property 10: Failures should be caught and reported correctly
      expect(() => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
            if (n > 50) {
              throw new Error('Test failure');
            }
          }),
          { numRuns: 100 }
        );
      }).toThrow();
    });
  });

  describe('Stable Test Execution', () => {
    it('should execute tests with consistent iteration count', () => {
      // Property 10: Test execution should be stable and predictable
      const results: number[] = [];

      pbtFramework.setupPropertyTest(
        fc.integer(),
        (n) => {
          results.push(n);
        },
        { numRuns: 100, seed: 12345 }
      );

      expect(results.length).toBe(100);
    });

    it('should handle large iteration counts without issues', () => {
      // Property 10: Framework should handle large test suites
      let count = 0;

      pbtFramework.setupPropertyTest(
        fc.integer(),
        () => {
          count++;
        },
        { numRuns: 500 }
      );

      expect(count).toBe(500);
    });

    it('should maintain stability across multiple test runs', () => {
      // Property 10: Multiple test runs should be stable
      const run1Results: number[] = [];
      const run2Results: number[] = [];
      const seed = 99999;

      pbtFramework.setupPropertyTest(
        fc.integer({ min: 0, max: 1000 }),
        (n) => {
          run1Results.push(n);
          return true; // Must return true for property to pass
        },
        { numRuns: 50, seed }
      );

      pbtFramework.setupPropertyTest(
        fc.integer({ min: 0, max: 1000 }),
        (n) => {
          run2Results.push(n);
          return true; // Must return true for property to pass
        },
        { numRuns: 50, seed }
      );

      expect(run1Results).toEqual(run2Results);
    });
  });

  describe('Seed Management for CI/CD', () => {
    it('should use fixed seed in CI environment', () => {
      // Property 10: CI/CD should have deterministic behavior
      const ciConfig = CI_CONFIG;
      expect(ciConfig.seed).toBe(42);
      expect(ciConfig.verbose).toBe(true);
    });

    it('should allow seed override for debugging', () => {
      // Property 10: Developers should be able to reproduce failures
      const debugSeed = 777777;
      const framework = createPBTFramework({ seed: debugSeed });
      const config = framework.getConfig();

      expect(config.seed).toBe(debugSeed);
    });

    it('should record seed history for failure reproduction', () => {
      // Property 10: Seed history enables debugging
      const manager = new SeedManager();
      const seed1 = manager.generateSeed();
      const seed2 = manager.generateSeed();

      const history = manager.getSeedHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.map((h) => h.seed)).toContain(seed1);
      expect(history.map((h) => h.seed)).toContain(seed2);
    });

    it('should support environment-based seed configuration', () => {
      // Property 10: Seeds can be configured via environment
      const manager = SeedManager.fromEnvironment();
      expect(manager).toBeInstanceOf(SeedManager);
    });

    it('should provide reproducible test execution with seed', () => {
      // Property 10: Same seed produces same test sequence
      const seed = 54321;
      const values1: number[] = [];
      const values2: number[] = [];

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
          values1.push(n);
          return true;
        }),
        { numRuns: 20, seed }
      );

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
          values2.push(n);
          return true;
        }),
        { numRuns: 20, seed }
      );

      expect(values1).toEqual(values2);
    });
  });

  describe('Test Suite Execution', () => {
    it('should run multiple property tests in a suite', () => {
      // Property 10: Framework should support test suites
      const results = pbtFramework.runTestSuite([
        {
          name: 'test-1',
          generator: fc.integer(),
          testFunction: (n) => expect(typeof n).toBe('number'),
          options: { numRuns: 50 },
        },
        {
          name: 'test-2',
          generator: fc.string(),
          testFunction: (s) => expect(typeof s).toBe('string'),
          options: { numRuns: 50 },
        },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
      expect(results[0].iterations).toBe(50);
      expect(results[1].iterations).toBe(50);
    });

    it('should aggregate results from test suite', () => {
      // Property 10: Test results should be properly aggregated
      const results = pbtFramework.runTestSuite([
        {
          name: 'passing-test',
          generator: fc.integer(),
          testFunction: () => {},
          options: { numRuns: 10 },
        },
        {
          name: 'failing-test',
          generator: fc.integer(),
          testFunction: (n) => {
            if (n > 5) throw new Error('Fail');
          },
          options: { numRuns: 100 },
        },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should support runtime configuration updates', () => {
      // Property 10: Configuration should be flexible
      const framework = createPBTFramework({ numRuns: 100 });
      expect(framework.getConfig().numRuns).toBe(100);

      framework.setConfig({ numRuns: 200 });
      expect(framework.getConfig().numRuns).toBe(200);
    });

    it('should merge partial configuration overrides', () => {
      // Property 10: Partial config updates should work
      const framework = createPBTFramework({
        numRuns: 100,
        seed: 42,
        verbose: false,
      });

      framework.setConfig({ verbose: true });

      const config = framework.getConfig();
      expect(config.numRuns).toBe(100);
      expect(config.seed).toBe(42);
      expect(config.verbose).toBe(true);
    });

    it('should provide appropriate defaults for different environments', () => {
      // Property 10: Environment-specific defaults should be sensible
      const defaultConfig = DEFAULT_CONFIG;
      const ciConfig = CI_CONFIG;

      expect(defaultConfig.numRuns).toBeGreaterThanOrEqual(100);
      expect(ciConfig.numRuns).toBeGreaterThanOrEqual(100);
      expect(ciConfig.seed).toBeDefined();
      expect(ciConfig.verbose).toBe(true);
    });
  });

  describe('Error Handling and Debugging', () => {
    it('should provide detailed error information on failure', () => {
      // Property 10: Failures should be debuggable
      const result = pbtFramework.runPropertyTest(
        'error-test',
        fc.integer({ min: 0, max: 100 }),
        (n) => {
          if (n > 75) {
            throw new Error('Value exceeds threshold');
          }
        },
        { numRuns: 100 }
      );

      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Property failed');
      expect(result.seed).toBeDefined();
    });

    it('should support test reproduction with captured seed', () => {
      // Property 10: Failed tests should be reproducible
      const result = pbtFramework.runPropertyTest(
        'reproducible-failure',
        fc.integer({ min: 0, max: 100 }),
        (n) => {
          if (n === 42) {
            throw new Error('Special case failure');
          }
        },
        { numRuns: 100 }
      );

      if (!result.passed) {
        // Should be able to reproduce with the same seed
        const reproResult = pbtFramework.runPropertyTest(
          'reproduction',
          fc.integer({ min: 0, max: 100 }),
          (n) => {
            if (n === 42) {
              throw new Error('Special case failure');
            }
          },
          { numRuns: 100, seed: result.seed }
        );

        expect(reproResult.passed).toBe(false);
        expect(reproResult.seed).toBe(result.seed);
      }
    });
  });

  describe('Integration with Domain Generators', () => {
    it('should seamlessly integrate domain generators with framework', () => {
      // Property 10: Domain generators should work with framework
      let projectCount = 0;

      pbtFramework.testProjectProperty(
        (project) => {
          projectCount++;
          expect(project.id).toBeDefined();
          expect(project.name).toBeDefined();
        },
        { numRuns: 100 }
      );

      expect(projectCount).toBe(100);
    });

    it('should support complex generator combinations', () => {
      // Property 10: Complex scenarios should be testable
      const complexGenerator = fc.record({
        projects: domainGenerators.projectArray({ minLength: 1, maxLength: 10 }),
        users: domainGenerators.userArray({ minLength: 1, maxLength: 5 }),
        filterState: domainGenerators.filterStateGenerator,
      });

      let testCount = 0;

      pbtFramework.setupPropertyTest(
        complexGenerator,
        (data) => {
          testCount++;
          expect(data.projects.length).toBeGreaterThanOrEqual(1);
          expect(data.users.length).toBeGreaterThanOrEqual(1);
          expect(data.filterState.sortBy).toBeDefined();
        },
        { numRuns: 100 }
      );

      expect(testCount).toBe(100);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high iteration counts efficiently', () => {
      // Property 10: Framework should be performant
      const startTime = Date.now();

      pbtFramework.setupPropertyTest(
        fc.integer(),
        () => {
          // Simple test
        },
        { numRuns: 1000 }
      );

      const duration = Date.now() - startTime;
      // Should complete 1000 iterations in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle complex generators efficiently', () => {
      // Property 10: Complex generators should not cause performance issues
      const startTime = Date.now();

      pbtFramework.setupPropertyTest(
        domainGenerators.projectArray({ minLength: 10, maxLength: 50 }),
        (projects) => {
          expect(projects.length).toBeGreaterThanOrEqual(10);
        },
        { numRuns: 100 }
      );

      const duration = Date.now() - startTime;
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);
    });
  });
});
