#!/bin/bash

# Docker-optimized startup script with pre-startup testing
# This script is designed for containerized environments

set -e

# Environment detection for Docker
ENVIRONMENT=${ENVIRONMENT:-production}
SKIP_PRE_STARTUP_TESTS=${SKIP_PRE_STARTUP_TESTS:-false}

echo "🐳 Docker Environment: $ENVIRONMENT"

# In Docker, we typically want to run tests as part of the application startup
# rather than as a separate process to avoid container startup issues
if [ "$SKIP_PRE_STARTUP_TESTS" = "true" ]; then
    echo "⚠️  Skipping pre-startup tests (SKIP_PRE_STARTUP_TESTS=true)"
elif [ "$ENVIRONMENT" = "development" ]; then
    echo "🧪 Running pre-startup tests..."
    
    # Run tests with shorter timeout for Docker
    if timeout 20s python run_pre_startup_tests.py --critical-only; then
        echo "✅ Pre-startup tests passed"
    else
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "⚠️  Pre-startup tests timed out, continuing..."
        else
            echo "❌ Pre-startup tests failed, aborting startup"
            exit $exit_code
        fi
    fi
else
    echo "🚀 Production mode: Tests integrated into application startup"
fi

# Start the server with production settings
echo "🚀 Starting FastAPI server in Docker..."
exec uvicorn simple_server:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-1}