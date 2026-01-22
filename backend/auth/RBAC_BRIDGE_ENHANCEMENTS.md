# SupabaseRBACBridge Enhancements (Task 4.2)

## Overview

This document describes the enhancements made to the SupabaseRBACBridge in Task 4.2, which adds advanced auth system bridging functionality including JWT token enhancement and Redis-based caching.

## Requirements Addressed

- **Requirement 2.3**: Bridge between Supabase auth.roles and custom roles system
- **Requirement 2.4**: Role information caching for performance optimization

## New Features

### 1. JWT Token Enhancement (Requirement 2.3)

The bridge now provides comprehensive JWT token enhancement capabilities:

#### Methods Added:

**`enhance_jwt_token(user_id, base_token=None)`**
- Enhances JWT tokens with role and permission information
- Includes user's assigned roles, aggregated permissions, and role metadata
- Can merge with existing token claims if base_token is provided
- Returns enhanced payload dictionary

**`create_enhanced_token_string(user_id, secret_key, algorithm='HS256', expires_in_seconds=3600)`**
- Creates a complete signed JWT token with enhanced role information
- Adds standard JWT claims (iat, exp)
- Returns signed token string ready for use

**`extract_roles_from_token(token)`**
- Extracts role information from an enhanced JWT token
- Returns dictionary with roles, permissions, and effective_roles
- Indicates whether token is enhanced with `is_enhanced` flag

**`validate_enhanced_token(token, secret_key, algorithm='HS256')`**
- Validates and decodes enhanced JWT tokens
- Performs signature verification and expiration checking
- Detects stale role information based on cache TTL
- Returns validated payload or None if invalid

#### Usage Example:

```python
from auth.supabase_rbac_bridge import get_supabase_rbac_bridge
from uuid import UUID

bridge = get_supabase_rbac_bridge()

# Create enhanced token
user_id = UUID("...")
secret_key = "your-secret-key"
token = await bridge.create_enhanced_token_string(user_id, secret_key)

# Validate token
validated = await bridge.validate_enhanced_token(token, secret_key)
if validated:
    print(f"User roles: {validated['roles']}")
    print(f"User permissions: {validated['permissions']}")

# Extract roles from token
role_info = await bridge.extract_roles_from_token(token)
if role_info['is_enhanced']:
    print(f"Enhanced token with {len(role_info['roles'])} roles")
```

### 2. Advanced Caching with Redis Support (Requirement 2.4)

The bridge now supports distributed caching using Redis for improved performance across multiple application instances.

#### Redis Integration:

**`initialize_redis_cache()`**
- Initializes Redis connection for distributed caching
- Falls back to in-memory caching if Redis is unavailable
- Returns True if Redis was successfully initialized

**`close_redis_cache()`**
- Closes Redis connection gracefully

#### Advanced Caching Methods:

**`get_cached_data_advanced(cache_key)`**
- Retrieves cached data with Redis support
- Tries Redis first (if enabled), then falls back to in-memory cache
- Returns cached data if found and valid

**`cache_data_advanced(cache_key, data, ttl=None)`**
- Caches data to both Redis (if enabled) and in-memory cache
- Supports custom TTL per cache entry
- Returns True if caching was successful

**`clear_user_cache_advanced(user_id)`**
- Clears all cached data for a user from both Redis and in-memory cache
- Uses Redis SCAN to find and delete matching keys
- Returns True if cache clearing was successful

**`clear_all_cache_advanced()`**
- Clears all RBAC cached data from both Redis and in-memory cache
- Returns True if cache clearing was successful

**`get_cache_statistics()`**
- Returns statistics about cache usage
- Includes in-memory entry count, Redis status, and memory usage
- Useful for monitoring and debugging

#### Usage Example:

```python
from auth.supabase_rbac_bridge import get_supabase_rbac_bridge
import os

# Initialize bridge with Redis
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
bridge = get_supabase_rbac_bridge(redis_url=redis_url)

# Initialize Redis cache
await bridge.initialize_redis_cache()

# Cache data
await bridge.cache_data_advanced("user:123:roles", {"roles": ["admin"]})

# Retrieve cached data
cached = await bridge.get_cached_data_advanced("user:123:roles")

# Get cache statistics
stats = await bridge.get_cache_statistics()
print(f"In-memory entries: {stats['in_memory_entries']}")
print(f"Redis enabled: {stats['redis_enabled']}")

# Clear user cache when roles change
await bridge.clear_user_cache_advanced("123")

# Close Redis connection when done
await bridge.close_redis_cache()
```

### 3. Enhanced Authentication Dependencies

The `auth/dependencies.py` module has been updated to integrate with the enhanced bridge:

**`get_current_user(credentials)`**
- Now uses SupabaseRBACBridge to extract enhanced user information from JWT tokens
- Returns user dict with roles, permissions, and effective_roles
- Falls back to basic JWT decode if bridge is unavailable

**`get_current_user_with_roles(credentials)`** (NEW)
- Enhanced version that ensures role information is always included
- Fetches roles from bridge if not present in token
- Useful for endpoints that require role information

#### Usage Example:

