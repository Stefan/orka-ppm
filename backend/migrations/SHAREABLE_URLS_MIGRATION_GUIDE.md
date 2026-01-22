# Shareable Project URLs Migration Guide

## Overview

This migration implements a secure shareable project URL system that enables controlled external access to project information. The system provides:

- **Secure Token Generation**: Cryptographically secure 64-character URL-safe tokens
- **Granular Permissions**: Three permission levels (view_only, limited_data, full_project)
- **Time-Based Expiration**: Automatic link expiration with configurable duration
- **Access Tracking**: Comprehensive logging of all access attempts
- **Security Monitoring**: Automatic detection of suspicious access patterns
- **Analytics**: Detailed usage analytics and reporting

## Database Schema

### Tables Created

#### 1. `project_shares`
Main table for storing shareable project links.

**Key Fields:**
- `id`: UUID primary key
- `project_id`: Reference to projects table
- `token`: Unique 64-character secure token
- `permission_level`: Enum (view_only, limited_data, full_project)
- `expires_at`: Expiration timestamp
- `is_active`: Active status flag
- `access_count`: Total access count
- `revoked_at`: Revocation timestamp (if revoked)

**Indexes:**
- `idx_project_shares_token`: Fast token lookup
- `idx_project_shares_project_id`: Project-based queries
- `idx_project_shares_expires_at`: Expiration management
- `idx_project_shares_active`: Active link filtering

#### 2. `share_access_logs`
Detailed access tracking for share links.

**Key Fields:**
- `id`: UUID primary key
- `share_id`: Reference to project_shares
- `accessed_at`: Access timestamp
- `ip_address`: Client IP address
- `user_agent`: Browser/client information
- `country_code`: Geographic location
- `accessed_sections`: JSON array of viewed sections
- `session_duration`: Session length in seconds
- `is_suspicious`: Suspicious activity flag
- `suspicious_reasons`: JSON array of detection reasons

**Indexes:**
- `idx_share_access_logs_share_id`: Share link queries
- `idx_share_access_logs_accessed_at`: Time-based queries
- `idx_share_access_logs_ip_address`: IP-based analysis
- `idx_share_access_logs_suspicious`: Security monitoring

### Enum Types

#### `share_permission_level`
- `view_only`: Basic project information only
- `limited_data`: Includes milestones, timeline, public documents
- `full_project`: All data except sensitive financials and internal notes

### Functions

#### `deactivate_expired_share_links()`
Automatically deactivates share links past their expiration date.

**Returns:** Count of deactivated links

**Usage:**
```sql
SELECT deactivate_expired_share_links();
```

#### `validate_share_link_access(token VARCHAR)`
Validates a share link token and returns access details.

**Returns:** Table with validation results
- `share_id`: Share link ID
- `project_id`: Associated project ID
- `permission_level`: Access level
- `is_valid`: Validation status
- `error_message`: Error description if invalid

**Usage:**
```sql
SELECT * FROM validate_share_link_access('token_here');
```

#### `log_share_access(share_id, ip_address, user_agent, country_code, city)`
Logs a share link access event and updates statistics.

**Returns:** Access log ID

**Usage:**
```sql
SELECT log_share_access(
    'share-uuid'::UUID,
    '192.168.1.1'::INET,
    'Mozilla/5.0...',
    'US',
    'New York'
);
```

#### `detect_suspicious_access(share_id, ip_address)`
Analyzes access patterns and detects suspicious activity.

**Detection Criteria:**
- High frequency: >10 accesses in 1 hour
- Multiple IPs: >5 different IPs in 24 hours
- Geographic anomalies: >3 different countries in 24 hours

**Returns:** JSON with detection results

**Usage:**
```sql
SELECT detect_suspicious_access(
    'share-uuid'::UUID,
    '192.168.1.1'::INET
);
```

#### `get_share_analytics(share_id, start_date, end_date)`
Returns comprehensive analytics for a share link.

**Returns:** JSON with analytics data
- `total_accesses`: Total access count
- `unique_visitors`: Unique IP count
- `unique_countries`: Geographic diversity
- `access_by_day`: Daily access breakdown
- `geographic_distribution`: Country-wise distribution
- `average_session_duration`: Average session length
- `suspicious_activity_count`: Security alerts

**Usage:**
```sql
SELECT get_share_analytics(
    'share-uuid'::UUID,
    NOW() - INTERVAL '30 days',
    NOW()
);
```

### Views

#### `v_active_share_links`
Active share links with project and creator information.

**Columns:**
- Share link details
- Project name
- Creator email
- Status (active, expired, revoked, inactive)

#### `v_share_link_usage`
Usage statistics summary for all share links.

**Columns:**
- Access counts
- Unique visitors
- Geographic diversity
- Suspicious access count
- Average session duration

#### `v_suspicious_access_patterns`
Share link accesses flagged as suspicious.

**Columns:**
- Access details
- Project information
- Suspicious reasons
- Creator contact

### Row Level Security (RLS)

RLS policies are enabled on both tables to ensure data security:

#### `project_shares` Policies:
- **SELECT**: Users can view share links for projects they have access to
- **INSERT**: Users can create share links for projects they manage or are members of
- **UPDATE**: Users can update their own share links
- **DELETE**: Users can delete their own share links

#### `share_access_logs` Policies:
- **SELECT**: Users can view access logs for their share links
- **INSERT**: System can insert access logs (no user restriction)

## Migration Steps

### 1. Prepare Environment

Ensure you have:
- Database connection configured
- Supabase CLI installed (optional)
- Backup of current database

