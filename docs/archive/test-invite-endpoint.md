# Testing the Invite User Endpoint

## Issue
The frontend is getting a "Not Found" (404) error when calling `/api/admin/users/invite`.

## Root Cause
The backend server needs to be restarted to register the new `/invite` endpoint.

## Solution
Restart the backend server to load the new endpoint.

## Steps to Fix

### 1. Stop the Backend Server
If the backend is running, stop it with `Ctrl+C` or:
```bash
pkill -f "uvicorn main:app"
```

### 2. Start the Backend Server
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Verify the Endpoint is Registered
Once the server starts, you should see the endpoint in the FastAPI docs:
- Open: http://localhost:8000/docs
- Look for: `POST /api/admin/users/invite`
- It should be listed under the "users" tag

### 4. Test the Endpoint

#### Using the FastAPI Docs UI:
1. Go to http://localhost:8000/docs
2. Find `POST /api/admin/users/invite`
3. Click "Try it out"
4. Enter test data:
   ```json
   {
     "email": "test@example.com",
     "role": "user"
   }
   ```
5. Click "Execute"

#### Using curl:
```bash
curl -X POST "http://localhost:8000/api/admin/users/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "email": "test@example.com",
    "role": "user"
  }'
```

#### Using the Frontend:
1. Make sure the frontend is running: `npm run dev`
2. Navigate to: http://localhost:3000/admin/users
3. Click "Invite User" button
4. Enter email and select role
5. Click "Send Invite"

## Expected Response

### Success (201 Created):
```json
{
  "id": "uuid-here",
  "email": "test@example.com",
  "role": "user",
  "status": "active",
  "is_active": true,
  "last_login": null,
  "created_at": "2024-01-24T12:00:00Z",
  "updated_at": null,
  "deactivated_at": null,
  "deactivated_by": null,
  "deactivation_reason": null,
  "sso_provider": null
}
```

### Error (400 Bad Request) - User Already Exists:
```json
{
  "detail": "User with this email already exists"
}
```

### Error (403 Forbidden) - Not Admin:
```json
{
  "detail": "Insufficient permissions"
}
```

## Verification Checklist

- [ ] Backend server restarted
- [ ] Endpoint visible in FastAPI docs at /docs
- [ ] Can see `POST /api/admin/users/invite` in the API documentation
- [ ] Frontend can successfully call the endpoint
- [ ] User is created in the database
- [ ] Success message appears in the UI
- [ ] New user appears in the users list

## Troubleshooting

### If endpoint still not found after restart:
1. Check backend logs for any import errors
2. Verify `backend/routers/users.py` has no syntax errors:
   ```bash
   cd backend
   python -m py_compile routers/users.py
   ```
3. Verify the router is included in `main.py`:
   ```bash
   grep "users_router" backend/main.py
   ```

### If getting authentication errors:
1. Make sure you're logged in as an admin user
2. Check that the session token is being sent in the Authorization header
3. Verify the token hasn't expired

### If getting database errors:
1. Check that Supabase is configured correctly
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in `.env`
3. Check that the `user_profiles` table exists

## Environment Variables Required

Make sure these are set in `backend/.env.local`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

## Notes

- The endpoint requires admin authentication (`require_admin()`)
- Email addresses are automatically converted to lowercase
- Temporary passwords are generated automatically
- Users are created with `email_confirm: True` (auto-confirmed)
- All actions are logged in the audit trail
