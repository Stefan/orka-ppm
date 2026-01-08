# User Synchronization System Documentation

## Overview

The User Synchronization System ensures seamless integration between Supabase's built-in authentication (`auth.users`) and the application's custom user management system (`user_profiles`). This system addresses the core issue where users can successfully authenticate through Supabase Auth but cannot access application features because their profile records don't exist in the custom user management tables.

## Table of Contents

- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Migration Process](#migration-process)
- [CLI Tools](#cli-tools)
- [Troubleshooting](#troubleshooting)
- [Deployment Integration](#deployment-integration)
- [Monitoring & Health Checks](#monitoring--health-checks)

## Architecture

### System Components

The user synchronization system consists of several key components:

1. **Database Migration**: Creates the required tables, triggers, and functions
2. **Automatic Profile Creation**: Database trigger that creates profiles for new users
3. **Synchronization Service**: Identifies and creates missing profiles for existing users
4. **CLI Tools**: Command-line interfaces for management and troubleshooting
5. **API Integration**: Enhanced user management API that works with synchronized data

### Data Flow

```
New User Registration:
User signs up → Supabase Auth creates auth.users record → Trigger automatically creates user_profiles record

Existing User Sync:
Admin runs sync → System identifies missing profiles → Creates missing user_profiles records

User Management:
API queries join auth.users and user_profiles for complete user information
```

## Database Schema

### Core Tables

#### user_profiles
The main user profile table that extends Supabase Auth with application-specific data:

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivated_by UUID REFERENCES auth.users(id),
    deactivation_reason VARCHAR(255),
    sso_provider VARCHAR(50),
    sso_user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Supporting Tables
- `user_activity_log`: Tracks user activities for monitoring and analytics
- `admin_audit_log`: Audit trail of administrative actions
- `chat_error_log`: Error tracking for AI chat functionality

### Automatic Profile Creation

The system uses a PostgreSQL trigger to automatically create user profiles:

```sql
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $
BEGIN
    INSERT INTO user_profiles (user_id, role, is_active)
    VALUES (NEW.id, 'user', true);
    RETURN NEW;
END;
$ language 'plpgsql';

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();
```

## Migration Process

### Prerequisites

Before running the migration:

1. **Database Access**: Ensure you have admin access to your Supabase database
2. **Backup**: Create a database backup before applying migrations
3. **Environment**: Verify your environment variables are correctly configured

### Running the Migration

#### Option 1: Using the Migration CLI Tool

```bash
# Navigate to the backend directory
cd backend

# Run migration verification
python user_management_migration_cli.py verify

# Run end-to-end tests
python user_management_migration_cli.py test

# If needed, rollback the migration
python user_management_migration_cli.py rollback
```

#### Option 2: Manual Migration

```bash
# Apply the migration directly
python apply_user_management_migration_direct.py
```

### Migration Verification

After applying the migration, verify it was successful:

```bash
# Check migration status
python user_management_migration_cli.py verify

# Expected output:
# ✅ Migration verification passed
# ✅ All required tables exist
# ✅ All triggers are functioning
# ✅ All functions are created
```

## CLI Tools

### User Synchronization CLI

The main tool for managing user synchronization:

```bash
python user_sync_cli.py [command] [options]
```

#### Available Commands

##### sync
Synchronize users between auth.users and user_profiles:

```bash
# Run full synchronization
python user_sync_cli.py sync

# Preview what would be synchronized (dry run)
python user_sync_cli.py sync --dry-run

# Run with detailed output
python user_sync_cli.py sync --verbose

# Output results as JSON
python user_sync_cli.py sync --json
```

##### status
Check current synchronization status:

```bash
# Check sync status
python user_sync_cli.py status

# Get detailed status information
python user_sync_cli.py status --verbose

# Get status as JSON
python user_sync_cli.py status --json
```

##### create-profile
Create a user profile for a specific user:

```bash
# Create profile with default settings
python user_sync_cli.py create-profile <user_id>

# Create profile with specific role
python user_sync_cli.py create-profile <user_id> --role admin

# Create inactive profile
python user_sync_cli.py create-profile <user_id> --inactive
```

##### preservation-report
Generate a report on data preservation for users:

```bash
# Generate report for all users
python user_sync_cli.py preservation-report

# Generate report for specific users
python user_sync_cli.py preservation-report user1 user2 user3
```

### Migration Management CLI

Tool for managing database migrations:

```bash
python user_management_migration_cli.py [command]
```

#### Available Commands

- `verify`: Verify migration status and database objects
- `test`: Run end-to-end tests to validate functionality
- `rollback`: Rollback migration changes (use with caution)

## Troubleshooting

### Common Issues

#### Issue: Users can authenticate but can't access the application

**Symptoms:**
- Users can log in successfully
- Application shows "access denied" or similar errors
- User doesn't appear in admin user management

**Diagnosis:**
```bash
# Check sync status
python user_sync_cli.py status

# Look for missing profiles
python user_sync_cli.py sync --dry-run
```

**Solution:**
```bash
# Run synchronization to create missing profiles
python user_sync_cli.py sync
```

#### Issue: Automatic profile creation not working for new users

**Symptoms:**
- New users can sign up but profiles aren't created automatically
- Manual sync is required after each new user registration

**Diagnosis:**
```bash
# Verify migration status
python user_management_migration_cli.py verify

# Check if trigger exists
# In your database, run:
# SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
```

**Solution:**
```bash
# Re-apply the migration
python apply_user_management_migration_direct.py

# Or use the migration CLI
python user_management_migration_cli.py verify
```

#### Issue: Sync operation fails with permission errors

**Symptoms:**
- CLI tools return permission denied errors
- Database connection failures

**Diagnosis:**
- Check environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Verify database permissions
- Check Row Level Security (RLS) policies

**Solution:**
```bash
# Verify environment variables are set
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Check database connectivity
python -c "from config.database import supabase; print('Connected' if supabase else 'Failed')"
```

#### Issue: Existing user data gets overwritten during sync

**Symptoms:**
- User roles or settings are reset to defaults after sync
- Custom user data is lost

**Diagnosis:**
```bash
# Generate preservation report
python user_sync_cli.py preservation-report
```

**Solution:**
The sync system preserves existing data by default. If data is being overwritten:

1. Check that you're not using the `--no-preserve` flag
2. Verify the preservation logic in the sync service
3. Run a preservation report before syncing

### Error Messages and Solutions

#### "No Supabase client available for synchronization"

**Cause:** Database connection configuration issue

**Solution:**
1. Check environment variables
2. Verify Supabase credentials
3. Test database connectivity

#### "Failed to identify missing profiles: permission denied"

**Cause:** Insufficient database permissions

**Solution:**
1. Use service role key instead of anon key
2. Check RLS policies
3. Verify user has admin privileges

#### "Profile creation failed: duplicate key value violates unique constraint"

**Cause:** Attempting to create a profile that already exists

**Solution:**
1. Run sync with preservation mode (default)
2. Check for existing profiles before creation
3. Use the status command to identify duplicates

### Debugging Tips

#### Enable Verbose Logging

```bash
# Add verbose flag to any command
python user_sync_cli.py sync --verbose

# Or set logging level in Python
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Check Database State

```sql
-- Count users in each table
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles;

-- Find users without profiles
SELECT au.id, au.email 
FROM auth.users au 
LEFT JOIN user_profiles up ON au.id = up.user_id 
WHERE up.user_id IS NULL;

-- Check trigger status
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

#### Test Trigger Functionality

```sql
-- Test the trigger by inserting a test user
-- (Only do this in development!)
INSERT INTO auth.users (id, email) 
VALUES (gen_random_uuid(), 'test@example.com');

-- Check if profile was created
SELECT * FROM user_profiles WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'test@example.com'
);
```

## Deployment Integration

### Environment Variables

Ensure these environment variables are set in your deployment environment:

```bash
# Required for database access
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Enable/disable features
DISABLE_BOOTSTRAP=true
ENABLE_DEVELOPMENT_MODE=false
```

### Pre-Deployment Checklist

Before deploying to production:

1. **Apply Migration**:
   ```bash
   python user_management_migration_cli.py verify
   ```

2. **Run Initial Sync**:
   ```bash
   python user_sync_cli.py sync --dry-run
   python user_sync_cli.py sync
   ```

3. **Verify Health Checks**:
   ```bash
   curl https://your-api-url/health
   ```

4. **Test User Registration**:
   - Create a test user through your application
   - Verify the profile is created automatically
   - Check that the user can access application features

### Post-Deployment Verification

After deployment:

1. **Monitor Sync Status**:
   ```bash
   python user_sync_cli.py status
   ```

2. **Check Application Health**:
   ```bash
   curl https://your-api-url/health
   curl https://your-api-url/admin/users/health-check
   ```

3. **Verify User Registration Flow**:
   - Test new user signup
   - Confirm automatic profile creation
   - Validate user permissions

## Monitoring & Health Checks

### Health Check Endpoints

The application provides several health check endpoints:

#### Basic Health Check
```bash
GET /health
```

Returns overall application health status including database connectivity.

#### User Management Health Check
```bash
GET /admin/users/health-check
```

Returns specific health information for the user management system.

#### Dashboard Health Check
```bash
GET /dashboard/health-check
```

Quick health check for dashboard functionality.

### Monitoring Sync Status

#### Automated Monitoring

Add sync status monitoring to your health checks:

```python
# Example health check integration
from user_synchronization_service import get_sync_status

async def enhanced_health_check():
    health_status = {"status": "healthy"}
    
    # Check sync status
    sync_status = get_sync_status()
    if sync_status.get("missing_profiles", 0) > 0:
        health_status["warnings"] = [
            f"{sync_status['missing_profiles']} users need profile synchronization"
        ]
    
    return health_status
```

#### Sync Status Metrics

Monitor these key metrics:

- **Total Auth Users**: Number of users in auth.users
- **Total User Profiles**: Number of profiles in user_profiles
- **Missing Profiles**: Users without profiles
- **Sync Percentage**: Percentage of users with profiles

#### Alerting

Set up alerts for:

- Missing profiles > 0 (indicates sync needed)
- Sync percentage < 100% (indicates ongoing sync issues)
- Failed profile creations (indicates system problems)
- Trigger failures (indicates database issues)

### Maintenance Tasks

#### Regular Sync Verification

Run periodic sync checks:

```bash
# Daily sync status check
0 9 * * * /path/to/python user_sync_cli.py status --json > /var/log/sync-status.log

# Weekly full sync (if needed)
0 2 * * 0 /path/to/python user_sync_cli.py sync --verbose > /var/log/sync-weekly.log
```

#### Database Maintenance

Regularly check:

- Trigger functionality
- Index performance
- RLS policy effectiveness
- Audit log cleanup

#### Performance Monitoring

Monitor:

- Sync operation execution time
- Database query performance
- API response times for user endpoints
- Memory usage during large sync operations

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**Related Documentation**: [Admin Setup](./ADMIN_SETUP.md), [Security Checklist](./SECURITY_CHECKLIST.md)