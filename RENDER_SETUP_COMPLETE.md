# Complete Render Deployment Guide

## 🎯 **Current Issue**
Error: `failed to read dockerfile: no such file or directory`
**Cause**: Render is set to Docker mode but no Dockerfile exists

## 🚀 **Solution Options**

### **Option 1: Native Python (Recommended - Faster)**

#### **Step 1: Change Build Method in Render Dashboard**

1. **Go to Render Dashboard** → Your Service (`orka-ppm`)
2. **Settings** → **Build & Deploy**
3. **Update these settings**:

```
Environment: Python 3
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Root Directory: backend
Python Version: 3.11.0
```

#### **Step 2: Environment Variables**

In **Settings** → **Environment**, add:

```
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgyODc4MSwiZXhwIjoyMDgyNDA0NzgxfQ.ak3-04l8Fp1CnAg-Rp1s_mHyMnmVNCS9fwH9QWBO4lY
SUPABASE_JWT_SECRET=1gOt/5k2/ulAmo33xbMm/XFqLD9UBIy1UzCxV+f6VxS4Wo9tZJVARZlggjn1BTGjnc+UuxpDap1+JsfbZ3nZZA==
```

### **Option 2: Docker (Alternative)**

If you prefer Docker:

1. **Keep Docker mode** in Render
2. **Use the Dockerfile** we created in `/backend/Dockerfile`
3. **Build Command**: `docker build -t app .`
4. **Start Command**: `docker run -p $PORT:8000 app`

## 🧪 **Local Testing**

### **Test Backend Locally**

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Test endpoints
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/debug
```

### **Expected Responses**

**Root endpoint** (`/`):
```json
{
  "message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀",
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-01-05T...",
  "database_status": "connected"
}
```

**Health endpoint** (`/health`):
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-05T..."
}
```

## 🔧 **Frontend Configuration Update**

### **Update Vercel Environment Variables**

1. **Go to Vercel Dashboard** → Your Project (`orka-ppm`)
2. **Settings** → **Environment Variables**
3. **Update/Add**:

```
NEXT_PUBLIC_API_URL=https://orka-ppm.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
```

4. **Redeploy Frontend**

## ✅ **Verification Steps**

### **1. Backend Verification**

```bash
# Test all endpoints
curl https://orka-ppm.onrender.com/
curl https://orka-ppm.onrender.com/health
curl https://orka-ppm.onrender.com/debug
curl https://orka-ppm.onrender.com/dashboard
```

### **2. Frontend Verification**

1. Go to `https://orka-ppm.vercel.app`
2. Open browser console (F12)
3. Try authentication (sign up/sign in)
4. Check for CORS errors
5. Verify dashboard loads

### **3. Integration Test**

1. **Sign up** with test email
2. **Check email** for confirmation
3. **Sign in** after confirmation
4. **Navigate to dashboard**
5. **Verify data loading**

## 🚨 **Troubleshooting**

### **Build Failures**

**Error**: `No module named 'fastapi'`
**Solution**: Ensure `requirements.txt` is in `/backend` directory

**Error**: `Port already in use`
**Solution**: Render automatically assigns `$PORT` variable

### **Runtime Errors**

**Error**: `Supabase connection failed`
**Solution**: Check environment variables are set correctly

**Error**: `CORS policy error`
**Solution**: Verify frontend URL is in backend CORS allowed origins

### **Frontend Issues**

**Error**: `Failed to fetch`
**Solution**: Check `NEXT_PUBLIC_API_URL` points to correct Render URL

**Error**: `Invalid API key`
**Solution**: Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct

## 📊 **Performance Expectations**

### **Render Free Tier**

- ✅ **750 hours/month** (24/7 operation)
- ✅ **512MB RAM** (sufficient for FastAPI)
- ✅ **0.1 CPU** (adequate for moderate traffic)
- ⚠️ **Cold starts** after 15 minutes inactivity

### **Expected Response Times**

- **Cold Start**: 10-30 seconds
- **Warm Response**: 100-500ms
- **Concurrent Users**: 10-50

## 🎉 **Success Criteria**

✅ Backend deploys without Docker errors
✅ All endpoints return 200 status
✅ Frontend authentication works
✅ CORS configured correctly
✅ Dashboard loads with data
✅ No console errors in browser

---

**Estimated Setup Time**: 10-15 minutes
**Difficulty**: Beginner
**Cost**: Free (Render + Vercel free tiers)