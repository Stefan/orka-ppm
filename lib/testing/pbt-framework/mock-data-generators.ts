/**
 * Realistic Mock Data Generators for Property-Based Testing
 * 
 * Provides enhanced generators that create realistic mock data for:
 * - Projects with realistic business constraints
 * - Users with realistic attributes and relationships
 * - Financial records with realistic amounts and patterns
 * - Complex domain scenarios for integration testing
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 3.2**
 */

import * as fc from 'fast-check';
import {
  projectGenerator,
  userGenerator,
  financialRecordGenerator,
  projectStatusGenerator,
  projectHealthGenerator,
  userRoleGenerator,
  currencyGenerator,
  isoDateStringGenerator,
  type GeneratedProject,
  type GeneratedUser,
  type GeneratedFinancialRecord,
  type ProjectStatus,
  type UserRole,
} from './domain-generators';

// ============================================================================
// Realistic Project Generators
// ============================================================================

/**
 * Generates projects with realistic business constraints
 * - Budget aligns with project status
 * - Health correlates with project progress
 * - Dates are logically ordered
 */
export const realisticProjectGenerator: fc.Arbitrary<GeneratedProject & {
  start_date: string;
  end_date: string;
  description: string;
  progress: number;
}> = fc
  .record({
    id: fc.uuid(),
    name: fc.oneof(
      fc.constant('Website Redesign'),
      fc.constant('Mobile App Development'),
      fc.constant('Infrastructure Upgrade'),
      fc.constant('Customer Portal'),
      fc.constant('Data Migration'),
      fc.constant('Security Enhancement'),
      fc.constant('Performance Optimization'),
      fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0)
    ),
    status: projectStatusGenerator,
    health: projectHealthGenerator,
    created_at: isoDateStringGenerator,
  })
  .chain((base) => {
    // Generate dates that make sense for the project status
    const startDateMs = new Date(base.created_at).getTime();
    const durationDays = base.status === 'completed' 
      ? fc.integer({ min: 30, max: 365 })
      : fc.integer({ min: 60, max: 730 });

    return durationDays.chain((days) => {
      const endDateMs = startDateMs + days * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      // Calculate progress based on status and dates
      let progress: number;
      if (base.status === 'completed') {
        progress = 100;
      } else if (base.status === 'cancelled') {
        progress = fc.sample(fc.integer({ min: 0, max: 80 }), 1)[0];
      } else if (base.status === 'planning') {
        progress = fc.sample(fc.integer({ min: 0, max: 20 }), 1)[0];
      } else {
        const elapsed = now - startDateMs;
        const total = endDateMs - startDateMs;
        progress = Math.min(95, Math.max(10, Math.floor((elapsed / total) * 100)));
      }

      // Budget correlates with project size and status
      const budgetMultiplier = base.status === 'completed' ? 1.2 : 1.0;
      const budget = Math.round(
        fc.sample(fc.float({ min: Math.fround(50000), max: Math.fround(5000000), noNaN: true }), 1)[0] * budgetMultiplier * 100
      ) / 100;

      // Health correlates with progress and status
      let health: 'green' | 'yellow' | 'red';
      if (base.status === 'cancelled') {
        health = 'red';
      } else if (base.status === 'completed') {
        health = 'green';
      } else if (progress < 30 && base.health === 'red') {
        health = 'red';
      } else if (progress > 70 && base.health === 'green') {
        health = 'green';
      } else {
        health = base.health;
      }

      return fc.constant({
        ...base,
        budget,
        health,
        start_date: new Date(startDateMs).toISOString(),
        end_date: new Date(endDateMs).toISOString(),
        description: `${base.name} - A comprehensive project to improve business operations`,
        progress,
      });
    });
  });

/**
 * Generates a project with team members
 */
export interface ProjectWithTeam extends GeneratedProject {
  team_members: GeneratedUser[];
  project_manager: GeneratedUser;
}

export const projectWithTeamGenerator: fc.Arbitrary<ProjectWithTeam> = fc
  .record({
    project: realisticProjectGenerator,
    teamSize: fc.integer({ min: 3, max: 15 }),
  })
  .chain(({ project, teamSize }) => {
    return fc
      .array(userGenerator, { minLength: teamSize, maxLength: teamSize })
      .map((team) => {
        // Ensure at least one project manager
        const pmIndex = Math.floor(Math.random() * team.length);
        const projectManager = { ...team[pmIndex], role: 'project_manager' as UserRole };
        team[pmIndex] = projectManager;

        return {
          ...project,
          team_members: team,
          project_manager: projectManager,
        };
      });
  });

