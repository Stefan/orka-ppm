/**
 * Frontend Property-Based Testing Framework
 * 
 * A comprehensive property-based testing framework for TypeScript/React applications
 * using fast-check and Jest. Provides domain-specific generators for PPM objects
 * and stable test execution with seed management for CI/CD reproducibility.
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.1, 3.4**
 * 
 * @example
 * ```typescript
 * import { pbtFramework, fc } from '@/lib/testing/pbt-framework';
 * 
 * describe('Project Properties', () => {
 *   it('should have valid project structure', () => {
 *     pbtFramework.testProjectProperty((project) => {
 *       expect(project.id).toBeDefined();
 *       expect(project.name.length).toBeGreaterThan(0);
 *       expect(['green', 'yellow', 'red']).toContain(project.health);
 *     });
 *   });
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Using generators directly
 * import { domainGenerators, fc } from '@/lib/testing/pbt-framework';
 * 
 * fc.assert(
 *   fc.property(domainGenerators.projectGenerator, (project) => {
 *     return project.id.length === 36; // UUID length
 *   }),
 *   { numRuns: 100 }
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // CI/CD reproducible tests
 * import { createPBTFramework, CI_CONFIG } from '@/lib/testing/pbt-framework';
 * 
 * const framework = createPBTFramework(CI_CONFIG);
 * framework.testProjectProperty((project) => {
 *   // Test with fixed seed for reproducibility
 * });
 * ```
 */

// Main framework exports
export {
  FrontendPBTFramework,
  createPBTFramework,
  pbtFramework,
  fc,
  type PropertyTestOptions,
  type PropertyTestResult,
} from './frontend-pbt-framework';

// Domain generators exports
export {
  DomainGenerators,
  domainGenerators,
  // Project generators
  projectGenerator,
  fullProjectGenerator,
  projectIdGenerator,
  projectNameGenerator,
  projectStatusGenerator,
  projectHealthGenerator,
  projectBudgetGenerator,
  projectArrayGenerator,
  // User generators
  userGenerator,
  fullUserGenerator,
  userIdGenerator,
  emailGenerator,
  userRoleGenerator,
  userArrayGenerator,
  // Filter state generators
  filterStateGenerator,
  fullFilterStateGenerator,
  searchStringGenerator,
  sortFieldGenerator,
  sortOrderGenerator,
  dateRangeGenerator,
  statusFilterGenerator,
  // Financial record generators
  financialRecordGenerator,
  fullFinancialRecordGenerator,
  currencyGenerator,
  monetaryAmountGenerator,
  exchangeRateGenerator,
  // Utility generators
  isoDateStringGenerator,
  // Types
  type GeneratedProject,
  type GeneratedUser,
  type GeneratedFilterState,
  type GeneratedFinancialRecord,
  type ProjectStatus,
  type ProjectHealth,
  type UserRole,
  type SortField,
  type SortOrder,
  type Currency,
  // Constants
  PROJECT_STATUSES,
  PROJECT_HEALTH_VALUES,
  USER_ROLES,
  SORT_FIELDS,
  SORT_ORDERS,
  CURRENCIES,
} from './domain-generators';

// Configuration exports
export {
  type PBTConfig,
  DEFAULT_CONFIG,
  CI_CONFIG,
  DEV_CONFIG,
  getConfig,
  getFastCheckOptions,
  isCI,
  SeedManager,
  globalSeedManager,
  type TestReporter,
  type TestResult,
  ConsoleTestReporter,
} from './test-config';

// Mock data generators exports
export {
  mockDataGenerators,
  realisticProjectGenerator,
  realisticUserGenerator,
  realisticFinancialRecordGenerator,
  projectWithTeamGenerator,
  projectFinancialScenarioGenerator,
  portfolioScenarioGenerator,
  projectMetricsTimeSeriesGenerator,
  type RealisticUser,
  type RealisticFinancialRecord,
  type ProjectWithTeam,
  type ProjectFinancialScenario,
  type PortfolioScenario,
  type ProjectMetricsTimeSeries,
} from './mock-data-generators';

// React testing utilities exports
export {
  reactTestingUtils,
  generateBooleanPropCombinations,
  propCombinationGenerator,
  optionalPropGenerator,
  testComponentWithProps,
  testComponentRenders,
  asyncStateGenerator,
  testAsyncOperation,
  asyncOperationSequenceGenerator,
  stateTransitionGenerator,
  testStateTransitions,
  testStateInvariants,
  testHookWithInputs,
  type AsyncState,
  type AsyncOperationSequence,
  type StateTransition,
  type StateInvariant,
  type ComponentTestResult,
} from './react-testing-utils';

// Filter operations exports
export {
  applyFilters,
  searchProjects,
  filterByStatus,
  filterByDateRange,
  sortProjects,
  applyCombinedFilters,
  haveSameProjects,
  projectMatchesSearch,
  projectMatchesFilters,
} from './filter-operations';

// Filter state management exports
export {
  simulateFilterStatePersistence,
  validateFilterStatePersistence,
  measureFilterPerformance,
  validateFilterPerformanceConsistency,
  validateFilterPerformanceScaling,
  simulateUIFilterBehavior,
  validateFilterStateUpdates,
  measureFilterMemoryUsage,
} from './filter-state-management';
