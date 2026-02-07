# SSO (Single Sign-On) – Tasks

## Task 1: Supabase Auth Providers (Dashboard + Dokumentation)
- **1.1** Im Supabase Dashboard unter Authentication → Providers: Google und Microsoft (Azure) aktivieren, Client ID/Secret eintragen, Redirect-URL hinzufügen: `https://<app>/auth/callback` bzw. `http://localhost:3000/auth/callback` für Dev.
- **1.2** Optional: SQL/Policy prüfen, dass OAuth-User gleiche RLS-Rechte haben wie E-Mail-User (bereits der Fall wenn auth.uid() gesetzt wird).
- **1.3** Dokumentation: Kurze Anleitung in README oder docs, wie Google/Microsoft in Supabase konfiguriert werden.

**Deliverable:** Dokumentation (z. B. docs/sso-setup.md) + Hinweis in Admin-SSO-UI.

---

## Task 2: Backend Callback + Config (FastAPI)
- **2.1** Router `routers/auth_sso.py` (oder `routers/auth/sso/router.py`) mit Prefix z. B. `/api/auth/sso`.
- **2.2** `GET /api/auth/sso/config` – Liste SSO-Provider (Name, enabled, last_error). Liest aus Config/DB.
- **2.3** `PUT /api/auth/sso/config` – Admin: Enabled-Status und Platzhalter für Client ID/Secret pro Provider speichern (für Option B; für Option A nur „enabled“ reicht).
- **2.4** `GET /api/auth/sso/authorize?provider=google` – Redirect zu IdP (Option B). Oder weglassen wenn nur Supabase-native genutzt wird.
- **2.5** `GET /api/auth/sso/callback?code=...&state=...` – Code-Exchange, E-Mail holen, Org aus Domain-Mapping, Supabase Admin API User anlegen/updaten, Redirect zu Frontend mit Session (Option B). Für Phase 1 kann Callback-Stub sein (Redirect zu Frontend mit Fehler-Query).

**Deliverable:** `backend/routers/auth_sso.py`, in main.py registriert.

---

## Task 3: Frontend Auth-Page (SSO-Buttons)
- **3.1** Login-Page (`app/login/page.tsx`): Über oder unter dem E-Mail-Formular SSO-Bereich mit „Or sign in with“, dann Buttons „Login with Google“, „Login with Microsoft“. Icons (lucide-react oder SVG).
- **3.2** Bei Klick: `supabase.auth.signInWithOAuth({ provider: 'google' | 'azure', options: { redirectTo: origin + '/auth/callback' } })`, dann `window.location.href = data.url`. Fehlerbehandlung mit Anzeige und optionalem Vorschlag („Überprüfe Key“).
- **3.3** Auth-Callback-Page: `app/auth/callback/page.tsx` – Client-Seite, „Signing you in…“, useEffect: Session aus URL (Supabase setzt sie automatisch), dann `router.replace('/dashboards')`, bei Fehler `router.replace('/login?error=...')`.

**Deliverable:** Erweiterte `app/login/page.tsx`, neue `app/auth/callback/page.tsx`.

---

## Task 4: Admin SSO-Page
- **4.1** Route `/admin/sso`: Seite `app/admin/sso/page.tsx` mit Tailwind-Table (Name, Status, Last Error, Actions). Daten: GET von Backend `/api/auth/sso/config` (via Next.js Proxy).
- **4.2** Config-Button öffnet Modal: Provider-Name, Enabled-Checkbox, Platzhalter Client ID / Client Secret, Hinweis „Supabase: Konfiguration im Dashboard unter Authentication → Providers.“ Speichern → PUT Config an Backend.
- **4.3** Optional: Nur anzeigen welche Provider in Supabase aktiv sind (Backend kann Supabase Config nicht auslesen, also nur unsere „enabled“-Liste).

**Deliverable:** `app/admin/sso/page.tsx`, Next.js API-Route für `/api/auth/sso/config` (Proxy).

---

## Task 5: Playwright E2E
- **5.1** Test: Login-Seite lädt, SSO-Buttons (Google/Microsoft) sind sichtbar.
- **5.2** Test: Klick auf „Login with Google“ führt zu Redirect (extern oder gleiche Origin mit Query). Optional: Mock-OAuth-Callback aufrufen und prüfen, dass Redirect zu /dashboards erfolgt.

**Deliverable:** `__tests__/e2e/sso-login.spec.ts`.

---

## Reihenfolge
1 → 2 → 3 → 4 → 5.

## Hinweis
- Phase 1: Supabase-native OAuth (Task 1 + 3 + 4 + 5), Backend nur Config-Endpoints (Task 2.2, 2.3).
- Phase 2: Eigenes Callback (Task 2.4, 2.5), E-Mail-Domain-Mapping, RBAC aus Claims.