// ============================================================================
// Realistic Financial Record Generators
// ============================================================================

/**
 * Generates financial records with realistic variance patterns
 */
export interface RealisticFinancialRecord extends GeneratedFinancialRecord {
  variance_amount: number;
  variance_percentage: number;
  period: string;
}

export const realisticFinancialRecordGenerator: fc.Arbitrary<RealisticFinancialRecord> = fc
  .record({
    id: fc.uuid(),
    project_id: fc.uuid(),
    currency: currencyGenerator,
    exchange_rate: fc.float({ min: 0.5, max: 2.0, noNaN: true }).map(n => Math.round(n * 10000) / 10000),
    period: fc.oneof(
      fc.constant('2024-Q1'),
      fc.constant('2024-Q2'),
      fc.constant('2024-Q3'),
      fc.constant('2024-Q4'),
      fc.constant('2025-Q1')
    ),
  })
  .chain((base) => {
    // Generate planned amount
    return fc.float({ min: Math.fround(10000), max: Math.fround(500000), noNaN: true }).chain((planned) => {
      const plannedAmount = Math.round(planned * 100) / 100;

      // Generate realistic variance (-20% to +30%)
      return fc.float({ min: Math.fround(-0.2), max: Math.fround(0.3), noNaN: true }).map((variancePercent) => {
        const actualAmount = Math.round(plannedAmount * (1 + variancePercent) * 100) / 100;
        const varianceAmount = actualAmount - plannedAmount;
        const variancePercentage = (varianceAmount / plannedAmount) * 100;

        return {
          ...base,
          planned_amount: plannedAmount,
          actual_amount: actualAmount,
          variance_amount: Math.round(varianceAmount * 100) / 100,
          variance_percentage: Math.round(variancePercentage * 100) / 100,
        };
      });
    });
  });

/**
 * Generates a complete financial scenario for a project
 */
export interface ProjectFinancialScenario {
  project: GeneratedProject;
  records: RealisticFinancialRecord[];
  total_planned: number;
  total_actual: number;
  total_variance: number;
}

export const projectFinancialScenarioGenerator: fc.Arbitrary<ProjectFinancialScenario> = fc
  .record({
    project: realisticProjectGenerator,
    recordCount: fc.integer({ min: 4, max: 12 }),
  })
  .chain(({ project, recordCount }) => {
    return fc
      .array(realisticFinancialRecordGenerator, { minLength: recordCount, maxLength: recordCount })
      .map((records) => {
        // Ensure all records belong to the same project
        const projectRecords = records.map((r) => ({ ...r, project_id: project.id }));

        const total_planned = projectRecords.reduce((sum, r) => sum + r.planned_amount, 0);
        const total_actual = projectRecords.reduce((sum, r) => sum + r.actual_amount, 0);
        const total_variance = total_actual - total_planned;

        return {
          project,
          records: projectRecords,
          total_planned: Math.round(total_planned * 100) / 100,
          total_actual: Math.round(total_actual * 100) / 100,
          total_variance: Math.round(total_variance * 100) / 100,
        };
      });
  });

// ============================================================================
// Realistic User Generators
// ============================================================================

/**
 * Generates users with realistic attributes
 */
export interface RealisticUser extends GeneratedUser {
  name: string;
  created_at: string;
  last_login?: string;
  permissions: string[];
}

export const realisticUserGenerator: fc.Arbitrary<RealisticUser> = fc
  .record({
    id: fc.uuid(),
    role: userRoleGenerator,
    is_active: fc.boolean(),
    created_at: isoDateStringGenerator,
  })
  .chain((base) => {
    // Generate realistic name
    const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

    return fc
      .record({
        firstName: fc.constantFrom(...firstNames),
        lastName: fc.constantFrom(...lastNames),
      })
      .map(({ firstName, lastName }) => {
        const name = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;

        // Permissions based on role
        let permissions: string[];
        switch (base.role) {
          case 'admin':
            permissions = ['read', 'write', 'delete', 'manage_users', 'manage_projects', 'view_financials'];
            break;
          case 'portfolio_manager':
            permissions = ['read', 'write', 'manage_projects', 'view_financials'];
            break;
          case 'project_manager':
            permissions = ['read', 'write', 'view_financials'];
            break;
          case 'viewer':
            permissions = ['read'];
            break;
          default:
            permissions = ['read'];
        }

        // Last login for active users
        const last_login = base.is_active
          ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

        return {
          ...base,
          name,
          email,
          permissions,
          last_login,
        };
      });
  });

