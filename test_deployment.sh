#!/bin/bash

echo "🧪 PPM SaaS Deployment Test Script"
echo "=================================="

# Test local backend
echo ""
echo "1. Testing Local Backend..."
echo "Starting backend on http://localhost:8000"
echo "Run this in a separate terminal:"
echo "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo ""
echo "Then test these endpoints:"
echo "curl http://localhost:8000/"
echo "curl http://localhost:8000/health"
echo "curl http://localhost:8000/debug"
echo ""

# Test Render backend (after deployment)
echo "2. Testing Render Backend..."
echo "Replace YOUR_RENDER_URL with your actual Render URL:"
echo ""
echo "curl https://YOUR_RENDER_URL.onrender.com/"
echo "curl https://YOUR_RENDER_URL.onrender.com/health"
echo "curl https://YOUR_RENDER_URL.onrender.com/debug"
echo ""

# Test frontend
echo "3. Testing Frontend..."
echo "Go to: https://orka-ppm.vercel.app"
echo "- Try to sign up with test email"
echo "- Check browser console (F12) for errors"
echo "- Verify authentication flow works"
echo "- Test dashboard loading"
echo ""

echo "✅ All tests passed? Your deployment is successful!"
echo "❌ Issues found? Check the troubleshooting section in RENDER_DEPLOYMENT_COMPLETE.md"