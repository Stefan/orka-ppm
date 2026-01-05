#!/bin/bash

echo "🧪 Render Deployment Test Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "1. Testing Local Backend..."
echo "=========================="

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo -e "${RED}❌ Error: backend/main.py not found. Run this script from the project root.${NC}"
    exit 1
fi

echo "Starting local backend test..."
echo "Run this command in a separate terminal:"
echo -e "${YELLOW}cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload${NC}"
echo ""
echo "Then test these endpoints:"
echo "curl http://localhost:8000/"
echo "curl http://localhost:8000/health"
echo "curl http://localhost:8000/debug"
echo ""

echo "2. Testing Render Backend..."
echo "============================"

RENDER_URL="https://orka-ppm.onrender.com"

echo "Testing Render deployment at: $RENDER_URL"

# Test root endpoint
echo -n "Testing root endpoint... "
if curl -s -f "$RENDER_URL/" > /dev/null; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
    echo "Check Render logs for deployment issues"
fi

# Test health endpoint
echo -n "Testing health endpoint... "
if curl -s -f "$RENDER_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test debug endpoint
echo -n "Testing debug endpoint... "
if curl -s -f "$RENDER_URL/debug" > /dev/null; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

echo ""
echo "3. Frontend Integration Test..."
echo "==============================="

echo "Go to: https://orka-ppm.vercel.app"
echo "- Try to sign up with test email"
echo "- Check browser console (F12) for errors"
echo "- Verify authentication flow works"
echo "- Test dashboard loading"

echo ""
echo "4. Environment Variables Check..."
echo "================================="

echo "Verify these are set in Vercel:"
echo "NEXT_PUBLIC_API_URL=https://orka-ppm.onrender.com"
echo "NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=[JWT_TOKEN]"

echo ""
echo "5. Render Configuration Check..."
echo "================================"

echo "Verify these settings in Render dashboard:"
echo "Environment: Python 3"
echo "Build Command: pip install -r requirements.txt"
echo "Start Command: uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo "Root Directory: backend"

echo ""
echo -e "${GREEN}🎉 Test completed! Check results above.${NC}"