// ============================================================================
// Complex Scenario Generators
// ============================================================================

/**
 * Generates a complete portfolio scenario with multiple projects
 */
export interface PortfolioScenario {
  id: string;
  name: string;
  projects: GeneratedProject[];
  manager: RealisticUser;
  total_budget: number;
  active_projects: number;
  completed_projects: number;
}

export const portfolioScenarioGenerator: fc.Arbitrary<PortfolioScenario> = fc
  .record({
    id: fc.uuid(),
    name: fc.oneof(
      fc.constant('Digital Transformation Portfolio'),
      fc.constant('Infrastructure Modernization'),
      fc.constant('Customer Experience Initiative'),
      fc.constant('Product Development Portfolio')
    ),
    projectCount: fc.integer({ min: 5, max: 20 }),
  })
  .chain(({ id, name, projectCount }) => {
    return fc
      .record({
        projects: fc.array(realisticProjectGenerator, { minLength: projectCount, maxLength: projectCount }),
        manager: realisticUserGenerator,
      })
      .map(({ projects, manager }) => {
        // Ensure manager has portfolio_manager role
        const portfolioManager = { ...manager, role: 'portfolio_manager' as UserRole };

        const total_budget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
        const active_projects = projects.filter((p) => p.status === 'active').length;
        const completed_projects = projects.filter((p) => p.status === 'completed').length;

        return {
          id,
          name,
          projects,
          manager: portfolioManager,
          total_budget: Math.round(total_budget * 100) / 100,
          active_projects,
          completed_projects,
        };
      });
  });

/**
 * Generates time-series data for project metrics
 */
export interface ProjectMetricsTimeSeries {
  project_id: string;
  metrics: Array<{
    date: string;
    budget_spent: number;
    progress: number;
    team_size: number;
    health: 'green' | 'yellow' | 'red';
  }>;
}

export const projectMetricsTimeSeriesGenerator: fc.Arbitrary<ProjectMetricsTimeSeries> = fc
  .record({
    project_id: fc.uuid(),
    dataPoints: fc.integer({ min: 10, max: 30 }),
  })
  .chain(({ project_id, dataPoints }) => {
    const startDate = new Date('2024-01-01').getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    return fc
      .array(
        fc.record({
          dayOffset: fc.integer({ min: 0, max: 365 }),
          budget_spent: fc.float({ min: 0, max: 1, noNaN: true }),
          progress: fc.integer({ min: 0, max: 100 }),
          team_size: fc.integer({ min: 3, max: 15 }),
          health: fc.constantFrom('green' as const, 'yellow' as const, 'red' as const),
        }),
        { minLength: dataPoints, maxLength: dataPoints }
      )
      .map((points) => {
        // Sort by date and ensure progress is monotonically increasing
        const sortedPoints = points
          .sort((a, b) => a.dayOffset - b.dayOffset)
          .map((point, index, arr) => {
            const progress = index === 0 ? point.progress : Math.max(arr[index - 1].progress, point.progress);
            return {
              date: new Date(startDate + point.dayOffset * dayMs).toISOString(),
              budget_spent: Math.round(point.budget_spent * 1000000 * 100) / 100,
              progress: Math.min(100, progress),
              team_size: point.team_size,
              health: point.health,
            };
          });

        // Ensure progress is truly monotonic by fixing any decreases
        for (let i = 1; i < sortedPoints.length; i++) {
          if (sortedPoints[i].progress < sortedPoints[i - 1].progress) {
            sortedPoints[i].progress = sortedPoints[i - 1].progress;
          }
        }

        return {
          project_id,
          metrics: sortedPoints,
        };
      });
  });

// ============================================================================
// Export all generators
// ============================================================================

export const mockDataGenerators = {
  // Realistic generators
  realisticProject: realisticProjectGenerator,
  realisticUser: realisticUserGenerator,
  realisticFinancialRecord: realisticFinancialRecordGenerator,

  // Complex scenarios
  projectWithTeam: projectWithTeamGenerator,
  projectFinancialScenario: projectFinancialScenarioGenerator,
  portfolioScenario: portfolioScenarioGenerator,
  projectMetricsTimeSeries: projectMetricsTimeSeriesGenerator,
};