### 2. Apply Migration

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy contents of `031_shareable_project_urls.sql`
4. Execute the SQL

**Option B: Using Supabase CLI**
```bash
supabase db push
```

**Option C: Using psql**
```bash
psql <connection_string> < migrations/031_shareable_project_urls.sql
```

**Option D: Using Python Script**
```bash
python migrations/apply_shareable_urls_migration.py
```

### 3. Verify Migration

Run the verification script:
```bash
python migrations/verify_shareable_urls_migration.py
```

Expected output:
- ✓ All tables created
- ✓ All views accessible
- ✓ Table structures correct

### 4. Test Basic Operations

```python
from config.database import get_supabase_client

supabase = get_supabase_client()

# Test table access
result = supabase.table('project_shares').select('*').limit(1).execute()
print("✓ project_shares accessible")

result = supabase.table('share_access_logs').select('*').limit(1).execute()
print("✓ share_access_logs accessible")
```

## Pydantic Models

The following Pydantic models are available in `backend/models/shareable_urls.py`:

### Request Models
- `ShareLinkCreate`: Create new share link
- `ShareLinkUpdate`: Update existing share link
- `ShareLinkRevoke`: Revoke share link
- `ShareLinkExtend`: Extend expiration
- `BulkShareLinkOperation`: Bulk operations
- `ShareAnalyticsRequest`: Analytics query
- `GuestAccessRequest`: Guest access logging

### Response Models
- `ShareLinkResponse`: Share link details
- `ShareLinkListResponse`: List of share links
- `FilteredProjectData`: Permission-filtered project data
- `ShareAccessLog`: Access log entry
- `ShareAnalytics`: Analytics data
- `ShareLinkValidation`: Validation result
- `BulkOperationResult`: Bulk operation result
- `ShareLinkStats`: System-wide statistics

### Enums
- `SharePermissionLevel`: Permission levels

## Security Considerations

### Token Generation
- Use cryptographically secure random generation
- 64-character URL-safe tokens (Base64URL encoding)
- Prevent token enumeration through rate limiting

### Access Control
- Validate project permissions before share link creation
- Implement IP-based rate limiting (10 requests per minute per IP)
- Log all access attempts for security monitoring

### Data Filtering
- Strict data filtering based on permission levels
- Never expose sensitive financial data or internal notes
- Sanitize all output data to prevent information leakage

### Monitoring
- Automatic detection of suspicious patterns
- Real-time alerts for security threats
- Comprehensive audit logging

## Performance Optimization

### Indexes
All critical columns are indexed for optimal query performance:
- Token lookups: O(1) with unique index
- Project queries: Efficient with project_id index
- Time-based queries: Optimized with timestamp indexes
- Security monitoring: Fast suspicious access detection

### Caching Strategy
Recommended caching approach:
- Cache filtered project data (5-minute TTL)
- Cache token validation results (1-minute TTL)
- Use Redis for distributed caching in production

### Database Maintenance
Regular maintenance tasks:
- Run `deactivate_expired_share_links()` daily
- Archive old access logs (>90 days)
- Update table statistics: `ANALYZE project_shares, share_access_logs`

## Troubleshooting

### Common Issues

#### 1. Migration Fails with "relation already exists"
**Solution:** Tables already exist. Either:
- Drop existing tables: `DROP TABLE IF EXISTS project_shares CASCADE;`
- Or skip migration if already applied

#### 2. RLS Policies Block Access
**Solution:** Ensure user has proper project permissions:
```sql
-- Check user's project access
SELECT * FROM projects WHERE manager_id = auth.uid();
```

#### 3. Token Validation Always Fails
**Solution:** Check token format and expiration:
```sql
SELECT * FROM validate_share_link_access('your-token');
```

#### 4. Suspicious Access False Positives
**Solution:** Adjust detection thresholds in `detect_suspicious_access()` function

### Rollback Procedure

If you need to rollback the migration:

```sql
-- Drop views
DROP VIEW IF EXISTS v_suspicious_access_patterns CASCADE;
DROP VIEW IF EXISTS v_share_link_usage CASCADE;
DROP VIEW IF EXISTS v_active_share_links CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_share_analytics CASCADE;
DROP FUNCTION IF EXISTS detect_suspicious_access CASCADE;
DROP FUNCTION IF EXISTS log_share_access CASCADE;
DROP FUNCTION IF EXISTS validate_share_link_access CASCADE;
DROP FUNCTION IF EXISTS deactivate_expired_share_links CASCADE;

-- Drop tables
DROP TABLE IF EXISTS share_access_logs CASCADE;
DROP TABLE IF EXISTS project_shares CASCADE;

-- Drop enum type
DROP TYPE IF EXISTS share_permission_level CASCADE;
```

## Next Steps

After successful migration:

1. **Implement Services**: Create share link generator and access controller services
2. **Create API Endpoints**: Implement FastAPI routes for share link management
3. **Build Frontend**: Create UI components for share link management
4. **Set Up Monitoring**: Configure alerts for suspicious activity
5. **Test End-to-End**: Verify complete share link lifecycle
6. **Deploy**: Roll out to production with monitoring

## Support

For issues or questions:
- Check the verification script output
- Review the migration SQL file
- Consult the design document in `.kiro/specs/shareable-project-urls/design.md`
- Check existing similar migrations for patterns

## References

- Design Document: `.kiro/specs/shareable-project-urls/design.md`
- Requirements: `.kiro/specs/shareable-project-urls/requirements.md`
- Tasks: `.kiro/specs/shareable-project-urls/tasks.md`
- Migration File: `migrations/031_shareable_project_urls.sql`
- Models: `models/shareable_urls.py`
