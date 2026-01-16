#!/bin/bash

# Vercel Environment Variables Setup Script
# This script helps you set up environment variables in Vercel

set -e

echo "🚀 Vercel Environment Variables Setup"
echo "======================================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

echo "✅ Vercel CLI is installed"
echo ""

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel..."
    vercel login
fi

echo "✅ Logged in to Vercel"
echo ""

# Link project if not already linked
if [ ! -f ".vercel/project.json" ]; then
    echo "🔗 Linking project to Vercel..."
    vercel link
    echo ""
fi

echo "✅ Project linked"
echo ""

# Read environment variables from .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    exit 1
fi

echo "📋 Reading environment variables from .env.production..."
echo ""

# Extract variables
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.production | cut -d '=' -f2)
SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.production | cut -d '=' -f2)
API_URL=$(grep NEXT_PUBLIC_API_URL .env.production | cut -d '=' -f2)
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.production | cut -d '=' -f2)

echo "Found variables:"
echo "  - NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:30}..."
echo "  - NEXT_PUBLIC_API_URL: $API_URL"
echo "  - SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:0:30}..."
echo ""

# Ask for confirmation
read -p "Do you want to add these variables to Vercel? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "📤 Adding environment variables to Vercel..."
echo ""

# Add variables to Vercel
# Note: This will prompt for each variable if it doesn't exist

echo "Adding NEXT_PUBLIC_SUPABASE_URL..."
echo "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development || echo "Variable may already exist"

echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..."
echo "$SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development || echo "Variable may already exist"

echo "Adding NEXT_PUBLIC_API_URL..."
echo "$API_URL" | vercel env add NEXT_PUBLIC_API_URL production preview development || echo "Variable may already exist"

echo "Adding SUPABASE_SERVICE_ROLE_KEY (production only)..."
echo "$SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production || echo "Variable may already exist"

echo ""
echo "✅ Environment variables added!"
echo ""
echo "📋 Current environment variables:"
vercel env ls

echo ""
echo "🚀 Next steps:"
echo "  1. Redeploy your application:"
echo "     vercel --prod"
echo ""
echo "  2. Or redeploy via Vercel dashboard:"
echo "     https://vercel.com/orka/orka-ppm/deployments"
echo ""
echo "✅ Done!"
