# Implementation Plan: User Management & Admin Dashboard

## Overview

This implementation plan covers fixing AI chat errors, implementing comprehensive user management, and adding SSO integration foundation. The approach prioritizes error handling fixes first, then builds out admin functionality systematically.

## Tasks

- [x] 1. Fix AI Chat Error Handling in Reports
  - Enhance error recovery system in `/reports/page.tsx`
  - Add comprehensive error classification and retry logic
  - Implement user-friendly error messages and recovery suggestions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 1.1 Write property test for error recovery system
  - **Property 1: Error Recovery Consistency**
  - **Validates: Requirements 1.4, 1.6**

- [x] 2. Create User Management Database Schema
  - Create enhanced user_profiles table with role and status tracking
  - Add user_activity_log table for activity monitoring
  - Add admin_audit_log table for administrative action tracking
  - Add chat_error_log table for error tracking and analysis
  - _Requirements: 8.4, 8.5, 7.3_

- [ ]* 2.1 Write property test for user data consistency
  - **Property 5: User Data Consistency**
  - **Validates: Requirements 8.4, 8.5**

- [x] 3. Implement User Management Backend API
- [x] 3.1 Create user management data models and validation
  - Write Pydantic models for UserResponse, UserCreateRequest, UserUpdateRequest
  - Implement input validation and error handling
  - _Requirements: 2.9, 2.7_

- [x] 3.2 Implement GET /admin/users endpoint
  - Add pagination, search, and filtering functionality
  - Integrate with Supabase auth.users and user_profiles tables
  - _Requirements: 2.1, 2.7_

- [x] 3.3 Implement POST /admin/users endpoint
  - Add user creation with email invitation
  - Handle Supabase Auth integration for new users
  - _Requirements: 2.2_

- [x] 3.4 Implement PUT /admin/users/{id} endpoint
  - Add user update functionality with role and status changes
  - Maintain data consistency between auth and profile tables
  - _Requirements: 2.3_

- [x] 3.5 Implement DELETE /admin/users/{id} endpoint
  - Add user deletion with proper cleanup of related data
  - Handle referential integrity for project assignments
  - _Requirements: 2.4, 8.6_

- [x] 3.6 Implement POST /admin/users/{id}/deactivate endpoint
  - Add user deactivation functionality
  - Log deactivation actions and handle project reassignments
  - _Requirements: 2.5, 8.2_

- [ ]* 3.7 Write property test for admin permission enforcement
  - **Property 2: Admin Permission Enforcement**
  - **Validates: Requirements 7.1, 7.3**

- [x]* 3.8 Write unit tests for user CRUD operations
  - Test all user management endpoints
  - Test error conditions and validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Create Admin Dashboard Frontend
- [x] 4.1 Create admin layout and navigation structure
  - Build AdminLayout component with sidebar integration
  - Add admin navigation to main Sidebar component
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 4.2 Implement user management table component
  - Create UserTable with sorting, filtering, and pagination
  - Display email, role, last login, status, and actions
  - _Requirements: 3.1, 3.2_

- [x] 4.3 Add user action components
  - Implement invite, deactivate, and delete actions
  - Add confirmation dialogs for destructive actions
  - _Requirements: 3.4, 3.5_

- [x] 4.4 Create user search and filter functionality
  - Add search by email and filter by role/status
  - Implement real-time filtering and debounced search
  - _Requirements: 3.3_

- [x] 4.5 Add bulk user management actions
  - Implement multi-select functionality
  - Add bulk deactivate and delete operations
  - _Requirements: 3.10_

- [ ]* 4.6 Write property test for admin navigation security
  - **Property 7: Admin Navigation Security**
  - **Validates: Requirements 6.3, 7.5**

- [ ]* 4.7 Write unit tests for admin dashboard components
  - Test user table functionality
  - Test action buttons and confirmation dialogs
  - _Requirements: 3.1, 3.4, 3.5_

- [ ] 5. Implement Auto-Deactivation Job System
- [ ] 5.1 Create user deactivation job scheduler
  - Implement UserDeactivationJob class with configurable thresholds
  - Add job scheduling with cron-like functionality
  - _Requirements: 4.1, 4.6_

- [ ] 5.2 Add inactive user detection logic
  - Query users with last_login older than threshold
  - Exclude admin users and recently created accounts
  - _Requirements: 4.2, 4.5_

