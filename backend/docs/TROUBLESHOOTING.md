# Pre-Startup Testing System - Troubleshooting Guide

## Quick Diagnosis

Run this command to get a comprehensive system status:

```bash
# Quick system check
python run_pre_startup_tests.py --json | jq '.validation_results[] | select(.status != "PASS")'

# Or for human-readable output
python run_pre_startup_tests.py --verbose
```

## Common Error Patterns

### 1. Database Connection Issues

#### Error: "Cannot connect to Supabase database"

**Symptoms:**
- Server fails to start
- Database tests fail with connection errors
- API endpoints return 500 errors

**Diagnosis:**
```bash
# Check environment variables
echo "SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:30}..."

# Test direct connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/" -v
```

**Solutions:**

1. **Invalid URL format:**
   ```bash
   # Correct format
   export SUPABASE_URL="https://your-project.supabase.co"
   # NOT: https://your-project.supabase.co/
   ```

2. **Invalid API key:**
   ```bash
   # Verify JWT format
   python -c "
   import os
   key = os.getenv('SUPABASE_ANON_KEY')
   parts = key.split('.')
   print(f'JWT parts: {len(parts)} (should be 3)')
   print(f'Starts with eyJ: {key.startswith(\"eyJ\")}')
   "
   ```

3. **Network connectivity:**
   ```bash
   # Test basic connectivity
   ping your-project.supabase.co
   
   # Test HTTPS
   curl -I https://your-project.supabase.co
   ```

#### Error: "Missing database functions"

**Symptoms:**
- API endpoints fail with "function does not exist" errors
- Database tests pass but API tests fail

**Solutions:**
```bash
# Run all migrations
python apply_migration_direct.py

# Apply specific function migrations
python apply_vector_functions.py

# Verify functions exist
python -c "
from supabase import create_client
import os
client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))
result = client.rpc('execute_sql', {'query': 'SELECT 1'}).execute()
print('execute_sql function works:', bool(result.data))
"
```

### 2. Authentication Problems

#### Error: "JWT token validation failed"

**Symptoms:**
- Authentication tests fail
- API endpoints return 401/403 errors
- User context is missing

**Diagnosis:**
```bash
# Decode JWT token
python -c "
import jwt
import os
token = os.getenv('SUPABASE_ANON_KEY')
try:
    payload = jwt.decode(token, options={'verify_signature': False})
    print('Token payload:', payload)
    print('Role:', payload.get('role'))
    print('Issuer:', payload.get('iss'))
except Exception as e:
    print('JWT decode error:', e)
"
```

**Solutions:**

1. **Expired token:**
   ```bash
   # Check expiration
   python -c "
   import jwt, os, datetime
   token = os.getenv('SUPABASE_ANON_KEY')
   payload = jwt.decode(token, options={'verify_signature': False})
   exp = payload.get('exp', 0)
   now = datetime.datetime.now().timestamp()
   print(f'Token expires: {datetime.datetime.fromtimestamp(exp)}')
   print(f'Current time: {datetime.datetime.fromtimestamp(now)}')
   print(f'Expired: {exp < now}')
   "
   ```

2. **Wrong token type:**
   ```bash
   # Ensure using anon key, not service role key for client
   echo "Role in token: $(python -c "import jwt,os; print(jwt.decode(os.getenv('SUPABASE_ANON_KEY'), options={'verify_signature': False}).get('role'))")"
   # Should be 'anon' for client operations
   ```

3. **Development mode fallback:**
   ```bash
   # Enable development mode
   export DEVELOPMENT_MODE=true
   python run_pre_startup_tests.py
   ```

### 3. API Endpoint Failures

#### Error: "Endpoint returned 500 Internal Server Error"

**Symptoms:**
- Specific endpoints fail during testing
- Server starts but some functionality broken

**Diagnosis:**
```bash
# Test specific endpoint
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     http://localhost:8000/admin/users -v

# Check server logs
tail -f backend.log | grep ERROR
```

**Solutions:**

1. **Missing database tables:**
   ```bash
   # Check table existence
   python -c "
   from supabase import create_client
   import os
   client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))
   try:
       result = client.table('user_profiles').select('count', count='exact').execute()
       print('user_profiles table exists')
   except Exception as e:
       print('user_profiles table missing:', e)
   "
   
   # Create missing tables
   python migrations/apply_migration.py
   ```

2. **Permission issues:**
   ```bash
   # Test with service role key
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   python run_pre_startup_tests.py
   ```

3. **Code errors:**
   ```bash
   # Check Python syntax
   python -m py_compile main.py
   
   # Run with debug mode
   export DEBUG=true
   python run_pre_startup_tests.py --verbose
   ```

### 4. Performance Issues

#### Error: "Tests timed out after 30 seconds"

**Symptoms:**
- Tests start but never complete
- Server startup is very slow

**Solutions:**

1. **Increase timeout:**
   ```bash
   # Temporary fix
   PRE_STARTUP_TEST_TIMEOUT=60 ./start_with_testing.sh
   
   # Permanent fix in .env
   echo "PRE_STARTUP_TEST_TIMEOUT=60" >> .env
   ```

2. **Run critical tests only:**
   ```bash
   python run_pre_startup_tests.py --critical-only
   ```

