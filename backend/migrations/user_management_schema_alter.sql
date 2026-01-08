-- User Management Schema Migration - ALTER TABLE Version
-- This migration updates the existing user_profiles table and adds missing tables

-- Add missing columns to existing user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS sso_user_id VARCHAR(255);

-- Note: Primary key already exists, so we skip adding one

-- Ensure user_id has unique constraint (if not already present)
DO $$ 
BEGIN
    -- Try to add unique constraint on user_id
    BEGIN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Added unique constraint on user_id';
    EXCEPTION 
        WHEN duplicate_table THEN 
            -- Constraint already exists, that's fine
            RAISE NOTICE 'Unique constraint on user_id already exists';
        WHEN others THEN
            -- Some other issue, but continue
            RAISE NOTICE 'Could not add unique constraint on user_id: %', SQLERRM;
    END;
END $$;

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin action audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat error tracking
CREATE TABLE IF NOT EXISTS chat_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(255),
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    status_code INTEGER,
    query_text TEXT,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON user_profiles(last_login);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_error_log_user_id ON chat_error_log(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_error_log_error_type ON chat_error_log(error_type);
CREATE INDEX IF NOT EXISTS idx_chat_error_log_created_at ON chat_error_log(created_at);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_error_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;

DROP POLICY IF EXISTS "Users can view their own activity" ON user_activity_log;
DROP POLICY IF EXISTS "Admins can view all activity" ON user_activity_log;
DROP POLICY IF EXISTS "System can insert activity logs" ON user_activity_log;

DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON admin_audit_log;

DROP POLICY IF EXISTS "Users can view their own errors" ON chat_error_log;
DROP POLICY IF EXISTS "Admins can view all errors" ON chat_error_log;
DROP POLICY IF EXISTS "System can insert error logs" ON chat_error_log;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "Admins can update all profiles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "Admins can insert profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

-- User activity log policies
CREATE POLICY "Users can view their own activity" ON user_activity_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON user_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "System can insert activity logs" ON user_activity_log
    FOR INSERT WITH CHECK (true);

-- Admin audit log policies
CREATE POLICY "Admins can view audit logs" ON admin_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "System can insert audit logs" ON admin_audit_log
    FOR INSERT WITH CHECK (true);

-- Chat error log policies
CREATE POLICY "Users can view their own errors" ON chat_error_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all errors" ON chat_error_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.user_id = auth.uid() 
            AND up.role = 'admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "System can insert error logs" ON chat_error_log
    FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_profiles updated_at (drop first if exists)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create user profile on auth.users insert
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, role, is_active)
    VALUES (NEW.id, 'user', true);
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log the error but don't prevent user creation
        RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-create user profile (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'Extended user profile information with roles and status';
COMMENT ON TABLE user_activity_log IS 'Log of user activities for monitoring and analytics';
COMMENT ON TABLE admin_audit_log IS 'Audit trail of administrative actions';
COMMENT ON TABLE chat_error_log IS 'Error tracking for AI chat functionality';

-- Update any existing user_profiles records to have IDs if they don't
UPDATE user_profiles SET id = gen_random_uuid() WHERE id IS NULL;