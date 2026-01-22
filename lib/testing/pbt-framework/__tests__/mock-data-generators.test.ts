/**
 * Tests for Realistic Mock Data Generators
 * 
 * Validates that generated mock data is realistic and conforms to domain constraints.
 * 
 * **Feature: property-based-testing**
 * **Property 11: Mock Data Realism**
 * **Validates: Requirements 3.2**
 */

import * as fc from 'fast-check';
import {
  mockDataGenerators,
  realisticProjectGenerator,
  realisticUserGenerator,
  realisticFinancialRecordGenerator,
  projectWithTeamGenerator,
  projectFinancialScenarioGenerator,
  portfolioScenarioGenerator,
  projectMetricsTimeSeriesGenerator,
} from '../mock-data-generators';
import { PROJECT_STATUSES, PROJECT_HEALTH_VALUES, USER_ROLES } from '../domain-generators';

describe('Realistic Mock Data Generators', () => {
  describe('Property 11: Mock Data Realism', () => {
    /**
     * Property 11: Mock Data Realism
     * For any generated test data for projects, users, and financial records,
     * the data must be realistic and conform to expected domain constraints
     * **Validates: Requirements 3.2**
     */

    describe('Realistic Project Generator', () => {
      it('should generate projects with realistic business constraints', () => {
        fc.assert(
          fc.property(realisticProjectGenerator, (project) => {
            // Basic structure validation
            expect(project.id).toBeDefined();
            expect(project.name).toBeDefined();
            expect(project.status).toBeDefined();
            expect(project.health).toBeDefined();
            expect(project.budget).toBeDefined();
            expect(project.start_date).toBeDefined();
            expect(project.end_date).toBeDefined();
            expect(project.description).toBeDefined();
            expect(project.progress).toBeDefined();

            // Validate types
            expect(typeof project.id).toBe('string');
            expect(typeof project.name).toBe('string');
            expect(typeof project.budget).toBe('number');
            expect(typeof project.progress).toBe('number');

            // Validate constraints
            expect(PROJECT_STATUSES).toContain(project.status);
            expect(PROJECT_HEALTH_VALUES).toContain(project.health);
            expect(project.budget).toBeGreaterThan(0);
            expect(project.progress).toBeGreaterThanOrEqual(0);
            expect(project.progress).toBeLessThanOrEqual(100);

            // Validate date ordering
            const startDate = new Date(project.start_date);
            const endDate = new Date(project.end_date);
            expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());

            // Validate realistic correlations
            if (project.status === 'completed') {
              expect(project.progress).toBe(100);
            }

            if (project.status === 'cancelled') {
              expect(project.health).toBe('red');
            }

            if (project.status === 'planning') {
              expect(project.progress).toBeLessThanOrEqual(20);
            }

            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate projects with realistic budget ranges', () => {
        fc.assert(
          fc.property(realisticProjectGenerator, (project) => {
            // Budget should be in realistic range for business projects
            expect(project.budget).toBeGreaterThanOrEqual(50000);
            expect(project.budget).toBeLessThanOrEqual(6000000);

            // Budget should have reasonable precision (cents)
            const budgetStr = project.budget.toString();
            const decimalPlaces = budgetStr.includes('.') ? budgetStr.split('.')[1].length : 0;
            expect(decimalPlaces).toBeLessThanOrEqual(2);

            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate projects with realistic names', () => {
        fc.assert(
          fc.property(realisticProjectGenerator, (project) => {
            // Name should not be empty
            expect(project.name.trim().length).toBeGreaterThan(0);

            // Name should be reasonable length
            expect(project.name.length).toBeLessThanOrEqual(100);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Realistic User Generator', () => {
      it('should generate users with realistic attributes', () => {
        fc.assert(
          fc.property(realisticUserGenerator, (user) => {
            // Basic structure validation
            expect(user.id).toBeDefined();
            expect(user.name).toBeDefined();
            expect(user.email).toBeDefined();
            expect(user.role).toBeDefined();
            expect(user.permissions).toBeDefined();
            expect(typeof user.is_active).toBe('boolean');

            // Validate types
            expect(typeof user.id).toBe('string');
            expect(typeof user.name).toBe('string');
            expect(typeof user.email).toBe('string');
            expect(Array.isArray(user.permissions)).toBe(true);

            // Validate constraints
            expect(USER_ROLES).toContain(user.role);
            expect(user.email).toContain('@');
            expect(user.email).toContain('.');

            // Name should have first and last name
            expect(user.name.split(' ').length).toBeGreaterThanOrEqual(2);

            // Permissions should match role
            if (user.role === 'admin') {
              expect(user.permissions).toContain('manage_users');
              expect(user.permissions).toContain('manage_projects');
            } else if (user.role === 'viewer') {
              expect(user.permissions).toEqual(['read']);
            }

            // Active users should have last login
            if (user.is_active && user.last_login) {
              const lastLogin = new Date(user.last_login);
              const now = new Date();
              expect(lastLogin.getTime()).toBeLessThanOrEqual(now.getTime());
            }

            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate realistic email addresses', () => {
        fc.assert(
          fc.property(realisticUserGenerator, (user) => {
            // Email should be lowercase
            expect(user.email).toBe(user.email.toLowerCase());

            // Email should match name pattern
            const nameParts = user.name.toLowerCase().split(' ');
            expect(user.email).toContain(nameParts[0]);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Realistic Financial Record Generator', () => {
      it('should generate financial records with realistic variance patterns', () => {
        fc.assert(
          fc.property(realisticFinancialRecordGenerator, (record) => {
            // Basic structure validation
            expect(record.id).toBeDefined();
            expect(record.project_id).toBeDefined();
            expect(record.planned_amount).toBeDefined();
            expect(record.actual_amount).toBeDefined();
            expect(record.variance_amount).toBeDefined();
            expect(record.variance_percentage).toBeDefined();
            expect(record.period).toBeDefined();

            // Validate types
            expect(typeof record.planned_amount).toBe('number');
            expect(typeof record.actual_amount).toBe('number');
            expect(typeof record.variance_amount).toBe('number');
            expect(typeof record.variance_percentage).toBe('number');

            // Validate constraints
            expect(record.planned_amount).toBeGreaterThan(0);
            expect(record.actual_amount).toBeGreaterThanOrEqual(0);

            // Validate variance calculations
            const expectedVariance = record.actual_amount - record.planned_amount;
            expect(Math.abs(record.variance_amount - expectedVariance)).toBeLessThan(0.01);

            const expectedPercentage = (expectedVariance / record.planned_amount) * 100;
            expect(Math.abs(record.variance_percentage - expectedPercentage)).toBeLessThan(0.1);

            // Variance should be in realistic range (-20% to +30%)
            expect(record.variance_percentage).toBeGreaterThanOrEqual(-20);
            expect(record.variance_percentage).toBeLessThanOrEqual(30);

            // Period should be valid format
            expect(record.period).toMatch(/^\d{4}-Q[1-4]$/);

            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should generate financial amounts with proper precision', () => {
        fc.assert(
          fc.property(realisticFinancialRecordGenerator, (record) => {
            // Amounts should have at most 2 decimal places
            const plannedDecimals = (record.planned_amount.toString().split('.')[1] || '').length;
            const actualDecimals = (record.actual_amount.toString().split('.')[1] || '').length;
            const varianceDecimals = (record.variance_amount.toString().split('.')[1] || '').length;

            expect(plannedDecimals).toBeLessThanOrEqual(2);
            expect(actualDecimals).toBeLessThanOrEqual(2);
            expect(varianceDecimals).toBeLessThanOrEqual(2);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Project With Team Generator', () => {
      it('should generate projects with realistic team structures', () => {
        fc.assert(
          fc.property(projectWithTeamGenerator, (projectWithTeam) => {
            // Validate structure
            expect(projectWithTeam.team_members).toBeDefined();
            expect(projectWithTeam.project_manager).toBeDefined();
            expect(Array.isArray(projectWithTeam.team_members)).toBe(true);

            // Team size should be realistic
            expect(projectWithTeam.team_members.length).toBeGreaterThanOrEqual(3);
            expect(projectWithTeam.team_members.length).toBeLessThanOrEqual(15);

            // Project manager should be in team
            const pmInTeam = projectWithTeam.team_members.some(
              (member) => member.id === projectWithTeam.project_manager.id
            );
            expect(pmInTeam).toBe(true);

            // Project manager should have correct role
            expect(projectWithTeam.project_manager.role).toBe('project_manager');

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Project Financial Scenario Generator', () => {
      it('should generate complete financial scenarios with consistent data', () => {
        fc.assert(
          fc.property(projectFinancialScenarioGenerator, (scenario) => {
            // Validate structure
            expect(scenario.project).toBeDefined();
            expect(scenario.records).toBeDefined();
            expect(scenario.total_planned).toBeDefined();
            expect(scenario.total_actual).toBeDefined();
            expect(scenario.total_variance).toBeDefined();

            // Records should belong to the project
            scenario.records.forEach((record) => {
              expect(record.project_id).toBe(scenario.project.id);
            });

            // Validate totals
            const calculatedPlanned = scenario.records.reduce((sum, r) => sum + r.planned_amount, 0);
            const calculatedActual = scenario.records.reduce((sum, r) => sum + r.actual_amount, 0);
            const calculatedVariance = calculatedActual - calculatedPlanned;

            expect(Math.abs(scenario.total_planned - calculatedPlanned)).toBeLessThan(0.01);
            expect(Math.abs(scenario.total_actual - calculatedActual)).toBeLessThan(0.01);
            expect(Math.abs(scenario.total_variance - calculatedVariance)).toBeLessThan(0.01);

            // Should have multiple records
            expect(scenario.records.length).toBeGreaterThanOrEqual(4);
            expect(scenario.records.length).toBeLessThanOrEqual(12);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Portfolio Scenario Generator', () => {
      it('should generate realistic portfolio scenarios', () => {
        fc.assert(
          fc.property(portfolioScenarioGenerator, (portfolio) => {
            // Validate structure
            expect(portfolio.id).toBeDefined();
            expect(portfolio.name).toBeDefined();
            expect(portfolio.projects).toBeDefined();
            expect(portfolio.manager).toBeDefined();
            expect(portfolio.total_budget).toBeDefined();
            expect(portfolio.active_projects).toBeDefined();
            expect(portfolio.completed_projects).toBeDefined();

            // Manager should have portfolio_manager role
            expect(portfolio.manager.role).toBe('portfolio_manager');

            // Should have multiple projects
            expect(portfolio.projects.length).toBeGreaterThanOrEqual(5);
            expect(portfolio.projects.length).toBeLessThanOrEqual(20);

            // Validate budget calculation
            const calculatedBudget = portfolio.projects.reduce((sum, p) => sum + (p.budget || 0), 0);
            expect(Math.abs(portfolio.total_budget - calculatedBudget)).toBeLessThan(0.01);

            // Validate project counts
            const actualActive = portfolio.projects.filter((p) => p.status === 'active').length;
            const actualCompleted = portfolio.projects.filter((p) => p.status === 'completed').length;

            expect(portfolio.active_projects).toBe(actualActive);
            expect(portfolio.completed_projects).toBe(actualCompleted);

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Project Metrics Time Series Generator', () => {
      it('should generate realistic time series data', () => {
        fc.assert(
          fc.property(projectMetricsTimeSeriesGenerator, (timeSeries) => {
            // Validate structure
            expect(timeSeries.project_id).toBeDefined();
            expect(timeSeries.metrics).toBeDefined();
            expect(Array.isArray(timeSeries.metrics)).toBe(true);

            // Should have multiple data points
            expect(timeSeries.metrics.length).toBeGreaterThanOrEqual(10);
            expect(timeSeries.metrics.length).toBeLessThanOrEqual(30);

            // Validate each metric
            timeSeries.metrics.forEach((metric, index) => {
              expect(metric.date).toBeDefined();
              expect(metric.budget_spent).toBeGreaterThanOrEqual(0);
              expect(metric.progress).toBeGreaterThanOrEqual(0);
              expect(metric.progress).toBeLessThanOrEqual(100);
              expect(metric.team_size).toBeGreaterThanOrEqual(3);
              expect(metric.team_size).toBeLessThanOrEqual(15);
              expect(['green', 'yellow', 'red']).toContain(metric.health);

              // Progress should be monotonically increasing
              if (index > 0) {
                expect(metric.progress).toBeGreaterThanOrEqual(timeSeries.metrics[index - 1].progress);
              }
            });

            // Dates should be in chronological order
            for (let i = 1; i < timeSeries.metrics.length; i++) {
              const prevDate = new Date(timeSeries.metrics[i - 1].date);
              const currDate = new Date(timeSeries.metrics[i].date);
              expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
            }

            return true;
          }),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('Mock Data Generators Object', () => {
    it('should provide all generators through mockDataGenerators object', () => {
      expect(mockDataGenerators.realisticProject).toBeDefined();
      expect(mockDataGenerators.realisticUser).toBeDefined();
      expect(mockDataGenerators.realisticFinancialRecord).toBeDefined();
      expect(mockDataGenerators.projectWithTeam).toBeDefined();
      expect(mockDataGenerators.projectFinancialScenario).toBeDefined();
      expect(mockDataGenerators.portfolioScenario).toBeDefined();
      expect(mockDataGenerators.projectMetricsTimeSeries).toBeDefined();
    });
  });
});
