# Vercel Environment Variables Update

## 🎯 **Your Render Backend URL**
```
https://orka-ppm.onrender.com
```

## 🔧 **Update Vercel Environment Variables**

### **Step 1: Go to Vercel Dashboard**
1. Open: [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project: **`orka-ppm`**
3. Go to **Settings** → **Environment Variables**

### **Step 2: Update/Add These Variables**

**CRITICAL**: Update or add these exact variables:

```
NEXT_PUBLIC_API_URL=https://orka-ppm.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo
```

### **Step 3: Redeploy Frontend**
1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Wait for redeployment to complete (1-2 minutes)

## ✅ **Verification Steps**

After updating:

1. **Test Backend**: https://orka-ppm.onrender.com/health
2. **Test Frontend**: https://orka-ppm.vercel.app
3. **Test Authentication**: Sign up/sign in flow
4. **Check Console**: Browser F12 for any errors

## 🚨 **Important Notes**

- **No trailing slashes** in API URL
- **Copy exact JWT token** (no spaces, no variable names)
- **Wait for Render service** to show "Live" status before testing
- **Redeploy frontend** after updating environment variables