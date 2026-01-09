# Help Chat System Migration Guide

## Overview

This guide provides instructions for setting up the database schema for the AI-powered Help Chat system. The schema includes tables for sessions, messages, feedback, analytics, and content management.

## Database Schema

The help chat system requires the following tables:

### 1. help_sessions
Tracks user help chat sessions with context and language preferences.

```sql
CREATE TABLE help_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    page_context JSONB,
    language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'de', 'fr')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_session UNIQUE (user_id, session_id)
);
```

### 2. help_messages
Stores all messages in help chat conversations.

```sql
CREATE TABLE help_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES help_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system', 'tip')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    response_time_ms INTEGER CHECK (response_time_ms >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. help_feedback
Collects user feedback on help responses.

```sql
CREATE TABLE help_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES help_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('helpful', 'not_helpful', 'incorrect', 'suggestion', 'feature_request')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_message_user_feedback UNIQUE (message_id, user_id)
);
```

### 4. help_analytics
Privacy-compliant usage analytics.

```sql
CREATE TABLE help_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('query', 'tip_shown', 'tip_dismissed', 'feedback', 'session_start', 'session_end')),
    event_data JSONB DEFAULT '{}',
    page_context JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. help_content
Knowledge base content with multi-language support.

```sql
CREATE TABLE help_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('guide', 'faq', 'feature_doc', 'troubleshooting', 'tutorial', 'best_practice')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'de', 'fr')),
    version INTEGER DEFAULT 1 CHECK (version > 0),
    is_active BOOLEAN DEFAULT true,
    
    -- SEO and search optimization
    slug VARCHAR(255),
    meta_description TEXT,
    keywords TEXT[],
    
    -- Content management
    author_id UUID REFERENCES auth.users(id),
    reviewer_id UUID REFERENCES auth.users(id),
    review_status VARCHAR(20) DEFAULT 'draft' CHECK (review_status IN ('draft', 'review', 'approved', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_content_slug_language UNIQUE (slug, language)
);
```

## Indexes

For optimal performance, create the following indexes:

```sql
-- Help sessions indexes
CREATE INDEX idx_help_sessions_user_id ON help_sessions(user_id);
CREATE INDEX idx_help_sessions_session_id ON help_sessions(session_id);
CREATE INDEX idx_help_sessions_started_at ON help_sessions(started_at);
CREATE INDEX idx_help_sessions_language ON help_sessions(language);
CREATE INDEX idx_help_sessions_page_context ON help_sessions USING GIN(page_context);

-- Help messages indexes
CREATE INDEX idx_help_messages_session_id ON help_messages(session_id);
CREATE INDEX idx_help_messages_type ON help_messages(message_type);
CREATE INDEX idx_help_messages_created_at ON help_messages(created_at);
CREATE INDEX idx_help_messages_confidence ON help_messages(confidence_score) WHERE confidence_score IS NOT NULL;
CREATE INDEX idx_help_messages_sources ON help_messages USING GIN(sources);

-- Help feedback indexes
CREATE INDEX idx_help_feedback_message_id ON help_feedback(message_id);
CREATE INDEX idx_help_feedback_user_id ON help_feedback(user_id);
CREATE INDEX idx_help_feedback_rating ON help_feedback(rating);
CREATE INDEX idx_help_feedback_type ON help_feedback(feedback_type);
CREATE INDEX idx_help_feedback_created_at ON help_feedback(created_at);

-- Help analytics indexes
CREATE INDEX idx_help_analytics_user_id ON help_analytics(user_id);
CREATE INDEX idx_help_analytics_event_type ON help_analytics(event_type);
CREATE INDEX idx_help_analytics_timestamp ON help_analytics(timestamp);
CREATE INDEX idx_help_analytics_event_data ON help_analytics USING GIN(event_data);
CREATE INDEX idx_help_analytics_page_context ON help_analytics USING GIN(page_context);

-- Help content indexes
CREATE INDEX idx_help_content_type ON help_content(content_type);
CREATE INDEX idx_help_content_language ON help_content(language);
CREATE INDEX idx_help_content_active ON help_content(is_active) WHERE is_active = true;
CREATE INDEX idx_help_content_tags ON help_content USING GIN(tags);
CREATE INDEX idx_help_content_keywords ON help_content USING GIN(keywords);
CREATE INDEX idx_help_content_review_status ON help_content(review_status);
CREATE INDEX idx_help_content_published_at ON help_content(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_help_content_slug ON help_content(slug);

-- Full-text search index for help content
CREATE INDEX idx_help_content_search ON help_content USING GIN(to_tsvector('english', title || ' ' || content));
```

