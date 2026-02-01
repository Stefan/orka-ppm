# ✅ Render Backend Fix - Schritt-für-Schritt Checklist

## Vor dem Fix

- [ ] Problem bestätigt: `curl https://orka-ppm.onrender.com/debug/info` zeigt `"server": "simple_server.py"`
- [ ] Render Dashboard Login bereit: https://dashboard.render.com
- [ ] Environment Variables notiert (falls neu eingeben nötig)

---

## Fix durchführen (5-10 Minuten)

### Phase 1: Render Dashboard

- [ ] **Schritt 1**: Render Dashboard geöffnet
- [ ] **Schritt 2**: Service "orka-ppm-backend" gefunden
- [ ] **Schritt 3**: Auf Service-Namen geklickt
- [ ] **Schritt 4**: "Settings" in linker Sidebar geklickt

### Phase 2: Start Command ändern

- [ ] **Schritt 5**: Zu "Build & Deploy" gescrollt
- [ ] **Schritt 6**: "Start Command" gefunden
- [ ] **Schritt 7**: Alten Command notiert (Backup):
  ```
  _______________________________________
  ```
- [ ] **Schritt 8**: Neuen Command eingegeben:
  ```bash
  cd backend && SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
  ```
- [ ] **Schritt 9**: "Save Changes" geklickt

### Phase 3: Environment Variables prüfen

- [ ] **Schritt 10**: Zu "Environment Variables" gescrollt
- [ ] **Schritt 11**: Folgende Variables geprüft:

| Variable | Status | Wert |
|----------|--------|------|
| `SKIP_PRE_STARTUP_TESTS` | ☐ | `true` |
| `ENVIRONMENT` | ☐ | `production` |
| `WORKERS` | ☐ | `2` |
| `SUPABASE_URL` | ☐ | `https://xceyrfvxooiplbmwavlb.supabase.co` |
| `SUPABASE_ANON_KEY` | ☐ | (gesetzt) |
| `SUPABASE_SERVICE_ROLE_KEY` | ☐ | (gesetzt) |
| `OPENAI_API_KEY` | ☐ | (XAI Key gesetzt) |
| `OPENAI_BASE_URL` | ☐ | `https://api.x.ai/v1` |
| `OPENAI_MODEL` | ☐ | `grok-4-fast-reasoning` |
| `USE_LOCAL_EMBEDDINGS` | ☐ | `true` |

- [ ] **Schritt 12**: Fehlende Variables hinzugefügt (falls nötig)

### Phase 4: Deployment starten

- [ ] **Schritt 13**: Oben rechts "Manual Deploy" geklickt
- [ ] **Schritt 14**: "Deploy latest commit" ausgewählt
- [ ] **Schritt 15**: Deployment gestartet
- [ ] **Schritt 16**: Timestamp notiert: ___:___ Uhr

### Phase 5: Logs beobachten (5-10 Min)

- [ ] **Schritt 17**: "Logs" in linker Sidebar geklickt
- [ ] **Schritt 18**: Auf folgende Meldungen gewartet:
  - [ ] `Building...`
  - [ ] `Installing dependencies...`
  - [ ] `Starting server...`
  - [ ] `✅ Admin router included` (oder ähnlich)
  - [ ] `Application startup complete`

---

## Nach dem Fix - Verifizierung

### Test 1: Server-Info prüfen

- [ ] **Test 1a**: Command ausgeführt:
  ```bash
  curl https://orka-ppm.onrender.com/debug/info
  ```
- [ ] **Test 1b**: Ergebnis zeigt `"server": "main.py"` ✅
- [ ] **Test 1c**: Falls NEIN: Warte weitere 2-3 Min und wiederhole

### Test 2: Admin Users Endpoint

- [ ] **Test 2a**: Command ausgeführt:
  ```bash
  curl https://orka-ppm.onrender.com/api/admin/users-with-roles
  ```
- [ ] **Test 2b**: Ergebnis ist 401/403 (NICHT 404) ✅
- [ ] **Test 2c**: Falls 404: Siehe Troubleshooting unten

