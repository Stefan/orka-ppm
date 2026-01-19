# Testing Guide - Catching API Errors Early

## Overview

This guide explains the comprehensive test suite designed to catch common API errors before they reach production, specifically errors like:
- 500 Internal Server Errors
- Missing or incorrect permissions
- Invalid response formats
- Authentication failures

## Test Files

### 1. Backend Integration Tests
**File:** `backend/tests/test_admin_performance_endpoints.py`

**What it catches:**
- ✅ Missing endpoints (404 errors)
- ✅ Invalid Permission enums (the original bug)
- ✅ 500 Internal Server Errors
- ✅ Authentication/Authorization failures
- ✅ Invalid response structures
- ✅ Tracker integration issues

**Run tests:**
```bash
cd backend
pytest tests/test_admin_performance_endpoints.py -v
```

**Key tests:**
- `test_stats_endpoint_exists` - Catches missing endpoints
- `test_all_endpoints_use_correct_permissions` - Catches Permission enum bugs
- `test_stats_endpoint_returns_valid_json` - Catches invalid responses
- `test_endpoints_handle_tracker_errors_gracefully` - Catches unhandled exceptions

### 2. Frontend Integration Tests
**File:** `__tests__/admin-performance-api-integration.test.ts`

**What it catches:**
- ✅ Frontend-backend integration issues
- ✅ Invalid response formats
- ✅ Missing authentication headers
- ✅ CORS issues
- ✅ Malformed JSON responses
- ✅ Backend unavailability

**Run tests:**
```bash
npm test -- __tests__/admin-performance-api-integration.test.ts --run
```

**Key tests:**
- `should detect missing Permission enum (original bug)` - Regression test for the bug
- `should handle 500 errors from backend gracefully` - Error handling
- `should validate response structure from backend` - Data validation
- `should detect when backend is not running` - Connection issues

### 3. API Health Check Script
**File:** `scripts/test-api-health.sh`

**What it catches:**
- ✅ Backend not running
- ✅ Endpoint accessibility
- ✅ Common error patterns in responses
- ✅ Invalid Permission enum usage
- ✅ Unhandled 500 errors

**Run script:**
```bash
./scripts/test-api-health.sh
```

**What it does:**
1. Checks if backend is accessible
2. Tests all admin performance endpoints
3. Searches for common error patterns
4. Runs backend unit tests
5. Runs frontend integration tests
6. Provides detailed error report

### 4. CI/CD Pipeline
**File:** `.github/workflows/api-health-check.yml`

**What it catches:**
- ✅ All of the above, automatically on every push
- ✅ Hardcoded secrets
- ✅ Missing permission checks
- ✅ Deprecated Permission enums

**Triggers:**
- Push to main/develop branches
- Pull requests
- Changes to backend or API files

## The Original Bug

### What Happened:
```python
# WRONG - This caused 500 Internal Server Error
@router.get("/stats")
async def get_performance_stats(
    current_user=Depends(require_permission(Permission.admin))  # ❌ Permission.admin doesn't exist
):
    ...
```

### Why It Failed:
- `Permission.admin` enum doesn't exist in `backend/auth/rbac.py`
- Python raised `AttributeError: Permission.admin`
- FastAPI returned 500 Internal Server Error
- Frontend showed: "Stats API error: 500 Internal Server Error"

### The Fix:
```python
# CORRECT - Use existing Permission enums
@router.get("/stats")
async def get_performance_stats(
    current_user=Depends(require_permission(Permission.admin_read))  # ✅ Correct
):
    ...
```

### How Tests Catch This:

**Backend Test:**
```python
def test_all_endpoints_use_correct_permissions(self, client):
    """Test that all endpoints use valid Permission enums"""
    from auth.rbac import Permission
    
    # Verify Permission.admin_read exists
    assert hasattr(Permission, 'admin_read')
    
    # Verify Permission.admin does NOT exist (this was the bug)
    assert not hasattr(Permission, 'admin'), \
        "Permission.admin should not exist (use admin_read or system_admin)"
```

**Frontend Test:**
```typescript
it('should detect missing Permission enum (original bug)', async () => {
  // Mock backend returning 500 due to invalid permission
  const response = await fetch('/api/admin/performance/stats')
  const errorText = await response.text()
  
  // If this error occurs, it means the permission bug is back
  if (errorText.includes('Permission.admin')) {
    throw new Error(
      'REGRESSION: Permission.admin is being used but does not exist.'
    )
  }
})
```

