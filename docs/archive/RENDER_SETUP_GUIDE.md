# Render Backend Setup Guide

## 🚨 IMPORTANT: Environment Variables Required

The backend deployment will fail or not work correctly without these environment variables set in the Render dashboard.

---

## 📋 Step-by-Step Setup

### 1. Access Render Dashboard
1. Go to https://dashboard.render.com
2. Find your service: `orka-ppm-backend`
3. Click on the service name

### 2. Add Environment Variables
Click on "Environment" in the left sidebar, then add these variables:

#### Supabase Configuration
```
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgyODc4MSwiZXhwIjoyMDgyNDA0NzgxfQ.ak3-04l8Fp1CnAg-Rp1s_mHyMnmVNCS9fwH9QWBO4lY
```

#### XAI/Grok API Configuration
```
OPENAI_API_KEY=<your-xai-api-key>
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning
```

#### Application Configuration
```
USE_LOCAL_EMBEDDINGS=true
SKIP_PRE_STARTUP_TESTS=true
ENVIRONMENT=production
BASE_URL=https://orka-ppm.onrender.com
```

### 3. Trigger Manual Deploy (if needed)
If the auto-deploy hasn't started:
1. Click "Manual Deploy" button
2. Select "Deploy latest commit"
3. Wait 5-10 minutes for deployment

---

## ✅ Verify Deployment

### Check Deployment Status
1. In Render dashboard, check "Events" tab
2. Look for "Deploy succeeded" message
3. Check "Logs" tab for any errors

### Test Endpoints

#### 1. Health Check
```bash
curl https://orka-ppm.onrender.com/health
```
Expected: `{"status":"healthy","timestamp":"..."}`

#### 2. Root Endpoint
```bash
curl https://orka-ppm.onrender.com/
```
Expected: JSON with API info

#### 3. Help Chat Endpoint (German)
```bash
curl -X POST https://orka-ppm.onrender.com/ai/help/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Was ist Varianztracking?",
    "language": "de",
    "context": {
      "page_route": "/test",
      "page_title": "Test"
    }
  }'
```
Expected: German response about variance tracking

#### 4. Help Chat Endpoint (Polish)
```bash
curl -X POST https://orka-ppm.onrender.com/ai/help/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Czym jest śledzenie wariancji?",
    "language": "pl",
    "context": {
      "page_route": "/test",
      "page_title": "Test"
    }
  }'
```
Expected: Polish response about variance tracking

---

## 🐛 Troubleshooting

### Issue: Deployment Fails
**Check**: 
- Logs tab in Render dashboard
- Ensure all environment variables are set
- Verify `SKIP_PRE_STARTUP_TESTS=true` is set

### Issue: 404 on Help Chat Endpoints
**Check**:
- Deployment is using `main.py` (not `simple_server.py`)
- Check logs for "Starting ORKA-PPM API server..."
- Verify render.yaml was updated correctly

### Issue: 500 Internal Server Error
**Check**:
- Environment variables are set correctly
- XAI API key is valid
- Supabase credentials are correct
- Check logs for specific error messages

### Issue: Slow Response Times
**Check**:
- XAI API is responding (test with curl)
- Cache is working (repeat queries should be instant)
- Check logs for performance metrics

---

## 📊 Expected Performance

- **First query**: 2.5-3.7 seconds
- **Cached query**: ~0ms (instant)
- **Cache TTL**: 5 minutes
- **Cache cleanup**: Automatic at >1000 entries

---

## 🔄 Deployment Timeline

1. **Git push**: Immediate
2. **Render detects change**: ~30 seconds
3. **Build starts**: ~1 minute
4. **Dependencies install**: ~2-3 minutes
5. **Service starts**: ~1 minute
6. **Health check passes**: ~30 seconds
7. **Total time**: ~5-10 minutes

---

## 📞 Need Help?

If deployment fails or endpoints don't work:
1. Check Render logs for errors
2. Verify all environment variables
3. Try manual redeploy
4. Check XAI API key is valid
5. Test Supabase connection

---

**Last Updated**: January 22, 2026
