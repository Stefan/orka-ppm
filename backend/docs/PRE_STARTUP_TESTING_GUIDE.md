# Pre-Startup Testing System - Developer Guide

## Overview

The Pre-Startup Testing System is a comprehensive validation framework that runs automated tests before the development server starts. It validates API endpoints, database connectivity, authentication flows, and system configuration to catch issues early in the development cycle.

## Quick Start

### Development Mode

```bash
# Standard startup with pre-startup tests
cd backend
./start_with_testing.sh

# Or use the simple startup script
./start.sh

# Skip tests for urgent debugging
SKIP_PRE_STARTUP_TESTS=true ./start_with_testing.sh

# Run tests only (don't start server)
./start_with_testing.sh --test-only
```

### Production Mode

In production environments (Vercel, Render, Heroku), pre-startup tests are automatically integrated into the FastAPI application startup to avoid deployment timeouts.

## Environment Detection

The system automatically detects your environment:

- **Development**: Local development environment
- **Vercel**: Vercel deployment
- **Render**: Render deployment  
- **Heroku**: Heroku deployment
- **Railway**: Railway deployment
- **Fly**: Fly.io deployment
- **Production**: Generic production environment

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SKIP_PRE_STARTUP_TESTS` | Skip all pre-startup tests | `false` | No |
| `PRE_STARTUP_TEST_TIMEOUT` | Test timeout in seconds | `30` | No |
| `BASE_URL` | Base URL for API testing | `http://localhost:8000` | No |
| `ENVIRONMENT` | Force environment detection | Auto-detected | No |

### Required Environment Variables

The following environment variables are required for the system to function:

```bash
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Optional

# AI Features (Optional)
OPENAI_API_KEY=your-openai-key

# JWT Configuration (Optional)
SUPABASE_JWT_SECRET=your-jwt-secret
```

## Startup Scripts

### Available Scripts

1. **`start.sh`** - Basic startup script with pre-startup testing
2. **`start_with_testing.sh`** - Enhanced startup script with full options
3. **`docker-start.sh`** - Docker-optimized startup script
4. **`run_pre_startup_tests.py`** - Standalone test runner

### Script Options

```bash
# Enhanced startup script options
./start_with_testing.sh --help          # Show help
./start_with_testing.sh --skip-tests    # Skip pre-startup tests
./start_with_testing.sh --test-only     # Run tests only, don't start server

# Standalone test runner options
python run_pre_startup_tests.py --help           # Show all options
python run_pre_startup_tests.py                  # Run all tests
python run_pre_startup_tests.py --critical-only  # Run only critical tests
python run_pre_startup_tests.py --json           # JSON output
python run_pre_startup_tests.py --skip-tests     # Skip tests
```

## Test Categories

### Critical Tests (Block Startup)

These tests must pass for the server to start:

- **Database Connection**: Supabase connectivity and authentication
- **Required Environment Variables**: Essential configuration validation
- **Core API Endpoints**: Critical endpoint functionality
- **Authentication System**: JWT validation and user authentication

### Warning Tests (Allow Startup)

These tests generate warnings but allow startup:

- **Optional Features**: Non-critical functionality validation
- **Performance Optimizations**: Cache and optimization checks
- **External Services**: Third-party service availability

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Error**: `Cannot connect to Supabase database`

**Solutions**:
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection manually
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Verify JWT token format
python -c "import jwt; print(jwt.decode('$SUPABASE_ANON_KEY', options={'verify_signature': False}))"
```

#### 2. Missing Database Functions

**Error**: `execute_sql function not found`

**Solutions**:
```bash
# Run database migrations
python apply_migration_direct.py

# Check migration status
python migrations/verify_schema.py

# Create missing functions manually
python apply_vector_functions.py
```

#### 3. Authentication Failures

**Error**: `JWT token validation failed`

**Solutions**:
```bash
# Check JWT secret
echo $SUPABASE_JWT_SECRET

# Verify token format
python -c "
import jwt
import os
token = os.getenv('SUPABASE_ANON_KEY')
print('Token valid:', token.startswith('eyJ') and len(token.split('.')) == 3)
"

# Test with development user
export DEVELOPMENT_MODE=true
```

#### 4. API Endpoint Failures

**Error**: `Endpoint /admin/users returned 500`

**Solutions**:
```bash
# Check server logs
tail -f backend.log

# Test endpoint manually
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" http://localhost:8000/admin/users

# Run specific endpoint tests
python -c "
from pre_startup_testing.api_endpoint_validator import APIEndpointValidator
import asyncio
validator = APIEndpointValidator('http://localhost:8000')
asyncio.run(validator.test_admin_endpoints())
"
```

#### 5. Tests Timeout

**Error**: `Pre-startup tests timed out after 30 seconds`

**Solutions**:
```bash
# Increase timeout
PRE_STARTUP_TEST_TIMEOUT=60 ./start_with_testing.sh

