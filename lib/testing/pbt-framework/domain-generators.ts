/**
 * Domain-Specific Generators for Property-Based Testing
 * 
 * Provides fast-check generators for PPM domain objects including:
 * - Projects with realistic constraints
 * - Users with role-based attributes
 * - Filter states for UI testing
 * - Financial records for variance testing
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */

import * as fc from 'fast-check';

// ============================================================================
// Project Generators
// ============================================================================

/**
 * Project status values used in the PPM system
 */
export const PROJECT_STATUSES = ['planning', 'active', 'completed', 'cancelled', 'on_hold'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

/**
 * Project health indicators
 */
export const PROJECT_HEALTH_VALUES = ['green', 'yellow', 'red'] as const;
export type ProjectHealth = typeof PROJECT_HEALTH_VALUES[number];

/**
 * Generated project data structure
 */
export interface GeneratedProject {
  id: string;
  name: string;
  status: ProjectStatus;
  budget: number | null;
  health: ProjectHealth;
  created_at: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * Generator for valid project IDs (UUIDs)
 */
export const projectIdGenerator = fc.uuid();

/**
 * Generator for project names with realistic constraints
 */
export const projectNameGenerator = fc.string({ minLength: 1, maxLength: 100 })
  .filter(name => name.trim().length > 0)
  .map(name => name.trim());

/**
 * Generator for project status
 */
export const projectStatusGenerator = fc.constantFrom(...PROJECT_STATUSES);

/**
 * Generator for project health
 */
export const projectHealthGenerator = fc.constantFrom(...PROJECT_HEALTH_VALUES);

/**
 * Generator for project budget (positive numbers or null)
 * Uses Math.fround to ensure 32-bit float compatibility
 */
export const projectBudgetGenerator = fc.option(
  fc.float({ min: Math.fround(0), max: Math.fround(10_000_000), noNaN: true }),
  { nil: null }
);

/**
 * Generator for ISO date strings
 * Uses integer timestamps to avoid invalid date issues
 */
const MIN_DATE_MS = new Date('2020-01-01').getTime();
const MAX_DATE_MS = new Date('2030-12-31').getTime();

export const isoDateStringGenerator = fc.integer({
  min: MIN_DATE_MS,
  max: MAX_DATE_MS,
}).map(ms => new Date(ms).toISOString());

/**
 * Generator for complete project objects
 */
export const projectGenerator: fc.Arbitrary<GeneratedProject> = fc.record({
  id: projectIdGenerator,
  name: projectNameGenerator,
  status: projectStatusGenerator,
  budget: projectBudgetGenerator,
  health: projectHealthGenerator,
  created_at: isoDateStringGenerator,
});

/**
 * Generator for project with optional fields
 */
export const fullProjectGenerator: fc.Arbitrary<GeneratedProject> = fc.record({
  id: projectIdGenerator,
  name: projectNameGenerator,
  status: projectStatusGenerator,
  budget: projectBudgetGenerator,
  health: projectHealthGenerator,
  created_at: isoDateStringGenerator,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  start_date: fc.option(isoDateStringGenerator, { nil: undefined }),
  end_date: fc.option(isoDateStringGenerator, { nil: undefined }),
});

/**
 * Generator for arrays of projects
 */
export const projectArrayGenerator = (options?: { minLength?: number; maxLength?: number }) =>
  fc.array(projectGenerator, {
    minLength: options?.minLength ?? 0,
    maxLength: options?.maxLength ?? 100,
  });

// ============================================================================
// User Generators
// ============================================================================

/**
 * User roles in the PPM system
 */
export const USER_ROLES = ['admin', 'portfolio_manager', 'project_manager', 'viewer'] as const;
export type UserRole = typeof USER_ROLES[number];

/**
 * Generated user data structure
 */
export interface GeneratedUser {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  name?: string;
  created_at?: string;
}

/**
 * Generator for user IDs (UUIDs)
 */
export const userIdGenerator = fc.uuid();

/**
 * Generator for valid email addresses
 */
export const emailGenerator = fc.emailAddress();

/**
 * Generator for user roles
 */
export const userRoleGenerator = fc.constantFrom(...USER_ROLES);

/**
 * Generator for user names
 */
export const userNameGenerator = fc.string({ minLength: 1, maxLength: 100 })
  .filter(name => name.trim().length > 0)
  .map(name => name.trim());

/**
 * Generator for complete user objects
 */
export const userGenerator: fc.Arbitrary<GeneratedUser> = fc.record({
  id: userIdGenerator,
  email: emailGenerator,
  role: userRoleGenerator,
  is_active: fc.boolean(),
});

/**
 * Generator for user with optional fields
 */
export const fullUserGenerator: fc.Arbitrary<GeneratedUser> = fc.record({
  id: userIdGenerator,
  email: emailGenerator,
  role: userRoleGenerator,
  is_active: fc.boolean(),
  name: fc.option(userNameGenerator, { nil: undefined }),
  created_at: fc.option(isoDateStringGenerator, { nil: undefined }),
});

/**
 * Generator for arrays of users
 */
export const userArrayGenerator = (options?: { minLength?: number; maxLength?: number }) =>
  fc.array(userGenerator, {
    minLength: options?.minLength ?? 0,
    maxLength: options?.maxLength ?? 50,
  });

// ============================================================================
// Filter State Generators
// ============================================================================

/**
 * Sort field options
 */
export const SORT_FIELDS = ['name', 'created_at', 'budget', 'status', 'health'] as const;
export type SortField = typeof SORT_FIELDS[number];

/**
 * Sort order options
 */
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = typeof SORT_ORDERS[number];

/**
 * Generated filter state structure
 */
export interface GeneratedFilterState {
  search: string;
  status: ProjectStatus | null;
  dateRange: {
    start: Date | null;
    end: Date | null;
  } | null;
  sortBy: SortField;
  sortOrder: SortOrder;
  category?: string;
}

/**
 * Generator for search strings
 */
export const searchStringGenerator = fc.string({ maxLength: 50 });

/**
 * Generator for optional status filter
 */
export const statusFilterGenerator = fc.option(
  fc.constantFrom(...PROJECT_STATUSES),
  { nil: null }
);

/**
 * Generator for date range filter
 * Uses integer timestamps to avoid invalid date issues
 */
export const dateRangeGenerator = fc.option(
  fc.record({
    start: fc.option(fc.integer({ min: MIN_DATE_MS, max: MAX_DATE_MS }).map(ms => new Date(ms)), { nil: null }),
    end: fc.option(fc.integer({ min: MIN_DATE_MS, max: MAX_DATE_MS }).map(ms => new Date(ms)), { nil: null }),
  }),
  { nil: null }
);

/**
 * Generator for sort field
 */
export const sortFieldGenerator = fc.constantFrom(...SORT_FIELDS);

/**
 * Generator for sort order
 */
export const sortOrderGenerator = fc.constantFrom(...SORT_ORDERS);

/**
 * Generator for complete filter state
 */
export const filterStateGenerator: fc.Arbitrary<GeneratedFilterState> = fc.record({
  search: searchStringGenerator,
  status: statusFilterGenerator,
  dateRange: dateRangeGenerator,
  sortBy: sortFieldGenerator,
  sortOrder: sortOrderGenerator,
});

/**
 * Generator for filter state with category
 */
export const fullFilterStateGenerator: fc.Arbitrary<GeneratedFilterState> = fc.record({
  search: searchStringGenerator,
  status: statusFilterGenerator,
  dateRange: dateRangeGenerator,
  sortBy: sortFieldGenerator,
  sortOrder: sortOrderGenerator,
  category: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
});

// ============================================================================
// Financial Record Generators
// ============================================================================

/**
 * Currency codes supported by the system
 */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;
export type Currency = typeof CURRENCIES[number];

/**
 * Generated financial record structure
 */
export interface GeneratedFinancialRecord {
  id: string;
  project_id: string;
  planned_amount: number;
  actual_amount: number;
  currency: Currency;
  exchange_rate: number;
  category?: string;
  description?: string;
}

/**
 * Generator for currency codes
 */
export const currencyGenerator = fc.constantFrom(...CURRENCIES);

/**
 * Generator for monetary amounts (positive, reasonable precision)
 * Uses Math.fround to ensure 32-bit float compatibility
 */
export const monetaryAmountGenerator = fc.float({
  min: Math.fround(0),
  max: Math.fround(1_000_000),
  noNaN: true,
}).map(n => Math.round(n * 100) / 100); // Round to 2 decimal places

/**
 * Generator for exchange rates
 * Uses Math.fround to ensure 32-bit float compatibility
 */
export const exchangeRateGenerator = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(100),
  noNaN: true,
}).map(n => Math.round(n * 10000) / 10000); // Round to 4 decimal places

