# Requirements Document: AI Help Chat Enhancement

## Introduction

This specification defines the requirements for enhancing the existing AI Help Chat feature in a Project Portfolio Management (PPM) SaaS application. The system currently has a basic AI Help Chat (AIHelpChat.tsx) that uses useState and fetch to query /api/help/query. This specification addresses three phases of enhancement: (1) Optimization & Integration with context-aware responses and RAG, (2) Proactive & Actionable Features with natural language actions, and (3) Scaling & Enterprise-Ready features with multi-language support and human escalation.

The implementation will integrate with existing Next.js 16 frontend, FastAPI backend, Supabase database, JWT authentication with organization_id filtering, and OpenAI for AI capabilities.

## Glossary

- **AI_Help_Chat**: The enhanced AI-powered help chat system
- **Chat_Context**: Page location and user role information used to provide context-aware responses
- **RAG_System**: Retrieval-Augmented Generation system for retrieving relevant documentation
- **Help_Logger**: System component that logs chat interactions and feedback
- **Proactive_Tip_Engine**: System component that monitors data changes and suggests help
- **Action_Parser**: AI component that parses natural language into executable actions
- **Translation_Service**: Service that translates queries and responses between languages
- **Support_Escalation**: System for creating support tickets from chat conversations
- **Supabase**: PostgreSQL database service used for data persistence
- **Organization_Context**: JWT-based filtering ensuring users only access their organization's data
- **Confidence_Score**: Numerical value (0.0-1.0) indicating AI response reliability
- **Embedding**: Vector representation of text for semantic search (vector dimension 1536)

## Requirements

### Phase 1: Optimization & Integration

### Requirement 1: Context-Aware Chat System

**User Story:** As a user, I want the AI Help Chat to understand my current page and role, so that I receive relevant and personalized assistance.

#### Acceptance Criteria

1. WHEN the AI_Help_Chat is initialized, THEN the system SHALL capture the current page context (e.g., 'financials/costbook', 'projects/dashboard') from the URL path
2. WHEN the AI_Help_Chat is initialized, THEN the system SHALL retrieve the user's role from Supabase user metadata filtered by Organization_Context
3. WHEN a user submits a query, THEN the system SHALL append the Chat_Context to the prompt in the format: "User is [role] viewing [page_context]. Query: [user_query]"
4. WHEN the backend receives a help query, THEN the system SHALL include the page_context and user_role in the audit log entry
5. WHEN the Chat_Context changes (user navigates to different page), THEN the AI_Help_Chat SHALL update the context without requiring component remount

### Requirement 2: RAG-Enhanced Documentation Retrieval

**User Story:** As a user, I want the AI to reference relevant documentation when answering my questions, so that I receive accurate and helpful information.

#### Acceptance Criteria

1. WHEN application documentation is added or updated, THEN the RAG_System SHALL generate embeddings and store them in the Supabase embeddings table with content_type='help_doc'
2. WHEN a user submits a help query, THEN the RAG_System SHALL retrieve the top 3 most relevant documentation snippets using vector similarity search
3. WHEN the RAG_System retrieves documentation, THEN the system SHALL filter embeddings by Organization_Context to ensure users only see their organization's custom docs
4. WHEN the backend generates a response, THEN the system SHALL include the retrieved documentation snippets in the prompt context
5. WHEN the response is returned, THEN the system SHALL include source references showing which documentation was used
6. WHEN no relevant documentation is found (similarity score < 0.7), THEN the system SHALL generate a response without documentation context and indicate this in the response metadata

### Requirement 3: User Feedback Collection

**User Story:** As a product manager, I want to collect feedback on AI responses, so that I can improve the help system over time.

#### Acceptance Criteria

1. WHEN the AI_Help_Chat displays a response, THEN the system SHALL show feedback buttons labeled "Helpful" and "Not Helpful"
2. WHEN a user clicks a feedback button, THEN the system SHALL log the feedback to the help_feedback table with query_id, user_id, rating (1 for helpful, 0 for not helpful), and timestamp
3. WHEN feedback is submitted, THEN the system SHALL display a confirmation message and disable the feedback buttons for that response
4. WHEN logging feedback, THEN the system SHALL include Organization_Context to filter analytics by organization
5. WHEN a user provides negative feedback, THEN the system SHALL optionally prompt for additional comments (max 500 characters)
6. WHEN feedback with comments is submitted, THEN the system SHALL store the comments in the help_feedback table

### Requirement 4: Help Analytics Dashboard

**User Story:** As an administrator, I want to view analytics on help chat usage and effectiveness, so that I can identify common issues and improve documentation.

#### Acceptance Criteria

