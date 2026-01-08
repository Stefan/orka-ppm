-- User Management Migration Rollback Script
-- This script undoes all changes made by the user management migration
-- Requirements: 5.4

-- WARNING: This will permanently delete all user management data!
-- Make sure to backup your data before running this script.

BEGIN;

-- Drop triggers first (to prevent them from firing during cleanup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Drop functions
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS check_function_exists(TEXT);

-- Drop RLS policies
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

-- Drop indexes
DROP INDEX IF EXISTS idx_user_profiles_user_id;
DROP INDEX IF EXISTS idx_user_profiles_role;
DROP INDEX IF EXISTS idx_user_profiles_is_active;
DROP INDEX IF EXISTS idx_user_profiles_last_login;

DROP INDEX IF EXISTS idx_user_activity_log_user_id;
DROP INDEX IF EXISTS idx_user_activity_log_created_at;

DROP INDEX IF EXISTS idx_admin_audit_log_admin_user_id;
DROP INDEX IF EXISTS idx_admin_audit_log_target_user_id;
DROP INDEX IF EXISTS idx_admin_audit_log_created_at;

DROP INDEX IF EXISTS idx_chat_error_log_user_id;
DROP INDEX IF EXISTS idx_chat_error_log_error_type;
DROP INDEX IF EXISTS idx_chat_error_log_created_at;

-- Drop constraints
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_unique;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS chat_error_log;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS user_activity_log;
DROP TABLE IF EXISTS user_profiles;

-- Remove comments
COMMENT ON TABLE user_profiles IS NULL;
COMMENT ON TABLE user_activity_log IS NULL;
COMMENT ON TABLE admin_audit_log IS NULL;
COMMENT ON TABLE chat_error_log IS NULL;

COMMIT;

-- Verification queries to confirm rollback
-- Uncomment these to verify the rollback was successful:

-- SELECT 'user_profiles' as table_name, 
--        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status
-- UNION ALL
-- SELECT 'user_activity_log' as table_name,
--        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activity_log') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status
-- UNION ALL
-- SELECT 'admin_audit_log' as table_name,
--        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_log') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status
-- UNION ALL
-- SELECT 'chat_error_log' as table_name,
--        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_error_log') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status;

-- SELECT 'create_user_profile' as function_name,
--        CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_user_profile') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status
-- UNION ALL
-- SELECT 'update_updated_at_column' as function_name,
--        CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') 
--             THEN 'EXISTS' ELSE 'DROPPED' END as status;