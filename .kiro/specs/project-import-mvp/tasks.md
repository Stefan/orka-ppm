# Implementation Plan: Project Import MVP

## Overview

This implementation plan breaks down the project import feature into discrete coding tasks. The approach follows a layered implementation strategy: starting with core backend services (validation, CSV parsing), then API endpoints with authentication, followed by frontend components, and finally integration with comprehensive testing throughout.

Each task builds incrementally on previous work, with property-based tests placed close to implementation to catch errors early. The plan ensures no orphaned code by wiring components together progressively.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create new directories: `backend/services/`, `backend/routers/projects_import.py`, `components/projects/`
  - Install backend dependencies: `pandas`, `hypothesis` (for property testing)
  - Install frontend dependencies: `react-dropzone`, `fast-check` (for property testing)
  - Update `backend/auth/rbac.py` to add `Permission.data_import` if not present
  - _Requirements: 1.5, 2.4_

- [x] 2. Implement validation service
  - [x] 2.1 Create `backend/services/validation_service.py` with ValidationService class
    - Implement `validate_project()` method with all validation rules
    - Implement helper methods: `_check_required_fields()`, `_check_duplicate_name()`, `_validate_budget()`, `_validate_date()`, `_validate_status()`
    - Define constants: `REQUIRED_FIELDS`, `VALID_STATUSES`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.3, 8.4, 8.5_
  
  - [x] 2.2 Write property test for missing required fields validation
    - **Property 3: Missing required fields are rejected**
    - **Validates: Requirements 3.1, 8.4**
  
  - [x] 2.3 Write property test for duplicate name detection
    - **Property 4: Duplicate names are rejected**
    - **Validates: Requirements 3.2**
  
  - [x] 2.4 Write property test for budget validation
    - **Property 5: Non-numeric budgets are rejected**
    - **Validates: Requirements 3.3, 8.1**
  
  - [x] 2.5 Write property test for date format validation
    - **Property 6: Invalid date formats are rejected**
    - **Validates: Requirements 3.4, 8.2**
  
  - [x] 2.6 Write property test for status validation
    - **Property 9: Invalid status values are rejected**
    - **Validates: Requirements 8.3**
  
  - [x] 2.7 Write property test for minimal valid records
    - **Property 10: Minimal valid records are accepted**
    - **Validates: Requirements 8.5**
  
  - [x] 2.8 Write unit tests for validation edge cases
    - Test empty strings vs null values
    - Test whitespace-only fields
    - Test maximum field lengths
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implement CSV parser service
  - [x] 3.1 Create `backend/services/csv_parser.py` with CSVParser class
    - Implement `parse_csv()` method using pandas
    - Implement `_validate_columns()` to check required columns
    - Implement `_row_to_project()` to convert DataFrame rows to ProjectCreate objects
    - Define `COLUMN_MAPPING` and `REQUIRED_COLUMNS` constants
    - Create `CSVParseError` exception class
    - _Requirements: 2.1, 2.2, 10.1, 10.2, 10.3_
  
  - [x] 3.2 Write property test for CSV header mapping
    - **Property 2: CSV header mapping preserves data**
    - **Validates: Requirements 2.2, 10.1, 10.2**
  
  - [x] 3.3 Write property test for CSV delimiter flexibility
    - **Property 14: CSV delimiter flexibility**
    - **Validates: Requirements 10.4**
  
  - [x] 3.4 Write property test for quoted field handling
    - **Property 15: Quoted field handling**
    - **Validates: Requirements 10.5**
  
  - [x] 3.5 Write unit tests for CSV parsing errors
    - Test malformed CSV structure
    - Test missing required columns
    - Test encoding issues (UTF-8, Latin-1)
    - Test empty CSV files
    - _Requirements: 2.5, 10.3_