1. WHEN an admin navigates to /admin/help-analytics, THEN the system SHALL display a dashboard with help chat metrics filtered by Organization_Context
2. WHEN displaying analytics, THEN the system SHALL show a time series chart of query volume using Recharts (queries per day over last 30 days)
3. WHEN displaying analytics, THEN the system SHALL show the top 10 most common query topics using keyword extraction
4. WHEN displaying analytics, THEN the system SHALL show the average helpfulness rating (percentage of "Helpful" responses)
5. WHEN displaying analytics, THEN the system SHALL show a list of queries with negative feedback for review
6. WHEN analytics are requested, THEN the system SHALL aggregate data from help_logs and help_feedback tables
7. WHEN a non-admin user attempts to access /admin/help-analytics, THEN the system SHALL return a 403 Forbidden error or redirect to home page

### Requirement 5: Help Interaction Logging

**User Story:** As a system administrator, I want all help chat interactions logged, so that I can audit usage and troubleshoot issues.

#### Acceptance Criteria

1. WHEN a user submits a help query, THEN the Help_Logger SHALL create an entry in help_logs table with query text, user_id, organization_id, page_context, user_role, and timestamp
2. WHEN the AI generates a response, THEN the Help_Logger SHALL update the help_logs entry with response text, confidence_score, sources_used, and response_time_ms
3. WHEN an error occurs during query processing, THEN the Help_Logger SHALL log the error details including error_type and error_message
4. WHEN a query is processed successfully, THEN the Help_Logger SHALL set success=true in the help_logs entry
5. WHEN logging interactions, THEN the system SHALL ensure all logs are filtered by Organization_Context for multi-tenancy

### Phase 2: Proactive & Actionable Features

### Requirement 6: Proactive Help Tips

**User Story:** As a user, I want to receive proactive help suggestions when significant data changes occur, so that I can take appropriate action without searching for help.

#### Acceptance Criteria

1. WHEN the Proactive_Tip_Engine detects a project variance exceeding 10%, THEN the system SHALL trigger a toast notification with a suggested help query
2. WHEN a proactive tip is triggered, THEN the notification SHALL include a "Learn More" button that opens the AI_Help_Chat with a pre-filled query
3. WHEN the Proactive_Tip_Engine monitors data changes, THEN the system SHALL use Supabase Realtime subscriptions to the projects table filtered by Organization_Context
4. WHEN a data change triggers a tip, THEN the system SHALL log the trigger event to help_logs with action_type='proactive_tip'
5. WHEN multiple tips are triggered within 5 minutes, THEN the system SHALL batch them and show only the highest priority tip
6. WHEN a user dismisses a proactive tip, THEN the system SHALL not show the same tip type for that entity for 24 hours

### Requirement 7: Natural Language Action Execution

**User Story:** As a user, I want to perform actions using natural language in the chat, so that I can work more efficiently without navigating through menus.

#### Acceptance Criteria

1. WHEN a user submits a query that contains an actionable intent, THEN the Action_Parser SHALL use OpenAI Function Calling to identify the action and parameters
2. WHEN the Action_Parser identifies a "fetch data" action (e.g., "show me current EAC"), THEN the system SHALL retrieve the requested data from Supabase filtered by Organization_Context
3. WHEN the Action_Parser identifies a "navigate" action (e.g., "open project details"), THEN the system SHALL return a navigation command to the frontend
4. WHEN the Action_Parser identifies an "open modal" action (e.g., "create new task"), THEN the system SHALL return a modal command with the appropriate modal type and pre-filled data
5. WHEN an action is executed successfully, THEN the system SHALL return both the action result and a natural language confirmation
6. WHEN an action cannot be executed (insufficient permissions, invalid parameters), THEN the system SHALL return an error message explaining why
7. WHEN an action is executed, THEN the system SHALL log the action to help_logs with action_type='natural_language_action' and action_details

### Requirement 8: Costbook Data Integration

**User Story:** As a project manager, I want the AI Help Chat to access current costbook data, so that I can get real-time financial insights through conversation.

#### Acceptance Criteria

1. WHEN a user asks about project financials, THEN the AI_Help_Chat SHALL query the costbook table for current budget, actual costs, and variance filtered by Organization_Context
2. WHEN displaying financial data, THEN the system SHALL format currency values consistently (e.g., "$1,234.56")
3. WHEN a user asks about variance, THEN the system SHALL calculate variance percentage and indicate if it exceeds thresholds (>10% warning, >20% critical)
4. WHEN costbook data is included in a response, THEN the system SHALL cite the data source and timestamp
5. WHEN costbook data is unavailable for a project, THEN the system SHALL inform the user and suggest alternative queries

### Phase 3: Scaling & Enterprise-Ready

