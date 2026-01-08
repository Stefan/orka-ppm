# CI/CD Integration for User Synchronization

## Overview

This document provides examples for integrating user synchronization health checks into various CI/CD pipelines. The health checks ensure that deployments are successful and the user synchronization system is working correctly.

## Health Check Script

The `deployment_health_check.py` script provides comprehensive post-deployment verification:

```bash
# Basic health check
python deployment_health_check.py --url https://your-api.com

# Verbose health check with JSON output
python deployment_health_check.py --url https://your-api.com --verbose --json

# Quick check without waiting for startup
python deployment_health_check.py --url https://your-api.com --no-wait
```

## GitHub Actions

### Example Workflow

```yaml
name: Deploy and Health Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    
    - name: Deploy to staging
      run: |
        # Your deployment commands here
        # e.g., vercel deploy, docker deploy, etc.
        echo "Deploying to staging..."
    
    - name: Wait for deployment
      run: sleep 30
    
    - name: Run health checks
      run: |
        cd backend
        python deployment_health_check.py \
          --url ${{ secrets.STAGING_API_URL }} \
          --timeout 60 \
          --verbose
    
    - name: Run user sync verification
      run: |
        cd backend
        # Set environment variables for CLI tools
        export SUPABASE_URL=${{ secrets.SUPABASE_URL }}
        export SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        
        # Check sync status
        python user_sync_cli.py status --json > sync_status.json
        
        # Verify no missing profiles
        missing=$(python -c "import json; data=json.load(open('sync_status.json')); print(data.get('missing_profiles', 0))")
        if [ "$missing" != "0" ]; then
          echo "Warning: $missing users need synchronization"
          exit 1
        fi
    
    - name: Deploy to production
      if: github.ref == 'refs/heads/main'
      run: |
        # Production deployment commands
        echo "Deploying to production..."
    
    - name: Production health check
      if: github.ref == 'refs/heads/main'
      run: |
        cd backend
        python deployment_health_check.py \
          --url ${{ secrets.PRODUCTION_API_URL }} \
          --timeout 120 \
          --report
```

### Secrets Configuration

Configure these secrets in your GitHub repository:

- `STAGING_API_URL`: Your staging API URL
- `PRODUCTION_API_URL`: Your production API URL
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Vercel Integration

### vercel.json Configuration

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "functions": {
    "backend/main.py": {
      "runtime": "@vercel/python"
    }
  },
  "env": {
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key",
    "DISABLE_BOOTSTRAP": "true"
  }
}
```

### Post-Deploy Hook

Create a `scripts/post-deploy.sh` script:

```bash
#!/bin/bash

# Post-deployment verification script for Vercel

set -e

API_URL=${1:-$VERCEL_URL}
if [ -z "$API_URL" ]; then
    echo "Error: API URL not provided"
    exit 1
fi

# Ensure URL has protocol
if [[ ! $API_URL =~ ^https?:// ]]; then
    API_URL="https://$API_URL"
fi

echo "Running post-deployment health checks for: $API_URL"

# Run health checks
cd backend
python deployment_health_check.py \
    --url "$API_URL" \
    --timeout 60 \
    --verbose

echo "✅ Post-deployment verification completed successfully"
```

## Docker Integration

### Dockerfile Health Check

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# Copy application code
COPY backend/ .

# Make scripts executable
RUN chmod +x deployment_health_check.py
RUN chmod +x start_with_testing.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python deployment_health_check.py --url http://localhost:8000 --no-wait || exit 1

# Start application
CMD ["./start_with_testing.sh"]
```

### Docker Compose with Health Checks

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - DISABLE_BOOTSTRAP=true
    healthcheck:
      test: ["CMD", "python", "deployment_health_check.py", "--url", "http://localhost:8000", "--no-wait"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    depends_on:
      - db

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=testdb
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser -d testdb"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Render Integration

### render.yaml

```yaml
services:
  - type: web
    name: ppm-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "bash start_with_testing.sh"
    healthCheckPath: /health
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: DISABLE_BOOTSTRAP
        value: "true"
      - key: ENVIRONMENT
        value: "production"

  - type: job
    name: post-deploy-check
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "python deployment_health_check.py --url $RENDER_EXTERNAL_URL --report"
    trigger: deploy
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

## Railway Integration

### railway.json

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "bash start_with_testing.sh",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### Post-Deploy Script

```bash
#!/bin/bash
# railway-post-deploy.sh

# Get the Railway service URL
SERVICE_URL="https://$RAILWAY_STATIC_URL"

echo "Running Railway post-deployment checks..."

# Run health checks
python deployment_health_check.py \
    --url "$SERVICE_URL" \
    --timeout 90 \
    --verbose

# Check user synchronization
export SUPABASE_URL=$SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

python user_sync_cli.py status

echo "✅ Railway deployment verification completed"
```

## Monitoring Integration

### Uptime Monitoring

Configure your monitoring service (Pingdom, UptimeRobot, etc.) to check:

```
Primary Health Check:
URL: https://your-api.com/health
Method: GET
Expected Status: 200
Expected Content: "healthy"
Interval: 1 minute

User Sync Health Check:
URL: https://your-api.com/health/user-sync
Method: GET
Expected Status: 200
Expected Content: "missing_profiles": 0
Interval: 5 minutes

Comprehensive Health Check:
URL: https://your-api.com/health/comprehensive
Method: GET
Expected Status: 200
Expected Content: "status": "healthy"
Interval: 5 minutes
```

### Alerting Rules

Set up alerts for:

1. **Critical**: Basic health check fails
2. **Warning**: Missing profiles > 0
3. **Warning**: Sync percentage < 100%
4. **Critical**: Comprehensive health check fails

### Example Monitoring Script

```bash
#!/bin/bash
# monitoring-check.sh

API_URL="https://your-api.com"

# Check basic health
if ! curl -f "$API_URL/health" > /dev/null 2>&1; then
    echo "CRITICAL: Basic health check failed"
    # Send alert (e.g., to Slack, email, etc.)
    exit 2
fi

# Check user sync
SYNC_RESPONSE=$(curl -s "$API_URL/health/user-sync")
MISSING_PROFILES=$(echo "$SYNC_RESPONSE" | jq -r '.missing_profiles // 0')

if [ "$MISSING_PROFILES" -gt 0 ]; then
    echo "WARNING: $MISSING_PROFILES users need synchronization"
    # Send warning alert
    exit 1
fi

echo "OK: All health checks passed"
exit 0
```

## Troubleshooting CI/CD Issues

### Common Issues

1. **Health checks timeout during deployment**:
   - Increase timeout values
   - Add startup wait time
   - Check application startup logs

2. **User sync checks fail**:
   - Verify environment variables are set
   - Check database connectivity
   - Run manual sync if needed

3. **Intermittent health check failures**:
   - Add retry logic
   - Increase health check intervals
   - Check for resource constraints

### Debug Commands

```bash
# Test health check locally
python deployment_health_check.py --url http://localhost:8000 --verbose

# Check environment variables
env | grep SUPABASE

# Test database connectivity
python -c "from config.database import supabase; print('Connected' if supabase else 'Failed')"

# Manual sync check
python user_sync_cli.py status --verbose
```

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**Related Documentation**: [Deployment Procedures](./DEPLOYMENT_PROCEDURES.md), [User Synchronization](./USER_SYNCHRONIZATION.md)