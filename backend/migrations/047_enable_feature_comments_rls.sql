-- Migration: Enable RLS on feature_comments
-- Security: Tables in public schema exposed to PostgREST must have RLS enabled.
-- Matches 025_feedback_system schema (feature_comments.author_id). Idempotent.

ALTER TABLE feature_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present (e.g. from 008) to avoid name clashes or wrong column
DROP POLICY IF EXISTS "Users can view all feature comments" ON feature_comments;
DROP POLICY IF EXISTS "Users can create feature comments" ON feature_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON feature_comments;

-- Policies for 025 schema (author_id). Use author_id for INSERT/UPDATE.
CREATE POLICY "Users can view all feature comments" ON feature_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create feature comments" ON feature_comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments" ON feature_comments
    FOR UPDATE USING (auth.uid() = author_id);

COMMENT ON TABLE feature_comments IS 'Comments on feature requests; RLS enabled';
