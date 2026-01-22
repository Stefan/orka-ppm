#!/bin/bash

# Development Backend Startup Script
# Skips pre-startup tests for faster development

echo "🚀 Starting Backend in Development Mode..."
echo ""
echo "⏭️  Skipping pre-startup tests for faster startup."
echo "💡 Use 'python3 -m uvicorn main:app --reload' for full validation."
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set environment variable to skip pre-startup tests
export SKIP_PRE_STARTUP_TESTS=true

# Start the backend server
python3 -m uvicorn main:app --reload --port 8000

