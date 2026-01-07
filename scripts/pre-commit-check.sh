#!/bin/bash

# Pre-commit validation script
# Run this before committing to catch issues early

set -e

echo "🔍 Running pre-commit validation..."

# Change to frontend directory if not already there
if [ ! -f "package.json" ]; then
    cd frontend
fi

echo "📁 Current directory: $(pwd)"

# Run syntax check
echo "🔧 Running syntax validation..."
npm run test:syntax

# Run TypeScript check
echo "📝 Running TypeScript check..."
npm run type-check

# Run ESLint
echo "🔍 Running ESLint..."
npm run lint

# Try to build (quick check)
echo "🏗️  Running build check..."
npm run build

echo "✅ All pre-commit checks passed!"
echo "🚀 Ready to commit!"