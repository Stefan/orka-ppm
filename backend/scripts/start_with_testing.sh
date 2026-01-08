#!/bin/bash

# Enhanced startup script with pre-startup testing integration
# This script provides comprehensive environment detection and startup options

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to detect environment
detect_environment() {
    if [ -n "$VERCEL" ]; then
        echo "vercel"
    elif [ -n "$RENDER" ]; then
        echo "render"
    elif [ -n "$HEROKU" ]; then
        echo "heroku"
    elif [ -n "$RAILWAY" ]; then
        echo "railway"
    elif [ -n "$FLY_APP_NAME" ]; then
        echo "fly"
    elif [ "$NODE_ENV" = "production" ] || [ "$ENVIRONMENT" = "production" ]; then
        echo "production"
    else
        echo "development"
    fi
}

# Function to check if pre-startup tests should be skipped
should_skip_tests() {
    if [ "$SKIP_PRE_STARTUP_TESTS" = "true" ]; then
        return 0  # Skip tests
    fi
    
    if [ "$1" = "vercel" ] || [ "$1" = "heroku" ]; then
        # Skip standalone tests for platforms with tight startup timeouts
        return 0
    fi
    
    return 1  # Don't skip tests
}

# Function to verify user synchronization migration
verify_user_sync_migration() {
    local environment=$1
    
    print_status $BLUE "🔍 Verifying user synchronization migration..."
    
    # Check if migration verification script exists
    if [ ! -f "user_management_migration_cli.py" ]; then
        print_status $YELLOW "⚠️  Migration verification script not found, skipping verification"
        return 0
    fi
    
    # Run migration verification
    if python user_management_migration_cli.py verify > /dev/null 2>&1; then
        print_status $GREEN "✅ User synchronization migration verified"
        return 0
    else
        print_status $YELLOW "⚠️  Migration verification failed or not applied"
        
        if [ "$environment" = "development" ]; then
            print_status $BLUE "🔧 Attempting to apply migration in development mode..."
            if python apply_user_management_migration_direct.py > /dev/null 2>&1; then
                print_status $GREEN "✅ Migration applied successfully"
                return 0
            else
                print_status $YELLOW "⚠️  Migration application failed, continuing anyway"
                return 0
            fi
        else
            print_status $YELLOW "⚠️  Production mode: Migration should be applied manually"
            return 0
        fi
    fi
}

# Function to check user synchronization status
check_user_sync_status() {
    print_status $BLUE "👥 Checking user synchronization status..."
    
    # Check if sync CLI exists
    if [ ! -f "user_sync_cli.py" ]; then
        print_status $YELLOW "⚠️  User sync CLI not found, skipping sync check"
        return 0
    fi
    
    # Get sync status
    if python user_sync_cli.py status --json > /tmp/sync_status.json 2>/dev/null; then
        # Parse sync status
        missing_profiles=$(python -c "import json; data=json.load(open('/tmp/sync_status.json')); print(data.get('missing_profiles', 0))" 2>/dev/null || echo "0")
        
        if [ "$missing_profiles" = "0" ]; then
            print_status $GREEN "✅ All users synchronized"
        else
            print_status $YELLOW "⚠️  $missing_profiles users need synchronization"
            
            # Auto-sync in development mode
            if [ "$1" = "development" ] && [ "$missing_profiles" -lt 10 ]; then
                print_status $BLUE "🔄 Auto-synchronizing users in development mode..."
                if python user_sync_cli.py sync > /dev/null 2>&1; then
                    print_status $GREEN "✅ User synchronization completed"
                else
                    print_status $YELLOW "⚠️  User synchronization failed, continuing anyway"
                fi
            fi
        fi
        
        # Clean up temp file
        rm -f /tmp/sync_status.json
    else
        print_status $YELLOW "⚠️  Could not check sync status, continuing anyway"
    fi
    
    return 0
}

