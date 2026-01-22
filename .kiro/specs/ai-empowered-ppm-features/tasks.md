# Implementation Plan: AI-Empowered PPM Features

## Overview

This implementation plan breaks down the AI-empowered PPM features into discrete, incremental coding tasks. The plan follows a logical progression: fix existing AI chat issues, implement AI agents, add workflow engine, extend RBAC, implement bulk imports, and finally add advanced audit capabilities. Each task builds on previous work and includes testing sub-tasks to validate functionality early.

The implementation uses Python/FastAPI for backend and TypeScript/Next.js for frontend, integrating with existing authentication patterns and Supabase database.

## Tasks

- [x] 1. Fix and enhance RAG Reporter Agent with error handling and retry logic
  - [x] 1.1 Add comprehensive error handling to RAGReporterAgent
    - Wrap all operations in try-except blocks with specific exception types (OpenAIError, SupabaseError, ValidationError)
    - Implement error logging to audit_logs with full context (timestamp, user_id, error message, stack trace)
    - Return user-friendly error messages (sanitize technical details)
    - _Requirements: 1.1, 1.6, 1.7_
    - **Status: Implemented in ai_agents.py and routers/ai.py**
  
  - [x] 1.2 Implement retry logic with exponential backoff
    - Add max_retries=3 configuration
    - Implement exponential backoff delays (1s, 2s, 4s)
    - Track retry attempts and log each attempt
    - _Requirements: 1.2_
    - **Status: Implemented in ai_agents.py**
  
  - [x] 1.3 Add confidence threshold handling
    - Set confidence_threshold=0.5
    - Check confidence score after each generation attempt
    - Trigger retry if confidence < threshold
    - Return fallback response after exhausting retries with low confidence
    - _Requirements: 1.3_
    - **Status: Implemented in ai_agents.py**
  
  - [x] 1.4 Implement interaction logging for successful requests
    - Log query, response, confidence score to audit_logs
    - Include organization_id and user_id in logs
    - Add action type "ai_query" for filtering
    - _Requirements: 1.5_
    - **Status: Implemented in ai_agents.py**
  
  - [x] 1.4a Setup RAG database infrastructure
    - [x] 1.4a.1 Create database migration for embeddings table
      - Add pgvector extension
      - Create embeddings table with vector(1536) column
      - Add indexes for performance (ivfflat for vector search)
      - Add unique constraint on (content_type, content_id)
      - _See: docs/RAG_IMPLEMENTATION_STATUS.md for SQL_
    
    - [x] 1.4a.2 Create vector_similarity_search RPC function
      - Implement PostgreSQL function for efficient vector search
      - Support content_type filtering
      - Return similarity scores with results
      - _See: docs/RAG_IMPLEMENTATION_STATUS.md for SQL_
    
    - [x] 1.4a.3 Create content indexing service
      - Implement background worker to index projects/portfolios/resources
      - Generate embeddings for all content
      - Store embeddings in embeddings table
      - Add webhook/trigger for automatic indexing on content changes
    
    - [x] 1.4a.4 Create initial content indexing script
      - Script to index all existing projects
      - Script to index all existing portfolios
      - Script to index all existing resources
      - Batch processing for large datasets
    
    - [-] 1.4a.5 Configure OpenAI API key
      - Set OPENAI_API_KEY in environment variables
      - Optional: Set OPENAI_BASE_URL for alternative providers
      - Optional: Set OPENAI_MODEL and OPENAI_EMBEDDING_MODEL
      - Document configuration in deployment guide
  
  - [x] 1.5 Write property test for RAG error handling
    - **Property 4: Exception Logging and User-Friendly Errors**
    - **Validates: Requirements 1.7**
  
  - [x] 1.6 Write property test for retry logic
    - **Property 2: Retry with Exponential Backoff**
    - **Validates: Requirements 1.2**
  
  - [x] 1.7 Write property test for confidence threshold
    - **Property 3: Confidence Threshold Handling**
    - **Validates: Requirements 1.3**
  
  - [x] 1.8 Write unit tests for RAG edge cases
    - Test empty query handling
    - Test malformed context data
    - Test OpenAI API timeout scenarios
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement Resource Optimizer Agent
  - [x] 2.1 Complete ResourceOptimizerAgent class
    - Implement optimize_resources method with organization filtering
    - Retrieve resources and projects from Supabase
    - Build PuLP linear programming model (minimize cost, satisfy constraints)
    - Extract recommendations from solved model
    - Calculate confidence scores based on solution quality
    - Log optimization requests and results to audit_logs
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.2 Implement optimization model builder
    - Define decision variables: allocation[resource_id, project_id]
    - Set objective: minimize Σ(resource_cost × allocation_hours)
    - Add constraints: resource availability, project requirements, skill matching
    - Handle infeasible solutions with clear error messages
    - _Requirements: 2.2, 2.6_
  
  - [x] 2.3 Add error handling for insufficient data
    - Check for missing resources or projects
    - Return specific error messages indicating missing data
    - _Requirements: 2.5_
  
  - [x] 2.4 Write property test for optimization cost minimization
    - **Property 6: Optimization Cost Minimization**
    - **Validates: Requirements 2.2**
  
  - [x] 2.5 Write property test for confidence scores
    - **Property 7: AI Agent Confidence Scores**
    - **Validates: Requirements 2.3**
  
  - [x] 2.6 Write property test for missing data errors
    - **Property 8: Missing Data Error Messages**
    - **Validates: Requirements 2.5**
  
  - [x] 2.7 Write unit tests for optimizer edge cases
    - Test with zero resources
    - Test with conflicting constraints
    - Test with optimal solution scenarios
    - _Requirements: 2.2, 2.5, 2.6_

- [x] 3. Implement Risk Forecaster Agent
  - [x] 3.1 Complete RiskForecasterAgent class
    - Implement forecast_risks method with organization filtering
    - Retrieve historical risk data from Supabase
    - Prepare time series data using pandas
    - Fit ARIMA model with auto parameter selection
    - Generate forecasts with confidence intervals
    - Log forecast requests and results to audit_logs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_
  
  - [x] 3.2 Implement ARIMA model fitting
    - Use statsmodels auto_arima for parameter selection
    - Test p,d,q parameters in range (0-2, 0-1, 0-2)
    - Detect and model seasonality if present
    - Calculate model confidence using AIC and RMSE
    - _Requirements: 3.2_
  
  - [x] 3.3 Add error handling for insufficient data
    - Check for minimum data points (min_data_points=10)
    - Return error message indicating minimum requirements
    - _Requirements: 3.5_
  
  - [x] 3.4 Write property test for forecast output format
    - **Property 9: ARIMA Forecast Output Format**
    - **Validates: Requirements 3.3, 3.4**
  
  - [x] 3.5 Write property test for organization isolation
    - **Property 5: Organization Context Isolation**
    - **Validates: Requirements 3.1**
  
  - [x] 3.6 Write unit tests for forecaster edge cases
    - Test with minimal data (exactly 10 points)
    - Test with insufficient data (< 10 points)
    - Test with seasonal data
    - _Requirements: 3.2, 3.5_

- [x] 4. Implement Data Validator Agent
  - [x] 4.1 Create DataValidatorAgent class
    - Implement validate_data method with scope parameter
    - Support validation scopes: "all", "financials", "timelines", "integrity"
    - Aggregate results from all validation methods
    - Return report with issues grouped by severity
    - Log validation requests and results to audit_logs
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [x] 4.2 Implement financial validation
    - Check for budget overruns (actual_cost > budget)
    - Detect negative values in cost or budget fields
    - Find projects without budget records
    - Assign severity based on overrun percentage
    - _Requirements: 4.1_
  
  - [x] 4.3 Implement timeline validation
    - Check for end_date < start_date
    - Detect overdue projects (end_date < current_date AND status != "completed")
    - Find resource conflicts (overlapping allocations)
    - _Requirements: 4.2_
  
  - [x] 4.4 Implement integrity validation
    - Check for orphaned foreign key references
    - Detect NULL values in required fields
    - Find duplicate unique identifiers
    - _Requirements: 4.3_
  
  - [x] 4.5 Write property test for budget overrun detection
    - **Property 10: Budget Overrun Detection**
    - **Validates: Requirements 4.1**
  
  - [x] 4.6 Write property test for timeline violation detection
    - **Property 11: Timeline Violation Detection**
    - **Validates: Requirements 4.2**
  
  - [x] 4.7 Write property test for integrity validation
    - **Property 12: Data Integrity Validation**
    - **Validates: Requirements 4.3**
  
  - [x] 4.8 Write property test for severity assignment
    - **Property 13: Validation Issue Severity Assignment**
    - **Validates: Requirements 4.4**

- [x] 5. Create AI agent API endpoints
  - [x] 5.1 Update /reports/adhoc endpoint for RAG agent
    - Use enhanced RAGReporterAgent with error handling
    - Add request/response models (RAGReportRequest, RAGReportResponse)
    - Include JWT authentication with get_current_user
    - Return confidence scores and sources
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 5.2 Create /agents/optimize-resources endpoint
    - Implement POST endpoint using ResourceOptimizerAgent
    - Add request/response models (OptimizeResourcesRequest, OptimizeResourcesResponse)
    - Include JWT authentication and organization filtering
    - Return recommendations with confidence scores
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 5.3 Create /agents/forecast-risks endpoint
    - Implement POST endpoint using RiskForecasterAgent
    - Add request/response models (ForecastRisksRequest, ForecastRisksResponse)
    - Include JWT authentication and organization filtering
    - Return forecasts with confidence intervals
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 5.4 Create /agents/validate-data endpoint
    - Implement POST endpoint using DataValidatorAgent
    - Add request/response models (ValidateDataRequest, ValidateDataResponse)
    - Include JWT authentication and organization filtering
    - Return validation report with severity levels
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 5.5 Write property test for JWT authentication
    - **Property 22: JWT Authentication Enforcement**
    - **Validates: Requirements 7.4**
  
  - [x] 5.6 Write property test for input validation
    - **Property 23: Input Validation Error Details**
    - **Validates: Requirements 7.5**


- [x] 6. Update frontend Reports page with AI agent integration
  - [x] 6.1 Add error handling to AI agent requests
    - Implement toast notifications for errors
    - Add retry button on failed requests
    - Display loading indicators during processing
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 6.2 Create visualization components for AI results
    - Add Recharts components for optimizer recommendations
    - Add timeline charts for risk forecasts
    - Display validation issues with severity indicators
    - Show confidence scores for all recommendations
    - _Requirements: 5.3, 5.4_
  
  - [x] 6.3 Implement consistent data formatting
    - Format numerical values (currency, percentages)
    - Format dates consistently (YYYY-MM-DD)
    - Apply formatting across all AI result displays
    - _Requirements: 5.6_
  
  - [x] 6.4 Write property test for frontend error handling
    - **Property 14: Frontend Error Handling**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 6.5 Write property test for loading states
    - **Property 15: Frontend Loading States**
    - **Validates: Requirements 5.5**
  
  - [x] 6.6 Write unit tests for visualization components
    - Test chart rendering with sample data
    - Test confidence score display
    - Test error state rendering
    - _Requirements: 5.3, 5.4_

- [x] 7. Checkpoint - Ensure AI agents are working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Workflow Engine
  - [x] 8.1 Create WorkflowEngine class
    - Implement create_instance method
    - Implement advance_workflow method
    - Implement submit_approval method
    - Implement get_instance_status method
    - Add organization filtering to all methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 8.2 Implement workflow state management
    - Create workflow_instances records with initial state
    - Create workflow_approvals records for each step
    - Update current_step on approval
    - Set status to "completed" or "rejected" appropriately
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 8.3 Add audit logging for workflow operations
    - Log workflow creation
    - Log state transitions
    - Log approval decisions
    - Include user_id and organization_id in all logs
    - _Requirements: 6.6_
  
  - [x] 8.4 Implement Supabase Realtime notifications
    - Send notifications on workflow state changes
    - Notify approvers when approval is required
    - Notify initiator on completion or rejection
    - _Requirements: 6.7_
  
  - [x] 8.5 Write property test for workflow instance creation
    - **Property 16: Workflow Instance Creation**
    - **Validates: Requirements 6.1**
  
  - [x] 8.6 Write property test for approval record creation
    - **Property 17: Workflow Approval Record Creation**
    - **Validates: Requirements 6.2**
  
  - [x] 8.7 Write property test for state advancement
    - **Property 18: Workflow State Advancement**
    - **Validates: Requirements 6.3**
  
  - [x] 8.8 Write property test for workflow completion
    - **Property 19: Workflow Completion**
    - **Validates: Requirements 6.4**
  
  - [x] 8.9 Write property test for workflow rejection
    - **Property 20: Workflow Rejection Halting**
    - **Validates: Requirements 6.5**
  
  - [x] 8.10 Write property test for realtime notifications
    - **Property 21: Workflow Realtime Notifications**
    - **Validates: Requirements 6.7**

- [x] 9. Create workflow API endpoints
  - [x] 9.1 Create POST /workflows/approve-project endpoint
    - Accept workflow_id, entity_type, entity_id, decision, comments
    - Use WorkflowEngine to create or update workflow instance
    - Include JWT authentication and organization filtering
    - Return workflow instance status
    - _Requirements: 7.1_
  
  - [x] 9.2 Create GET /workflows/instances/{id} endpoint
    - Retrieve workflow instance by id
    - Filter by organization_id
    - Return full workflow status with steps and approvals
    - _Requirements: 7.2_
  
  - [x] 9.3 Create POST /workflows/instances/{id}/advance endpoint
    - Advance workflow to next step if conditions met
    - Validate user permissions
    - Return updated workflow status
    - _Requirements: 7.3_
  
  - [x] 9.4 Write property test for workflow organization filtering
    - **Property 5: Organization Context Isolation**
    - **Validates: Requirements 7.2**
  
  - [x] 9.5 Write unit tests for workflow endpoints
    - Test approval submission
    - Test workflow advancement
    - Test permission validation
    - _Requirements: 7.1, 7.3, 7.4_

- [x] 10. Implement workflow frontend interface
  - [x] 10.1 Add workflow status display to Projects page
    - Show workflow status for each project
    - Highlight pending approvals
    - Display current step and approvers
    - _Requirements: 8.1_
  
  - [x] 10.2 Create workflow approval modal
    - Display workflow details and history
    - Provide approve/reject buttons
    - Add comments field
    - Submit decision to backend
    - _Requirements: 8.2, 8.4_
  
  - [x] 10.3 Implement Supabase Realtime subscriptions
    - Subscribe to workflow_instances changes
    - Update UI when workflow state changes
    - Show real-time notifications for approvals
    - _Requirements: 8.3_
  
  - [x] 10.4 Add workflow history display
    - Show all state transitions
    - Display timestamps and user names
    - Show approval comments
    - _Requirements: 8.5_
  
  - [x] 10.5 Write property test for real-time updates
    - **Property 36: Frontend Real-time Workflow Updates**
    - **Validates: Requirements 8.3**
  
  - [x] 10.6 Write unit tests for workflow UI components
    - Test modal rendering
    - Test approval submission
    - Test status display
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 11. Checkpoint - Ensure workflow engine is working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Extend RBAC with role management endpoints
  - [x] 12.1 Create GET /admin/roles endpoint
    - Return all available roles (admin, manager, member, viewer)
    - Include permissions for each role
    - Use require_admin dependency for authorization
    - _Requirements: 9.1_
  
  - [x] 12.2 Create POST /admin/users/{user_id}/roles endpoint
    - Accept role assignment request
    - Validate user and role exist
    - Update user's roles in database
    - Log role assignment to audit_logs
    - Use require_admin dependency
    - _Requirements: 9.2, 9.5, 9.6_
  
  - [x] 12.3 Create DELETE /admin/users/{user_id}/roles/{role_id} endpoint
    - Accept role removal request
    - Validate user and role exist
    - Remove role from user
    - Log role removal to audit_logs
    - Use require_admin dependency
    - _Requirements: 9.3, 9.5, 9.6_
  
  - [x] 12.4 Write property test for admin authorization
    - **Property 24: Admin Authorization**
    - **Validates: Requirements 9.4**
  
  - [x] 12.5 Write property test for role assignment
    - **Property 25: Role Assignment and Removal**
    - **Validates: Requirements 9.2, 9.3, 9.5**
  
  - [x] 12.6 Write unit tests for role endpoints
    - Test role listing
    - Test assignment with non-existent user
    - Test removal with non-existent role
    - _Requirements: 9.1, 9.6_

- [x] 13. Create RBAC frontend administration interface
  - [x] 13.1 Create /admin page with role management UI
    - Display all users with current roles
    - Show role descriptions and permissions
    - Provide role assignment interface
    - _Requirements: 10.1, 10.2, 10.6_
  
  - [x] 13.2 Implement role assignment functionality
    - Allow admins to select users
    - Display available roles for assignment
    - Submit role changes to backend
    - Display confirmation messages
    - _Requirements: 10.3, 10.4_
  
  - [x] 13.3 Add access control for admin page
    - Check user role before rendering
    - Redirect non-admin users to home page
    - Display access denied message if needed
    - _Requirements: 10.5_
  
  - [x] 13.4 Write property test for non-admin access denial
    - **Property 38: Non-Admin Access Denial**
    - **Validates: Requirements 10.5**
  
  - [x] 13.5 Write unit tests for admin UI components
    - Test user list rendering
    - Test role assignment form
    - Test access control redirect
    - _Requirements: 10.1, 10.2, 10.5_

- [-] 14. Implement bulk import processor
  - [x] 14.1 Create ImportProcessor class
    - Implement process_import method
    - Support CSV and JSON file formats
    - Support entity types: projects, resources, financials
    - Add organization_id to all imported records
    - _Requirements: 11.1, 11.2, 11.7_
  
  - [x] 14.2 Implement CSV parsing with pandas
    - Parse CSV files using pandas.read_csv
    - Handle encoding issues
    - Validate column names match expected schema
    - _Requirements: 11.1_
  
  - [x] 14.3 Implement JSON parsing
    - Parse JSON files using json.loads
    - Validate structure matches expected schema
    - Handle nested objects
    - _Requirements: 11.2_
  
  - [x] 14.4 Implement record validation
    - Validate each record against Pydantic models
    - Collect validation errors with line numbers
    - Return detailed error report
    - _Requirements: 11.3, 11.6_
  
  - [x] 14.5 Implement batch insertion with transactions
    - Insert records in batches of 100
    - Use Supabase transactions for atomicity
    - Rollback on any error
    - Log import operation to audit_logs
    - _Requirements: 11.4, 11.5_
  
  - [x] 14.6 Write property test for CSV parsing
    - **Property 26: CSV Import Parsing**
    - **Validates: Requirements 11.1, 11.3**
  
  - [ ] 14.7 Write property test for JSON parsing
    - **Property 27: JSON Import Parsing**
    - **Validates: Requirements 11.2, 11.3**
  
  - [ ] 14.8 Write property test for transaction atomicity
    - **Property 28: Import Transaction Atomicity**
    - **Validates: Requirements 11.4**
  
  - [ ] 14.9 Write property test for validation error reporting
    - **Property 29: Import Validation Error Reporting**
    - **Validates: Requirements 11.6**
  
  - [ ] 14.10 Write unit tests for import edge cases
    - Test with empty files
    - Test with malformed CSV
    - Test with invalid JSON
    - Test with large files (>1000 records)
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 15. Create bulk import API endpoint
  - [x] 15.1 Create POST /projects/import endpoint
    - Accept file upload (CSV or JSON)
    - Accept entity_type parameter
    - Use ImportProcessor to process file
    - Include JWT authentication and organization filtering
    - Return import summary with success/error counts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [x] 15.2 Write unit tests for import endpoint
    - Test with valid CSV file
    - Test with valid JSON file
    - Test with invalid file format
    - Test with validation errors
    - _Requirements: 11.1, 11.2, 11.6_

- [x] 16. Create bulk import frontend interface
  - [x] 16.1 Create /import page with file upload UI
    - Implement drag-and-drop using react-dropzone
    - Support CSV and JSON file types
    - Add entity type selector (projects, resources, financials)
    - _Requirements: 12.1_
  
  - [x] 16.2 Implement upload progress and status display
    - Show progress bar during upload
    - Display processing status
    - Disable upload button during processing
    - _Requirements: 12.2, 12.5_
  
  - [x] 16.3 Display import results
    - Show success summary with record counts
    - Display validation errors with line numbers and field names
    - Provide download option for error report
    - _Requirements: 12.3, 12.4, 12.6_
  
  - [x] 16.4 Write unit tests for import UI components
    - Test file upload
    - Test progress display
    - Test error display
    - Test download functionality
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 17. Checkpoint - Ensure import functionality is working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement anomaly detection agent
  - [x] 18.1 Create AnomalyDetectorAgent class
    - Implement detect_anomalies method
    - Retrieve audit logs filtered by organization and time range
    - Extract features for anomaly detection
    - Train Isolation Forest model
    - Score and rank anomalies
    - Log detection requests to audit_logs
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  
  - [x] 18.2 Implement feature engineering
    - Extract hour_of_day, day_of_week from timestamps
    - Calculate action_frequency (actions per hour)
    - Calculate user_action_diversity (unique actions per hour)
    - Calculate time_since_last_action
    - Calculate data_volume (size of data accessed)
    - _Requirements: 13.4_
  
  - [x] 18.3 Implement Isolation Forest training
    - Configure with n_estimators=100, contamination=0.1
    - Fit model on extracted features
    - Generate anomaly scores
    - Convert scores to confidence values (0.0-1.0)
    - _Requirements: 13.2_
  
  - [x] 18.4 Write property test for anomaly detection
    - **Property 30: Isolation Forest Anomaly Detection**
    - **Validates: Requirements 13.2, 13.4**
  
  - [x] 18.5 Write unit tests for anomaly detector
    - Test with normal activity logs
    - Test with injected anomalies
    - Test with insufficient data
    - _Requirements: 13.2, 13.3_

- [x] 19. Implement audit RAG search agent
  - [x] 19.1 Add embedding column to audit_logs table
    - Create migration to add embedding vector(1536) column
    - Create ivfflat index for vector similarity search
    - _Requirements: 14.1_
  
  - [x] 19.2 Create AuditSearchAgent class
    - Implement search_audit_logs method
    - Generate embeddings for queries using OpenAI
    - Perform vector similarity search on audit_logs
    - Rank results by relevance (cosine similarity)
    - Highlight relevant sections in results
    - Log search queries to audit_logs
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 19.3 Implement background embedding generation
    - Create background job to generate embeddings for new audit logs
    - Update embedding column when new logs are created
    - _Requirements: 14.1_
  
  - [x] 19.4 Write property test for RAG search relevance ranking
    - **Property 31: RAG Audit Search Relevance Ranking**
    - **Validates: Requirements 14.3**
  
  - [x] 19.5 Write property test for result highlighting
    - **Property 32: Audit Search Result Highlighting**
    - **Validates: Requirements 14.4**
  
  - [x] 19.6 Write unit tests for audit search
    - Test with various natural language queries
    - Test with no matching results
    - Test relevance ranking order
    - _Requirements: 14.1, 14.3, 14.4_