### Test 3: Admin Roles Endpoint

- [ ] **Test 3a**: Command ausgeführt:
  ```bash
  curl https://orka-ppm.onrender.com/api/admin/roles
  ```
- [ ] **Test 3b**: Ergebnis ist 401/403 (NICHT 404) ✅
- [ ] **Test 3c**: Falls 404: Siehe Troubleshooting unten

### Test 4: Health Check

- [ ] **Test 4a**: Command ausgeführt:
  ```bash
  curl https://orka-ppm.onrender.com/health
  ```
- [ ] **Test 4b**: Ergebnis zeigt `"status": "healthy"` ✅

### Test 5: Frontend-Test

- [ ] **Test 5a**: Browser geöffnet: https://orka-ppm.vercel.app
- [ ] **Test 5b**: Login mit: `stefan.krause@gmail.com` / `orkaadmin`
- [ ] **Test 5c**: Zu Admin → Benutzerverwaltung navigiert
- [ ] **Test 5d**: Benutzerliste wird geladen (kein "Failed to fetch users") ✅
- [ ] **Test 5e**: Rollenliste wird geladen ✅

---

## Troubleshooting

### Problem: Deployment schlägt fehl

- [ ] **Logs prüfen**: Render Dashboard → Logs
- [ ] **Fehler notiert**:
  ```
  _______________________________________
  _______________________________________
  ```
- [ ] **Häufige Fehler**:
  - [ ] `ModuleNotFoundError` → Datei fehlt im Git
  - [ ] `ImportError` → Abhängigkeit fehlt
  - [ ] `Address already in use` → Warte 2 Min

### Problem: Immer noch 404 nach Deployment

- [ ] **Option 1**: Build Cache löschen
  - [ ] Render Dashboard → Manual Deploy
  - [ ] "Clear build cache & deploy" ausgewählt
  - [ ] Warte 10 Min

- [ ] **Option 2**: Branch prüfen
  - [ ] Render Dashboard → Settings → Branch
  - [ ] Muss `main` sein
  - [ ] Falls anders: Ändere zu `main`

- [ ] **Option 3**: Service neu starten
  - [ ] Render Dashboard → Service
  - [ ] Oben rechts: "Restart Service"
  - [ ] Warte 5 Min

### Problem: Environment Variables fehlen

- [ ] **Supabase Keys prüfen**:
  - [ ] Supabase Dashboard: https://supabase.com/dashboard
  - [ ] Project Settings → API
  - [ ] Keys kopieren und in Render einfügen

- [ ] **XAI Key prüfen**:
  - [ ] XAI Dashboard: https://console.x.ai
  - [ ] API Keys
  - [ ] Key kopieren und in Render einfügen

---

## Erfolg! 🎉

Alle Tests bestanden:

- [x] Backend läuft mit `main.py`
- [x] Admin-Endpoints antworten (401/403 statt 404)
- [x] Frontend Benutzerverwaltung funktioniert
- [x] Keine Console-Errors mehr

### Nächste Schritte

- [ ] **Dokumentation aktualisieren**: Notiere die Lösung für zukünftige Deployments
- [ ] **render.yaml prüfen**: Warum wurde es ignoriert?
- [ ] **CI/CD verbessern**: Automatische Tests vor Deployment

---

## Zeitstempel

| Aktion | Zeit | Status |
|--------|------|--------|
| Fix gestartet | ___:___ | ☐ |
| Deployment gestartet | ___:___ | ☐ |
| Deployment abgeschlossen | ___:___ | ☐ |
| Tests bestanden | ___:___ | ☐ |
| Frontend funktioniert | ___:___ | ☐ |

**Gesamtdauer**: _____ Minuten

---

## Notizen

```
_______________________________________
_______________________________________
_______________________________________
_______________________________________
```

---

**Erstellt**: 22. Januar 2026, 18:30 Uhr  
**Letzte Aktualisierung**: ___________  
**Status**: ☐ In Arbeit | ☐ Abgeschlossen | ☐ Fehlgeschlagen