```python
from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user_with_roles

router = APIRouter()

@router.get("/protected")
async def protected_endpoint(current_user = Depends(get_current_user_with_roles)):
    # current_user now includes roles and permissions
    user_roles = current_user.get("roles", [])
    user_permissions = current_user.get("permissions", [])
    
    if "admin" in user_roles:
        return {"message": "Admin access granted"}
    else:
        return {"message": "Regular user access"}
```

## Configuration

### Environment Variables

- **`REDIS_URL`**: Redis connection URL (optional)
  - Format: `redis://host:port/db`
  - Example: `redis://localhost:6379/0`
  - If not provided, only in-memory caching is used

### Initialization

The bridge can be initialized with Redis support:

```python
from auth.supabase_rbac_bridge import get_supabase_rbac_bridge

# Get bridge instance (uses REDIS_URL from environment)
bridge = get_supabase_rbac_bridge()

# Or provide Redis URL explicitly
bridge = get_supabase_rbac_bridge(redis_url="redis://localhost:6379/0")

# Initialize Redis cache
await bridge.initialize_redis_cache()
```

## Performance Optimization

### Caching Strategy

1. **Dual-Layer Caching**: Data is cached in both Redis (distributed) and in-memory (local) for optimal performance
2. **Cache TTL**: Default 5 minutes (300 seconds), configurable per instance
3. **Automatic Expiration**: Cached data expires automatically based on TTL
4. **Cache Invalidation**: User cache is cleared when roles change

### Cache Keys

The bridge uses the following cache key patterns:

- `rbac:enhanced_user:{user_id}` - Enhanced user information
- `rbac:perms:{user_id}:{context}` - User permissions for specific context
- `rbac:global_perm:{user_id}:{permission}` - Global permission checks
- `rbac:proj_perm:{user_id}:{permission}:{project_id}` - Project permission checks
- `rbac:port_perm:{user_id}:{permission}:{portfolio_id}` - Portfolio permission checks

### Performance Benefits

- **Reduced Database Queries**: Role and permission lookups are cached
- **Distributed Caching**: Multiple application instances share cache via Redis
- **Fast Token Validation**: Enhanced tokens include role information, reducing database hits
- **Automatic Cache Invalidation**: Ensures consistency when roles change

## Testing

Comprehensive test suite included in `test_supabase_rbac_bridge_enhancements.py`:

- **JWT Token Enhancement Tests**: 5 tests covering token creation, validation, and extraction
- **Advanced Caching Tests**: 4 tests covering cache operations, expiration, and statistics
- **Auth System Bridging Tests**: 2 tests covering JWT extraction and cache usage
- **Integration Tests**: 1 test covering complete token enhancement flow

Run tests:
```bash
cd backend
python -m pytest auth/test_supabase_rbac_bridge_enhancements.py -v
```

All 12 tests pass successfully.

## Migration Guide

### For Existing Code

No breaking changes. Existing code continues to work as before. To take advantage of new features:

1. **Enable Redis Caching** (optional):
   ```python
   bridge = get_supabase_rbac_bridge()
   await bridge.initialize_redis_cache()
   ```

2. **Use Enhanced Tokens** (optional):
   ```python
   # Create enhanced token
   token = await bridge.create_enhanced_token_string(user_id, secret_key)
   
   # Validate enhanced token
   validated = await bridge.validate_enhanced_token(token, secret_key)
   ```

3. **Use Enhanced Dependencies** (optional):
   ```python
   from auth.dependencies import get_current_user_with_roles
   
   @router.get("/endpoint")
   async def endpoint(user = Depends(get_current_user_with_roles)):
       # user now includes roles and permissions
       pass
   ```

### For New Code

Recommended approach for new endpoints:

```python
from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user_with_roles
from auth.supabase_rbac_bridge import get_supabase_rbac_bridge

router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint(current_user = Depends(get_current_user_with_roles)):
    # Access user roles and permissions
    if "admin" in current_user.get("roles", []):
        # Admin-only logic
        pass
    
    # Check specific permission
    if "project_update" in current_user.get("permissions", []):
        # Permission-specific logic
        pass
    
    return {"status": "success"}
```

## Security Considerations

1. **Token Signing**: Always use strong secret keys for JWT signing
2. **Token Expiration**: Set appropriate expiration times (default: 1 hour)
3. **Signature Verification**: Always verify token signatures in production
4. **Stale Role Detection**: Enhanced tokens detect stale role information
5. **Cache Security**: Redis should be secured with authentication and encryption in production

## Future Enhancements

Potential future improvements:

1. **Token Refresh**: Automatic token refresh when roles are stale
2. **Role Change Notifications**: Real-time notifications when user roles change
3. **Advanced Cache Strategies**: LRU eviction, cache warming, etc.
4. **Metrics and Monitoring**: Detailed metrics for cache hit rates and performance
5. **Multi-Region Caching**: Support for Redis clusters and replication

## References

- **Design Document**: `orka-ppm/.kiro/specs/rbac-enhancement/design.md`
- **Requirements**: `orka-ppm/.kiro/specs/rbac-enhancement/requirements.md`
- **Task List**: `orka-ppm/.kiro/specs/rbac-enhancement/tasks.md`
- **Main Implementation**: `orka-ppm/backend/auth/supabase_rbac_bridge.py`
- **Test Suite**: `orka-ppm/backend/auth/test_supabase_rbac_bridge_enhancements.py`