- [ ] 5.3 Implement deactivation execution and logging
  - Execute user deactivation with proper audit logging
  - Send notification emails to deactivated users
  - _Requirements: 4.3, 4.4_

- [ ]* 5.4 Write property test for auto-deactivation rules
  - **Property 8: Auto-deactivation Exclusion Rules**
  - **Validates: Requirements 4.5, 4.1**

- [ ]* 5.5 Write unit tests for deactivation job
  - Test inactive user detection
  - Test deactivation execution and logging
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Add SSO Integration Foundation
- [ ] 6.1 Create SSO configuration models
  - Implement SSOConfig and SSOHandler classes
  - Add support for Okta and Azure AD configuration
  - _Requirements: 5.1, 5.3, 5.4_

- [ ] 6.2 Implement OAuth 2.0/SAML authentication flows
  - Add OAuth 2.0 callback handling
  - Implement SAML assertion processing
  - _Requirements: 5.1, 5.2_

- [ ] 6.3 Add user provisioning and attribute mapping
  - Implement Just-In-Time user provisioning
  - Map SSO attributes to internal user profiles
  - _Requirements: 5.5, 5.9_

- [ ] 6.4 Create SSO authentication middleware
  - Add authentication flow routing
  - Maintain backward compatibility with email/password
  - _Requirements: 5.6, 5.7, 5.8_

- [ ]* 6.5 Write property test for SSO authentication
  - **Property 4: SSO Authentication Round-trip**
  - **Validates: Requirements 5.1, 5.8**

- [ ]* 6.6 Write unit tests for SSO integration
  - Test OAuth and SAML flows
  - Test user provisioning and mapping
  - _Requirements: 5.1, 5.2, 5.5, 5.9_

- [ ] 7. Enhance Security and Permissions
- [ ] 7.1 Implement admin permission middleware
  - Add require_admin dependency for admin endpoints
  - Enhance existing RBAC system with admin role checks
  - _Requirements: 7.1, 7.2_

- [ ] 7.2 Add comprehensive audit logging
  - Log all administrative actions with user identification
  - Implement audit trail for user management operations
  - _Requirements: 7.3, 7.6_

- [ ] 7.3 Implement rate limiting for admin endpoints
  - Add rate limiting middleware for admin API endpoints
  - Configure appropriate limits for different operations
  - _Requirements: 7.4_

- [ ]* 7.4 Write property test for user deactivation integrity
  - **Property 3: User Deactivation Integrity**
  - **Validates: Requirements 4.2, 8.2**

- [ ]* 7.5 Write unit tests for security features
  - Test permission validation
  - Test audit logging functionality
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8. Integration and Testing
- [ ] 8.1 Integrate admin navigation with existing sidebar
  - Update Sidebar component to include admin links
  - Add permission-based navigation visibility
  - _Requirements: 6.1, 6.3, 6.4_

- [ ] 8.2 Add error logging and monitoring
  - Implement comprehensive error logging for AI chat
  - Add monitoring dashboard for error tracking
  - _Requirements: 1.2, 1.5_

- [ ] 8.3 Create data migration scripts
  - Migrate existing user data to new schema
  - Handle existing role assignments and permissions
  - _Requirements: 8.3, 8.5_

- [ ]* 8.4 Write property test for error classification
  - **Property 6: Error Classification Accuracy**
  - **Validates: Requirements 1.1, 1.2, 1.5**

- [ ]* 8.5 Write integration tests for complete workflows
  - Test end-to-end user management workflows
  - Test AI chat error recovery scenarios
  - _Requirements: 1.7, 3.6, 7.6_

- [ ] 9. Final Integration and Deployment
- [ ] 9.1 Update environment configuration
  - Add SSO provider configuration variables
  - Configure auto-deactivation job settings
  - _Requirements: 5.3, 5.4, 4.6_

- [ ] 9.2 Deploy database schema changes
  - Apply all database migrations
  - Verify data integrity and constraints
  - _Requirements: 8.4, 8.5_

- [ ] 9.3 Test complete system integration
  - Verify all features work together correctly
  - Test admin dashboard with real user data
  - _Requirements: 8.1, 8.7_

- [ ] 10. Checkpoint - Ensure all tests pass
- Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases