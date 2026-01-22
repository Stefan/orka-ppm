# Shareable Project URLs - Quick Reference

## Quick Start

### 1. Apply Migration
```bash
cd backend/migrations
python apply_shareable_urls_migration.py
```

### 2. Verify Migration
```bash
python verify_shareable_urls_migration.py
```

## Database Tables

### `project_shares`
```sql
-- Create a share link
INSERT INTO project_shares (project_id, token, created_by, permission_level, expires_at)
VALUES (
    'project-uuid',
    'secure-64-char-token',
    'user-uuid',
    'view_only',
    NOW() + INTERVAL '7 days'
);

-- Get active share links for a project
SELECT * FROM project_shares 
WHERE project_id = 'project-uuid' 
AND is_active = true 
AND revoked_at IS NULL;

-- Revoke a share link
UPDATE project_shares 
SET revoked_at = NOW(), 
    revoked_by = 'user-uuid',
    revocation_reason = 'Security concern',
    is_active = false
WHERE id = 'share-uuid';
```

### `share_access_logs`
```sql
-- Log an access
INSERT INTO share_access_logs (share_id, ip_address, user_agent, country_code)
VALUES ('share-uuid', '192.168.1.1', 'Mozilla/5.0...', 'US');

-- Get recent accesses
SELECT * FROM share_access_logs 
WHERE share_id = 'share-uuid' 
ORDER BY accessed_at DESC 
LIMIT 10;
```

## Functions

### Validate Share Link
```sql
SELECT * FROM validate_share_link_access('token-here');
-- Returns: share_id, project_id, permission_level, is_valid, error_message
```

### Log Access
```sql
SELECT log_share_access(
    'share-uuid'::UUID,
    '192.168.1.1'::INET,
    'Mozilla/5.0...',
    'US',
    'New York'
);
-- Returns: log_id
```

### Detect Suspicious Activity
```sql
SELECT detect_suspicious_access(
    'share-uuid'::UUID,
    '192.168.1.1'::INET
);
-- Returns: JSON with is_suspicious and reasons
```

### Get Analytics
```sql
SELECT get_share_analytics(
    'share-uuid'::UUID,
    NOW() - INTERVAL '30 days',
    NOW()
);
-- Returns: JSON with comprehensive analytics
```

### Deactivate Expired Links
```sql
SELECT deactivate_expired_share_links();
-- Returns: count of deactivated links
```

## Views

### Active Share Links
```sql
SELECT * FROM v_active_share_links 
WHERE project_id = 'project-uuid';
```

### Usage Statistics
```sql
SELECT * FROM v_share_link_usage 
WHERE share_id = 'share-uuid';
```

### Suspicious Access
```sql
SELECT * FROM v_suspicious_access_patterns 
ORDER BY accessed_at DESC;
```

## Pydantic Models

### Create Share Link
```python
from models import ShareLinkCreate, SharePermissionLevel

share_link = ShareLinkCreate(
    project_id=project_uuid,
    permission_level=SharePermissionLevel.VIEW_ONLY,
    expiry_duration_days=7,
    custom_message="Welcome to our project!"
)
```

### Response Model
```python
from models import ShareLinkResponse

# Automatically converts database row to response
share_response = ShareLinkResponse.from_orm(db_row)
```

### Analytics Request
```python
from models import ShareAnalyticsRequest
from datetime import datetime, timedelta

analytics_request = ShareAnalyticsRequest(
    start_date=datetime.now() - timedelta(days=30),
    end_date=datetime.now()
)
```

## Permission Levels

### `view_only`
- Project name, description
- Status, progress percentage
- Start/end dates

### `limited_data`
- Everything in view_only
- Milestones
- Timeline
- Public documents
- Team members (names only)

### `full_project`
- Everything in limited_data
- Tasks and schedules
- Risk register (non-sensitive)
- Resource allocation
- **Excludes**: Financial data, internal notes

## Security Best Practices

### Token Generation
```python
import secrets
import base64

def generate_secure_token():
    # Generate 48 random bytes (will be 64 chars in base64)
    random_bytes = secrets.token_bytes(48)
    # Encode as URL-safe base64
    token = base64.urlsafe_b64encode(random_bytes).decode('utf-8')
    return token[:64]  # Ensure exactly 64 characters
```

### Rate Limiting
```python
# Check access frequency
recent_accesses = supabase.table('share_access_logs')\
    .select('id')\
    .eq('ip_address', client_ip)\
    .gte('accessed_at', datetime.now() - timedelta(minutes=1))\
    .execute()

if len(recent_accesses.data) > 10:
    raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

### Validation
```python
def validate_share_link(token: str):
    result = supabase.rpc('validate_share_link_access', {'p_token': token}).execute()
    
    if not result.data or not result.data[0]['is_valid']:
        error = result.data[0]['error_message'] if result.data else 'Invalid token'
        raise HTTPException(status_code=403, detail=error)
    
    return result.data[0]
```

## Common Queries

### Get All Share Links for User's Projects
```sql
SELECT ps.*, p.name as project_name
FROM project_shares ps
JOIN projects p ON ps.project_id = p.id
WHERE ps.created_by = 'user-uuid'
ORDER BY ps.created_at DESC;
```

### Find Expiring Links (Next 24 Hours)
```sql
SELECT * FROM v_active_share_links
WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
AND status = 'active';
```

### Get Most Accessed Links
```sql
SELECT * FROM v_share_link_usage
ORDER BY total_accesses DESC
LIMIT 10;
```

### Geographic Distribution
```sql
SELECT country_code, COUNT(*) as access_count
FROM share_access_logs
WHERE share_id = 'share-uuid'
GROUP BY country_code
ORDER BY access_count DESC;
```

## Maintenance Tasks

### Daily Cleanup (Cron Job)
```sql
-- Deactivate expired links
SELECT deactivate_expired_share_links();

-- Archive old logs (optional)
DELETE FROM share_access_logs 
WHERE accessed_at < NOW() - INTERVAL '90 days';
```

### Weekly Analytics
```sql
-- Generate weekly report
SELECT 
    p.name as project_name,
    COUNT(DISTINCT ps.id) as share_links,
    SUM(ps.access_count) as total_accesses,
    COUNT(DISTINCT sal.ip_address) as unique_visitors
FROM projects p
LEFT JOIN project_shares ps ON p.id = ps.project_id
LEFT JOIN share_access_logs sal ON ps.id = sal.share_id
WHERE sal.accessed_at > NOW() - INTERVAL '7 days'
GROUP BY p.id, p.name
ORDER BY total_accesses DESC;
```

## Troubleshooting

### Check Token Validity
```sql
SELECT 
    token,
    is_active,
    expires_at,
    expires_at < NOW() as is_expired,
    revoked_at IS NOT NULL as is_revoked
FROM project_shares
WHERE token = 'your-token';
```

### Debug Access Issues
```sql
-- Check recent access attempts
SELECT * FROM share_access_logs
WHERE share_id = 'share-uuid'
ORDER BY accessed_at DESC
LIMIT 20;

-- Check for suspicious patterns
SELECT * FROM v_suspicious_access_patterns
WHERE share_id = 'share-uuid';
```

### Verify RLS Policies
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('project_shares', 'share_access_logs');

-- List policies
SELECT * FROM pg_policies 
WHERE tablename IN ('project_shares', 'share_access_logs');
```

## API Integration Examples

### FastAPI Endpoint
```python
from fastapi import APIRouter, Depends, HTTPException
from models import ShareLinkCreate, ShareLinkResponse

router = APIRouter()

@router.post("/projects/{project_id}/shares", response_model=ShareLinkResponse)
async def create_share_link(
    project_id: UUID,
    share_data: ShareLinkCreate,
    current_user = Depends(get_current_user)
):
    # Generate secure token
    token = generate_secure_token()
    
    # Calculate expiration
    expires_at = datetime.now() + timedelta(days=share_data.expiry_duration_days)
    
    # Create share link
    result = supabase.table('project_shares').insert({
        'project_id': str(project_id),
        'token': token,
        'created_by': str(current_user.id),
        'permission_level': share_data.permission_level.value,
        'expires_at': expires_at.isoformat(),
        'custom_message': share_data.custom_message
    }).execute()
    
    return ShareLinkResponse.from_orm(result.data[0])
```

### Guest Access Endpoint
```python
@router.get("/projects/{project_id}/share/{token}")
async def access_shared_project(
    project_id: UUID,
    token: str,
    request: Request
):
    # Validate token
    validation = validate_share_link(token)
    
    # Log access
    log_id = supabase.rpc('log_share_access', {
        'p_share_id': validation['share_id'],
        'p_ip_address': request.client.host,
        'p_user_agent': request.headers.get('user-agent')
    }).execute()
    
    # Check for suspicious activity
    suspicious = supabase.rpc('detect_suspicious_access', {
        'p_share_id': validation['share_id'],
        'p_ip_address': request.client.host
    }).execute()
    
    # Get filtered project data
    project_data = get_filtered_project_data(
        project_id,
        validation['permission_level']
    )
    
    return project_data
```

## Performance Tips

1. **Use Indexes**: All critical columns are indexed
2. **Cache Validation**: Cache token validation results for 1 minute
3. **Batch Operations**: Use bulk operations for multiple share links
4. **Async Logging**: Log access asynchronously to avoid blocking
5. **Partition Logs**: Consider partitioning share_access_logs by date for large datasets

## Next Steps

1. Implement share link generator service
2. Create API endpoints
3. Build frontend UI components
4. Set up monitoring and alerts
5. Configure email notifications
6. Deploy and test end-to-end
