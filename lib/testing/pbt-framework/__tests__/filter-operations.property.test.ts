/**
 * Property-Based Tests for Filter Operations
 * 
 * Comprehensive property-based testing for filter and search operations.
 * Tests filter consistency, search result accuracy, and combined filter logic.
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  pbtFramework,
  projectArrayGenerator,
  filterStateGenerator,
  searchStringGenerator,
  projectStatusGenerator,
  dateRangeGenerator,
  sortFieldGenerator,
  sortOrderGenerator,
} from '../index';
import {
  applyFilters,
  searchProjects,
  filterByStatus,
  filterByDateRange,
  sortProjects,
  applyCombinedFilters,
  haveSameProjects,
  projectMatchesSearch,
  projectMatchesFilters,
} from '../filter-operations';
import type { GeneratedProject, GeneratedFilterState } from '../domain-generators';

describe('Filter Operations Property Tests', () => {
  describe('Property 14: Filter Operation Consistency', () => {
    /**
     * **Validates: Requirements 4.1**
     * 
     * Property: For any filter operation applied to different data sets,
     * the results must be consistent regardless of data order or composition.
     */
    it('should produce consistent results regardless of data order', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Apply filters to original order
          const filtered1 = applyFilters(projects, filterState);

          // Shuffle the projects and apply filters again
          const shuffled = [...projects].sort(() => Math.random() - 0.5);
          const filtered2 = applyFilters(shuffled, filterState);

          // Results should contain the same projects (by ID)
          expect(haveSameProjects(filtered1, filtered2)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should maintain filter consistency across multiple applications', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Apply filters multiple times
          const filtered1 = applyFilters(projects, filterState);
          const filtered2 = applyFilters(projects, filterState);
          const filtered3 = applyFilters(projects, filterState);

          // All results should be identical
          expect(haveSameProjects(filtered1, filtered2)).toBe(true);
          expect(haveSameProjects(filtered2, filtered3)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should produce consistent results with different data compositions', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          // Apply filters to full dataset
          const fullFiltered = applyFilters(projects, filterState);

          // Split dataset and filter separately
          const midpoint = Math.floor(projects.length / 2);
          const part1 = projects.slice(0, midpoint);
          const part2 = projects.slice(midpoint);

          const filtered1 = applyFilters(part1, filterState);
          const filtered2 = applyFilters(part2, filterState);

          // Combined partial results should equal full filtered results
          const combinedFiltered = [...filtered1, ...filtered2];
          expect(haveSameProjects(fullFiltered, combinedFiltered)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should validate that all filtered projects match filter criteria', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const filtered = applyFilters(projects, filterState);

          // Every filtered project should match the filter criteria
          filtered.forEach(project => {
            expect(projectMatchesFilters(project, filterState)).toBe(true);
          });
        },
        { numRuns: 100 }
      );
    });

    it('should not include projects that do not match filter criteria', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const filtered = applyFilters(projects, filterState);
          const filteredIds = new Set(filtered.map(p => p.id));

          // Projects not in filtered results should not match criteria
          projects.forEach(project => {
            if (!filteredIds.has(project.id)) {
              // If a project is not in results, it should not match all criteria
              // (unless the filter is empty, in which case all should be included)
              const hasActiveFilters = 
                (filterState.search && filterState.search.trim()) ||
                filterState.status !== null ||
                filterState.dateRange !== null;

              if (hasActiveFilters) {
                expect(projectMatchesFilters(project, filterState)).toBe(false);
              }
            }
          });
        },
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Search Result Consistency', () => {
    /**
     * **Validates: Requirements 4.2**
     * 
     * Property: For any search operation, results must match expected criteria
     * consistently regardless of data ordering or presentation.
     */
    it('should return all projects when search term is empty', () => {
      pbtFramework.setupPropertyTest(
        projectArrayGenerator({ minLength: 1, maxLength: 50 }),
        (projects) => {
          const emptySearchResults = searchProjects(projects, '');
          const whitespaceSearchResults = searchProjects(projects, '   ');

          // Empty search should return all projects
          expect(emptySearchResults.length).toBe(projects.length);
          expect(whitespaceSearchResults.length).toBe(projects.length);
          expect(haveSameProjects(emptySearchResults, projects)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should match search term in project name or description', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: searchStringGenerator.filter(s => s.trim().length > 0),
        }),
        ({ projects, searchTerm }) => {
          const results = searchProjects(projects, searchTerm);

          // All results should match the search term
          results.forEach(project => {
            expect(projectMatchesSearch(project, searchTerm)).toBe(true);
          });
        },
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: searchStringGenerator.filter(s => s.trim().length > 0),
        }),
        ({ projects, searchTerm }) => {
          const lowerResults = searchProjects(projects, searchTerm.toLowerCase());
          const upperResults = searchProjects(projects, searchTerm.toUpperCase());
          const mixedResults = searchProjects(projects, searchTerm);

          // Case variations should produce the same results
          expect(haveSameProjects(lowerResults, upperResults)).toBe(true);
          expect(haveSameProjects(upperResults, mixedResults)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should produce consistent results regardless of data order', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: searchStringGenerator,
        }),
        ({ projects, searchTerm }) => {
          const results1 = searchProjects(projects, searchTerm);

          // Shuffle and search again
          const shuffled = [...projects].sort(() => Math.random() - 0.5);
          const results2 = searchProjects(shuffled, searchTerm);

          // Should contain the same projects
          expect(haveSameProjects(results1, results2)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should handle special characters in search terms', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ projects, searchTerm }) => {
          // Should not throw errors with special characters
          expect(() => searchProjects(projects, searchTerm)).not.toThrow();

          const results = searchProjects(projects, searchTerm);

          // Results should be a subset of original projects
          expect(results.length).toBeLessThanOrEqual(projects.length);
        },
        { numRuns: 100 }
      );
    });

    it('should return subset of original projects', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: searchStringGenerator,
        }),
        ({ projects, searchTerm }) => {
          const results = searchProjects(projects, searchTerm);

          // Results should be a subset
          expect(results.length).toBeLessThanOrEqual(projects.length);

          // All result IDs should exist in original projects
          const originalIds = new Set(projects.map(p => p.id));
          results.forEach(project => {
            expect(originalIds.has(project.id)).toBe(true);
          });
        },
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Combined Filter Logic Correctness', () => {
    /**
     * **Validates: Requirements 4.3**
     * 
     * Property: For any combination of multiple filters, the combined filtering
     * logic must work correctly and produce expected intersection results.
     */
    it('should correctly combine search and status filters', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          searchTerm: searchStringGenerator,
          status: projectStatusGenerator,
        }),
        ({ projects, searchTerm, status }) => {
          // Apply filters separately
          const searchResults = searchProjects(projects, searchTerm);
          const statusResults = filterByStatus(projects, status);

          // Apply combined filters
          const combinedResults = applyCombinedFilters(projects, {
            search: searchTerm,
            status: status,
          });

          // Combined results should be intersection of individual filters
          combinedResults.forEach(project => {
            expect(projectMatchesSearch(project, searchTerm)).toBe(true);
            expect(project.status).toBe(status);
          });

          // Combined results should be subset of each individual filter
          expect(combinedResults.length).toBeLessThanOrEqual(searchResults.length);
          expect(combinedResults.length).toBeLessThanOrEqual(statusResults.length);
        },
        { numRuns: 100 }
      );
    });

    it('should correctly combine status and date range filters', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          status: projectStatusGenerator,
          dateRange: dateRangeGenerator,
        }),
        ({ projects, status, dateRange }) => {
          const combinedResults = applyCombinedFilters(projects, {
            status: status,
            dateRange: dateRange,
          });

          // All results should match both filters
          combinedResults.forEach(project => {
            expect(project.status).toBe(status);

            if (dateRange) {
              const projectDate = new Date(project.created_at);
              
              if (dateRange.start) {
                expect(projectDate.getTime()).toBeGreaterThanOrEqual(dateRange.start.getTime());
              }
              
              if (dateRange.end) {
                expect(projectDate.getTime()).toBeLessThanOrEqual(dateRange.end.getTime());
              }
            }
          });
        },
        { numRuns: 100 }
      );
    });

    it('should correctly combine all filter types', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const results = applyFilters(projects, filterState);

          // All results should match all filter criteria
          results.forEach(project => {
            // Check search
            if (filterState.search && filterState.search.trim()) {
              expect(projectMatchesSearch(project, filterState.search)).toBe(true);
            }

            // Check status
            if (filterState.status !== null) {
              expect(project.status).toBe(filterState.status);
            }

            // Check date range
            if (filterState.dateRange) {
              const projectDate = new Date(project.created_at);
              
              if (filterState.dateRange.start) {
                expect(projectDate.getTime()).toBeGreaterThanOrEqual(
                  filterState.dateRange.start.getTime()
                );
              }
              
              if (filterState.dateRange.end) {
                expect(projectDate.getTime()).toBeLessThanOrEqual(
                  filterState.dateRange.end.getTime()
                );
              }
            }
          });
        },
        { numRuns: 100 }
      );
    });

    it('should maintain filter order independence', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          searchTerm: searchStringGenerator,
          status: projectStatusGenerator,
        }),
        ({ projects, searchTerm, status }) => {
          // Apply filters in different orders
          const order1 = applyCombinedFilters(
            applyCombinedFilters(projects, { search: searchTerm }),
            { status: status }
          );

          const order2 = applyCombinedFilters(
            applyCombinedFilters(projects, { status: status }),
            { search: searchTerm }
          );

          const combined = applyCombinedFilters(projects, {
            search: searchTerm,
            status: status,
          });

          // All orders should produce the same results
          expect(haveSameProjects(order1, order2)).toBe(true);
          expect(haveSameProjects(order2, combined)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should handle empty filter combinations correctly', () => {
      pbtFramework.setupPropertyTest(
        projectArrayGenerator({ minLength: 5, maxLength: 50 }),
        (projects) => {
          // Empty filters should return all projects
          const results = applyCombinedFilters(projects, {});

          expect(results.length).toBe(projects.length);
          expect(haveSameProjects(results, projects)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should produce results that are subsets of original data', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const results = applyFilters(projects, filterState);

          // Results should be a subset
          expect(results.length).toBeLessThanOrEqual(projects.length);

          // All result IDs should exist in original projects
          const originalIds = new Set(projects.map(p => p.id));
          results.forEach(project => {
            expect(originalIds.has(project.id)).toBe(true);
          });
        },
        { numRuns: 100 }
      );
    });

    it('should maintain sorting after filtering', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 10, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const results = applyFilters(projects, filterState);

          // Verify sorting is applied correctly
          if (results.length > 1) {
            for (let i = 0; i < results.length - 1; i++) {
              const current = results[i];
              const next = results[i + 1];

              let currentValue: any;
              let nextValue: any;

              switch (filterState.sortBy) {
                case 'name':
                  currentValue = current.name.toLowerCase();
                  nextValue = next.name.toLowerCase();
                  break;
                case 'created_at':
                  currentValue = new Date(current.created_at).getTime();
                  nextValue = new Date(next.created_at).getTime();
                  break;
                case 'budget':
                  currentValue = current.budget ?? -Infinity;
                  nextValue = next.budget ?? -Infinity;
                  break;
                case 'status':
                  currentValue = current.status;
                  nextValue = next.status;
                  break;
                case 'health':
                  const healthOrder = { green: 0, yellow: 1, red: 2 };
                  currentValue = healthOrder[current.health];
                  nextValue = healthOrder[next.health];
                  break;
              }

              if (filterState.sortOrder === 'asc') {
                if (typeof currentValue === 'string') {
                  expect(currentValue.localeCompare(nextValue)).toBeLessThanOrEqual(0);
                } else {
                  expect(currentValue).toBeLessThanOrEqual(nextValue);
                }
              } else {
                if (typeof currentValue === 'string') {
                  expect(currentValue.localeCompare(nextValue)).toBeGreaterThanOrEqual(0);
                } else {
                  expect(currentValue).toBeGreaterThanOrEqual(nextValue);
                }
              }
            }
          }
        },
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Filter Operation Properties', () => {
    it('should handle projects with null budgets correctly', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          sortOrder: sortOrderGenerator,
        }),
        ({ projects, sortOrder }) => {
          // Sort by budget
          const sorted = sortProjects(projects, 'budget', sortOrder);

          // Should not throw and should return all projects
          expect(sorted.length).toBe(projects.length);
          expect(haveSameProjects(sorted, projects)).toBe(true);
        },
        { numRuns: 100 }
      );
    });

    it('should handle projects with missing descriptions correctly', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          searchTerm: searchStringGenerator.filter(s => s.trim().length > 0),
        }),
        ({ projects, searchTerm }) => {
          // Should not throw even if descriptions are undefined
          expect(() => searchProjects(projects, searchTerm)).not.toThrow();

          const results = searchProjects(projects, searchTerm);
          expect(results.length).toBeLessThanOrEqual(projects.length);
        },
        { numRuns: 100 }
      );
    });

    it('should maintain referential integrity of project objects', () => {
      pbtFramework.setupPropertyTest(
        fc.record({
          projects: projectArrayGenerator({ minLength: 5, maxLength: 50 }),
          filterState: filterStateGenerator,
        }),
        ({ projects, filterState }) => {
          const results = applyFilters(projects, filterState);

          // Filtered projects should be the same objects (not copies)
          results.forEach(resultProject => {
            const originalProject = projects.find(p => p.id === resultProject.id);
            expect(originalProject).toBeDefined();
            // Check that key properties match
            expect(resultProject.name).toBe(originalProject!.name);
            expect(resultProject.status).toBe(originalProject!.status);
            expect(resultProject.health).toBe(originalProject!.health);
          });
        },
        { numRuns: 100 }
      );
    });
  });
});
