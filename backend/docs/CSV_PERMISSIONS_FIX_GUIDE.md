# CSV Import Permissions Fix Guide

## Problem
You're getting the error: "Insufficient permissions. Required: financial_create" when trying to upload CSV files.

## Root Cause
Your current user account doesn't have the `financial_create` permission, which is required for CSV import operations.

## Solution Options

### Option 1: Check Current Permissions (Recommended)
1. **Check your current permissions**:
   ```
   GET /debug/user-permissions
   ```
   This will show you:
   - Your current roles
   - All permissions you have
   - Whether you can upload CSV files

### Option 2: Assign Admin Role (Quick Fix)
1. **Assign admin role to your current user**:
   ```
   POST /debug/assign-role
   Body: {
     "role": "admin",
     "organization_id": null
   }
   ```

### Option 3: Assign Specific Role
Choose one of these roles that have `financial_create` permission:
- `admin` - Full system access
- `portfolio_manager` - Portfolio and financial management
- `project_manager` - Project and financial management

**API Call**:
```
POST /debug/assign-role
Body: {
  "role": "portfolio_manager",
  "organization_id": "00000000-0000-0000-0000-000000000001"
}
```

### Option 4: Create Test Organization
If you need a test organization:
```
POST /debug/create-test-organization
```

## Step-by-Step Fix Process

### Step 1: Check Current Status
```bash
curl -X GET "http://localhost:8000/debug/user-permissions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 2: Assign Admin Role
```bash
curl -X POST "http://localhost:8000/debug/assign-role" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"role": "admin"}'
```

### Step 3: Verify Permissions
```bash
curl -X GET "http://localhost:8000/debug/user-permissions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 4: Test CSV Upload
```bash
curl -X POST "http://localhost:8000/csv-import/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@your_file.csv" \
  -F "import_type=commitments" \
  -F "organization_id=DEFAULT"
```

## Roles and Permissions Matrix

| Role | financial_create | financial_read | Can Upload CSV |
|------|------------------|----------------|----------------|
| admin | ✅ | ✅ | ✅ |
| portfolio_manager | ✅ | ✅ | ✅ |
| project_manager | ✅ | ✅ | ✅ |
| resource_manager | ❌ | ✅ | ❌ |
| team_member | ❌ | ❌ | ❌ |
| viewer | ❌ | ❌ | ❌ |

## Alternative: Manual Database Fix

If the API endpoints don't work, you can fix this directly in the database:

### SQL Commands (Run in Supabase SQL Editor)

1. **Check current user roles**:
```sql
SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID';
```

2. **Assign admin role**:
```sql
INSERT INTO user_roles (user_id, role, organization_id) 
VALUES ('YOUR_USER_ID', 'admin', NULL)
ON CONFLICT (user_id, organization_id) 
DO UPDATE SET role = 'admin', updated_at = NOW();
```

3. **Create organizations table if missing**:
```sql
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

4. **Create user_roles table if missing**:
```sql
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);
```

## Testing Your Fix

After applying the fix, test with a small CSV file:

### Sample Commitments CSV
```csv
PO Number,PO Date,Vendor,Project,WBS Element,Total Amount,Currency
PO-001,2024-01-15,Vendor A,Project Alpha,WBS-001,10000,USD
PO-002,2024-01-16,Vendor B,Project Beta,WBS-002,15000,EUR
```

### Sample Actuals CSV
```csv
FI Doc No,Posting Date,Vendor,Project Nr,WBS,Invoice Amount,Currency
FI-001,2024-01-20,Vendor A,Project Alpha,WBS-001,5000,USD
FI-002,2024-01-21,Vendor B,Project Beta,WBS-002,7500,EUR
```

## Troubleshooting

### Common Issues:

1. **"User not found"** - Make sure you're authenticated
2. **"Invalid role"** - Use one of: admin, portfolio_manager, project_manager, resource_manager, team_member, viewer
3. **"Table doesn't exist"** - Run the table creation SQL commands above
4. **"Still no permissions"** - Check that the role assignment was successful with `/debug/user-permissions`

### Debug Information:
- Check browser network tab for detailed error messages
- Use `/debug/user-permissions` to verify your current permissions
- Ensure your JWT token is valid and not expired

## Contact Support
If you continue to have issues, provide this information:
- Your user ID
- Current roles (from `/debug/user-permissions`)
- Exact error message
- Steps you've tried