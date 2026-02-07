# Admin Benutzerverwaltung – Kurzer Testablauf

Kurze manuelle Tests für die Benutzerverwaltung inkl. 403/404-Fehlerbehandlung.

## Voraussetzungen

- Backend läuft (z. B. `./start-local.sh` oder `cd backend && python -m uvicorn main:app`)
- Frontend läuft (`npm run dev`)
- Als **Admin** eingeloggt (Rolle mit `admin_read` / Admin-Rechten)
- **Rollen zuweisen/entfernen:** In der Backend-`.env` muss `SUPABASE_SERVICE_ROLE_KEY` gesetzt sein, sonst schlagen Zuweisung/Entfernung mit RLS-Fehler fehl (Backend antwortet dann mit 503 und Hinweis auf den Key).

---

## 0. Ersten Admin anlegen (wenn du nur „User“ bist)

**Du kannst dir die Admin-Rolle nicht in der App zuweisen**, wenn du nur die Rolle „User“ (z. B. Viewer/Team Member) hast: Die Admin-API verlangt die Berechtigung `user_manage`, die nur Admins haben. Das ist gewollt (kein Selbst-Promotion ohne bestehenden Admin).

**Lösung: Ersten Admin per Skript setzen** (mit Service-Role-Key, außerhalb der App):

1. In der Backend-`.env` muss `SUPABASE_SERVICE_ROLE_KEY` gesetzt sein.
2. Python-Abhängigkeiten: Aus dem **backend**-Ordner `pip install -r requirements.txt` (oder mindestens `pip install PyJWT`), damit `import jwt` (Modul PyJWT) funktioniert.
3. Im Projektroot (oder aus `backend/`):

   ```bash
   cd backend
   python scripts/add_admin_user.py stefan.krause@gmail.com
   ```

   Oder mit User-ID (falls E-Mail-Lookup nicht genutzt werden soll):

   ```bash
   python scripts/add_admin_user.py --user-id bf1b1732-2449-4987-9fdb-fefa2a93b816
   ```

3. Danach: **Seite neu laden, ggf. aus- und wieder einloggen.** Der Nutzer hat dann die Admin-Rolle und sieht Admin-Menü sowie User Management; Rollen können dort zugewiesen/entfernt werden.

**Alternative (nur Entwicklung):** Bootstrap-Endpunkt `POST /api/admin/bootstrap/admin` (nur wenn `DISABLE_BOOTSTRAP` nicht gesetzt); legt einen neuen Admin-User an (E-Mail/Passwort im Request-Body).

---

## 1. Normale Abläufe

1. **Benutzerliste**
   - Zu **Admin → User Management** (`/admin/users`) gehen.
   - Erwartung: Tabelle mit Benutzern, Filter, „Invite User“, Aktionen pro Zeile.
   - Bei 403: rote Meldung z. B. „Permission denied“ (nicht nur „Forbidden“).

2. **Rolle zuweisen**
   - Bei einem Benutzer auf **Schild-Icon** (Manage Roles) klicken → Modal „Manage Roles“.
   - Eine Rolle aus „Available Roles“ auf **Assign** klicken.
   - Erwartung: Erfolgsmeldung, Liste aktualisiert, neue Rolle sichtbar.
   - Bei 404 (z. B. User nicht in `user_profiles`): Backend erstellt ggf. Profil und weist Rolle zu; sonst Meldung vom Backend (z. B. „User … not found“).

3. **Rolle entfernen**
   - Im gleichen Modal bei „Current Roles“ auf **Minus-Icon** klicken.
   - Erwartung: Erfolgsmeldung, Rolle aus der Liste verschwunden.

4. **Benutzer deaktivieren / aktivieren / löschen**
   - Deaktivieren: Gelbes Icon (UserMinus) → Bestätigung.
   - Aktivieren: Grünes Icon (UserPlus) bei inaktiven Usern.
   - Löschen: Rotes Icon (UserX) → Bestätigungsdialog mit Grund.
   - Erwartung: Erfolgsmeldung und aktualisierte Liste; bei Fehler Anzeige der Backend-Meldung (z. B. `detail`).

---

## 2. Fehlerfälle (403/404)

- **403 (Forbidden)**  
  - Z. B. als Nutzer ohne Admin-Recht auf `/admin/users` gehen oder API direkt aufrufen.  
  - Erwartung: Klare Meldung wie „Permission denied“ (oder übersetzte Variante), nicht nur HTTP-Status.

- **404 (Not found)**  
  - Z. B. Rolle einem Auth-User zuweisen, der noch kein `user_profiles`-Eintrag hat (Backend legt ihn an); oder nicht existierende User-ID.  
  - Erwartung: Anzeige der Backend-`detail`-Meldung (z. B. „User … not found“), wo möglich.

- **Netzwerk/Timeout**  
  - Backend abstellen und Aktion ausführen.  
  - Erwartung: Verständliche Fehlermeldung (z. B. Timeout oder „Failed to fetch“).

---

## 3. Konkrete API-Requests (optional)

Mit `curl` (Token durch echten Admin-JWT ersetzen):

```bash
# Benutzerliste (erwartet 200 oder 403)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer YOUR_JWT" \
  "http://localhost:8000/api/admin/users?page=1&per_page=10"

# Rollen (erwartet 200 oder 403)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer YOUR_JWT" \
  "http://localhost:8000/api/admin/roles"

# Rolle zuweisen (erwartet 200, 400, 403 oder 404)
curl -s -X POST -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
  -d '{"role":"viewer"}' \
  "http://localhost:8000/api/admin/users/USER_UUID/roles"
```

Frontend ruft die APIs über die Next.js-API-Routen (z. B. `/api/admin/...`) auf, die zum Backend weiterleiten.
