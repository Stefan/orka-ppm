# Render Backend Fix - Manuelle Anleitung

**Problem**: Backend läuft mit `simple_server.py` statt `main.py`  
**Symptom**: 404 Fehler für `/api/admin/users-with-roles` und andere Admin-Endpoints

---

## 🚨 Sofortlösung: Manuelles Deployment in Render

### Schritt 1: Render Dashboard öffnen
1. Gehe zu: https://dashboard.render.com
2. Login mit deinem Account
3. Finde den Service: **orka-ppm-backend**

### Schritt 2: Service-Einstellungen prüfen
1. Klicke auf den Service-Namen
2. Gehe zu **Settings** (linke Sidebar)
3. Scrolle zu **Build & Deploy**

### Schritt 3: Start Command ändern
Suche nach **Start Command** und ändere es zu:
```bash
cd backend && SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
```

**WICHTIG**: Stelle sicher, dass es `main:app` ist, NICHT `simple_server:app`!

### Schritt 4: Manuelles Deployment triggern
1. Gehe zu **Manual Deploy** (oben rechts)
2. Klicke auf **Deploy latest commit**
3. Warte 5-10 Minuten

### Schritt 5: Verifizieren
Nach dem Deployment:
```bash
curl https://orka-ppm.onrender.com/debug/info
```

**Erwartetes Ergebnis**:
```json
{
  "server": "main.py"  // ← Sollte NICHT mehr "simple_server.py" sein
}
```

---

## 🔧 Alternative: render.yaml manuell in Render eintragen

Falls das automatische Deployment nicht funktioniert:

### Option A: Start Command direkt in Render UI
1. Render Dashboard → Service → Settings
2. **Start Command**:
   ```bash
   cd backend && SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2 --log-level warning
   ```
3. **Build Command**:
   ```bash
   cd backend && pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt
   ```
4. Speichern und neu deployen

### Option B: Environment Variables prüfen
Stelle sicher, dass diese Environment Variables gesetzt sind:

```bash
SKIP_PRE_STARTUP_TESTS=true
ENVIRONMENT=production
WORKERS=2
SUPABASE_URL=https://xceyrfvxooiplbmwavlb.supabase.co
SUPABASE_ANON_KEY=<dein-key>
SUPABASE_SERVICE_ROLE_KEY=<dein-key>
OPENAI_API_KEY=<dein-xai-key>
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning
USE_LOCAL_EMBEDDINGS=true
```

---

## 🧪 Nach dem Fix testen

### Test 1: Health Check
```bash
curl https://orka-ppm.onrender.com/health
```
Erwartung: `{"status":"healthy",...}`

### Test 2: Admin Users Endpoint
```bash
curl https://orka-ppm.onrender.com/api/admin/users-with-roles
```
Erwartung: `{"detail":"Not authenticated"}` (NICHT 404!)

### Test 3: Admin Roles Endpoint
```bash
curl https://orka-ppm.onrender.com/api/admin/roles
```
Erwartung: `{"detail":"Not authenticated"}` (NICHT 404!)

---

## 📊 Warum funktioniert render.yaml nicht?

Mögliche Gründe:
1. **Render cached alte Konfiguration** - Manuelles Deploy nötig
2. **render.yaml wird ignoriert** - Render nutzt UI-Einstellungen
3. **Syntax-Fehler in render.yaml** - Render fällt auf Defaults zurück
4. **Branch-Mismatch** - render.yaml ist auf `main`, aber Render deployed von anderem Branch

---

## 🔍 Logs prüfen

1. Render Dashboard → Service → **Logs**
2. Suche nach:
   - `Starting ORKA-PPM API server...` (aus main.py)
   - `simple_server.py` (sollte NICHT erscheinen)
   - Fehler beim Import von Routers

### Häufige Fehler:

**Fehler 1**: `ModuleNotFoundError: No module named 'routers.admin'`
```bash
# Lösung: Prüfe, ob alle Dateien im Git sind
git status
git add backend/routers/admin.py
git push
```

**Fehler 2**: `Address already in use`
```bash
# Lösung: Render startet automatisch neu, warte 1-2 Min
```

**Fehler 3**: `ImportError: cannot import name 'help_chat_router'`
```bash
# Lösung: Prüfe backend/routers/help_chat.py existiert
```

---

## 💡 Workaround: simple_server.py erweitern

Falls nichts funktioniert, können wir temporär `simple_server.py` erweitern:

```python
# backend/simple_server.py - Am Ende hinzufügen

# Import admin router
try:
    from routers.admin import router as admin_router
    app.include_router(admin_router)
    print("✅ Admin router included")
except Exception as e:
    print(f"⚠️ Could not load admin router: {e}")

# Import help chat router
try:
    from routers.help_chat import router as help_chat_router
    app.include_router(help_chat_router)
    print("✅ Help chat router included")
except Exception as e:
    print(f"⚠️ Could not load help chat router: {e}")
```

Dann:
```bash
git add backend/simple_server.py
git commit -m "temp: Add admin routes to simple_server"
git push
```

---

## 📞 Support

Falls nichts funktioniert:
1. **Render Support**: https://render.com/support
2. **Render Community**: https://community.render.com
3. **Alternative**: Service löschen und neu erstellen

---

**Erstellt**: 22. Januar 2026  
**Status**: Warte auf manuelles Render-Deployment
