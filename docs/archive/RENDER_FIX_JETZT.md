# 🚨 RENDER BACKEND FIX - SOFORT DURCHFÜHREN

**Problem bestätigt**: Backend läuft mit `simple_server.py` statt `main.py`

```bash
curl https://orka-ppm.onrender.com/debug/info
# Zeigt: "server": "simple_server.py"  ❌
# Sollte sein: "server": "main.py"     ✅
```

---

## ✅ LÖSUNG: Manuelles Deployment in Render (5 Minuten)

### Schritt 1: Render Dashboard öffnen
🔗 **Link**: https://dashboard.render.com

1. Login mit deinem Render-Account
2. Suche den Service: **orka-ppm-backend**
3. Klicke auf den Service-Namen

---

### Schritt 2: Start Command ändern

1. Klicke links auf **"Settings"**
2. Scrolle runter zu **"Build & Deploy"**
3. Finde **"Start Command"**
4. Ändere den Befehl zu:

```bash
cd backend && SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
```

**WICHTIG**: 
- Es muss `main:app` sein (NICHT `simple_server:app`)
- Klicke auf **"Save Changes"**

---

### Schritt 3: Environment Variables prüfen

Scrolle zu **"Environment Variables"** und stelle sicher, dass diese gesetzt sind:

| Variable | Wert |
|----------|------|
| `SKIP_PRE_STARTUP_TESTS` | `true` |
| `ENVIRONMENT` | `production` |
| `WORKERS` | `2` |
| `SUPABASE_URL` | `https://xceyrfvxooiplbmwavlb.supabase.co` |
| `SUPABASE_ANON_KEY` | (dein Key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (dein Key) |
| `OPENAI_API_KEY` | (dein XAI/Grok Key) |
| `OPENAI_BASE_URL` | `https://api.x.ai/v1` |
| `OPENAI_MODEL` | `grok-4-fast-reasoning` |
| `USE_LOCAL_EMBEDDINGS` | `true` |

Falls eine fehlt, klicke auf **"Add Environment Variable"**

---

### Schritt 4: Manuelles Deployment starten

1. Klicke oben rechts auf **"Manual Deploy"**
2. Wähle **"Deploy latest commit"**
3. Warte 5-10 Minuten (Render baut und startet neu)

**Fortschritt verfolgen**:
- Klicke auf **"Logs"** (linke Sidebar)
- Warte auf: `✅ Admin router included` oder ähnliche Meldungen

---

### Schritt 5: Verifizieren

Nach dem Deployment (ca. 5-10 Min):

```bash
# Test 1: Server-Info prüfen
curl https://orka-ppm.onrender.com/debug/info
```

**Erwartetes Ergebnis**:
```json
{
  "server": "main.py",  // ← MUSS "main.py" sein!
  "status": "running"
}
```

```bash
# Test 2: Admin-Endpoint testen
curl https://orka-ppm.onrender.com/api/admin/users-with-roles
```

**Erwartetes Ergebnis**:
```json
{"detail":"Not authenticated"}  // ← 401/403 ist OK! (NICHT 404!)
```

```bash
# Test 3: Roles-Endpoint testen
curl https://orka-ppm.onrender.com/api/admin/roles
```

**Erwartetes Ergebnis**:
```json
{"detail":"Not authenticated"}  // ← 401/403 ist OK! (NICHT 404!)
```

---

## 🎯 Was passiert dann?

Nach erfolgreichem Deployment:

1. ✅ Backend läuft mit `main.py`
2. ✅ Admin-Endpoints sind verfügbar (`/api/admin/*`)
3. ✅ Help-Chat-Endpoints sind verfügbar (`/api/help-chat/*`)
4. ✅ Alle anderen Routers sind geladen
5. ✅ Frontend kann Benutzerverwaltung nutzen

---

## 🔍 Troubleshooting

### Problem: Deployment schlägt fehl

**Logs prüfen**:
1. Render Dashboard → Service → **Logs**
2. Suche nach Fehlern wie:
   - `ModuleNotFoundError`
   - `ImportError`
   - `Address already in use`

**Häufige Fehler**:

#### Fehler 1: `ModuleNotFoundError: No module named 'routers.admin'`
```bash
# Lösung: Datei fehlt im Git
git status
git add backend/routers/admin.py
git commit -m "Add admin router"
git push
# Dann in Render: Manual Deploy → Deploy latest commit
```

#### Fehler 2: `ImportError: cannot import name 'require_admin'`
```bash
# Lösung: RBAC-Modul fehlt
git add backend/auth/rbac.py
git commit -m "Add RBAC module"
git push
```

#### Fehler 3: Build dauert zu lange (>10 Min)
```bash
# Lösung: Build Command optimieren
# In Render Settings → Build Command:
cd backend && pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt
```

---

### Problem: Deployment erfolgreich, aber immer noch 404

**Mögliche Ursachen**:

1. **Render cached alte Version**
   - Lösung: Service neu starten
   - Render Dashboard → Service → **Manual Deploy** → **Clear build cache & deploy**

2. **Falscher Branch deployed**
   - Render Dashboard → Settings → **Branch**: Muss `main` sein
   - Falls anders: Ändere zu `main` und deploye neu

3. **render.yaml wird ignoriert**
   - Render nutzt UI-Einstellungen statt render.yaml
   - Lösung: Alle Einstellungen manuell in UI eingeben (siehe Schritt 2 & 3)

---

## 🚀 Alternative: Service neu erstellen

Falls nichts funktioniert:

1. **Neuen Service erstellen**:
   - Render Dashboard → **New** → **Web Service**
   - Repository: Dein GitHub-Repo
   - Branch: `main`
   - Root Directory: `backend`
   - Build Command: `pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt`
   - Start Command: `SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`

2. **Environment Variables kopieren**:
   - Vom alten Service alle Env Vars kopieren
   - Im neuen Service einfügen

3. **Alten Service löschen**:
   - Erst wenn neuer Service läuft!

---

## 📊 Status-Check nach Fix

Führe diese Tests aus:

```bash
# 1. Health Check
curl https://orka-ppm.onrender.com/health
# Erwartung: {"status":"healthy"}

# 2. Root Endpoint
curl https://orka-ppm.onrender.com/
# Erwartung: {"message":"Willkommen zur Orka PPM..."}

# 3. Debug Info
curl https://orka-ppm.onrender.com/debug/info
# Erwartung: {"server":"main.py"}  ← WICHTIG!

# 4. Admin Users (ohne Auth)
curl https://orka-ppm.onrender.com/api/admin/users-with-roles
# Erwartung: 401/403 (NICHT 404!)

# 5. Admin Roles (ohne Auth)
curl https://orka-ppm.onrender.com/api/admin/roles
# Erwartung: 401/403 (NICHT 404!)
```

---

## ✅ Erfolg!

Wenn alle Tests bestanden sind:

1. ✅ Backend läuft mit `main.py`
2. ✅ Admin-Endpoints antworten (401/403 statt 404)
3. ✅ Frontend kann Benutzerverwaltung nutzen

**Nächster Schritt**: Frontend testen
```bash
# Öffne im Browser:
https://orka-ppm.vercel.app/admin/users
# Login: stefan.krause@gmail.com / orkaadmin
# Erwartung: Benutzerliste wird geladen (kein "Failed to fetch users")
```

---

**Erstellt**: 22. Januar 2026, 18:24 Uhr  
**Status**: Warte auf manuelles Render-Deployment  
**Geschätzte Dauer**: 5-10 Minuten

