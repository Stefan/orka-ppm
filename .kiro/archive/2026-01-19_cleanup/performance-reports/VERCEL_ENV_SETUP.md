# 🚀 Vercel Environment Variables Setup

## Problem
You're seeing this error in production:
```
❌ CONFIGURATION ERROR: Supabase environment variables are not configured
```

## Root Cause
**Vercel does NOT automatically read from `.env.production` file.** You must set environment variables in the Vercel dashboard.

## ✅ Solution: Add Environment Variables to Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to your Vercel project**:
   - Visit https://vercel.com/orka/orka-ppm (or your project URL)
   - Or go to https://vercel.com and select your project

2. **Navigate to Settings**:
   - Click on "Settings" tab
   - Click on "Environment Variables" in the left sidebar

3. **Add these environment variables**:

   **Variable 1:**
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://xceyrfvxooiplbmwavlb.supabase.co`
   - Environment: Select **Production**, **Preview**, and **Development**

   **Variable 2:**
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo`
   - Environment: Select **Production**, **Preview**, and **Development**

   **Variable 3 (Optional - for server-side operations):**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgyODc4MSwiZXhwIjoyMDgyNDA0NzgxfQ.ak3-04l8Fp1CnAg-Rp1s_mHyMnmVNCS9fwH9QWBO4lY`
   - Environment: Select **Production** only (keep this secret!)

   **Variable 4:**
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://orka-ppm.onrender.com`
   - Environment: Select **Production**, **Preview**, and **Development**

4. **Save and Redeploy**:
   - After adding all variables, click "Save"
   - Go to "Deployments" tab
   - Click the three dots (...) on the latest deployment
   - Click "Redeploy"
   - Check "Use existing Build Cache" (optional)
   - Click "Redeploy"

### Method 2: Via Vercel CLI (Faster)

If you have Vercel CLI installed, run this script:

```bash
# Make the script executable
chmod +x scripts/verify-vercel-env.sh

# Run the script to set environment variables
./scripts/verify-vercel-env.sh
```

Or manually with Vercel CLI:

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://xceyrfvxooiplbmwavlb.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo

vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://orka-ppm.onrender.com

# Redeploy
vercel --prod
```

## 🔍 Verification

After redeploying, visit your production site and:

1. Open browser DevTools (F12)
2. Go to Console tab
3. You should see logs showing Supabase configuration
4. The error message should be gone

## 📝 Important Notes

1. **`.env.production` is for local builds only** - Vercel ignores it
2. **Environment variables are encrypted** in Vercel
3. **Changes require a redeploy** to take effect
4. **`NEXT_PUBLIC_*` variables** are exposed to the browser (safe for public keys)
5. **Non-prefixed variables** (like `SUPABASE_SERVICE_ROLE_KEY`) are server-only

## 🔐 Security

- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Safe to expose (public)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Safe to expose (public, rate-limited)
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - Keep secret! Only in Production environment

## 🆘 Troubleshooting

**Still seeing the error after redeploying?**

1. Check that variables are set for "Production" environment
2. Clear Vercel build cache and redeploy
3. Check browser console for actual values being loaded
4. Verify the deployment used the latest code

**Need to verify variables are set?**

```bash
vercel env ls
```

This will show all environment variables configured in Vercel.