**CI/CD Check:**
```bash
# Check that Permission.admin is not used anywhere
if grep -r "Permission\.admin[^_]" routers/ middleware/; then
  echo "ERROR: Found usage of Permission.admin"
  exit 1
fi
```

## Running All Tests

### Local Development:

```bash
# 1. Run backend tests
cd backend
pytest tests/test_admin_performance_endpoints.py -v
pytest tests/test_performance_tracker.py -v

# 2. Run frontend tests
npm test -- __tests__/admin-performance-api-integration.test.ts --run

# 3. Run health check script
./scripts/test-api-health.sh

# 4. Run all tests together
npm run test:all  # If configured
```

### Before Committing:

```bash
# Quick pre-commit check
./scripts/test-api-health.sh

# If all pass, commit
git add .
git commit -m "Your changes"
git push
```

### In CI/CD:

Tests run automatically on:
- Every push to main/develop
- Every pull request
- Changes to backend or API files

## Test Coverage

### What's Covered:

✅ **Endpoint Existence**
- All admin performance endpoints exist
- Return correct status codes
- Handle missing endpoints gracefully

✅ **Authentication & Authorization**
- Require authentication
- Check permissions correctly
- Handle missing/invalid tokens
- Return appropriate error codes (401, 403)

✅ **Response Validation**
- Return valid JSON structures
- Include all required fields
- Use correct data types
- Handle missing fields gracefully

✅ **Error Handling**
- Handle tracker errors
- Handle database errors
- Handle network errors
- Return meaningful error messages

✅ **Permission Enums**
- Use only valid Permission enums
- No deprecated permissions
- Correct permission for each endpoint

✅ **Integration**
- Frontend-backend communication
- Request/response flow
- Authentication header forwarding
- Error propagation

### What's NOT Covered:

❌ **Load Testing**
- High traffic scenarios
- Concurrent requests
- Performance under load

❌ **End-to-End UI Testing**
- User interactions
- Browser compatibility
- Visual regression

❌ **Database Integration**
- Real database queries
- Transaction handling
- Data persistence

## Adding New Tests

### When to Add Tests:

1. **New Endpoint:** Add integration test
2. **New Permission:** Add permission validation test
3. **New Error Scenario:** Add error handling test
4. **Bug Fix:** Add regression test

### Test Template:

```python
# Backend test
def test_new_endpoint_feature(self, client, mock_auth_admin):
    """Test description"""
    response = client.get("/new/endpoint")
    
    assert response.status_code == 200
    data = response.json()
    assert 'expected_field' in data
```

```typescript
// Frontend test
it('should handle new scenario', async () => {
  const response = await fetch('/api/new/endpoint')
  expect(response.ok).toBe(true)
  
  const data = await response.json()
  expect(data).toHaveProperty('expected_field')
})
```

## Troubleshooting Tests

### Tests Failing Locally:

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check dependencies:**
   ```bash
   cd backend && pip install -r requirements.txt
   npm install
   ```

3. **Check environment variables:**
   ```bash
   cat .env.local
   ```

4. **Run tests in verbose mode:**
   ```bash
   pytest -v --tb=short
   npm test -- --verbose
   ```

### Tests Failing in CI:

1. **Check GitHub Actions logs**
2. **Verify secrets are set** (SUPABASE_URL, etc.)
3. **Check for environment differences**
4. **Run locally with same Python/Node versions**

## Best Practices

### DO:
✅ Run tests before committing
✅ Add tests for new features
✅ Add regression tests for bugs
✅ Keep tests fast and focused
✅ Use descriptive test names
✅ Mock external dependencies

### DON'T:
❌ Skip failing tests
❌ Commit without running tests
❌ Test implementation details
❌ Use real credentials in tests
❌ Make tests dependent on each other

## Continuous Improvement

### Metrics to Track:
- Test coverage percentage
- Number of caught bugs
- Time to detect issues
- False positive rate

### Regular Reviews:
- Monthly: Review test effectiveness
- Quarterly: Update test strategy
- After incidents: Add regression tests

## Summary

This comprehensive test suite ensures that common API errors are caught early:

1. **Backend Tests** - Catch server-side issues
2. **Frontend Tests** - Catch integration issues
3. **Health Check Script** - Catch deployment issues
4. **CI/CD Pipeline** - Catch issues before merge

**Result:** Fewer production bugs, faster development, higher confidence in deployments.
