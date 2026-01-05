#!/bin/bash

# Complete integration test for frontend + backend
echo "🚀 Testing Full Stack Integration"
echo "=================================="

FRONTEND_URL="https://orka-ppm.vercel.app"
BACKEND_URL="https://orka-ppm.onrender.com"

echo ""
echo "🔍 Testing Frontend..."
echo "1. Frontend accessibility..."
curl -s -w "Status: %{http_code}\n" "$FRONTEND_URL" | grep -q "PPM SaaS" && echo "✅ Frontend loads successfully" || echo "❌ Frontend load failed"

echo ""
echo "🔍 Testing Backend..."
echo "2. Backend health check..."
BACKEND_STATUS=$(curl -s "$BACKEND_URL/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$BACKEND_STATUS" = "healthy" ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi

echo ""
echo "🔍 Testing CORS Integration..."
echo "3. CORS headers for frontend..."
CORS_HEADER=$(curl -s -I -H "Origin: $FRONTEND_URL" "$BACKEND_URL/" | grep -i "access-control-allow-origin")
if [[ $CORS_HEADER == *"$FRONTEND_URL"* ]]; then
    echo "✅ CORS configured correctly"
else
    echo "❌ CORS configuration issue"
    echo "CORS Header: $CORS_HEADER"
fi

echo ""
echo "🔍 Testing API Endpoints..."
echo "4. Dashboard endpoint (requires auth)..."
DASHBOARD_RESPONSE=$(curl -s "$BACKEND_URL/dashboard")
if [[ $DASHBOARD_RESPONSE == *"Not authenticated"* ]]; then
    echo "✅ Dashboard endpoint working (authentication required)"
else
    echo "❌ Dashboard endpoint issue"
    echo "Response: $DASHBOARD_RESPONSE"
fi

echo ""
echo "🎯 Integration Test Summary:"
echo "- Frontend: $FRONTEND_URL"
echo "- Backend: $BACKEND_URL"
echo "- Next step: Test authentication flow manually"
echo ""
echo "Manual Test Steps:"
echo "1. Visit: $FRONTEND_URL"
echo "2. Sign up with a test email"
echo "3. Check email for confirmation"
echo "4. Sign in after confirmation"
echo "5. Verify dashboard loads without 'Failed to fetch' errors"