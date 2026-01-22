/**
 * Filter Operation Utilities for Property-Based Testing
 * 
 * Provides utilities for testing filter and search operations on project data.
 * These utilities are used to validate filter consistency, search accuracy,
 * and combined filter logic correctness.
 * 
 * **Feature: property-based-testing**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import { GeneratedProject, GeneratedFilterState, ProjectStatus } from './domain-generators';

/**
 * Applies filter operations to a list of projects
 * 
 * @param projects - Array of projects to filter
 * @param filterState - Filter state containing search, status, date range, and sort options
 * @returns Filtered and sorted array of projects
 */
export function applyFilters(
  projects: GeneratedProject[],
  filterState: GeneratedFilterState
): GeneratedProject[] {
  let filtered = [...projects];

  // Apply search filter
  if (filterState.search && filterState.search.trim()) {
    const searchLower = filterState.search.toLowerCase().trim();
    filtered = filtered.filter(project => {
      const nameMatch = project.name.toLowerCase().includes(searchLower);
      const descriptionMatch = project.description?.toLowerCase().includes(searchLower) ?? false;
      return nameMatch || descriptionMatch;
    });
  }

  // Apply status filter
  if (filterState.status !== null) {
    filtered = filtered.filter(project => project.status === filterState.status);
  }

  // Apply date range filter
  if (filterState.dateRange) {
    filtered = filtered.filter(project => {
      const projectDate = new Date(project.created_at);
      
      if (filterState.dateRange!.start && projectDate < filterState.dateRange!.start) {
        return false;
      }
      
      if (filterState.dateRange!.end && projectDate > filterState.dateRange!.end) {
        return false;
      }
      
      return true;
    });
  }

  // Apply category filter if present
  if (filterState.category && filterState.category.trim()) {
    // Category filtering would be implemented here if projects had categories
    // For now, we'll skip this as the GeneratedProject doesn't have a category field
  }

  // Apply sorting
  filtered = sortProjects(filtered, filterState.sortBy, filterState.sortOrder);

  return filtered;
}

/**
 * Searches projects by a search term
 * 
 * @param projects - Array of projects to search
 * @param searchTerm - Search term to match against project name and description
 * @returns Array of projects matching the search term
 */
export function searchProjects(
  projects: GeneratedProject[],
  searchTerm: string
): GeneratedProject[] {
  if (!searchTerm || !searchTerm.trim()) {
    return [...projects];
  }

  const searchLower = searchTerm.toLowerCase().trim();
  
  return projects.filter(project => {
    const nameMatch = project.name.toLowerCase().includes(searchLower);
    const descriptionMatch = project.description?.toLowerCase().includes(searchLower) ?? false;
    return nameMatch || descriptionMatch;
  });
}

/**
 * Filters projects by status
 * 
 * @param projects - Array of projects to filter
 * @param status - Status to filter by
 * @returns Array of projects with the specified status
 */
export function filterByStatus(
  projects: GeneratedProject[],
  status: ProjectStatus
): GeneratedProject[] {
  return projects.filter(project => project.status === status);
}

/**
 * Filters projects by date range
 * 
 * @param projects - Array of projects to filter
 * @param startDate - Start date of the range (inclusive)
 * @param endDate - End date of the range (inclusive)
 * @returns Array of projects within the date range
 */
export function filterByDateRange(
  projects: GeneratedProject[],
  startDate: Date | null,
  endDate: Date | null
): GeneratedProject[] {
  return projects.filter(project => {
    const projectDate = new Date(project.created_at);
    
    if (startDate && projectDate < startDate) {
      return false;
    }
    
    if (endDate && projectDate > endDate) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sorts projects by a specified field and order
 * 
 * @param projects - Array of projects to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort order (asc or desc)
 * @returns Sorted array of projects
 */
export function sortProjects(
  projects: GeneratedProject[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): GeneratedProject[] {
  const sorted = [...projects];
  
  sorted.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'budget':
        aValue = a.budget ?? -Infinity;
        bValue = b.budget ?? -Infinity;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'health':
        // Define health order: green < yellow < red
        const healthOrder = { green: 0, yellow: 1, red: 2 };
        aValue = healthOrder[a.health];
        bValue = healthOrder[b.health];
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return sorted;
}

/**
 * Applies multiple filters in combination
 * 
 * @param projects - Array of projects to filter
 * @param filters - Object containing multiple filter criteria
 * @returns Filtered array of projects
 */
export function applyCombinedFilters(
  projects: GeneratedProject[],
  filters: {
    search?: string;
    status?: ProjectStatus | null;
    dateRange?: { start: Date | null; end: Date | null } | null;
    health?: string;
  }
): GeneratedProject[] {
  let filtered = [...projects];

  // Apply search
  if (filters.search) {
    filtered = searchProjects(filtered, filters.search);
  }

  // Apply status filter
  if (filters.status) {
    filtered = filterByStatus(filtered, filters.status);
  }

  // Apply date range filter
  if (filters.dateRange) {
    filtered = filterByDateRange(filtered, filters.dateRange.start, filters.dateRange.end);
  }

  // Apply health filter
  if (filters.health) {
    filtered = filtered.filter(project => project.health === filters.health);
  }

  return filtered;
}

/**
 * Checks if two project arrays contain the same projects (by ID)
 * regardless of order
 * 
 * @param projects1 - First array of projects
 * @param projects2 - Second array of projects
 * @returns True if both arrays contain the same project IDs
 */
export function haveSameProjects(
  projects1: GeneratedProject[],
  projects2: GeneratedProject[]
): boolean {
  if (projects1.length !== projects2.length) {
    return false;
  }

  const ids1 = new Set(projects1.map(p => p.id));
  const ids2 = new Set(projects2.map(p => p.id));

  if (ids1.size !== ids2.size) {
    return false;
  }

  for (const id of ids1) {
    if (!ids2.has(id)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that a project matches search criteria
 * 
 * @param project - Project to validate
 * @param searchTerm - Search term to match
 * @returns True if the project matches the search term
 */
export function projectMatchesSearch(
  project: GeneratedProject,
  searchTerm: string
): boolean {
  if (!searchTerm || !searchTerm.trim()) {
    return true;
  }

  const searchLower = searchTerm.toLowerCase().trim();
  const nameMatch = project.name.toLowerCase().includes(searchLower);
  const descriptionMatch = project.description?.toLowerCase().includes(searchLower) ?? false;
  
  return nameMatch || descriptionMatch;
}

/**
 * Validates that a project matches filter criteria
 * 
 * @param project - Project to validate
 * @param filterState - Filter state to match against
 * @returns True if the project matches all filter criteria
 */
export function projectMatchesFilters(
  project: GeneratedProject,
  filterState: GeneratedFilterState
): boolean {
  // Check search
  if (filterState.search && filterState.search.trim()) {
    if (!projectMatchesSearch(project, filterState.search)) {
      return false;
    }
  }

  // Check status
  if (filterState.status !== null && project.status !== filterState.status) {
    return false;
  }

  // Check date range
  if (filterState.dateRange) {
    const projectDate = new Date(project.created_at);
    
    if (filterState.dateRange.start && projectDate < filterState.dateRange.start) {
      return false;
    }
    
    if (filterState.dateRange.end && projectDate > filterState.dateRange.end) {
      return false;
    }
  }

  return true;
}