/**
 * Generator for financial records
 */
export const financialRecordGenerator: fc.Arbitrary<GeneratedFinancialRecord> = fc.record({
  id: fc.uuid(),
  project_id: fc.uuid(),
  planned_amount: monetaryAmountGenerator,
  actual_amount: monetaryAmountGenerator,
  currency: currencyGenerator,
  exchange_rate: exchangeRateGenerator,
});

/**
 * Generator for financial record with optional fields
 */
export const fullFinancialRecordGenerator: fc.Arbitrary<GeneratedFinancialRecord> = fc.record({
  id: fc.uuid(),
  project_id: fc.uuid(),
  planned_amount: monetaryAmountGenerator,
  actual_amount: monetaryAmountGenerator,
  currency: currencyGenerator,
  exchange_rate: exchangeRateGenerator,
  category: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
});

// ============================================================================
// Domain Generators Class
// ============================================================================

/**
 * Domain-specific generators for PPM frontend testing
 * 
 * Provides a centralized collection of generators for all PPM domain objects.
 * Use this class to access generators in a consistent way across tests.
 */
export class DomainGenerators {
  // Project generators
  readonly projectGenerator = projectGenerator;
  readonly fullProjectGenerator = fullProjectGenerator;
  readonly projectIdGenerator = projectIdGenerator;
  readonly projectNameGenerator = projectNameGenerator;
  readonly projectStatusGenerator = projectStatusGenerator;
  readonly projectHealthGenerator = projectHealthGenerator;
  readonly projectBudgetGenerator = projectBudgetGenerator;

