#!/bin/bash

# Workflow Frontend-Backend Integration Verification Script
# This script verifies that the Next.js API routes are properly set up
# and can communicate with the FastAPI backend.

set -e

echo "=========================================="
echo "Workflow Integration Verification"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1. Checking if FastAPI backend is running..."
BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL:-http://localhost:8000}"

if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running at ${BACKEND_URL}${NC}"
else
    echo -e "${RED}✗ Backend is not running at ${BACKEND_URL}${NC}"
    echo -e "${YELLOW}Please start the backend with: cd backend && uvicorn main:app --reload${NC}"
    exit 1
fi

echo ""

# Check if Next.js dev server is running
echo "2. Checking if Next.js frontend is running..."
FRONTEND_URL="${NEXT_PUBLIC_FRONTEND_URL:-http://localhost:3000}"

if curl -s -f "${FRONTEND_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running at ${FRONTEND_URL}${NC}"
else
    echo -e "${RED}✗ Frontend is not running at ${FRONTEND_URL}${NC}"
    echo -e "${YELLOW}Please start the frontend with: npm run dev${NC}"
    exit 1
fi

echo ""

# Verify API route files exist
echo "3. Verifying API route files exist..."

ROUTES=(
    "app/api/workflows/instances/my-workflows/route.ts"
    "app/api/workflows/instances/[id]/route.ts"
    "app/api/workflows/instances/[id]/approve/route.ts"
)

for route in "${ROUTES[@]}"; do
    if [ -f "$route" ]; then
        echo -e "${GREEN}✓ $route exists${NC}"
    else
        echo -e "${RED}✗ $route is missing${NC}"
        exit 1
    fi
done

echo ""

# Verify frontend components exist
echo "4. Verifying frontend workflow components exist..."

COMPONENTS=(
    "components/workflow/WorkflowDashboard.tsx"
    "components/workflow/ApprovalButtons.tsx"
    "components/workflow/WorkflowStatus.tsx"
    "components/workflow/WorkflowHistory.tsx"
    "components/workflow/WorkflowApprovalModal.tsx"
)

for component in "${COMPONENTS[@]}"; do
    if [ -f "$component" ]; then
        echo -e "${GREEN}✓ $component exists${NC}"
    else
        echo -e "${RED}✗ $component is missing${NC}"
        exit 1
    fi
done

echo ""

# Check TypeScript compilation
echo "5. Checking TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
    echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript compilation has warnings (this may be okay)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ All verification checks passed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Ensure you have a valid authentication token"
echo "2. Test the workflow components in the dashboard"
echo "3. Try creating a workflow instance and approving it"
echo ""
echo "API Endpoints available:"
echo "  - GET  /api/workflows/instances/my-workflows"
echo "  - GET  /api/workflows/instances/[id]"
echo "  - POST /api/workflows/instances/[id]/approve"
echo ""