## Sample Data

Insert sample help content:

```sql
INSERT INTO help_content (content_type, title, content, tags, language, slug, meta_description, review_status, is_active, published_at) VALUES
('guide', 'Getting Started with Project Management', 'Learn the basics of project management in our PPM platform. This guide covers creating projects, managing resources, and tracking progress.', ARRAY['getting-started', 'projects', 'basics'], 'en', 'getting-started-project-management', 'Complete guide to getting started with project management features', 'approved', true, NOW()),
('faq', 'How to Create a New Project', 'To create a new project, navigate to the Projects section and click the "New Project" button. Fill in the required information including project name, description, and initial budget.', ARRAY['projects', 'creation', 'faq'], 'en', 'how-to-create-new-project', 'Step-by-step guide for creating new projects', 'approved', true, NOW()),
('troubleshooting', 'Common Login Issues', 'If you are experiencing login problems, try these troubleshooting steps: 1) Clear your browser cache, 2) Check your internet connection, 3) Verify your credentials, 4) Contact support if issues persist.', ARRAY['login', 'authentication', 'troubleshooting'], 'en', 'common-login-issues', 'Solutions for common login and authentication problems', 'approved', true, NOW()),
('feature_doc', 'Budget Management Features', 'Our budget management system provides comprehensive tools for tracking project costs, managing budgets, and generating financial reports.', ARRAY['budget', 'financial', 'features'], 'en', 'budget-management-features', 'Overview of budget management and financial tracking features', 'approved', true, NOW()),
('tutorial', 'Creating Your First Dashboard', 'Dashboards provide a visual overview of your project data. Here is how to create and customize your first dashboard.', ARRAY['dashboard', 'visualization', 'tutorial'], 'en', 'creating-first-dashboard', 'Tutorial for creating and customizing project dashboards', 'approved', true, NOW());
```

## Manual Migration Steps

1. **Connect to your Supabase database** using the SQL editor or a database client
2. **Execute the table creation SQL** from the schema section above
3. **Create the indexes** using the index SQL statements
4. **Insert sample data** using the sample data SQL
5. **Verify the migration** by checking that all tables exist and contain data

## Automated Migration

If you have service role access, you can use the complete SQL migration file:

```bash
# Execute the full migration
psql -h your-supabase-host -U postgres -d postgres -f backend/migrations/018_help_chat_system.sql
```

## Verification

After migration, verify the setup:

```sql
-- Check table existence
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'help_%';

-- Check sample content
SELECT count(*) FROM help_content WHERE is_active = true;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename LIKE 'help_%';
```

## Requirements Satisfied

This migration satisfies the following requirements from the task:

- ✅ **1.1, 1.4**: help_sessions and help_messages tables for contextual chat interface
- ✅ **6.1**: help_feedback table for feedback system integration  
- ✅ **7.1**: help_analytics table for usage analytics and improvement
- ✅ **8.1**: Privacy-compliant design with proper data handling

## Next Steps

After completing the database migration:

1. Test table creation and data insertion
2. Verify foreign key constraints work correctly
3. Test the indexes improve query performance
4. Implement the backend API endpoints that use these tables
5. Create the frontend components that interact with the help chat system

## Troubleshooting

**Issue**: Tables not created
- **Solution**: Ensure you have proper database permissions
- **Alternative**: Use Supabase dashboard to create tables manually

**Issue**: Foreign key constraint errors
- **Solution**: Ensure auth.users table exists and has the expected structure

**Issue**: Index creation fails
- **Solution**: Create tables first, then add indexes separately

**Issue**: Sample data insertion fails
- **Solution**: Check that all required columns have values and constraints are satisfied