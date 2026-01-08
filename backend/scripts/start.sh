#!/bin/bash

# Pre-startup testing system integration
# Detect environment (development vs production)
if [ -z "$VERCEL" ] && [ -z "$RENDER" ] && [ -z "$HEROKU" ]; then
    ENVIRONMENT="development"
    echo "🔧 Environment: Development"
else
    ENVIRONMENT="production"
    echo "🚀 Environment: Production"
fi

# Check if pre-startup tests should be skipped
if [ "$SKIP_PRE_STARTUP_TESTS" = "true" ]; then
    echo "⚠️  Skipping pre-startup tests (SKIP_PRE_STARTUP_TESTS=true)"
elif [ "$ENVIRONMENT" = "development" ]; then
    echo "🧪 Running pre-startup tests..."
    
    # Run pre-startup tests with timeout
    if timeout 30s python run_pre_startup_tests.py --critical-only; then
        echo "✅ Pre-startup tests passed"
    else
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "⚠️  Pre-startup tests timed out after 30 seconds"
            echo "⚠️  Continuing with server startup..."
        else
            echo "❌ Pre-startup tests failed with exit code $exit_code"
            echo "❌ Server startup aborted"
            exit $exit_code
        fi
    fi
else
    echo "🚀 Production mode: Pre-startup tests integrated into application startup"
fi

# Start the server
echo "🚀 Starting FastAPI server..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}