  // User generators
  readonly userGenerator = userGenerator;
  readonly fullUserGenerator = fullUserGenerator;
  readonly userIdGenerator = userIdGenerator;
  readonly emailGenerator = emailGenerator;
  readonly userRoleGenerator = userRoleGenerator;

  // Filter state generators
  readonly filterStateGenerator = filterStateGenerator;
  readonly fullFilterStateGenerator = fullFilterStateGenerator;
  readonly searchStringGenerator = searchStringGenerator;
  readonly sortFieldGenerator = sortFieldGenerator;
  readonly sortOrderGenerator = sortOrderGenerator;

  // Financial record generators
  readonly financialRecordGenerator = financialRecordGenerator;
  readonly fullFinancialRecordGenerator = fullFinancialRecordGenerator;
  readonly currencyGenerator = currencyGenerator;
  readonly monetaryAmountGenerator = monetaryAmountGenerator;
  readonly exchangeRateGenerator = exchangeRateGenerator;

  // Utility generators
  readonly isoDateStringGenerator = isoDateStringGenerator;

  /**
   * Creates an array generator for projects
   */
  projectArray(options?: { minLength?: number; maxLength?: number }) {
    return projectArrayGenerator(options);
  }

  /**
   * Creates an array generator for users
   */
  userArray(options?: { minLength?: number; maxLength?: number }) {
    return userArrayGenerator(options);
  }

  /**
   * Creates an array generator for financial records
   */
  financialRecordArray(options?: { minLength?: number; maxLength?: number }) {
    return fc.array(financialRecordGenerator, {
      minLength: options?.minLength ?? 0,
      maxLength: options?.maxLength ?? 100,
    });
  }

  /**
   * Creates a generator for projects with specific status
   */
  projectWithStatus(status: ProjectStatus) {
    return fc.record({
      id: projectIdGenerator,
      name: projectNameGenerator,
      status: fc.constant(status),
      budget: projectBudgetGenerator,
      health: projectHealthGenerator,
      created_at: isoDateStringGenerator,
    });
  }

  /**
   * Creates a generator for users with specific role
   */
  userWithRole(role: UserRole) {
    return fc.record({
      id: userIdGenerator,
      email: emailGenerator,
      role: fc.constant(role),
      is_active: fc.boolean(),
    });
  }

  /**
   * Creates a generator for active users only
   */
  activeUser() {
    return fc.record({
      id: userIdGenerator,
      email: emailGenerator,
      role: userRoleGenerator,
      is_active: fc.constant(true),
    });
  }

  /**
   * Creates a generator for projects with budget constraints
   */
  projectWithBudgetRange(min: number, max: number) {
    return fc.record({
      id: projectIdGenerator,
      name: projectNameGenerator,
      status: projectStatusGenerator,
      budget: fc.float({ min, max, noNaN: true }),
      health: projectHealthGenerator,
      created_at: isoDateStringGenerator,
    });
  }
}

// Export singleton instance for convenience
export const domainGenerators = new DomainGenerators();
