# Implementation Plan: AI Help Chat Enhancement

## Overview

This implementation plan breaks down the AI Help Chat enhancement into discrete, incremental coding tasks organized by the three-phase roadmap: (1) Optimization & Integration, (2) Proactive & Actionable Features, and (3) Scaling & Enterprise-Ready. Each task builds on previous work and includes testing sub-tasks to validate functionality early.

The implementation uses Python/FastAPI for backend and TypeScript/Next.js for frontend, integrating with existing authentication patterns, Supabase database, and OpenAI for AI capabilities.

## Tasks

### Phase 1: Optimization & Integration

- [x] 1. Set up database schema for help chat enhancement
  - [x] 1.1 Create help_logs table with all required fields
    - Add columns: id, query_id, user_id, organization_id, query, response, page_context, user_role, confidence_score, sources_used, response_time_ms, success, error_type, error_message, action_type, action_details, created_at, updated_at
    - Add indexes on organization_id, user_id, created_at, action_type
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 1.2 Create help_feedback table
    - Add columns: id, query_id, user_id, organization_id, rating, comments, created_at
    - Add foreign key to help_logs(query_id)
    - Add indexes on query_id, organization_id
    - _Requirements: 3.2, 3.4, 3.6_
  
  - [x] 1.3 Ensure embeddings table supports help documentation
    - Verify embeddings table exists with vector(1536) column
    - Add index for content_type='help_doc' if not exists
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Create ChatContext provider for page and role context
  - [x] 2.1 Implement ChatContext provider component
    - Implemented via HelpChatProvider (route, pageTitle, userRole from pathname and user; context in API requests).
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 2.2 Write property test for context capture
    - **Property 2: Context Capture and Formatting** – lib/help-chat/__tests__/contextFromPath.test.ts, getPageContextFromPath()
    - **Validates: Requirements 1.1, 1.3**
  
  - [x] 2.3 Write property test for context updates
    - **Property 3: Context Update Without Remount** – same test file, context update without remount cases
    - **Validates: Requirements 1.5**
  
  - [x] 2.4 Write unit tests for ChatContext
    - Test URL path extraction, role, context shape – lib/help-chat/contextFromPath.ts + tests
    - _Requirements: 1.1, 1.2, 1.5_

- [x] 3. Implement Help Logger service
  - [x] 3.1 Create HelpLogger class
    - Implement log_query method
    - Implement log_response method
    - Implement log_error method
    - Implement log_feedback method
    - All methods filter by organization_id
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 3.2 Write property test for query logging completeness
    - **Property 7: Help Query Logging Completeness** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 1.4, 5.1**
  
  - [x] 3.3 Write property test for response logging completeness
    - **Property 8: Help Response Logging Completeness** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 5.2, 5.3, 5.4**
  
  - [x] 3.4 Write property test for feedback logging
    - **Property 9: Feedback Logging Completeness** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 3.2, 3.4, 3.6**
  
  - [x] 3.5 Write unit tests for HelpLogger
    - tests/unit/test_help_logger.py – error logging, organization filtering, all methods
    - _Requirements: 5.3, 5.5_

- [x] 4. Implement RAG documentation system
  - [x] 4.1 Create HelpDocumentationRAG class
    - Implement index_documentation method
    - Implement retrieve_relevant_docs method with top-k=3
    - Implement _generate_embedding method using OpenAI
    - Set similarity_threshold=0.7
    - Filter all queries by organization_id
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [x] 4.2 Write property test for documentation indexing
    - **Property 5: RAG Documentation Indexing** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 2.1**
  
  - [x] 4.3 Write property test for top-k retrieval
    - **Property 4: RAG Top-K Retrieval** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 2.2**
  
  - [x] 4.4 Write property test for organization filtering
    - **Property 1: Organization Context Isolation** (RAG portion) – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 2.3**
  
  - [x] 4.5 Write property test for source attribution
    - **Property 6: RAG Source Attribution** – test_help_chat_enhancement_properties.py
    - **Validates: Requirements 2.4, 2.5**
  
  - [x] 4.6 Write unit tests for RAG edge cases
    - tests/unit/test_help_documentation_rag.py – empty/None data, fewer than top_k, embedding failure
    - _Requirements: 2.2, 2.6_


