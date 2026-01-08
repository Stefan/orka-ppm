# User Management Migration Guide

## Overview

This guide provides step-by-step instructions for applying the user management schema migration to enable automatic user profile creation and synchronization.

## Current Status

Based on the migration verification test, the current database state is:

- ✅ `user_profiles` table exists but has incomplete structure
- ❌ `user_activity_log` table missing
- ❌ `admin_audit_log` table missing  
- ❌ `chat_error_log` table missing
- ❌ Automatic profile creation trigger not functional

## Manual Migration Steps

### Step 1: Access Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/xceyrfvxooiplbmwavlb
2. Navigate to the **SQL Editor** tab
3. Create a new query

### Step 2: Execute Migration SQL

**IMPORTANT:** Use the ALTER TABLE version of the migration since the user_profiles table already exists:

Copy and paste the entire contents of `backend/migrations/user_management_schema_alter.sql` into the SQL Editor and execute it.

This migration will:
- Add missing columns to the existing user_profiles table (id, last_login, sso_provider, sso_user_id)
- Add primary key and unique constraints

This migration will:
- Add missing columns to the existing user_profiles table (id, last_login, sso_provider, sso_user_id)
- Add primary key and unique constraints
- Create missing tables (`user_activity_log`, `admin_audit_log`, `chat_error_log`)
- Create indexes for performance
- Set up Row Level Security (RLS) policies
- Create the automatic user profile creation trigger
- Create supporting functions

### Step 3: Verify Migration

After executing the SQL, run the verification script:

```bash
cd backend
python verify_and_apply_migration.py
```

Expected output after successful migration:
```
✅ user_profiles - Core user profile information with roles and status
✅ user_activity_log - Log of user activities for monitoring
✅ admin_audit_log - Audit trail of administrative actions
✅ chat_error_log - Error tracking for AI chat functionality
✅ User profile creation trigger appears to be functional
🎉 Migration verification successful!
```

### Step 4: Test Automatic Profile Creation

The migration includes a trigger that automatically creates user profiles when new users sign up. To test this:

1. Create a test user through your application's signup process
2. Verify that a corresponding `user_profiles` record is created automatically
3. Check that the profile has the default role of 'user' and is_active = true

### Step 5: Synchronize Existing Users

If you have existing users in `auth.users` without corresponding `user_profiles`, run the synchronization process (this will be implemented in the next task).

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure you're using an admin account in Supabase dashboard
2. **Table Already Exists**: The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to re-run
3. **Trigger Not Working**: Verify the `create_user_profile()` function was created successfully

### Rollback (if needed)

If you need to rollback the migration:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (WARNING: This will delete all data)
DROP TABLE IF EXISTS chat_error_log;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS user_activity_log;
-- Note: user_profiles table may contain important data, consider backing up first
```

## Verification Commands

After migration, you can verify the setup using these commands:

```bash
# Check migration status
python verify_and_apply_migration.py

# Run property-based tests
python -m pytest test_migration_verification_properties.py -v

# Check current schema
python check_current_schema.py
```

## Next Steps

After successful migration:

1. ✅ Database migration applied
2. ⏳ Implement user synchronization service (Task 2)
3. ⏳ Enhance user management API (Task 3)
4. ⏳ Test automatic profile creation (Task 4)
5. ⏳ Implement data integrity validation (Task 5)