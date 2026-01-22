/**
 * Filter State Management Utilities for Property-Based Testing
 * 
 * Provides utilities for testing filter state persistence across navigation
 * and filter performance with large datasets.
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 4.4, 4.5**
 */

import { GeneratedProject, GeneratedFilterState } from './domain-generators';
import { applyFilters } from './filter-operations';

/**
 * Simulates filter state persistence across navigation
 * 
 * @param filterState - Initial filter state
 * @returns Persisted filter state after navigation simulation
 */
export function simulateFilterStatePersistence(
  filterState: GeneratedFilterState
): GeneratedFilterState {
  // Simulate serialization/deserialization that would occur during navigation
  const serialized = JSON.stringify(filterState);
  const deserialized = JSON.parse(serialized);
  
  // Restore Date objects that were serialized as strings
  if (deserialized.dateRange) {
    if (deserialized.dateRange.start) {
      deserialized.dateRange.start = new Date(deserialized.dateRange.start);
    }
    if (deserialized.dateRange.end) {
      deserialized.dateRange.end = new Date(deserialized.dateRange.end);
    }
  }
  
  return deserialized;
}

/**
 * Validates that filter state is correctly persisted
 * 
 * @param original - Original filter state
 * @param persisted - Persisted filter state
 * @returns True if filter states match
 */
export function validateFilterStatePersistence(
  original: GeneratedFilterState,
  persisted: GeneratedFilterState
): boolean {
  // Check search
  if (original.search !== persisted.search) {
    return false;
  }
  
  // Check status
  if (original.status !== persisted.status) {
    return false;
  }
  
  // Check date range
  if (original.dateRange && persisted.dateRange) {
    const originalStart = original.dateRange.start?.getTime() ?? null;
    const persistedStart = persisted.dateRange.start?.getTime() ?? null;
    const originalEnd = original.dateRange.end?.getTime() ?? null;
    const persistedEnd = persisted.dateRange.end?.getTime() ?? null;
    
    if (originalStart !== persistedStart || originalEnd !== persistedEnd) {
      return false;
    }
  } else if (original.dateRange !== persisted.dateRange) {
    return false;
  }
  
  // Check sort options
  if (original.sortBy !== persisted.sortBy || original.sortOrder !== persisted.sortOrder) {
    return false;
  }
  
  // Check category
  if (original.category !== persisted.category) {
    return false;
  }
  
  return true;
}

/**
 * Measures filter operation performance
 * 
 * @param projects - Array of projects to filter
 * @param filterState - Filter state to apply
 * @returns Performance metrics including execution time
 */
export function measureFilterPerformance(
  projects: GeneratedProject[],
  filterState: GeneratedFilterState
): {
  executionTimeMs: number;
  projectCount: number;
  resultCount: number;
  throughput: number; // projects per millisecond
} {
  const startTime = performance.now();
  const results = applyFilters(projects, filterState);
  const endTime = performance.now();
  
  const executionTimeMs = endTime - startTime;
  const throughput = executionTimeMs > 0 ? projects.length / executionTimeMs : Infinity;
  
  return {
    executionTimeMs,
    projectCount: projects.length,
    resultCount: results.length,
    throughput,
  };
}

/**
 * Validates filter performance consistency across multiple runs
 * 
 * @param projects - Array of projects to filter
 * @param filterState - Filter state to apply
 * @param runs - Number of performance measurement runs
 * @returns Performance consistency metrics
 */