- [x] 5. Implement enhanced Help Query Processor
  - [x] 5.1 Create HelpQueryProcessor class
    - Implement process_query method with streaming
    - Integrate HelpDocumentationRAG for context retrieval
    - Implement _build_prompt method with context awareness
    - Implement _stream_response method for OpenAI streaming
    - Implement _calculate_confidence method
    - Log all queries and responses using HelpLogger
    - _Requirements: 1.3, 1.4, 2.2, 2.4, 2.5, 5.1, 5.2_
  
  - [x] 5.2 Update /api/help/query endpoint
    - Modify existing endpoint to use HelpQueryProcessor
    - Accept page_context and user_role in request
    - Return StreamingResponse for real-time updates
    - Include JWT authentication with get_current_user
    - _Requirements: 1.3, 1.4, 2.2, 2.4, 2.5_
  
  - [x] 5.3 Write property test for context formatting
    - **Property 2: Context Capture and Formatting** (backend) – test_help_chat_query_processor.py PageContext
    - **Validates: Requirements 1.3**
  
  - [x] 5.4 Write property test for streaming responses
    - **Property 43: Streaming Response Behavior** – covered by test_help_chat_full_integration / endpoint streaming
    - **Validates: Requirements 12.2**
  
  - [x] 5.5 Write unit tests for query processor
    - test_help_chat_query_processor.py – PageContext, HelpResponse; HelpRAGAgent in test_help_rag_agent.py
    - _Requirements: 1.3, 2.4, 2.5_

- [x] 6. Enhance AIHelpChat frontend component
  - [x] 6.1 Update AIHelpChat component with context awareness
    - Use useChatContext hook to get page_context and user_role
    - Update handleSubmit to include context in API request
    - Implement streaming response handling
    - Add feedback buttons to each assistant message
    - Implement handleFeedback method
    - Display source references when available
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 2.5_
  
  - [x] 6.2 Create /api/help/feedback endpoint
    - Backend POST /api/ai/help/feedback; frontend HelpChatFeedbackIntegration + feedback in MessageRenderer. Accepts message_id, rating, feedback_text, feedback_type; JWT via get_current_user.
    - _Requirements: 3.2, 3.4, 3.6_
  
  - [x] 6.3 Write property test for feedback UI state
    - **Property 10: Feedback UI State Management** – lib/__tests__/help-chat-api.test.ts (feedback validation, queryId/messageId)
    - **Validates: Requirements 3.3**
  
  - [x] 6.4 Write unit tests for AIHelpChat component
    - HelpChatProvider.test.tsx (message/streaming/feedback); help-chat-api tests for submit/feedback/retry
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Implement Help Analytics Dashboard
  - [x] 7.1 Create backend analytics aggregation functions
    - Implemented via existing analytics_tracker + help_analytics table (get_usage_metrics, generate_weekly_report). No separate SQL functions; aggregation in Python.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.2 Create /api/admin/help-analytics endpoint
    - Backend: GET /api/ai/help/analytics/metrics (admin). Frontend proxy: GET /api/admin/help-analytics with start_date/end_date and admin auth.
    - _Requirements: 4.1, 4.6, 4.7_
  
  - [x] 7.3 Create /admin/help-analytics frontend page
    - Admin page at /admin/help-analytics: total queries, unique users, avg response time, satisfaction rate, top queries list, common issues (low confidence). Link from Admin Dashboard.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.4 Write property test for helpfulness calculation
    - **Property 11: Analytics Helpfulness Calculation** – backend test_helpfulness_calculation_satisfaction_rate (satisfaction_rate = 100 * count(ratings>=4)/count(ratings))
    - **Validates: Requirements 4.4**
  
  - [x] 7.5 Write property test for negative feedback filtering
    - **Property 12: Analytics Negative Feedback Filtering** – backend test_common_issues_low_confidence_filtering (common_issues only confidence < 0.6, max 5)
    - **Validates: Requirements 4.5**
  
  - [x] 7.6 Write property test for data aggregation
    - **Property 13: Analytics Data Aggregation** – backend test_data_aggregation_top_queries_limit_and_sort (top_queries ≤10, sorted by count desc)
    - **Validates: Requirements 4.6**
  
  - [x] 7.7 Write property test for admin authorization
    - **Property 14: Admin Authorization** – API route test: 403/401 when backend rejects (__tests__/api-routes/admin-help-analytics.route.test.ts)
    - **Validates: Requirements 4.7**
  
  - [x] 7.8 Write unit tests for analytics dashboard
    - Test page render, heading, Refresh button, loading skeletons, container testid (__tests__/admin-help-analytics.test.tsx)
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

- [x] 8. Checkpoint - Phase 1 complete
  - Phase 1 tests pass; 80% coverage target for help-chat code (lib/help-chat, backend services/help_*).

### Phase 2: Proactive & Actionable Features

- [x] 9. Implement Proactive Tip Engine
  - [x] 9.1 Create ProactiveTipEngine class
    - Implement _load_tip_rules method with variance, overdue, budget rules
    - Implement start_monitoring method with Supabase Realtime subscriptions
    - Implement _handle_change method to evaluate rule conditions
    - Implement _trigger_tip method to send notifications
    - Implement cooldown tracking (_is_in_cooldown, _set_cooldown)
    - Filter all subscriptions by organization_id
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x] 9.2 Integrate proactive tips with frontend
    - Subscribe to user-specific Realtime channel in _app.tsx
    - Display toast notifications for proactive tips
    - Add "Learn More" button that opens chat with pre-filled query
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.3 Write property test for variance threshold triggering
    - **Property 15: Proactive Tip Variance Threshold**
    - **Validates: Requirements 6.1**
  
  - [x] 9.4 Write property test for notification content
    - **Property 16: Proactive Tip Notification Content**
    - **Validates: Requirements 6.2**
  
  - [x] 9.5 Write property test for tip logging
    - **Property 17: Proactive Tip Logging**
    - **Validates: Requirements 6.4**
  
  - [x] 9.6 Write property test for cooldown logic
    - **Property 18: Proactive Tip Cooldown**
    - **Validates: Requirements 6.6**
  
  - [x] 9.7 Write property test for priority batching
    - **Property 19: Proactive Tip Priority Batching**
    - **Validates: Requirements 6.5**
  
  - [x] 9.8 Write unit tests for proactive tips
    - Test Realtime subscription setup
    - Test rule condition evaluation
    - Test multiple simultaneous tips
    - _Requirements: 6.1, 6.3, 6.5_

- [x] 10. Implement Natural Language Action Parser
  - [x] 10.1 Create ActionParser class
    - Implement _define_functions method with fetch_data, navigate, open_modal
    - Implement parse_and_execute method using OpenAI Function Calling
    - Implement _execute_action method for each action type
    - Implement _fetch_project_data method with organization filtering
    - Implement _generate_confirmation method
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [x] 10.2 Update help query endpoint to support actions
    - Integrate ActionParser into HelpQueryProcessor
    - Check if query contains actionable intent
    - Execute action if detected
    - Return action result with confirmation
    - Log actions with action_type='natural_language_action'
    - _Requirements: 7.1, 7.5, 7.7_
  
  - [x] 10.3 Update frontend to handle action commands
    - Handle navigate commands (router.push)
    - Handle open_modal commands (modal state management)
    - Display action results and confirmations
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [x] 10.4 Write property test for action detection
    - **Property 20: Action Parser Detection**
    - **Validates: Requirements 7.1**
  
  - [x] 10.5 Write property test for action response format
    - **Property 21: Action Execution Response Format**
    - **Validates: Requirements 7.5**
  
  - [x] 10.6 Write property test for action error handling
    - **Property 22: Action Execution Error Handling**
    - **Validates: Requirements 7.6**
  
  - [x] 10.7 Write property test for action logging
    - **Property 23: Action Execution Logging**
    - **Validates: Requirements 7.7**
  
  - [x] 10.8 Write property test for navigate command generation
    - **Property 24: Navigate Action Command Generation**
    - **Validates: Requirements 7.3**
  
  - [x] 10.9 Write property test for modal command generation
    - **Property 25: Modal Action Command Generation**
    - **Validates: Requirements 7.4**
  
  - [x] 10.10 Write unit tests for action parser
    - Test specific action types (fetch EAC, open project details)
    - Test permission errors
    - Test invalid parameters
    - _Requirements: 7.2, 7.6_

- [x] 11. Implement Costbook Data Integration
  - [x] 11.1 Add costbook query support to ActionParser
    - Implement costbook data fetching in _fetch_project_data
    - Query costbook table for budget, actual_cost, variance
    - Filter by organization_id
    - Format currency values consistently
    - Calculate variance percentage and thresholds
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 11.2 Add costbook context to help responses
    - Include costbook data in prompt context when relevant
    - Add source citations with timestamps
    - Handle missing costbook data gracefully
    - _Requirements: 8.1, 8.4, 8.5_
  
  - [x] 11.3 Write property test for costbook data retrieval
    - **Property 26: Costbook Data Retrieval**
    - **Validates: Requirements 8.1, 8.2**
  
  - [x] 11.4 Write property test for variance threshold indication
    - **Property 27: Variance Threshold Indication**
    - **Validates: Requirements 8.3**
  
  - [x] 11.5 Write property test for costbook source citation
    - **Property 28: Costbook Source Citation**
    - **Validates: Requirements 8.4**
  
  - [x] 11.6 Write unit tests for costbook integration
    - Test currency formatting
    - Test missing costbook data handling
    - Test variance calculations
    - _Requirements: 8.2, 8.3, 8.5_

- [x] 12. Checkpoint - Phase 2 complete
  - Ensure all Phase 2 tests pass, ask the user if questions arise.

### Phase 3: Scaling & Enterprise-Ready

- [ ] 13. Implement Translation Service
  - [ ] 13.1 Create TranslationService class
    - Implement translate_query method using DeepL API
    - Implement translate_response method
    - Implement get_user_language method
    - Handle translation failures with fallback to English
    - Support all major languages (EN, DE, FR, ES, IT, PT, NL, PL, RU, JA, ZH)
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7_
  
  - [ ] 13.2 Integrate translation into HelpQueryProcessor
    - Detect user's language preference on query submission
    - Translate non-English queries to English
    - Process query in English
    - Translate response back to user's language
    - Log both original and translated text
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [x] 13.3 Add UI localization to chat interface
    - Create translation files for UI labels
    - Display labels in user's preferred language
    - Support language selector in settings
    - _Requirements: 9.6_
  
  - [ ] 13.4 Write property test for language detection
    - **Property 29: Language Detection and Default**
    - **Validates: Requirements 9.1, 9.7**
  
  - [ ] 13.5 Write property test for translation round trip
    - **Property 30: Translation Round Trip**
    - **Validates: Requirements 9.2, 9.3, 9.4**
  
  - [ ] 13.6 Write property test for translation fallback
    - **Property 31: Translation Fallback**
    - **Validates: Requirements 9.5**
  
  - [ ] 13.7 Write property test for UI localization
    - **Property 32: UI Localization**
    - **Validates: Requirements 9.6**
  
  - [ ] 13.8 Write unit tests for translation service
    - Test DeepL API integration
    - Test various languages
    - Test error scenarios
    - _Requirements: 9.2, 9.3, 9.5_


- [ ] 14. Create support_tickets table
  - [ ] 14.1 Create support_tickets table schema
    - Add columns: id, user_id, organization_id, subject, description, conversation_history, status, priority, external_ticket_id, assigned_to, created_at, updated_at, resolved_at
    - Add indexes on organization_id, user_id, status
    - _Requirements: 10.2, 10.3_

- [ ] 15. Implement Support Escalation Service
  - [ ] 15.1 Create SupportEscalationService class
    - Implement create_ticket method
    - Implement _generate_subject method
    - Implement _format_conversation method
    - Implement _create_intercom_ticket method
    - Implement _notify_support_team method via Realtime
    - Handle Intercom integration failures gracefully
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.8_
  
  - [ ] 15.2 Create /api/help/escalate endpoint
    - Accept conversation_history and priority
    - Use SupportEscalationService to create ticket
    - Return ticket_id, external_ticket_id, subject, status
    - Include JWT authentication
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ] 15.3 Add "Escalate to Support" button to chat interface
    - Display button on all assistant responses
    - Collect conversation history
    - Call /api/help/escalate endpoint
    - Display confirmation with ticket ID
    - _Requirements: 10.1, 10.7_
  
  - [ ] 15.4 Write property test for ticket creation completeness
    - **Property 33: Support Ticket Creation Completeness**
    - **Validates: Requirements 10.2, 10.3**
  
  - [ ] 15.5 Write property test for Intercom integration success
    - **Property 34: Intercom Integration Success**
    - **Validates: Requirements 10.4, 10.5**
  
  - [ ] 15.6 Write property test for Intercom integration failure handling
    - **Property 35: Intercom Integration Failure Handling**
    - **Validates: Requirements 10.6**
  
  - [ ] 15.7 Write property test for ticket confirmation
    - **Property 36: Support Ticket Confirmation**
    - **Validates: Requirements 10.7**
  
  - [ ] 15.8 Write property test for support team notification
    - **Property 37: Support Team Notification**
    - **Validates: Requirements 10.8**
  
  - [ ] 15.9 Write unit tests for support escalation
    - Test subject generation
    - Test conversation formatting
    - Test Intercom API integration
    - _Requirements: 10.2, 10.4_

