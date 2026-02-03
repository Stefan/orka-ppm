# Deployment Procedures with User Synchronization

## Overview

This document outlines the deployment procedures for the PPM SaaS application with integrated user synchronization system. It includes pre-deployment checks, migration application, and post-deployment verification.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Migration Application](#migration-application)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Health Check Integration](#health-check-integration)
- [Rollback Procedures](#rollback-procedures)
- [Environment-Specific Instructions](#environment-specific-instructions)

**Incident response:** For step-by-step actions during incidents (API down, high error rate, DB issues, frontend white screen), see [docs/runbooks/README.md](runbooks/README.md).

## Pre-Deployment Checklist

### 1. Environment Preparation

Ensure the following environment variables are configured:

```bash
# Required for database access
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Security settings
DISABLE_BOOTSTRAP=true
ENABLE_DEVELOPMENT_MODE=false
JWT_SECRET=your-jwt-secret

# Optional: Pre-startup testing
SKIP_PRE_STARTUP_TESTS=false
PRE_STARTUP_TEST_TIMEOUT=30

# Optional: Production error reporting (Sentry)
# Set NEXT_PUBLIC_SENTRY_DSN for client/server error reporting. Get DSN from sentry.io.
# If not set, errors are only logged locally. For full setup run: npx @sentry/wizard@latest -i nextjs
NEXT_PUBLIC_SENTRY_DSN=
```

### 2. Database Backup

**Critical**: Always backup your database before deployment:

```bash
# Using Supabase CLI (if available)
supabase db dump --file backup-$(date +%Y%m%d-%H%M%S).sql

# Or create a manual backup through Supabase dashboard
```

### 3. Code Verification

```bash
# Run local tests
cd backend
python -m pytest tests/ -v

# Verify migration scripts
python user_management_migration_cli.py verify --dry-run
```

## Migration Application

### Automatic Migration (Recommended)

The migration is automatically applied during application startup if not already present. This is handled by the pre-startup testing system.

### Manual Migration (For Controlled Deployments)

If you prefer to apply migrations manually:

```bash
cd backend

# 1. Verify current migration status
python user_management_migration_cli.py verify

# 2. Apply migration if needed
python apply_user_management_migration_direct.py

# 3. Verify migration success
python user_management_migration_cli.py verify

# 4. Run initial user synchronization
python user_sync_cli.py sync --dry-run
python user_sync_cli.py sync
```

## Deployment Steps

### Step 1: Deploy Application Code

Deploy your application using your preferred method (Vercel, Render, Docker, etc.).

### Step 2: Verify Application Startup

Check that the application starts successfully:

```bash
# Check application logs for startup messages
# Look for:
# ✅ Pre-startup tests passed
# 🚀 Starting FastAPI server...
# ✅ Migration verification passed (if applicable)
```

### Step 3: Run Health Checks

```bash
# Basic health check
curl https://your-api-url/health

# Enhanced health check (includes user sync status)
curl https://your-api-url/admin/users/health-check
```

### Step 4: Verify User Synchronization

```bash
# Check sync status
python user_sync_cli.py status

# Expected output should show 100% sync percentage
```

## Post-Deployment Verification

### 1. Functional Testing

Test the complete user flow:

1. **New User Registration**:
   - Create a test user through your application
   - Verify the user can authenticate
   - Check that user profile is created automatically
   - Confirm user can access application features

2. **Existing User Access**:
   - Test login with existing users
   - Verify all users can access their data
   - Check admin functionality (if applicable)

### 2. Database Verification

```sql
-- Check user synchronization status
SELECT 
    'auth.users' as table_name, 
    COUNT(*) as count 
FROM auth.users
UNION ALL
SELECT 
    'user_profiles' as table_name, 
    COUNT(*) as count 
FROM user_profiles;

-- Verify trigger is working
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check for any missing profiles
SELECT COUNT(*) as missing_profiles
FROM auth.users au 
LEFT JOIN user_profiles up ON au.id = up.user_id 
WHERE up.user_id IS NULL;
```

### 3. Performance Verification

```bash
# Test API response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-api-url/health

# Where curl-format.txt contains:
#     time_namelookup:  %{time_namelookup}\n
#        time_connect:  %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#    time_pretransfer:  %{time_pretransfer}\n
#       time_redirect:  %{time_redirect}\n
#  time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n
```

## Health Check Integration

### Enhanced Health Check Endpoint

The application includes enhanced health checks that monitor user synchronization:

```python
# Example enhanced health check response
{
    "status": "healthy",
    "timestamp": "2026-01-08T10:30:00Z",
    "database": "connected",
    "user_sync": {
        "status": "healthy",
        "total_auth_users": 150,
        "total_profiles": 150,
        "missing_profiles": 0,
        "sync_percentage": 100.0
    },
    "services": {
        "supabase": "connected",
        "auth": "operational",
        "triggers": "active"
    }
}
```

### Monitoring Integration

#### Uptime Monitoring

Configure your monitoring service to check:

- `/health` - Basic application health
- `/admin/users/health-check` - User management health

#### Alert Thresholds

Set up alerts for:

- Health check failures (status != "healthy")
- Missing profiles > 0
- Sync percentage < 100%
- Database connection failures

#### Example Monitoring Configuration

```yaml
# Example for monitoring services like Pingdom, UptimeRobot, etc.
endpoints:
  - name: "API Health Check"
    url: "https://your-api-url/health"
    method: "GET"
    expected_status: 200
    expected_content: '"status": "healthy"'
    interval: 60  # seconds
    
  - name: "User Sync Health"
    url: "https://your-api-url/admin/users/health-check"
    method: "GET"
    expected_status: 200
    expected_content: '"missing_profiles": 0'
    interval: 300  # 5 minutes
```

## Rollback Procedures

### If Deployment Fails

1. **Immediate Rollback**:
   ```bash
   # Rollback to previous deployment
   # (Method depends on your deployment platform)
   
   # For Vercel:
   vercel rollback
   
   # For Docker:
   docker rollback your-service
   ```

2. **Database Rollback** (if migration was applied):
   ```bash
   cd backend
   python user_management_migration_cli.py rollback
   ```

### If User Sync Issues Occur

1. **Check Sync Status**:
   ```bash
   python user_sync_cli.py status
   ```

2. **Re-run Synchronization**:
   ```bash
   python user_sync_cli.py sync
   ```

3. **Verify Trigger Functionality**:
   ```bash
   python user_management_migration_cli.py test
   ```

### Emergency User Access

If users cannot access the application:

1. **Create Missing Profiles**:
   ```bash
   # For specific users
   python user_sync_cli.py create-profile <user_id>
   
   # For all missing users
   python user_sync_cli.py sync
   ```

2. **Temporary Admin Access**:
   ```bash
   # Create admin profile for emergency access
   python user_sync_cli.py create-profile <admin_user_id> --role admin
   ```

## Environment-Specific Instructions

### Vercel Deployment

```bash
# Set environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DISABLE_BOOTSTRAP true

# Deploy
vercel --prod

# Verify deployment
curl https://your-app.vercel.app/health
```

### Render Deployment

```yaml
# render.yaml
services:
  - type: web
    name: ppm-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "bash start_with_testing.sh"
    envVars:
      - key: SUPABASE_URL
        value: your-supabase-url
      - key: SUPABASE_SERVICE_ROLE_KEY
        value: your-service-role-key
      - key: DISABLE_BOOTSTRAP
        value: "true"
```

### Docker Deployment

```dockerfile
# Dockerfile additions for user sync
COPY user_sync_cli.py ./
COPY user_synchronization_service.py ./
COPY user_management_migration_cli.py ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

```bash
# Build and deploy
docker build -t ppm-backend .
docker run -d \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e DISABLE_BOOTSTRAP=true \
  -p 8000:8000 \
  ppm-backend
```

### Railway Deployment

```bash
# Set environment variables
railway variables set SUPABASE_URL=your-url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your-key
railway variables set DISABLE_BOOTSTRAP=true

# Deploy
railway up

# Check deployment
railway logs
```

## Maintenance Procedures

### Regular Health Checks

Set up automated health checks:

```bash
#!/bin/bash
# daily-health-check.sh

echo "Running daily health check..."

# Check API health
if curl -f https://your-api-url/health > /dev/null 2>&1; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed"
    exit 1
fi

# Check user sync status
cd /path/to/backend
if python user_sync_cli.py status --json | jq -e '.missing_profiles == 0' > /dev/null; then
    echo "✅ User sync status healthy"
else
    echo "⚠️ User sync issues detected, running sync..."
    python user_sync_cli.py sync
fi

echo "Daily health check completed"
```

### Weekly Maintenance

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Running weekly maintenance..."

cd /path/to/backend

# Full sync verification
python user_sync_cli.py sync --dry-run

# Migration verification
python user_management_migration_cli.py verify

# Performance check
python user_management_migration_cli.py test

echo "Weekly maintenance completed"
```

## Troubleshooting Deployment Issues

### Common Issues and Solutions

1. **Migration fails during deployment**:
   ```bash
   # Check database permissions
   python -c "from config.database import service_supabase; print(service_supabase.table('auth.users').select('id', count='exact').execute())"
   
   # Apply migration manually
   python apply_user_management_migration_direct.py
   ```

2. **Users can't access after deployment**:
   ```bash
   # Check sync status
   python user_sync_cli.py status
   
   # Run sync if needed
   python user_sync_cli.py sync
   ```

3. **Health checks fail**:
   ```bash
   # Check application logs
   # Verify environment variables
   # Test database connectivity
   ```

### Support Contacts

- **Database Issues**: Check Supabase dashboard and logs
- **Deployment Issues**: Check platform-specific logs and documentation
- **User Sync Issues**: Use CLI tools for diagnosis and resolution

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**Related Documentation**: [User Synchronization](./USER_SYNCHRONIZATION.md), [Admin Setup](./ADMIN_SETUP.md)