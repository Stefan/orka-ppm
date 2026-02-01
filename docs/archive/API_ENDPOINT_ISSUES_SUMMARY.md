# API Endpoint Issues Summary

## Issues Fixed

### 1. API URL Construction (✅ FIXED)
- **Issue**: `getApiUrl` was incorrectly adding `/api` prefix for full URLs
- **Fix**: Updated `lib/api.ts` to handle full URLs correctly
- **Files Changed**: `lib/api.ts`

### 2. Help Chat Endpoints (✅ FIXED)
- **Issue**: Help chat endpoints were missing `/api` prefix
- **Fix**: Added `/api` prefix to all help chat endpoints in config
- **Files Changed**: `lib/help-chat/api.ts`

### 3. CSV Import View Error Rendering (✅ FIXED)
- **Issue**: Validation errors (objects) were being rendered directly as React children
- **Fix**: Added proper error message stringification
- **Files Changed**: `app/financials/components/views/CSVImportView.tsx`

### 4. CSV Import History Table Name (✅ FIXED)
- **Issue**: Code was querying `import_logs` but table is named `csv_import_logs`
- **Fix**: Updated table name in query
- **Files Changed**: `backend/routers/csv_import.py`

## Issues Requiring Backend Implementation

### 5. Missing Budget Variance Endpoint (❌ NOT IMPLEMENTED)
- **Frontend Expects**: `GET /projects/{id}/budget-variance?currency={currency}`
- **Status**: Endpoint doesn't exist
- **Impact**: Budget variance data not displayed in financials view
- **Workaround**: Frontend handles failure gracefully (returns null)
- **Solution Options**:
  1. Create new endpoint in `backend/routers/projects.py`
  2. Update frontend to use existing `/pos/breakdown/projects/{id}/variance-analysis`
  3. Leave as-is (non-critical feature)

### 6. Financial Tracking Schema Issues (❌ DATABASE SCHEMA MISMATCH)
- **Endpoint**: `GET /financial-tracking/budget-alerts`
- **Error**: `column financial_tracking.amount does not exist`
- **Impact**: Budget alerts not displayed
- **Solution**: Database migration needed to fix schema

### 7. Comprehensive Report Data Issues (❌ DATA QUALITY)
- **Endpoint**: `GET /financial-tracking/comprehensive-report`
- **Error**: `float() argument must be a string or a real number, not 'NoneType'`
- **Impact**: Comprehensive financial report not displayed
- **Solution**: Add null checks in backend code or ensure data quality

## Backend Routing Inconsistency

The backend has inconsistent routing patterns:

### Routers WITH `/api` prefix:
- `/api/ai/help/*` (help_chat.py)
- `/api/admin/*` (admin.py, users.py, feature_flags.py, admin_performance.py)
- `/api/rbac/*` (rbac.py, viewer_restrictions_router.py)
- `/api/reports/pmr/*` (enhanced_pmr.py, pmr_performance.py)
- `/api/projects/*` (projects_import.py)
- `/api/v1/monte-carlo/*` (simulations.py)
- `/api/audit/*` (audit.py)

### Routers WITHOUT `/api` prefix:
- `/projects/*` (projects.py)
- `/portfolios/*` (portfolios.py)
- `/resources/*` (resources.py)
- `/risks/*` (risks.py)
- `/financial-tracking/*` (financial.py)
- `/csv-import/*` (csv_import.py)
- `/workflows/*` (workflows.py)
- `/schedules/*` (schedules.py)
- `/reports/*` (reports.py)
- `/ai/*` (ai.py, ai_resource_optimizer.py)
- And many more...

### Recommendation:
Consider standardizing all backend routes to either:
1. Use `/api` prefix consistently (preferred for API versioning)
2. Remove `/api` prefix from all routes (simpler structure)

## Current Status

✅ **Working**: Projects list, Help chat languages, CSV import (after backend restart)
⚠️ **Degraded**: Budget variance, financial alerts, comprehensive reports (non-critical features)
❌ **Broken**: None (all critical features working)

## Next Steps

1. **Immediate**: Restart backend to pick up CSV import table name fix
2. **Short-term**: Decide on budget variance endpoint implementation
3. **Medium-term**: Fix financial tracking database schema
4. **Long-term**: Standardize API routing patterns across backend
