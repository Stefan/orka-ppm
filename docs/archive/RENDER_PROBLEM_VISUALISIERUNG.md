# 🔍 Render Backend Problem - Visualisierung

## Das Problem im Überblick

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                        │
│              https://orka-ppm.vercel.app                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Request
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (Render) - AKTUELL                  │
│           https://orka-ppm.onrender.com                     │
│                                                             │
│  ❌ Läuft mit: simple_server.py                            │
│                                                             │
│  Verfügbare Endpoints:                                      │
│  ✅ GET  /                                                  │
│  ✅ GET  /health                                            │
│  ✅ GET  /projects                                          │
│  ✅ GET  /debug/info                                        │
│                                                             │
│  Fehlende Endpoints:                                        │
│  ❌ GET  /api/admin/users-with-roles  → 404               │
│  ❌ GET  /api/admin/roles             → 404               │
│  ❌ POST /api/help-chat/ask           → 404               │
│  ❌ ... und viele mehr                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Was sollte laufen

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                        │
│              https://orka-ppm.vercel.app                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Request
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (Render) - SOLLTE SEIN              │
│           https://orka-ppm.onrender.com                     │
│                                                             │
│  ✅ Läuft mit: main.py                                     │
│                                                             │
│  Verfügbare Endpoints:                                      │
│  ✅ GET  /                                                  │
│  ✅ GET  /health                                            │
│  ✅ GET  /projects                                          │
│  ✅ GET  /debug/info                                        │
│  ✅ GET  /api/admin/users-with-roles                       │
│  ✅ GET  /api/admin/roles                                  │
│  ✅ POST /api/help-chat/ask                                │
│  ✅ GET  /api/portfolios                                   │
│  ✅ GET  /api/scenarios                                    │
│  ✅ ... und 50+ weitere Endpoints                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Warum passiert das?

### Render Deployment Flow

```
┌──────────────────┐
│  GitHub Push     │
│  (main branch)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Render erkennt  │
│  neuen Commit    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Render sucht nach Konfiguration:        │
│                                          │
│  1. render.yaml im Root? ✅ Vorhanden   │
│  2. UI Settings? ✅ Vorhanden           │
│                                          │
│  ❌ PROBLEM: UI Settings überschreiben  │
│     render.yaml!                         │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Render nutzt alte UI Settings:          │
│                                          │
│  Start Command (alt):                    │
│  cd backend && uvicorn simple_server:app │
│                                          │
│  Start Command (neu in render.yaml):     │
│  cd backend && uvicorn main:app          │
│                                          │
│  ❌ Render ignoriert render.yaml!        │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Backend startet │
│  mit             │
│  simple_server.py│
└──────────────────┘
```

---

## Die Lösung

### Manuelles Update in Render UI

```
┌──────────────────────────────────────────┐
│  1. Render Dashboard öffnen              │
│     https://dashboard.render.com         │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  2. Service Settings öffnen              │
│     orka-ppm-backend → Settings          │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  3. Start Command ändern                 │
│                                          │
│  ALT:                                    │
│  cd backend && uvicorn simple_server:app │
│                                          │
│  NEU:                                    │
│  cd backend && SKIP_PRE_STARTUP_TESTS=   │
│  true uvicorn main:app --host 0.0.0.0    │
│  --port $PORT --workers 2                │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  4. Save Changes                         │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  5. Manual Deploy → Deploy latest commit │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  6. Warten (5-10 Min)                    │
│     Logs beobachten                      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  ✅ Backend läuft mit main.py            │
│  ✅ Alle Endpoints verfügbar             │
└──────────────────────────────────────────┘
```

---

## Vergleich: simple_server.py vs main.py

### simple_server.py (AKTUELL - ❌)

```python
# Nur 10 Endpoints
app = FastAPI(title="ORKA-PPM API")

@app.get("/")
@app.get("/health")
@app.get("/projects")
@app.get("/debug/info")
# ... nur Mock-Daten

# ❌ KEINE Admin-Routers
# ❌ KEINE Help-Chat-Routers
# ❌ KEINE RBAC
# ❌ KEINE Supabase-Integration
```

### main.py (SOLLTE SEIN - ✅)

```python
# 50+ Endpoints
app = FastAPI(title="ORKA-PPM API")

# ✅ Alle Router importiert
from routers.admin import router as admin_router
from routers.help_chat import router as help_chat_router
from routers.portfolios import router as portfolios_router
from routers.projects import router as projects_router
# ... 20+ weitere Router

# ✅ Alle Router registriert
app.include_router(admin_router)
app.include_router(help_chat_router)
app.include_router(portfolios_router)
# ... alle anderen

# ✅ Supabase-Integration
# ✅ RBAC-System
# ✅ Performance-Monitoring
# ✅ Caching
```

---

## Endpoint-Vergleich

| Endpoint | simple_server.py | main.py |
|----------|------------------|---------|
| `GET /` | ✅ Mock | ✅ Real |
| `GET /health` | ✅ Mock | ✅ Real |
| `GET /projects` | ✅ Mock | ✅ Real (Supabase) |
| `GET /api/admin/users-with-roles` | ❌ 404 | ✅ 200/401 |
| `GET /api/admin/roles` | ❌ 404 | ✅ 200/401 |
| `POST /api/help-chat/ask` | ❌ 404 | ✅ 200 |
| `GET /api/portfolios` | ❌ 404 | ✅ 200 |
| `GET /api/scenarios` | ❌ 404 | ✅ 200 |
| `GET /api/resources` | ✅ Mock | ✅ Real (Supabase) |
| `GET /api/risks` | ✅ Mock | ✅ Real (Supabase) |

---

## Nach dem Fix

### Test-Sequenz

```bash
# 1. Server-Check
curl https://orka-ppm.onrender.com/debug/info
# Erwartung: {"server": "main.py"}  ✅

# 2. Admin-Endpoints (ohne Auth)
curl https://orka-ppm.onrender.com/api/admin/users-with-roles
# Erwartung: {"detail":"Not authenticated"}  ✅ (401, nicht 404!)

# 3. Frontend-Test
# Browser: https://orka-ppm.vercel.app/admin/users
# Login: stefan.krause@gmail.com / orkaadmin
# Erwartung: Benutzerliste wird geladen  ✅
```

---

## Zusammenfassung

### Problem
```
Render deployed mit simple_server.py
→ Nur 10 Mock-Endpoints
→ Keine Admin-Funktionen
→ Frontend bekommt 404-Fehler
```

### Lösung
```
Render UI: Start Command ändern zu main.py
→ 50+ echte Endpoints
→ Alle Admin-Funktionen
→ Frontend funktioniert
```

### Dauer
```
5-10 Minuten für manuelles Deployment
```

---

**Erstellt**: 22. Januar 2026  
**Nächster Schritt**: Siehe `RENDER_FIX_JETZT.md`

