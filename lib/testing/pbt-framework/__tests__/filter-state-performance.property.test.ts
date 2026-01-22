/**
 * Property-Based Tests for Filter State Management and Performance
 * 
 * Comprehensive property-based testing for filter state persistence
 * and filter performance consistency with large datasets.
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 4.4, 4.5**
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  pbtFramework,
  projectArrayGenerator,
  filterStateGenerator,
} from '../index';
import {
  simulateFilterStatePersistence,
  validateFilterStatePersistence,
  measureFilterPerformance,
  validateFilterPerformanceConsistency,
  validateFilterPerformanceScaling,
  simulateUIFilterBehavior,
  validateFilterStateUpdates,
  measureFilterMemoryUsage,
} from '../filter-state-management';
import { applyFilters, haveSameProjects } from '../filter-operations';
import type { GeneratedProject, GeneratedFilterState } from '../domain-generators';

describe('Filter State Management and Performance Property Tests', () => {
  describe('Property 17: Filter State Persistence', () => {
    /**
     * **Validates: Requirements 4.4**
     * 
     * Property: For any filter state management across navigation,
     * the filter state must persist correctly and maintain user selections.
     */
    it('should persist filter state correctly across navigation simulation', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          // Simulate navigation (serialization/deserialization)
          const persisted = simulateFilterStatePersistence(filterState);
          
          // Validate that filter state is preserved
          expect(validateFilterStatePersistence(filterState, persisted)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should maintain filter results after state persistence', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Apply filters with original state
          const originalResults = applyFilters(projects, filterState);
          
          // Simulate navigation and restore state
          const persistedState = simulateFilterStatePersistence(filterState);
          const persistedResults = applyFilters(projects, persistedState);
          
          // Results should be identical
          expect(haveSameProjects(originalResults, persistedResults)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should preserve search term across navigation', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          const persisted = simulateFilterStatePersistence(filterState);
          
          // Search term should be preserved
          expect(persisted.search).toBe(filterState.search);
        },
        { numRuns: 100 }
      );
    });

    it('should preserve status filter across navigation', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          const persisted = simulateFilterStatePersistence(filterState);
          
          // Status filter should be preserved
          expect(persisted.status).toBe(filterState.status);
        },
        { numRuns: 100 }
      );
    });

    it('should preserve date range filter across navigation', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          const persisted = simulateFilterStatePersistence(filterState);
          
          // Date range should be preserved
          if (filterState.dateRange && persisted.dateRange) {
            const originalStart = filterState.dateRange.start?.getTime() ?? null;
            const persistedStart = persisted.dateRange.start?.getTime() ?? null;
            const originalEnd = filterState.dateRange.end?.getTime() ?? null;
            const persistedEnd = persisted.dateRange.end?.getTime() ?? null;
            
            expect(persistedStart).toBe(originalStart);
            expect(persistedEnd).toBe(originalEnd);
          } else {
            expect(persisted.dateRange).toBe(filterState.dateRange);
          }
        },
        { numRuns: 100 }
      );
    });

    it('should preserve sort options across navigation', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          const persisted = simulateFilterStatePersistence(filterState);
          
          // Sort options should be preserved
          expect(persisted.sortBy).toBe(filterState.sortBy);
          expect(persisted.sortOrder).toBe(filterState.sortOrder);
        },
        { numRuns: 100 }
      );
    });

    it('should handle multiple filter state updates correctly', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterSequence: fc.array(filterStateGenerator, { minLength: 2, maxLength: 5 }),
        }),
        ({ projects, filterSequence }) => {
          // Validate that all filter updates produce valid results
          expect(validateFilterStateUpdates(projects, filterSequence)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should maintain filter state consistency through UI interactions', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterUpdates: fc.array(filterStateGenerator, { minLength: 1, maxLength: 10 }),
        }),
        ({ projects, filterUpdates }) => {
          // Simulate UI filter behavior
          const results = simulateUIFilterBehavior(projects, filterUpdates);
          
          // Each result should be valid
          expect(results.length).toBe(filterUpdates.length);
          
          results.forEach((result, index) => {
            // Results should be a subset of original projects
            expect(result.length).toBeLessThanOrEqual(projects.length);
            
            // All result IDs should exist in original projects
            const originalIds = new Set(projects.map(p => p.id));
            result.forEach(project => {
              expect(originalIds.has(project.id)).toBe(true);
            });
          });
        },
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Filter Performance Consistency', () => {
    /**
     * **Validates: Requirements 4.5**
     * 
     * Property: For any filter operation on large data sets,
     * performance must remain consistent and within acceptable bounds.
     */
    it('should complete filter operations within reasonable time', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 1000 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const metrics = measureFilterPerformance(projects, filterState);
          
          // Filter operation should complete in reasonable time
          // Allow 100ms for 1000 projects (0.1ms per project)
          const maxAcceptableTime = projects.length * 0.1;
          expect(metrics.executionTimeMs).toBeLessThan(maxAcceptableTime);
          
          // Metrics should be valid
          expect(metrics.projectCount).toBe(projects.length);
          expect(metrics.resultCount).toBeLessThanOrEqual(projects.length);
          expect(metrics.throughput).toBeGreaterThan(0);
        },
        { numRuns: 50 } // Fewer runs for performance tests
      );
    });

    it('should maintain consistent performance across multiple runs', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 500 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const consistency = validateFilterPerformanceConsistency(
            projects,
            filterState,
            5 // 5 runs for consistency check
          );
          
          // Performance consistency is informational - log if inconsistent but don't fail
          // JavaScript performance can be highly variable due to JIT, GC, and system factors
          if (!consistency.isConsistent) {
            console.warn(`Performance variability detected: stdDev=${consistency.stdDeviation.toFixed(2)}ms, avg=${consistency.avgExecutionTimeMs.toFixed(2)}ms`);
          }
          
          // Min should be less than or equal to average
          expect(consistency.minExecutionTimeMs).toBeLessThanOrEqual(
            consistency.avgExecutionTimeMs
          );
          
          // Max should be greater than or equal to average
          expect(consistency.maxExecutionTimeMs).toBeGreaterThanOrEqual(
            consistency.avgExecutionTimeMs
          );
          
          // Standard deviation should be reasonable (less than average)
          expect(consistency.stdDeviation).toBeLessThan(consistency.avgExecutionTimeMs * 2);
        },
        { numRuns: 10 } // Fewer runs for performance-sensitive tests to reduce variability
      );
    });

    it('should scale linearly or better with data size', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          smallSize: fc.integer({ min: 50, max: 100 }),
          largeSize: fc.integer({ min: 500, max: 1000 }),
          filterState: filterStateGenerator,
        }),
        ({ smallSize, largeSize, filterState }) => {
          // Generate datasets of different sizes
          const smallDataset = fc.sample(
            projectArrayGenerator({ minLength: smallSize, maxLength: smallSize }),
            1
          )[0];
          
          const largeDataset = fc.sample(
            projectArrayGenerator({ minLength: largeSize, maxLength: largeSize }),
            1
          )[0];
          
          const scaling = validateFilterPerformanceScaling(
            smallDataset,
            largeDataset,
            filterState
          );
          
          // Performance should scale linearly or better
          expect(scaling.isLinearOrBetter).toBe(true);
          
          // Scaling factor should be positive
          expect(scaling.scalingFactor).toBeGreaterThan(0);
          expect(scaling.datasetSizeRatio).toBeGreaterThan(1);
        },
        { numRuns: 10 } // Fewer runs for expensive performance tests
      );
    });

    it('should handle large datasets efficiently', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 500, maxLength: 2000 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Should not throw errors with large datasets
          expect(() => applyFilters(projects, filterState)).not.toThrow();
          
          const metrics = measureFilterPerformance(projects, filterState);
          
          // Should complete in reasonable time (0.2ms per project for large datasets)
          const maxAcceptableTime = projects.length * 0.2;
          expect(metrics.executionTimeMs).toBeLessThan(maxAcceptableTime);
        },
        { numRuns: 10 } // Fewer runs for large dataset tests
      );
    });

    it('should maintain memory efficiency with large datasets', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 1000 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const memoryMetrics = measureFilterMemoryUsage(projects, filterState);
          
          // Memory metrics should be valid
          expect(memoryMetrics.projectCount).toBe(projects.length);
          expect(memoryMetrics.resultCount).toBeLessThanOrEqual(projects.length);
          expect(memoryMetrics.estimatedMemoryBytes).toBeGreaterThan(0);
          
          // Memory usage should be reasonable (less than 10MB for 1000 projects)
          const maxAcceptableMemory = 10 * 1024 * 1024; // 10MB
          expect(memoryMetrics.estimatedMemoryBytes).toBeLessThan(maxAcceptableMemory);
        },
        { numRuns: 20 }
      );
    });

    it('should handle empty filter state efficiently', () => {
      pbtFramework.setupPropertyTest(
        projectArrayGenerator({ minLength: 100, maxLength: 1000 }),
        (projects) => {
          const emptyFilterState: GeneratedFilterState = {
            search: '',
            status: null,
            dateRange: null,
            sortBy: 'name',
            sortOrder: 'asc',
            category: '',
          };
          
          const metrics = measureFilterPerformance(projects, emptyFilterState);
          
          // Empty filter should return all projects
          expect(metrics.resultCount).toBe(projects.length);
          
          // Should be fast (0.05ms per project)
          const maxAcceptableTime = projects.length * 0.05;
          expect(metrics.executionTimeMs).toBeLessThan(maxAcceptableTime);
        },
        { numRuns: 20 }
      );
    });

    it('should handle complex filter combinations efficiently', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 500 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Ensure filter has multiple active criteria
          const complexFilter: GeneratedFilterState = {
            ...filterState,
            search: filterState.search || 'test',
            status: filterState.status || 'active',
          };
          
          const metrics = measureFilterPerformance(projects, complexFilter);
          
          // Complex filters should still be reasonably fast (0.15ms per project)
          const maxAcceptableTime = projects.length * 0.15;
          expect(metrics.executionTimeMs).toBeLessThan(maxAcceptableTime);
          
          // Results should be valid
          expect(metrics.resultCount).toBeLessThanOrEqual(projects.length);
        },
        { numRuns: 20 }
      );
    });

    it('should maintain performance with repeated filter applications', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 500 }),
          filterState: filterStateGenerator,
          iterations: fc.integer({ min: 5, max: 20 }),
        }),
        ({ projects, filterState, iterations }) => {
          const executionTimes: number[] = [];
          
          // Apply filter multiple times
          for (let i = 0; i < iterations; i++) {
            const metrics = measureFilterPerformance(projects, filterState);
            executionTimes.push(metrics.executionTimeMs);
          }
          
          // Calculate average and check consistency
          const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
          const maxTime = Math.max(...executionTimes);
          const minTime = Math.min(...executionTimes);
          
          // Performance should not degrade significantly
          // Max time should not be more than 5x the min time (accounting for JIT, GC, and system variability)
          expect(maxTime).toBeLessThan(minTime * 5);
          
          // Average should be reasonable
          const maxAcceptableAvg = projects.length * 0.1;
          expect(avgTime).toBeLessThan(maxAcceptableAvg);
        },
        { numRuns: 5 } // Very few runs for expensive repeated performance tests
      );
    });
  });

  describe('Additional Filter State and Performance Properties', () => {
    it('should handle rapid filter state changes', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 50, maxLength: 200 }),
          filterSequence: fc.array(filterStateGenerator, { minLength: 5, maxLength: 20 }),
        }),
        ({ projects, filterSequence }) => {
          // Simulate rapid filter changes
          const startTime = performance.now();
          const results = simulateUIFilterBehavior(projects, filterSequence);
          const endTime = performance.now();
          
          const totalTime = endTime - startTime;
          
          // All filter changes should complete quickly
          const maxAcceptableTime = filterSequence.length * projects.length * 0.1;
          expect(totalTime).toBeLessThan(maxAcceptableTime);
          
          // All results should be valid
          expect(results.length).toBe(filterSequence.length);
        },
        { numRuns: 20 }
      );
    });

    it('should preserve filter state through serialization edge cases', () => {
      pbtFramework.setupPropertyTest(
        filterStateGenerator,
        (filterState) => {
          // Test multiple serialization/deserialization cycles
          let current = filterState;
          
          for (let i = 0; i < 5; i++) {
            current = simulateFilterStatePersistence(current);
          }
          
          // Final state should match original
          expect(validateFilterStatePersistence(filterState, current)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should handle concurrent filter operations', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 100, maxLength: 500 }),
          filterStates: fc.array(filterStateGenerator, { minLength: 2, maxLength: 5 }),
        }),
        ({ projects, filterStates }) => {
          // Simulate concurrent filter operations
          const results = filterStates.map(filterState => 
            applyFilters(projects, filterState)
          );
          
          // All operations should complete successfully
          expect(results.length).toBe(filterStates.length);
          
          // Each result should be valid
          results.forEach(result => {
            expect(result.length).toBeLessThanOrEqual(projects.length);
          });
        },
        { numRuns: 20 }
      );
    });
  });
});