export function validateFilterPerformanceConsistency(
  projects: GeneratedProject[],
  filterState: GeneratedFilterState,
  runs: number = 5
): {
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  stdDeviation: number;
  isConsistent: boolean; // true if std deviation is within acceptable bounds
} {
  const measurements: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const metrics = measureFilterPerformance(projects, filterState);
    measurements.push(metrics.executionTimeMs);
  }
  
  const avgExecutionTimeMs = measurements.reduce((a, b) => a + b, 0) / measurements.length;
  const minExecutionTimeMs = Math.min(...measurements);
  const maxExecutionTimeMs = Math.max(...measurements);
  
  // Calculate standard deviation
  const squaredDiffs = measurements.map(time => Math.pow(time - avgExecutionTimeMs, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / measurements.length;
  const stdDeviation = Math.sqrt(variance);
  
  // Performance is considered consistent if std deviation is less than 75% of average
  // This accounts for JavaScript JIT compilation, garbage collection, and system variability
  const isConsistent = stdDeviation < (avgExecutionTimeMs * 0.75);
  
  return {
    avgExecutionTimeMs,
    minExecutionTimeMs,
    maxExecutionTimeMs,
    stdDeviation,
    isConsistent,
  };
}

/**
 * Validates filter performance scales acceptably with data size
 * 
 * @param smallDataset - Small dataset for baseline
 * @param largeDataset - Large dataset for comparison
 * @param filterState - Filter state to apply
 * @returns Scaling metrics
 */
export function validateFilterPerformanceScaling(
  smallDataset: GeneratedProject[],
  largeDataset: GeneratedProject[],
  filterState: GeneratedFilterState
): {
  smallDatasetTime: number;
  largeDatasetTime: number;
  scalingFactor: number; // ratio of large to small execution time
  datasetSizeRatio: number; // ratio of large to small dataset size
  isLinearOrBetter: boolean; // true if scaling is O(n) or better
} {
  const smallMetrics = measureFilterPerformance(smallDataset, filterState);
  const largeMetrics = measureFilterPerformance(largeDataset, filterState);
  
  const scalingFactor = largeMetrics.executionTimeMs / smallMetrics.executionTimeMs;
  const datasetSizeRatio = largeDataset.length / smallDataset.length;
  
  // Performance is considered linear or better if time scaling is less than or equal to data scaling
  // Allow 50% margin for overhead, JIT compilation, and small dataset effects
  const isLinearOrBetter = scalingFactor <= (datasetSizeRatio * 1.5);
  
  return {
    smallDatasetTime: smallMetrics.executionTimeMs,
    largeDatasetTime: largeMetrics.executionTimeMs,
    scalingFactor,
    datasetSizeRatio,
    isLinearOrBetter,
  };
}

/**
 * Simulates UI filter behavior with state updates
 * 
 * @param initialProjects - Initial project list
 * @param filterUpdates - Sequence of filter state updates
 * @returns Array of filtered results for each update
 */
export function simulateUIFilterBehavior(
  initialProjects: GeneratedProject[],
  filterUpdates: GeneratedFilterState[]
): GeneratedProject[][] {
  const results: GeneratedProject[][] = [];
  
  for (const filterState of filterUpdates) {
    const filtered = applyFilters(initialProjects, filterState);
    results.push(filtered);
  }
  
  return results;
}

/**
 * Validates that filter state updates produce expected results
 * 
 * @param projects - Project list
 * @param filterSequence - Sequence of filter states
 * @returns True if all filter updates produce valid results
 */
export function validateFilterStateUpdates(
  projects: GeneratedProject[],
  filterSequence: GeneratedFilterState[]
): boolean {
  for (const filterState of filterSequence) {
    const results = applyFilters(projects, filterState);
    
    // Results should be a subset of original projects
    if (results.length > projects.length) {
      return false;
    }
    
    // All result IDs should exist in original projects
    const originalIds = new Set(projects.map(p => p.id));
    for (const result of results) {
      if (!originalIds.has(result.id)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Measures memory usage during filter operations
 * 
 * @param projects - Array of projects to filter
 * @param filterState - Filter state to apply
 * @returns Memory usage metrics (if available)
 */
export function measureFilterMemoryUsage(
  projects: GeneratedProject[],
  filterState: GeneratedFilterState
): {
  estimatedMemoryBytes: number;
  projectCount: number;
  resultCount: number;
} {
  // Estimate memory usage based on object sizes
  const projectSize = JSON.stringify(projects[0] || {}).length;
  const estimatedMemoryBytes = projects.length * projectSize;
  
  const results = applyFilters(projects, filterState);
  
  return {
    estimatedMemoryBytes,
    projectCount: projects.length,
    resultCount: results.length,
  };
}
