# Backend Deployment Guide - Render.com

## Why Render instead of Vercel?

Vercel has limitations with Python/FastAPI deployments that cause 500 errors. Render.com provides better Python support with persistent containers.

## Backend Deployment on Render

### 1. Create New Web Service

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New" → "Web Service"
3. Connect your GitHub repository: `https://github.com/Stefan/ppm-saas`
4. Select the repository and configure:

### 2. Service Configuration

- **Name**: `ppm-saas-backend`
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `backend`

### 3. Build & Start Commands

- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

### 4. Environment Variables

Add these environment variables in Render dashboard:

```
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
PYTHON_VERSION=3.11.0
```

### 5. Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete
3. Note the service URL (e.g., `https://ppm-saas-backend.onrender.com`)

## Frontend Configuration Update

### Update Vercel Environment Variables

1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Update or add:

```
NEXT_PUBLIC_API_URL=https://ppm-saas-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
```

**CRITICAL**: Make sure to copy ONLY the JWT token value, not the variable name!

### Redeploy Frontend

1. Go to Vercel dashboard → Deployments
2. Click "Redeploy" on latest deployment
3. Or push a new commit to trigger automatic deployment

## Testing the Deployment

### 1. Test Backend Endpoints

```bash
curl https://ppm-saas-backend.onrender.com/
curl https://ppm-saas-backend.onrender.com/health
curl https://ppm-saas-backend.onrender.com/debug
```

### 2. Test Frontend Authentication

1. Go to `https://orka-ppm.vercel.app`
2. Try to sign up with a test email
3. Check browser console for any CORS or API errors
4. Verify authentication flow works end-to-end

## Troubleshooting

### Backend Issues

- **Build fails**: Check `requirements.txt` and Python version
- **Start fails**: Verify gunicorn command and port binding
- **500 errors**: Check Render logs for detailed error messages

### Frontend Issues

- **CORS errors**: Verify backend CORS configuration includes frontend URL
- **Auth errors**: Check environment variables are set correctly
- **API errors**: Verify `NEXT_PUBLIC_API_URL` points to Render backend

### Environment Variable Issues

- **Corrupted ANON_KEY**: Must be exactly 208 characters, start with 'eyJ'
- **Variable names in values**: Remove 'NEXT_PUBLIC_SUPABASE_ANON_KEY =' text
- **Spaces/quotes**: Trim all whitespace and quotes from values

## Success Criteria

✅ Backend deployed on Render without 500 errors
✅ Frontend can authenticate users (sign up/sign in)
✅ CORS configured correctly for cross-origin requests
✅ Dashboard loads after successful authentication
✅ No environment variable corruption errors