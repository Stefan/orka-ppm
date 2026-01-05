# 🚨 SOFORT-FIX: Invalid API Key Error

## ❌ Problem: "Authentication failed: Invalid API key"

**Ursache**: Supabase API Key ist nicht korrekt in Vercel gesetzt oder ungültig.

## ✅ SOFORTIGE LÖSUNG:

### 1. **Vercel Dashboard - Environment Variables**

1. Gehe zu: **https://vercel.com/dashboard**
2. Wähle dein Projekt: **orka-ppm**
3. **Settings** → **Environment Variables**
4. **Lösche alle bestehenden** PPM-related Variables
5. **Füge NEU hinzu** (für Production, Preview UND Development):

```bash
NEXT_PUBLIC_SUPABASE_URL
https://xceyrfvxooiplbmwavlb.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo

NEXT_PUBLIC_API_URL
https://backend-six-inky-90.vercel.app
```

**⚠️ WICHTIG:**
- **KEINE Anführungszeichen** verwenden!
- **Alle drei Environments** setzen (Production/Preview/Development)
- **Exakt kopieren** - keine Leerzeichen am Ende

### 2. **Redeploy auslösen**

Nach dem Setzen der Variables:
```bash
vercel --prod
```

Oder in Vercel Dashboard: **Deployments** → **Redeploy**

### 3. **Sofort-Test**

1. Gehe zu: **https://orka-ppm.vercel.app**
2. **🔍 Run Diagnostics** klicken
3. Prüfen ob:
   - `SUPABASE_URL`: Korrekte URL angezeigt
   - `SUPABASE_KEY length`: ~200+ Zeichen
   - Keine "MISSING" Meldungen

### 4. **Backup-Plan: Lokaler Test**

Falls Vercel-Deployment dauert:
```bash
cd frontend
npm run dev
```

Dann lokal testen auf: **http://localhost:3000**

## 🔍 **Debug-Schritte:**

### Browser Console öffnen:
1. **F12** drücken
2. **Console** Tab
3. Nach Environment-Logs suchen:
   ```
   🔍 Environment Variables Check:
   - SUPABASE_URL: https://...
   - SUPABASE_KEY length: 208
   - API_URL: https://...
   ✅ Environment validation completed
   ```

### Häufige Probleme:

❌ **"SUPABASE_KEY length: 0"** → Variable nicht gesetzt
❌ **"MISSING" in Diagnostics** → Variable fehlt komplett  
❌ **"Invalid API key"** → Falscher Key oder Anführungszeichen
❌ **"Connection failed: 401"** → Normal! (Bedeutet Verbindung OK)

## 🎯 **Erwartetes Verhalten nach Fix:**

✅ **Diagnostics zeigen**: Alle Variables korrekt
✅ **Connection Test**: 401 (das ist OK!)
✅ **Authentication**: Funktioniert ohne "Invalid API key"
✅ **Signup/Login**: Erfolgreich oder andere spezifische Fehler

## 🚀 **Schnell-Commands:**

```bash
# Redeploy
vercel --prod

# Environment Variables prüfen
vercel env ls

# Lokaler Test
cd frontend && npm run dev
```

---

**Nach dem Fix sollte "Invalid API key" verschwinden und durch spezifischere Auth-Fehler ersetzt werden (falls welche auftreten).**