# Implementation Plan: Feature Toggle System

## Overview

This implementation plan breaks down the Feature Toggle System into discrete, actionable tasks. The approach follows a bottom-up strategy: database layer → backend API → frontend context → admin UI. Each task builds incrementally, with testing integrated throughout to catch errors early.

## Tasks

- [x] 1. Set up database schema and seed data
  - Create `feature_flags` table with all required columns and constraints
  - Create indexes on name, organization_id, and (name, organization_id)
  - Implement RLS policies for read (authenticated users) and write (admin only)
  - Create trigger for automatic updated_at timestamp updates
  - Create seed migration with initial flags: costbook_phase1, costbook_phase2, ai_anomaly_detection, import_builder_ai, nested_grids, predictive_forecast
  - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

- [x] 1.1 Write property test for unique flag names per scope
  - **Property 2: Unique Flag Names per Scope**
  - **Validates: Requirements 1.4**

- [x] 1.2 Write property test for automatic timestamp creation
  - **Property 3: Automatic Timestamp Creation**
  - **Validates: Requirements 1.5, 15.1**

- [x] 1.3 Write property test for automatic timestamp updates
  - **Property 4: Automatic Timestamp Updates**
  - **Validates: Requirements 1.6, 15.2**

- [x] 1.4 Write property test for UTC timestamp storage
  - **Property 21: UTC Timestamp Storage**
  - **Validates: Requirements 15.4**

- [x] 1.5 Write property test for timestamp precision
  - **Property 22: Timestamp Precision**
  - **Validates: Requirements 15.5**

- [x] 2. Implement backend API authentication and authorization middleware
  - Create `get_current_user` dependency that extracts user from JWT token
  - Create `require_admin` dependency that checks for admin role
  - Implement organization_id extraction from JWT token
  - Add error handling for missing/invalid tokens (401) and insufficient permissions (403)
  - _Requirements: 2.1, 2.2, 2.5, 4.3, 5.3, 12.1, 12.2, 12.3_

- [x] 2.1 Write property test for organization ID extraction
  - **Property 17: Organization ID Extraction**
  - **Validates: Requirements 12.2**

- [x] 2.2 Write property test for admin role detection
  - **Property 18: Admin Role Detection**
  - **Validates: Requirements 12.3**

- [x] 2.3 Write unit tests for authentication edge cases
  - Test unauthenticated requests return 401
  - Test non-admin write attempts return 403
  - _Requirements: 4.3, 5.3_

- [x] 3. Implement GET /api/features endpoint
  - Create Pydantic response models (FeatureFlagResponse)
  - Implement query logic to fetch global flags and organization-specific flags
  - Implement merge logic with organization flags taking precedence over global flags
  - Add error handling for database failures (503)
  - Return flags in JSON format with all required fields
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 3.1 Write property test for flag scoping and visibility
  - **Property 1: Flag Scoping and Visibility**
  - **Validates: Requirements 1.2, 1.3, 2.1, 4.1, 4.2**

- [x] 3.2 Write property test for API response format completeness
  - **Property 7: API Response Format Completeness**
  - **Validates: Requirements 4.4**

- [x] 4. Implement POST /api/features endpoint
  - Create Pydantic request model (FeatureFlagCreate) with validation
  - Implement name validation (alphanumeric + underscore + hyphen only)
  - Implement flag creation logic with admin permission check
  - Add error handling for validation errors (400), conflicts (409)
  - Return created flag with 201 status code
  - _Requirements: 5.1, 5.4, 5.6_

- [x] 4.1 Write property test for flag creation persistence
  - **Property 8: Flag Creation Persistence**
  - **Validates: Requirements 5.1**

- [x] 4.2 Write property test for input validation rejection
  - **Property 10: Input Validation Rejection**
  - **Validates: Requirements 5.4**

- [x] 4.3 Write property test for name format validation
  - **Property 11: Name Format Validation**
  - **Validates: Requirements 5.6**

- [x] 4.4 Write property test for admin write permissions
  - **Property 5: Admin Write Permissions**
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 4.5 Write property test for regular user write restrictions
  - **Property 6: Regular User Write Restrictions**
  - **Validates: Requirements 2.5**

