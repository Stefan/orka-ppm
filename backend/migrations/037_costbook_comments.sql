-- Costbook Comments Migration (P3.2.1)
-- Creates costbook_comments table and RLS for collaborative comments on projects.

-- =====================================================
-- COSTBOOK COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS costbook_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions JSONB DEFAULT '[]',
    parent_id UUID REFERENCES costbook_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_costbook_comments_project_id ON costbook_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_costbook_comments_user_id ON costbook_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_costbook_comments_parent_id ON costbook_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_costbook_comments_created_at ON costbook_comments(created_at);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

-- Use standard trigger if it exists (from other migrations), otherwise create function
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_costbook_comments_updated_at ON costbook_comments;
CREATE TRIGGER update_costbook_comments_updated_at
    BEFORE UPDATE ON costbook_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE costbook_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all costbook comments (Costbook is internal to project visibility)
CREATE POLICY costbook_comments_select_policy ON costbook_comments
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert comments only with their own user_id
CREATE POLICY costbook_comments_insert_policy ON costbook_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update only their own comments
CREATE POLICY costbook_comments_update_policy ON costbook_comments
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own comments
CREATE POLICY costbook_comments_delete_policy ON costbook_comments
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE costbook_comments IS 'Collaborative comments on Costbook projects (Phase 3)';
COMMENT ON COLUMN costbook_comments.mentions IS 'Array of user IDs mentioned in the comment (JSON array of strings)';
COMMENT ON COLUMN costbook_comments.parent_id IS 'Parent comment ID for threaded replies';
