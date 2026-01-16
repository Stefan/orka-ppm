# 🚨 Quick Fix: Production Environment Variables

## The Problem
```
❌ CONFIGURATION ERROR: Supabase environment variables are not configured
```

## The Solution (Choose One)

### Option 1: Vercel Dashboard (5 minutes)

1. Go to https://vercel.com → Your Project → Settings → Environment Variables

2. Add these 3 variables:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xceyrfvxooiplbmwavlb.supabase.co` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo` | Production, Preview, Development |
   | `NEXT_PUBLIC_API_URL` | `https://orka-ppm.onrender.com` | Production, Preview, Development |

3. Go to Deployments → Click ⋯ on latest → Redeploy

### Option 2: Vercel CLI (2 minutes)

```bash
# Run the automated script
./scripts/verify-vercel-env.sh

# Then redeploy
vercel --prod
```

### Option 3: Manual CLI

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://xceyrfvxooiplbmwavlb.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo

vercel --prod
```

## ✅ Verification

After redeploying, the error should be gone and authentication should work!

## 📚 More Details

See `VERCEL_ENV_SETUP.md` for complete documentation.
