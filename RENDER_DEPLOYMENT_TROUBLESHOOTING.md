# Render Deployment Troubleshooting

**Problem**: Backend läuft noch mit `simple_server.py` statt `main.py`  
**Symptom**: "Failed to fetch users" in der Benutzerverwaltung

---

## 🔍 Problem-Diagnose

### Aktueller Status
```bash
curl https://orka-ppm.onrender.com/debug/info
```

**Ergebnis**:
```json
{
  "status": "running",
  "server": "simple_server.py",  // ❌ Sollte "main.py" sein
  "timestamp": "2026-01-22T16:54:22.790319"
}
```

### Warum passiert das?
Render hat die Änderungen in `render.yaml` noch nicht übernommen oder das Deployment ist fehlgeschlagen.

---

## ✅ Lösung 1: Manuelles Redeploy in Render Dashboard

### Schritt 1: Render Dashboard öffnen
1. Gehe zu https://dashboard.render.com
2. Finde den Service: `orka-ppm-backend`
3. Klicke auf den Service-Namen

### Schritt 2: Deployment-Status prüfen
- Gehe zum Tab "Events"
- Prüfe den letzten Deployment-Status
- Suche nach Fehlermeldungen

### Schritt 3: Manuelles Redeploy
1. Klicke auf "Manual Deploy" (oben rechts)
2. Wähle "Deploy latest commit"
3. Warte 5-10 Minuten

### Schritt 4: Verifizieren
```bash
# Warte 5-10 Minuten, dann teste:
curl https://orka-ppm.onrender.com/debug/info

# Sollte zeigen:
# "server": "main.py"  ✅
```

---

## ✅ Lösung 2: Render.yaml Syntax prüfen

### Problem
Möglicherweise hat Render die `render.yaml` nicht korrekt geparst.

### Lösung
```yaml
# render.yaml - Vereinfachte Version
services:
  - type: web
    name: orka-ppm-backend
    env: python
    buildCommand: cd backend && pip install -r requirements.txt
    startCommand: cd backend && SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
    plan: starter
    region: frankfurt
    branch: main
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: 8001
      - key: PYTHON_VERSION
        value: 3.11
      - key: SKIP_PRE_STARTUP_TESTS
        value: true
      - key: ENVIRONMENT
        value: production
      - key: WORKERS
        value: 2
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_BASE_URL
        value: https://api.x.ai/v1
      - key: OPENAI_MODEL
        value: grok-4-1-fast-non-reasoning
      - key: USE_LOCAL_EMBEDDINGS
        value: true
    autoDeploy: true
```

---

## ✅ Lösung 3: Environment Variables prüfen

### Fehlende Environment Variables
Das Backend benötigt diese Environment Variables in Render:

```bash
# Kritisch (müssen gesetzt sein)
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=<dein-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<dein-service-role-key>

# XAI/Grok API
OPENAI_API_KEY=<dein-xai-key>
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-1-fast-non-reasoning

# Konfiguration
USE_LOCAL_EMBEDDINGS=true
SKIP_PRE_STARTUP_TESTS=true
ENVIRONMENT=production
WORKERS=2
```

### Wie setzen?
1. Render Dashboard → Service → Environment
2. Klicke auf "Add Environment Variable"
3. Füge alle fehlenden Variables hinzu
4. Klicke auf "Save Changes"
5. Render deployed automatisch neu

---

## ✅ Lösung 4: Logs prüfen

### Schritt 1: Logs öffnen
1. Render Dashboard → Service → Logs
2. Suche nach Fehlermeldungen

### Häufige Fehler

#### Fehler 1: Import Error
```
ImportError: cannot import name 'help_chat_router'
```

**Lösung**: Prüfe, ob alle Dateien im Git-Repository sind:
```bash
git status
git add backend/routers/help_chat.py
git commit -m "fix: Add missing router"
git push
```

#### Fehler 2: Module Not Found
```
ModuleNotFoundError: No module named 'sentence_transformers'
```

**Lösung**: Prüfe `backend/requirements.txt`:
```bash
# Sollte enthalten:
sentence-transformers>=2.2.0
```

#### Fehler 3: Port Already in Use
```
OSError: [Errno 98] Address already in use
```

**Lösung**: Render startet automatisch neu, warte 1-2 Minuten

---

## ✅ Lösung 5: Lokales Testing

### Backend lokal starten
```bash
cd backend

# Virtual Environment aktivieren
source venv/bin/activate  # oder: source .venv/bin/activate

# Backend starten
SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Endpoint testen
```bash
# In einem neuen Terminal
./test-backend-local.sh
```

### Erwartetes Ergebnis
```
✅ Backend is running
✅ Endpoint exists but requires authentication (expected)
```

---

## 🔧 Workaround: Temporär simple_server.py anpassen

Falls Render partout nicht mit `main.py` funktioniert, kannst du temporär `simple_server.py` erweitern:

```python
# backend/simple_server.py - Am Ende hinzufügen

# Import admin router
from routers.admin import router as admin_router
app.include_router(admin_router)

print("✅ Admin router included")
```

**Dann**:
```bash
git add backend/simple_server.py
git commit -m "temp: Add admin router to simple_server"
git push
```

---

## 📊 Deployment-Status prüfen

### Render CLI (optional)
```bash
# Render CLI installieren
npm install -g @render-com/cli

# Login
render login

# Service-Status prüfen
render services list
render deploys list --service orka-ppm-backend
```

### GitHub Actions
Prüfe GitHub Actions für Deployment-Fehler:
- https://github.com/Stefan/ppm-saas/actions

---

## 🎯 Schnelltest

```bash
# 1. Health Check
curl https://orka-ppm.onrender.com/health

# 2. Debug Info
curl https://orka-ppm.onrender.com/debug/info

# 3. Admin Endpoint (sollte 401/403 zurückgeben, nicht 404)
curl https://orka-ppm.onrender.com/api/admin/users-with-roles

# Erwartete Ergebnisse:
# 1. {"status":"healthy",...}
# 2. {"server":"main.py",...}  ← Wichtig!
# 3. {"detail":"Not authenticated"} oder {"detail":"Forbidden"}
```

---

## 📞 Wenn nichts funktioniert

### Option 1: Render Support kontaktieren
- https://render.com/support
- Beschreibe das Problem: "Service läuft mit alter Konfiguration"

### Option 2: Service neu erstellen
1. Render Dashboard → Service → Settings
2. Scrolle nach unten → "Delete Service"
3. Erstelle neuen Service mit korrekter Konfiguration

### Option 3: Alternative Deployment-Plattform
- Railway.app
- Fly.io
- Heroku
- DigitalOcean App Platform

---

**Erstellt**: 22. Januar 2026  
**Status**: Warte auf Render-Deployment