- [ ] 16. Implement AI Fine-Tuning Data Collection
  - [ ] 16.1 Add training_candidate and approved_for_training fields to help_logs
    - Add training_candidate BOOLEAN DEFAULT false
    - Add approved_for_training BOOLEAN DEFAULT false
    - Create index on training_candidate
    - _Requirements: 11.1, 11.3_
  
  - [ ] 16.2 Implement automatic training candidate flagging
    - Update HelpLogger to check helpfulness rating
    - Set training_candidate=true for rating >= 0.8 and success=true
    - _Requirements: 11.1_
  
  - [ ] 16.3 Create /admin/help-analytics/training-data page
    - Display list of training candidate interactions
    - Allow admins to approve or reject candidates
    - Update approved_for_training flag
    - _Requirements: 11.2, 11.3_
  
  - [ ] 16.4 Create /api/admin/help-analytics/export-training-data endpoint
    - Query approved interactions (approved_for_training=true)
    - Generate JSONL file with query-response pairs
    - Anonymize user-specific information (PII removal)
    - Log export action to audit_logs
    - Use require_admin dependency
    - _Requirements: 11.4, 11.5, 11.6_
  
  - [ ] 16.5 Write property test for training candidate auto-flagging
    - **Property 38: Training Candidate Auto-Flagging**
    - **Validates: Requirements 11.1**
  
  - [ ] 16.6 Write property test for export format
    - **Property 39: Training Data Export Format**
    - **Validates: Requirements 11.4**
  
  - [ ] 16.7 Write property test for training data privacy
    - **Property 40: Training Data Privacy**
    - **Validates: Requirements 11.5**
  
  - [ ] 16.8 Write property test for export logging
    - **Property 41: Training Data Export Logging**
    - **Validates: Requirements 11.6**
  
  - [ ] 16.9 Write unit tests for training data collection
    - Test candidate flagging logic
    - Test JSONL format generation
    - Test PII anonymization
    - _Requirements: 11.1, 11.4, 11.5_

- [x] 17. Implement Performance Optimizations
  - [x] 17.1 Add response time monitoring
    - Track response_time_ms for all queries
    - Log performance warnings when response_time > 5000ms
    - _Requirements: 12.6_
  
  - [ ] 17.2 Optimize vector search with proper indexing
    - Ensure ivfflat index exists on embeddings.embedding
    - Configure index parameters for < 500ms search time
    - _Requirements: 12.3_
  
  - [x] 17.3 Implement OpenAI timeout handling
    - Set timeout=10 seconds for OpenAI API calls
    - Return fallback response on timeout
    - Log timeout errors
    - _Requirements: 12.5_
  
  - [x] 17.4 Add streaming response support
    - Implement streaming in HelpQueryProcessor
    - Use StreamingResponse in FastAPI endpoint
    - Handle streaming in frontend
    - _Requirements: 12.2_
  
  - [ ] 17.5 Write property test for response time performance
    - **Property 42: Response Time Performance**
    - **Validates: Requirements 12.1**
  
  - [ ] 17.6 Write property test for streaming behavior
    - **Property 43: Streaming Response Behavior**
    - **Validates: Requirements 12.2**
  
  - [ ] 17.7 Write property test for vector search performance
    - **Property 44: Vector Search Performance**
    - **Validates: Requirements 12.3**
  
  - [ ] 17.8 Write property test for concurrent request handling
    - **Property 45: Concurrent Request Handling**
    - **Validates: Requirements 12.4**
  
  - [ ] 17.9 Write property test for OpenAI timeout handling
    - **Property 46: OpenAI Timeout Handling**
    - **Validates: Requirements 12.5**
  
  - [ ] 17.10 Write property test for performance warning logging
    - **Property 47: Performance Warning Logging**
    - **Validates: Requirements 12.6**
  
  - [ ] 17.11 Write load tests for concurrent requests
    - Test with 50 concurrent users using locust
    - Measure response time degradation
    - _Requirements: 12.4_

