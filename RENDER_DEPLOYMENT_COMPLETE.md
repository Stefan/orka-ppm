# Complete Backend Migration: Vercel → Render.com

## 🎯 **Migration Overview**

This guide migrates your FastAPI backend from Vercel (which has Python limitations) to Render.com (better Python support, free tier available).

## 📋 **Prerequisites**

- ✅ GitHub repository: `https://github.com/Stefan/ppm-saas`
- ✅ Backend code in `/backend` directory
- ✅ Frontend deployed on Vercel: `https://orka-ppm.vercel.app`

## 🚀 **Step-by-Step Render Deployment**

### **Step 1: Create Render Account**

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with your GitHub account (recommended for easy repo access)
4. Verify your email if prompted

### **Step 2: Create New Web Service**

1. In Render dashboard, click **"New"** → **"Web Service"**
2. Click **"Connect a repository"**
3. Authorize Render to access your GitHub repositories
4. Select repository: **`Stefan/ppm-saas`**
5. Click **"Connect"**

### **Step 3: Configure Service Settings**

Fill in these **EXACT** settings:

```
Name: ppm-saas-backend
Environment: Python 3
Region: Oregon (US West) [or closest to your users]
Branch: main
Root Directory: backend
```

### **Step 4: Build & Start Commands**

```
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Alternative Start Command** (if you prefer gunicorn):
```
Start Command: gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

### **Step 5: Environment Variables**

Click **"Advanced"** and add these environment variables:

```
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgyODc4MSwiZXhwIjoyMDgyNDA0NzgxfQ.ak3-04l8Fp1CnAg-Rp1s_mHyMnmVNCS9fwH9QWBO4lY
SUPABASE_JWT_SECRET=1gOt/5k2/ulAmo33xbMm/XFqLD9UBIy1UzCxV+f6VxS4Wo9tZJVARZlggjn1BTGjnc+UuxpDap1+JsfbZ3nZZA==
PYTHON_VERSION=3.11.0
```

### **Step 6: Deploy**

1. Click **"Create Web Service"**
2. Wait for deployment (usually 3-5 minutes)
3. **IMPORTANT**: Note your service URL (e.g., `https://ppm-saas-backend-xyz.onrender.com`)

## 🔧 **Update Frontend Configuration**

### **Step 7: Update Vercel Environment Variables**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **`orka-ppm`**
3. Go to **Settings** → **Environment Variables**
4. Update/Add these variables:

```
NEXT_PUBLIC_API_URL=https://your-render-backend-url.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
```

**⚠️ CRITICAL**: Replace `your-render-backend-url` with your actual Render URL!

### **Step 8: Redeploy Frontend**

1. In Vercel dashboard → **Deployments**
2. Click **"Redeploy"** on the latest deployment
3. Wait for redeployment to complete

## 🧪 **Local Testing (Optional but Recommended)**

### **Test Backend Locally**

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run backend locally
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Test endpoints
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/debug
```

### **Test Frontend → Local Backend**

1. Update `NEXT_PUBLIC_API_URL=http://localhost:8000` temporarily
2. Test authentication flow
3. Check browser console for errors
4. Revert to Render URL when satisfied

## ✅ **Verify Deployment**

### **Test Backend Endpoints**

Replace `your-render-url` with your actual Render URL:

```bash
# Basic health check
curl https://your-render-url.onrender.com/

# Expected response:
{
  "message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀",
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-01-05T...",
  "database_status": "connected"
}

# Health endpoint
curl https://your-render-url.onrender.com/health

# Debug endpoint
curl https://your-render-url.onrender.com/debug
```

### **Test Frontend Authentication**

1. Go to `https://orka-ppm.vercel.app`
2. Try to sign up with a test email
3. Check browser console (F12) for errors
4. Verify authentication works end-to-end
5. Test dashboard loading after login

## 🔍 **Monitoring & Logs**

### **Render Dashboard**

- **Service Status**: Should show "Live" with green indicator
- **Logs**: Click on your service → "Logs" tab for real-time monitoring
- **Metrics**: View CPU, memory usage, and request metrics

### **Common Log Messages (Normal)**

```
✅ Supabase client created successfully
✅ JWT payload decoded: iss=supabase, role=anon
🔍 Backend Environment Check: SUPABASE_URL set: True
```

## 🚨 **Troubleshooting**

### **Build Failures**

**Error**: `Could not find requirements.txt`
**Solution**: Ensure Root Directory is set to `backend`

**Error**: `Python version not supported`
**Solution**: Add `PYTHON_VERSION=3.11.0` environment variable

### **Start Failures**

**Error**: `Port already in use`
**Solution**: Render automatically assigns $PORT, don't hardcode port numbers

**Error**: `Module 'main' not found`
**Solution**: Ensure `main.py` exists in `/backend` directory

### **Runtime Errors**

**Error**: `Supabase connection failed`
**Solution**: Check environment variables are set correctly

**Error**: `CORS errors in frontend`
**Solution**: Verify frontend URL is in backend CORS allowed origins

### **Frontend Issues**

**Error**: `Failed to fetch`
**Solution**: Check `NEXT_PUBLIC_API_URL` points to correct Render URL

**Error**: `Authentication failed`
**Solution**: Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly

## 📊 **Performance & Costs**

### **Render Free Tier Limits**

- ✅ **750 hours/month** (enough for 24/7 operation)
- ✅ **512MB RAM** (sufficient for FastAPI)
- ✅ **0.1 CPU** (adequate for moderate traffic)
- ⚠️ **Sleeps after 15 minutes of inactivity** (cold starts)

### **Expected Performance**

- **Cold Start**: 10-30 seconds (first request after sleep)
- **Warm Response**: 100-500ms (normal operation)
- **Concurrent Users**: 10-50 (depending on usage)

## 🎉 **Success Criteria**

✅ Backend deployed on Render without 500 errors
✅ All endpoints responding correctly
✅ Frontend authentication working
✅ CORS configured properly
✅ Dashboard loads after login
✅ No environment variable corruption
✅ Logs show healthy status

## 📞 **Support**

If you encounter issues:

1. **Check Render Logs**: Most issues are visible in service logs
2. **Verify Environment Variables**: Ensure all keys are set correctly
3. **Test Endpoints**: Use curl to test backend directly
4. **Check Frontend Console**: Browser F12 for client-side errors

## 🔄 **Rollback Plan**

If deployment fails, you can quickly rollback:

1. Revert `NEXT_PUBLIC_API_URL` to previous Vercel backend
2. Redeploy frontend
3. Debug Render issues without affecting users

---

**Deployment Time**: ~15 minutes
**Difficulty**: Beginner-friendly
**Cost**: Free (Render free tier)