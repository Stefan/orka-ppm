#!/bin/bash

echo "🧪 Testing Backend Locally"
echo "=========================="

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Backend is not running on localhost:8000"
    echo ""
    echo "To start the backend:"
    echo "  cd backend"
    echo "  source venv/bin/activate  # or source .venv/bin/activate"
    echo "  SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port 8000"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Test health endpoint
echo "Testing /health endpoint..."
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""

# Test admin users endpoint (without auth - will fail but shows if endpoint exists)
echo "Testing /api/admin/users-with-roles endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8000/api/admin/users-with-roles)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Endpoint not found (404)"
    echo "Response: $BODY"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "✅ Endpoint exists but requires authentication (expected)"
    echo "HTTP Code: $HTTP_CODE"
else
    echo "Response (HTTP $HTTP_CODE):"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
fi

echo ""
echo "=========================="
echo "Test completed"