### Requirement 9: Multi-Language Support

**User Story:** As an international user, I want to interact with the AI Help Chat in my preferred language, so that I can get help without language barriers.

#### Acceptance Criteria

1. WHEN the AI_Help_Chat initializes, THEN the system SHALL detect the user's preferred language from Supabase user metadata (language_preference field)
2. WHEN a user submits a query in a non-English language, THEN the Translation_Service SHALL translate the query to English using DeepL API before processing
3. WHEN the AI generates a response in English, THEN the Translation_Service SHALL translate the response back to the user's preferred language
4. WHEN translation is used, THEN the system SHALL log both original and translated text in help_logs
5. WHEN translation fails, THEN the system SHALL fall back to English and notify the user
6. WHEN displaying the chat interface, THEN the system SHALL show UI labels in the user's preferred language
7. WHEN a user's language_preference is not set, THEN the system SHALL default to English

### Requirement 10: Human Support Escalation

**User Story:** As a user, I want to escalate complex issues to human support, so that I can get personalized assistance when the AI cannot help.

#### Acceptance Criteria

1. WHEN the AI_Help_Chat displays a response, THEN the system SHALL show an "Escalate to Support" button
2. WHEN a user clicks "Escalate to Support", THEN the system SHALL create a support ticket in the support_tickets table with the conversation history
3. WHEN creating a support ticket, THEN the system SHALL include user_id, organization_id, subject (derived from query), description (conversation history), status='open', and priority='normal'
4. WHEN a support ticket is created, THEN the system SHALL integrate with Intercom API to create a corresponding ticket in the external support system
5. WHEN the Intercom integration succeeds, THEN the system SHALL store the external_ticket_id in the support_tickets table
6. WHEN the Intercom integration fails, THEN the system SHALL still create the internal ticket and log the integration error
7. WHEN a ticket is created, THEN the system SHALL display a confirmation message with the ticket ID to the user
8. WHEN a ticket is created, THEN the system SHALL send a notification to the support team via Supabase Realtime

### Requirement 11: AI Fine-Tuning Data Collection

**User Story:** As a system administrator, I want to collect training data from help interactions, so that I can fine-tune the AI model for better performance.

#### Acceptance Criteria

1. WHEN help interactions are logged, THEN the system SHALL mark high-quality interactions (helpfulness rating >= 0.8, no errors) as training_candidate=true
2. WHEN an admin navigates to /admin/help-analytics/training-data, THEN the system SHALL display a list of training candidate interactions
3. WHEN an admin reviews a training candidate, THEN the system SHALL allow marking it as approved_for_training=true or rejected
4. WHEN an admin exports training data, THEN the system SHALL generate a JSONL file with query-response pairs in OpenAI fine-tuning format
5. WHEN exporting training data, THEN the system SHALL only include approved interactions and anonymize user-specific information
6. WHEN training data is exported, THEN the system SHALL log the export action to audit_logs with the number of interactions exported

### Requirement 12: Help Chat Performance Optimization

**User Story:** As a user, I want the help chat to respond quickly, so that I can get assistance without waiting.

#### Acceptance Criteria

1. WHEN a user submits a query, THEN the system SHALL return a response within 3 seconds for 95% of requests
2. WHEN processing a query, THEN the system SHALL use streaming responses to show partial results as they are generated
3. WHEN the RAG_System performs vector search, THEN the system SHALL use indexed vector similarity search with response time < 500ms
4. WHEN multiple users submit queries simultaneously, THEN the system SHALL handle at least 50 concurrent requests without degradation
5. WHEN the OpenAI API is slow or unavailable, THEN the system SHALL implement request timeout (10 seconds) and return a fallback response
6. WHEN response time exceeds 5 seconds, THEN the system SHALL log a performance warning to help_logs

### Requirement 13: Help Chat Security and Privacy

**User Story:** As a security administrator, I want the help chat to protect sensitive information, so that user data remains secure.

#### Acceptance Criteria

1. WHEN a user submits a query, THEN the system SHALL validate and sanitize input to prevent injection attacks
2. WHEN the AI generates a response, THEN the system SHALL filter out any PII (email addresses, phone numbers, API keys) before displaying
3. WHEN logging interactions, THEN the system SHALL encrypt sensitive fields (query, response) at rest in the database
4. WHEN a user requests data deletion, THEN the system SHALL delete all their help_logs and help_feedback entries filtered by user_id and Organization_Context
5. WHEN accessing help data, THEN the system SHALL enforce Organization_Context filtering to prevent cross-organization data leakage
6. WHEN the system detects potential security issues in queries (SQL injection attempts, XSS), THEN the system SHALL block the query and log a security alert

