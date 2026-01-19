# Deployment Configuration

## Environment Variables for Vercel

Set these environment variables in the Vercel dashboard:

```
NEXT_PUBLIC_API_URL=https://orka-ppm.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
```

## Backend URLs

- **Production Backend**: https://orka-ppm.onrender.com
- **Frontend**: https://orka-ppm.vercel.app

## CORS Issue Fix

The CORS error was caused by the frontend trying to call the wrong API URL:
- ❌ **Wrong**: `https://ppm-pearl.vercel.app` (old Vercel backend)
- ✅ **Correct**: `https://orka-ppm.onrender.com` (render.com backend)

## Deployment Steps

1. Update environment variables in Vercel dashboard
2. Redeploy frontend to pick up new environment variables
3. Verify backend is running on render.com
4. Test API calls in production

## Fallback System

The frontend now includes a fallback system:
1. Try production API (render.com)
2. If that fails, use mock data
3. User sees working interface even if backend is down