# Function to run pre-startup tests
run_pre_startup_tests() {
    local environment=$1
    local test_timeout=${PRE_STARTUP_TEST_TIMEOUT:-30}
    
    print_status $BLUE "🧪 Running pre-startup tests (timeout: ${test_timeout}s)..."
    
    # Check if the pre-startup testing module exists
    if [ ! -f "run_pre_startup_tests.py" ]; then
        print_status $YELLOW "⚠️  Pre-startup test script not found, skipping tests"
        return 0
    fi
    
    # Run tests with timeout
    if timeout "${test_timeout}s" python run_pre_startup_tests.py --critical-only; then
        print_status $GREEN "✅ Pre-startup tests passed"
        return 0
    else
        local exit_code=$?
        
        if [ $exit_code -eq 124 ]; then
            print_status $YELLOW "⚠️  Pre-startup tests timed out after ${test_timeout} seconds"
            print_status $YELLOW "⚠️  Continuing with server startup..."
            return 0
        else
            print_status $RED "❌ Pre-startup tests failed with exit code $exit_code"
            
            if [ "$environment" = "development" ]; then
                print_status $RED "❌ Server startup aborted"
                print_status $YELLOW "💡 To skip tests and start anyway, run: SKIP_PRE_STARTUP_TESTS=true $0"
                return $exit_code
            else
                print_status $YELLOW "⚠️  Production mode: Continuing despite test failures"
                return 0
            fi
        fi
    fi
}

# Function to start the server
start_server() {
    local host=${HOST:-0.0.0.0}
    local port=${PORT:-8000}
    local workers=${WORKERS:-1}
    
    print_status $GREEN "🚀 Starting FastAPI server..."
    print_status $BLUE "   Host: $host"
    print_status $BLUE "   Port: $port"
    print_status $BLUE "   Workers: $workers"
    
    # Use different startup commands based on environment
    if [ "$workers" -gt 1 ]; then
        exec uvicorn main:app --host "$host" --port "$port" --workers "$workers"
    else
        exec uvicorn main:app --host "$host" --port "$port"
    fi
}

# Main execution
main() {
    print_status $BLUE "🔧 PPM SaaS Backend Startup Script"
    print_status $BLUE "=================================="
    
    # Detect environment
    local environment=$(detect_environment)
    print_status $BLUE "🌍 Environment: $environment"
    
    # Set environment variable for the application
    export DETECTED_ENVIRONMENT="$environment"
    
    # Verify user synchronization migration
    verify_user_sync_migration "$environment"
    
    # Check user synchronization status
    check_user_sync_status "$environment"
    
    # Check if we should run pre-startup tests
    if should_skip_tests "$environment"; then
        print_status $YELLOW "⚠️  Skipping pre-startup tests"
        print_status $YELLOW "   Reason: Environment '$environment' or SKIP_PRE_STARTUP_TESTS=true"
    else
        # Run pre-startup tests
        if ! run_pre_startup_tests "$environment"; then
            exit $?
        fi
    fi
    
    # Start the server
    start_server
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "PPM SaaS Backend Startup Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --skip-tests        Skip pre-startup tests"
        echo "  --test-only         Run only pre-startup tests, don't start server"
        echo "  --sync-only         Run only user synchronization check"
        echo ""
        echo "Environment Variables:"
        echo "  SKIP_PRE_STARTUP_TESTS    Set to 'true' to skip tests"
        echo "  PRE_STARTUP_TEST_TIMEOUT  Test timeout in seconds (default: 30)"
        echo "  HOST                      Server host (default: 0.0.0.0)"
        echo "  PORT                      Server port (default: 8000)"
        echo "  WORKERS                   Number of workers (default: 1)"
        echo ""
        exit 0
        ;;
    --skip-tests)
        export SKIP_PRE_STARTUP_TESTS=true
        main
        ;;
    --test-only)
        environment=$(detect_environment)
        print_status $BLUE "🧪 Running pre-startup tests only..."
        run_pre_startup_tests "$environment"
        exit $?
        ;;
    --sync-only)
        environment=$(detect_environment)
        print_status $BLUE "👥 Running user synchronization check only..."
        verify_user_sync_migration "$environment"
        check_user_sync_status "$environment"
        exit $?
        ;;
    *)
        main
        ;;
esac