3. **Disable slow tests:**
   ```bash
   export SKIP_NON_CRITICAL_TESTS=true
   python run_pre_startup_tests.py
   ```

4. **Check system resources:**
   ```bash
   # Check CPU and memory
   top -p $(pgrep -f python)
   
   # Check disk I/O
   iostat -x 1 5
   
   # Check network latency
   ping -c 5 your-project.supabase.co
   ```

### 5. Environment-Specific Issues

#### Vercel Deployment Issues

**Error: "Function timeout" or "Build failed"**

**Solutions:**
```bash
# Skip tests in Vercel build
export SKIP_PRE_STARTUP_TESTS=true

# Use shorter timeout
export PRE_STARTUP_TEST_TIMEOUT=10

# Ensure correct base URL
export BASE_URL="https://your-app.vercel.app"
```

#### Docker Container Issues

**Error: "Permission denied" or "Command not found"**

**Solutions:**
```bash
# Ensure scripts are executable
chmod +x docker-start.sh start.sh

# Check user permissions
docker run --rm -it your-image whoami
docker run --rm -it your-image ls -la

# Use absolute paths
docker run --rm -it your-image /app/docker-start.sh
```

#### Local Development Issues

**Error: "Module not found" or "Import error"**

**Solutions:**
```bash
# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Install missing dependencies
pip install -r requirements.txt

# Check virtual environment
which python
pip list | grep -E "(fastapi|supabase)"

# Reinstall pre-startup testing module
pip install -e .
```

## Diagnostic Commands

### System Information

```bash
# Python environment
python --version
pip --version
which python

# Dependencies
pip list | grep -E "(fastapi|supabase|pytest|hypothesis)"

# Environment variables (sanitized)
env | grep -E "(SUPABASE|ENVIRONMENT|SKIP)" | sed 's/=.*/=***/'

# System resources
free -h
df -h
ps aux | grep python
```

### Test-Specific Diagnostics

```bash
# Run individual test components
python -c "
import asyncio
from pre_startup_testing.configuration_validator import ConfigurationValidator
validator = ConfigurationValidator()
result = asyncio.run(validator.validate())
print(f'Config validation: {result.status} - {result.message}')
"

# Test database connectivity
python -c "
import asyncio
from pre_startup_testing.database_connectivity_checker import DatabaseConnectivityChecker
checker = DatabaseConnectivityChecker()
result = asyncio.run(checker.validate())
print(f'Database connectivity: {result.status} - {result.message}')
"

# Test API endpoints
python -c "
import asyncio
from pre_startup_testing.api_endpoint_validator import APIEndpointValidator
validator = APIEndpointValidator('http://localhost:8000')
result = asyncio.run(validator.validate())
print(f'API endpoints: {result.status} - {result.message}')
"
```

### Network Diagnostics

```bash
# Test Supabase connectivity
curl -w "@curl-format.txt" -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Create curl-format.txt
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF

# Test local server
curl -w "@curl-format.txt" http://localhost:8000/health
```

## Recovery Procedures

### Emergency Server Start

If tests are completely broken but you need to start the server:

```bash
# Skip all tests
SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port 8000

# Or use direct uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Reset Test Cache

If tests are giving inconsistent results:

```bash
# Clear test cache
rm -f .pre_startup_test_cache.json

# Clear Python cache
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} +

# Restart with fresh cache
python run_pre_startup_tests.py
```

### Database Recovery

If database tests are failing:

```bash
# Reset database schema
python migrations/apply_migration.py --reset

# Apply all migrations
python apply_migration_direct.py
python apply_vector_functions.py
python apply_user_management_migration.py

# Verify schema
python migrations/verify_schema.py
```

## Getting Help

### Information to Collect

When seeking help, collect this information:

```bash
# Create diagnostic report
cat > diagnostic_report.txt << EOF
=== System Information ===
Python Version: $(python --version)
OS: $(uname -a)
Date: $(date)

=== Environment Variables ===
$(env | grep -E "(SUPABASE|ENVIRONMENT|SKIP)" | sed 's/=.*/=***/')

=== Test Results ===
$(python run_pre_startup_tests.py --json 2>&1)

=== System Status ===
$(curl -s http://localhost:8000/debug 2>&1 || echo "Server not running")

=== Recent Logs ===
$(tail -50 backend.log 2>/dev/null || echo "No log file found")
EOF

echo "Diagnostic report saved to diagnostic_report.txt"
```

### Support Channels

1. **Check documentation**: `PRE_STARTUP_TESTING_GUIDE.md`
2. **Run diagnostics**: Use commands in this guide
3. **Create issue**: Include diagnostic report
4. **Emergency contact**: For critical production issues

### Self-Help Checklist

Before seeking help, verify:

- [ ] Environment variables are set correctly
- [ ] Database is accessible
- [ ] All dependencies are installed
- [ ] Python version is 3.11+
- [ ] No firewall blocking connections
- [ ] Sufficient disk space and memory
- [ ] Recent changes haven't broken configuration
- [ ] Test cache has been cleared
- [ ] Logs have been reviewed

---

*This troubleshooting guide is part of the PPM SaaS MVP Pre-Startup Testing System. For general usage, see `PRE_STARTUP_TESTING_GUIDE.md`.*