- [x] 18. Implement Security and Privacy Features
  - [x] 18.1 Add input sanitization
    - Implement sanitize_input function
    - Remove/escape SQL injection patterns
    - Remove/escape XSS patterns
    - Remove/escape command injection patterns
    - Apply to all query inputs
    - _Requirements: 13.1, 13.6_
  
  - [x] 18.2 Add PII filtering to responses
    - Implement filter_pii function
    - Remove email addresses (regex)
    - Remove phone numbers (regex)
    - Remove API keys (pattern matching)
    - Apply to all AI-generated responses
    - _Requirements: 13.2_
  
  - [ ] 18.3 Implement database encryption for sensitive fields
    - Configure Supabase encryption for help_logs.query
    - Configure Supabase encryption for help_logs.response
    - _Requirements: 13.3_
  
  - [ ] 18.4 Implement user data deletion
    - Create /api/help/delete-user-data endpoint
    - Delete all help_logs for user_id and organization_id
    - Delete all help_feedback for user_id and organization_id
    - Include JWT authentication
    - _Requirements: 13.4_
  
  - [x] 18.5 Add security alert logging
    - Detect SQL injection attempts
    - Detect XSS attempts
    - Block malicious queries
    - Log security alerts to audit_logs
    - _Requirements: 13.6_
  
  - [ ] 18.6 Write property test for input sanitization
    - **Property 48: Input Sanitization**
    - **Validates: Requirements 13.1**
  
  - [ ] 18.7 Write property test for PII filtering
    - **Property 49: PII Filtering in Responses**
    - **Validates: Requirements 13.2**
  
  - [ ] 18.8 Write property test for data encryption
    - **Property 50: Sensitive Data Encryption**
    - **Validates: Requirements 13.3**
  
  - [ ] 18.9 Write property test for user data deletion
    - **Property 51: User Data Deletion**
    - **Validates: Requirements 13.4**
  
  - [ ] 18.10 Write property test for security alerts
    - **Property 52: Security Alert on Malicious Queries**
    - **Validates: Requirements 13.6**
  
  - [x] 18.11 Write unit tests for security features
    - Test specific injection patterns
    - Test PII regex patterns
    - Test security alert triggers
    - _Requirements: 13.1, 13.2, 13.6_

- [ ] 19. Checkpoint - Phase 3 complete
  - Ensure all Phase 3 tests pass, ask the user if questions arise.

### Integration and Documentation

- [ ] 20. Integration testing and documentation
  - [ ] 20.1 Test end-to-end workflows
    - Test complete help query workflow (submit → RAG → LLM → logging → feedback)
    - Test complete proactive tip workflow (data change → trigger → notification → chat)
    - Test complete action workflow (query → parse → execute → confirmation)
    - Test complete translation workflow (non-English → translate → process → translate back)
    - Test complete escalation workflow (click → create ticket → Intercom → notification)
  
  - [ ] 20.2 Verify organization isolation across all features
    - Test that users can only access their organization's help data
    - Test that RAG only retrieves organization-specific docs
    - Test that proactive tips only trigger for organization's projects
    - Test that analytics only show organization's data
    - Test that support tickets are organization-scoped
  
  - [ ] 20.3 Create documentation indexing script
    - Script to index all application documentation
    - Script to index organization-specific custom docs
    - Batch processing for large documentation sets
    - _Requirements: 2.1_
  
  - [ ] 20.4 Create deployment guide
    - Document required environment variables (OPENAI_API_KEY, DEEPL_API_KEY, INTERCOM_API_KEY)
    - Document database migrations
    - Document Realtime subscription setup
    - Document performance tuning recommendations
  
  - [ ] 20.5 Create user guide
    - Document how to use context-aware chat
    - Document how to provide feedback
    - Document how to use natural language actions
    - Document how to escalate to support
    - Document multi-language support

- [ ] 21. Final checkpoint - All phases complete
  - Ensure all tests pass, verify all features work end-to-end, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each phase
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- All features must integrate with existing Auth (JWT, organization_id filtering)
- Use existing patterns: Supabase for data, OpenAI for AI, Recharts for analytics, Realtime for notifications