# Run critical tests only
python run_pre_startup_tests.py --critical-only

# Skip tests temporarily
SKIP_PRE_STARTUP_TESTS=true ./start_with_testing.sh
```

### Debug Mode

Enable detailed debugging:

```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=DEBUG

# Run tests with verbose output
python run_pre_startup_tests.py --verbose

# Check system status
curl http://localhost:8000/debug
```

## Development Workflow

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run initial tests
python run_pre_startup_tests.py
```

### 2. Daily Development

```bash
# Start development server
./start_with_testing.sh

# If tests fail, fix issues before continuing
# Check specific test failures:
python run_pre_startup_tests.py --json | jq '.validation_results[] | select(.status == "FAIL")'

# Skip tests for urgent debugging
SKIP_PRE_STARTUP_TESTS=true ./start_with_testing.sh
```

### 3. Before Deployment

```bash
# Run full test suite
python run_pre_startup_tests.py

# Test production configuration
ENVIRONMENT=production python run_pre_startup_tests.py

# Verify all critical endpoints
python run_pre_startup_tests.py --critical-only
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Pre-Startup Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run pre-startup tests
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          cd backend
          python run_pre_startup_tests.py --json
```

### Docker

```dockerfile
# In your Dockerfile
COPY docker-start.sh .
RUN chmod +x docker-start.sh
CMD ["./docker-start.sh"]
```

### Vercel

```json
{
  "builds": [
    {
      "src": "backend/main.py",
      "use": "@vercel/python"
    }
  ],
  "env": {
    "SKIP_PRE_STARTUP_TESTS": "false",
    "BASE_URL": "https://your-app.vercel.app"
  }
}
```

## Performance Considerations

### Test Execution Time

- **Target**: Complete all tests within 30 seconds
- **Critical tests only**: Complete within 15 seconds
- **Individual test timeout**: 5 seconds per test

### Caching

The system caches test results to avoid redundant checks:

```bash
# Clear test cache
rm -f .pre_startup_test_cache.json

# Disable caching
export DISABLE_TEST_CACHING=true
```

### Parallel Execution

Tests run in parallel by default for better performance:

```bash
# Disable parallel execution
export PARALLEL_TESTING=false

# Adjust concurrency
export MAX_TEST_CONCURRENCY=4
```

## Extending the System

### Adding New Validators

1. Create a new validator class in `pre_startup_testing/`
2. Implement the `ValidationInterface`
3. Add to the test runner configuration
4. Update documentation

Example:

```python
from pre_startup_testing.interfaces import ValidationInterface, ValidationResult

class CustomValidator(ValidationInterface):
    async def validate(self) -> ValidationResult:
        # Your validation logic here
        return ValidationResult(
            component="custom",
            test_name="custom_test",
            status=TestStatus.PASS,
            message="Custom validation passed"
        )
```

### Custom Test Configuration

Create a `pre_startup_config.json` file:

```json
{
  "validators": {
    "database": {
      "enabled": true,
      "timeout": 10,
      "critical": true
    },
    "api_endpoints": {
      "enabled": true,
      "endpoints": [
        "/custom/endpoint",
        "/another/endpoint"
      ]
    }
  },
  "reporting": {
    "format": "console",
    "include_warnings": true
  }
}
```

## Support

### Getting Help

1. **Check this documentation** for common issues
2. **Run diagnostic tests**: `python run_pre_startup_tests.py --verbose`
3. **Check system status**: `curl http://localhost:8000/debug`
4. **Review logs**: Check `backend.log` for detailed error information
5. **Create an issue** with test output and system information

### Reporting Issues

When reporting issues, include:

```bash
# System information
python --version
pip list | grep -E "(fastapi|supabase|pytest|hypothesis)"

# Test output
python run_pre_startup_tests.py --json > test_results.json

# Environment variables (sanitized)
env | grep -E "(SUPABASE|ENVIRONMENT|SKIP)" | sed 's/=.*/=***/'

# System status
curl http://localhost:8000/debug > debug_info.json
```

## Best Practices

### Development

1. **Always run tests** before committing code
2. **Fix test failures immediately** - don't skip tests habitually
3. **Keep environment variables up to date**
4. **Use appropriate timeouts** for your environment
5. **Monitor test performance** and optimize slow tests

### Production

1. **Use environment-specific configurations**
2. **Monitor test results** in deployment logs
3. **Set up alerts** for test failures
4. **Keep fallback options** for critical failures
5. **Document environment-specific issues**

### Testing

1. **Write tests for new validators**
2. **Test both success and failure scenarios**
3. **Use property-based testing** for comprehensive coverage
4. **Mock external dependencies** appropriately
5. **Validate test performance** regularly

---

*This guide is part of the PPM SaaS MVP Pre-Startup Testing System. For technical details, see the design document at `.kiro/specs/pre-startup-testing/design.md`.*