- [x] 20. Create audit management API endpoints
  - [x] 20.1 Create GET /audit/logs endpoint
    - Support filters: date_range, user_id, action_type
    - Filter by organization_id
    - Return paginated results
    - Include JWT authentication
    - _Requirements: 15.1, 15.5_
  
  - [x] 20.2 Create POST /audit/logs/{id}/tag endpoint
    - Accept tag parameter
    - Add tag to audit log entry
    - Log tagging action to audit_logs
    - Include JWT authentication
    - _Requirements: 15.2, 15.6_
  
  - [x] 20.3 Create POST /audit/export endpoint
    - Accept format parameter (csv or json)
    - Accept filter parameters
    - Generate export file with all required fields
    - Return file download
    - Include JWT authentication
    - _Requirements: 15.3, 15.4, 15.5_
  
  - [x] 20.4 Create POST /audit/detect-anomalies endpoint
    - Accept time_range_days parameter
    - Use AnomalyDetectorAgent to detect anomalies
    - Return flagged activities with confidence scores
    - Include JWT authentication
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  
  - [x] 20.5 Create POST /audit/search endpoint
    - Accept natural language query
    - Use AuditSearchAgent to search audit logs
    - Return ranked results with highlights
    - Include JWT authentication
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 20.6 Write property test for audit log filtering
    - **Property 33: Audit Log Filtering**
    - **Validates: Requirements 15.1**
  
  - [x] 20.7 Write property test for audit log tagging
    - **Property 34: Audit Log Tagging**
    - **Validates: Requirements 15.2, 15.6**
  
  - [x] 20.8 Write property test for audit export completeness
    - **Property 35: Audit Export Completeness**
    - **Validates: Requirements 15.4**
  
  - [x] 20.9 Write unit tests for audit endpoints
    - Test filtering with various parameters
    - Test tagging with invalid log id
    - Test export with different formats
    - _Requirements: 15.1, 15.2, 15.3_

- [x] 21. Create audit frontend interface
  - [x] 21.1 Create /audit page with timeline chart
    - Display audit activities using Recharts timeline
    - Show activity volume over time
    - Color-code by action type
    - _Requirements: 16.1_
  
  - [x] 21.2 Implement natural language search interface
    - Add search input field
    - Submit queries to /audit/search endpoint
    - Display search results with relevance scores
    - Highlight matching sections
    - _Requirements: 16.2, 16.4_
  
  - [x] 21.3 Add anomaly detection and highlighting
    - Add "Detect Anomalies" button
    - Call /audit/detect-anomalies endpoint
    - Highlight anomalous activities with visual indicators
    - Show confidence scores for anomalies
    - _Requirements: 16.3_
  
  - [x] 21.4 Implement tag management
    - Display tags for each log entry
    - Allow users to add new tags
    - Submit tags to /audit/logs/{id}/tag endpoint
    - _Requirements: 16.4_
  
  - [x] 21.5 Add filtering and export functionality
    - Provide filter controls (date range, user, action type)
    - Update display when filters change
    - Add export button
    - Trigger download from /audit/export endpoint
    - _Requirements: 16.5, 16.6_
  
  - [x] 21.6 Implement audit entry display
    - Show user names, timestamps, actions, details
    - Format data consistently
    - Make entries expandable for full details
    - _Requirements: 16.7_
  
  - [x] 21.7 Write property test for data formatting consistency
    - **Property 37: Frontend Data Formatting Consistency**
    - **Validates: Requirements 5.6**
  
  - [x] 21.8 Write unit tests for audit UI components
    - Test timeline chart rendering
    - Test search interface
    - Test anomaly highlighting
    - Test tag management
    - Test filtering
    - Test export triggering
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 22. Final checkpoint - Comprehensive testing and integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Integration and documentation
  - [x] 23.1 Test end-to-end workflows
    - Test complete AI agent workflow (query → response → audit log)
    - Test complete workflow approval (create → approve → complete → notification)
    - Test complete import workflow (upload → validate → insert → audit log)
    - Test complete audit workflow (action → log → search → tag → export)
  
  - [x] 23.2 Verify organization isolation across all features
    - Test that users can only access their organization's data
    - Test that imports are scoped to organization
    - Test that workflows are isolated by organization
    - Test that audit logs are filtered by organization
  
  - [x] 23.3 Update API documentation
    - Document all new endpoints with request/response examples
    - Document authentication requirements
    - Document error responses
    - Add usage examples for each AI agent

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end workflows
- All backend code uses existing patterns: JWT auth, Supabase queries, audit logging
- All frontend code uses existing patterns: fetch API, toast notifications, Recharts