- [x] 4. Implement audit service
  - [x] 4.1 Create `backend/services/audit_service.py` with AuditService class
    - Implement `log_import_start()` method
    - Implement `log_import_complete()` method
    - Handle audit logging failures gracefully (log warning but don't fail import)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 4.2 Write property test for audit logging completeness
    - **Property 12: Audit logging completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  
  - [x] 4.3 Write unit test for audit logging failure graceful degradation
    - Test that import succeeds even when audit logging fails
    - _Requirements: 5.5_

- [x] 5. Checkpoint - Ensure all service tests pass
  - Run all tests for validation, CSV parser, and audit services
  - Ensure all tests pass, ask the user if questions arise

- [ ] 6. Implement import service
  - [x] 6.1 Create `backend/services/import_service.py` with ImportService and ImportResult classes
    - Implement `import_projects()` orchestration method
    - Implement `_validate_batch()` to validate all projects
    - Implement `_create_projects_transaction()` with database transaction handling
    - Integrate ValidationService, AuditService
    - _Requirements: 1.1, 1.2, 2.3, 3.5, 3.6, 9.2, 9.3_
  
  - [x] 6.2 Write property test for valid imports creating all projects
    - **Property 1: Valid imports create all projects**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.3**
  
  - [x] 6.3 Write property test for validation error completeness
    - **Property 7: Validation errors are comprehensive**
    - **Validates: Requirements 3.5, 7.1**
  
  - [x] 6.4 Write property test for import atomicity with invalid records
    - **Property 8: Import atomicity (all-or-nothing)**
    - **Validates: Requirements 3.6, 9.1, 9.5**
  
  - [x] 6.5 Write property test for transaction atomicity with valid batches
    - **Property 11: Transaction atomicity for valid batches**
    - **Validates: Requirements 9.2**
  
  - [x] 6.6 Write unit tests for database error handling
    - Test transaction rollback on database errors
    - Test error message for rollback scenarios
    - _Requirements: 9.3, 9.4_

- [x] 7. Implement import API endpoints
  - [x] 7.1 Create `backend/routers/projects_import.py` with FastAPI router
    - Implement `POST /api/projects/import` endpoint for JSON imports
    - Implement `POST /api/projects/import/csv` endpoint for CSV uploads
    - Add JWT authentication dependency (`get_current_user`)
    - Add RBAC permission check (`require_permission(Permission.data_import)`)
    - Wire ImportService and CSVParser
    - Handle all error types with appropriate HTTP status codes
    - _Requirements: 1.3, 1.4, 1.5, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.2 Write property test for error response format consistency
    - **Property 13: Error response format consistency**
    - **Validates: Requirements 7.6**
  
  - [x] 7.3 Write unit tests for authentication and authorization
    - Test missing JWT token returns 401
    - Test invalid JWT token returns 401
    - Test expired JWT token returns 401
    - Test missing `data_import` permission returns 403
    - Test disabled user account returns 403
    - _Requirements: 1.3, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.4 Write unit tests for API endpoint routing
    - Test POST method accepted on both endpoints
    - Test other HTTP methods rejected
    - Test correct paths: `/api/projects/import` and `/api/projects/import/csv`
    - _Requirements: 1.5, 2.4_

- [x] 8. Register import router in main application
  - [x] 8.1 Update `backend/main.py` to include projects_import router
    - Import and register the new router
    - Ensure router is mounted with correct prefix
    - _Requirements: 1.5, 2.4_

- [x] 9. Checkpoint - Ensure all backend tests pass
  - Run full backend test suite
  - Test API endpoints with curl or Postman
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. Implement frontend import modal component
  - [x] 10.1 Create `components/projects/ProjectImportModal.tsx`
    - Implement modal UI with method selection (JSON/CSV tabs)
    - Implement JSON textarea input
    - Implement CSV drag-and-drop upload using react-dropzone
    - Implement loading state during API calls
    - Implement success message display with project count
    - Implement error message display with record details
    - Add "Copy errors" button for error sharing
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 10.2 Write unit tests for modal component
    - Test modal opens and closes
    - Test method selection switches UI
    - Test file upload accepts only CSV files
    - Test loading indicator displays during API calls
    - Test success message displays with correct count
    - Test error messages display with record details
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 11. Implement frontend API route
  - [x] 11.1 Create `app/api/projects/import/route.ts`
    - Implement POST handler for both JSON and CSV imports
    - Detect content type to determine import method
    - Extract JWT token from cookies or headers
    - Proxy requests to backend API with authentication
    - Handle backend responses and errors
    - Return appropriate status codes
    - _Requirements: 1.3, 1.4, 1.5, 2.4_
  
  - [x] 11.2 Write unit tests for API route
    - Test JSON import proxying
    - Test CSV import proxying
    - Test authentication token extraction
    - Test error handling for missing token
    - Test error response forwarding
    - _Requirements: 1.3, 1.4_

- [x] 12. Add import button to dashboard
  - [x] 12.1 Update `app/dashboards/page.tsx`
    - Add import button to Quick Actions section (around line 756)
    - Add state management for modal visibility
    - Wire button click to open ProjectImportModal
    - Import and render ProjectImportModal component
    - _Requirements: 6.1_
  
  - [x] 12.2 Write unit test for import button
    - Test button renders in dashboard
    - Test button click opens modal
    - _Requirements: 6.1_

- [x] 13. Integration and end-to-end testing
  - [x] 13.1 Write integration tests for complete import flow
    - Test JSON import from frontend to database
    - Test CSV import from frontend to database
    - Test validation error flow
    - Test authentication error flow
    - Test audit logging for successful and failed imports
    - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.6, 5.1, 5.2, 5.3_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Run full test suite (backend and frontend)
  - Test complete user flow in development environment
  - Verify audit logs are created correctly
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Checkpoints ensure incremental validation throughout implementation
- All components are wired together progressively to avoid orphaned code