- [x] 5. Implement PUT /api/features/{name} endpoint
  - Create Pydantic request model (FeatureFlagUpdate) with optional fields
  - Implement flag update logic with admin permission check
  - Ensure name cannot be changed during update
  - Add error handling for not found (404), validation errors (400)
  - Return updated flag with 200 status code
  - _Requirements: 5.2, 5.4, 9.5_

- [x] 5.1 Write property test for flag update persistence
  - **Property 9: Flag Update Persistence**
  - **Validates: Requirements 5.2**

- [x] 5.2 Write property test for edit preserves name
  - **Property 15: Edit Preserves Name**
  - **Validates: Requirements 9.5**

- [x] 6. Implement DELETE /api/features/{name} endpoint
  - Implement flag deletion logic with admin permission check
  - Support organization_id query parameter to specify which flag to delete
  - Add error handling for not found (404)
  - Return 204 No Content on success
  - _Requirements: 2.4_

- [x] 7. Checkpoint - Ensure all backend tests pass
  - Run all backend unit tests and property tests
  - Verify API endpoints work correctly with Postman or curl
  - Check database state after operations
  - Ask the user if questions arise

- [x] 8. Implement Supabase Realtime broadcasting
  - Create `broadcast_flag_change` function that sends events to `feature_flags_changes` channel
  - Integrate broadcasting into POST, PUT, DELETE endpoints
  - Include action type (created/updated/deleted) and flag data in broadcast payload
  - Add error handling for broadcast failures (log but don't fail main operation)
  - _Requirements: 5.5, 6.1_

- [x] 8.1 Write property test for real-time broadcast on changes
  - **Property 12: Real-Time Broadcast on Changes**
  - **Validates: Requirements 5.5, 6.1**

- [x] 9. Create frontend TypeScript types and interfaces
  - Create `types/feature-flags.ts` with FeatureFlag, FeatureFlagCreate, FeatureFlagUpdate interfaces
  - Create FeatureFlagsContextValue interface
  - Export all types for use throughout the application
  - _Requirements: 7.3_

- [x] 10. Implement FeatureFlagProvider context
  - Create `contexts/FeatureFlagContext.tsx` with React context
  - Implement state management for flags Map, loading, and error
  - Implement fetchFlags function that calls GET /api/features
  - Implement flag caching in Map<string, boolean> for O(1) lookups
  - Handle authentication state (fetch on login, clear on logout)
  - Add error handling with retry logic (exponential backoff)
  - _Requirements: 7.1, 7.6, 7.7, 12.4, 13.1, 13.2, 14.1_

- [x] 10.1 Write property test for error containment
  - **Property 19: Error Containment**
  - **Validates: Requirements 13.6**

- [x] 11. Implement Supabase Realtime subscription in context
  - Subscribe to `feature_flags_changes` channel in useEffect
  - Handle broadcast events (created/updated/deleted) and update local state
  - Implement automatic reconnection on connection loss
  - Clean up subscription on unmount
  - _Requirements: 6.1, 6.5, 7.2_

- [x] 12. Implement useFeatureFlags and useFeatureFlag hooks
  - Create useFeatureFlags hook that returns full context value
  - Create useFeatureFlag(flagName) hook that returns {enabled, loading}
  - Implement isFeatureEnabled function with O(1) Map lookup
  - Return false for non-existent flags (fail-safe default)
  - Ensure synchronous return for cached values
  - _Requirements: 7.3, 7.4, 7.5, 14.2_

- [x] 12.1 Write property test for hook returns boolean
  - **Property 13: Hook Returns Boolean**
  - **Validates: Requirements 7.3**

- [x] 12.2 Write property test for non-existent flag default
  - **Property 14: Non-Existent Flag Default**
  - **Validates: Requirements 7.5**

- [x] 12.3 Write property test for synchronous hook response
  - **Property 20: Synchronous Hook Response**
  - **Validates: Requirements 14.2**

- [x] 13. Integrate FeatureFlagProvider into app layout
  - Wrap application with FeatureFlagProvider in root layout
  - Ensure provider is inside SupabaseAuthProvider (depends on auth)
  - Test that flags are available throughout the app
  - _Requirements: 12.1_

- [x] 14. Checkpoint - Ensure frontend context works
  - Test flag fetching on login
  - Test real-time updates by manually changing flags in database
  - Verify hooks return correct values
  - Check error handling with network failures
  - Ask the user if questions arise

- [x] 15. Create admin UI page structure
  - Create `app/admin/features/page.tsx` with admin route protection
  - Implement redirect for non-admin users
  - Create basic page layout with header and container
  - Add loading state during initial data fetch
  - _Requirements: 8.1, 8.2_

- [x] 16. Implement admin UI flags table
  - Create table component with columns: Name, Description, Scope, Enabled, Actions
  - Fetch flags using GET /api/features on mount
  - Display flags in table rows with proper formatting
  - Show "Global" or organization name for Scope column
  - Format timestamps in human-readable format
  - Handle empty state (no flags)
  - _Requirements: 8.3, 15.3_

- [x] 17. Implement search and filtering functionality
  - Add search input with Search icon from lucide-react
  - Implement case-insensitive filtering on flag names
  - Debounce search input (300ms) for performance
  - Update filtered results as user types
  - Show "No results found" message when no matches
  - Clear filter when search is empty
  - _Requirements: 8.4, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 17.1 Write property test for case-insensitive search filtering
  - **Property 16: Case-Insensitive Search Filtering**
  - **Validates: Requirements 11.1, 11.2**

- [x] 18. Implement toggle switches for enabling/disabling flags
  - Create toggle switch component using Tailwind CSS
  - Add click handler that calls PUT /api/features/{name}
  - Implement optimistic updates (update UI immediately)
  - Revert on API failure with error notification
  - Show loading state during toggle operation
  - Use lucide-react icons for visual feedback
  - _Requirements: 8.6, 8.7, 8.8_

- [x] 19. Implement "Add New Flag" modal
  - Create modal component with form fields: name, description, scope, enabled
  - Add "Add New Flag" button with Plus icon that opens modal
  - Implement form validation (required fields, name format)
  - Show inline validation errors
  - Call POST /api/features on form submit
  - Close modal and refresh table on success
  - Show error notification on failure
  - _Requirements: 8.5, 9.1, 9.2, 9.3, 9.6_

- [x] 20. Implement edit flag functionality
  - Add Edit action button with Edit icon for each flag row
  - Create edit modal (reuse create modal component)
  - Pre-populate form with existing flag data
  - Disable name field (cannot be changed)
  - Call PUT /api/features/{name} on form submit
  - Update table row on success
  - Show error notification on failure
  - _Requirements: 9.4, 9.5, 9.6_

- [x] 21. Implement delete flag functionality
  - Add Delete action button with Trash icon for each flag row
  - Show confirmation dialog before deletion
  - Call DELETE /api/features/{name} on confirmation
  - Remove row from table on success
  - Show error notification on failure
  - _Requirements: 2.4_

- [x] 22. Implement real-time synchronization in admin UI
  - Subscribe to `feature_flags_changes` channel in admin page
  - Handle created events: add new row to table
  - Handle updated events: update existing row
  - Handle deleted events: remove row from table
  - Show visual indicator (flash/highlight) when updates occur
  - Ensure search filter is reapplied after real-time updates
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 23. Add error boundaries and error handling to admin UI
  - Wrap admin page in React Error Boundary
  - Display user-friendly error messages for API failures
  - Implement retry buttons for failed operations
  - Show connection status indicator for real-time
  - Log errors to console for debugging
  - _Requirements: 13.4, 13.5_

- [x] 24. Implement success notifications and loading states
  - Add toast notification system (or use existing)
  - Show success messages after create/update/delete operations
  - Display loading spinners during API calls
  - Show skeleton loaders during initial data fetch
  - Disable buttons during operations to prevent double-clicks
  - _Requirements: 8.8, 9.6_

- [x] 25. Final checkpoint - End-to-end testing
  - Test complete flag lifecycle: create → read → update → delete
  - Test real-time synchronization with multiple browser tabs
  - Test admin UI with different user roles (admin vs regular)
  - Test search and filtering with various queries
  - Test error scenarios (network failures, invalid data)
  - Verify all property tests pass with 100+ iterations
  - Ensure all unit tests pass
  - Ask the user if questions arise

- [x] 26. Write integration tests for complete workflows
  - Test flag creation and immediate retrieval
  - Test real-time updates across multiple clients
  - Test admin UI workflows (create, edit, delete via UI)
  - Test authentication and authorization flows
  - _Requirements: All_

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- Real-time functionality is critical - test thoroughly with multiple clients
- Error handling is essential - the system should never crash due to feature flag failures
