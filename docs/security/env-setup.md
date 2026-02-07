# JWT & Auth env setup

Damit die JWT-Verifikation und der IDOR-Schutz greifen, müssen folgende Variablen gesetzt werden.

---

## Backend (`backend/.env` oder `.env` im Backend-Root)

1. **JWKS (empfohlen)** – JWT Signing Keys
   - Wenn **SUPABASE_URL** gesetzt ist, lädt das Backend die öffentlichen Schlüssel von
     `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` und verifiziert Tokens mit **RS256/ES256** (JWKS). Kein geteiltes Secret nötig; Schlüsselrotation wird von Supabase unterstützt.
   - **SUPABASE_JWT_SECRET** wird dann nur noch als **Fallback** verwendet (z. B. wenn der Token mit HS256 signiert ist oder JWKS nicht erreichbar ist).

2. **SUPABASE_JWT_SECRET** (Fallback / Legacy)
   - Wert: **JWT Secret** aus Supabase (siehe unten: „Wo ist das JWT Secret?“).
   - Wird verwendet, wenn JWKS nicht genutzt werden kann (z. B. kein SUPABASE_URL oder Token mit HS256). Ohne JWKS und ohne dieses Secret werden Tokens nur dekodiert, nicht signaturgeprüft (unsicher).
   - **Wichtig für Audit-Dashboard:** Wenn das Frontend mit Supabase eingeloggt ist und das Backend 401 zurückgibt, prüfe zuerst, ob **SUPABASE_URL** gesetzt ist (dann JWKS); sonst Secret prüfen.
   - **Prüfen:** Backend-Endpoint `GET /debug/verify-jwt` mit Header `Authorization: Bearer <dein-Session-Token>` aufrufen (nur in Development). Antwort `"valid": true` und `"method": "JWKS"` = Verifikation per JWKS; `"method": "HS256"` = Fallback mit Secret.

3. **ALLOW_DEV_DEFAULT_USER** (nur für lokales Dev ohne echte Tokens)
   - Optional: `ALLOW_DEV_DEFAULT_USER=true`
   - Nur wirksam, wenn die Umgebung `environment == "development"` ist (kein `VERCEL`, `RENDER`, etc.).
   - Erlaubt Zugriff ohne Token bzw. bei Token-Fehler mit einem Default-Admin; **niemals in Produktion setzen**.
   - Nützlich, wenn du lokal ohne Supabase-JWT-Secret testen willst (z. B. Audit-Dashboard lädt dann mit Default-User).

---

## Next.js (`.env.local` im Projektroot)

1. **SUPABASE_JWT_SECRET**
   - **Gleicher Wert** wie im Backend (JWT Secret aus Supabase Project Settings → API).
   - Wird nur in API-Routen (Server) verwendet; **nicht** mit `NEXT_PUBLIC_` prefix.

Damit können die Next.js API-Routen (Sync, Column-Views, Suggest-Description, Quick-Stats usw.) Bearer-Tokens verifizieren und die User-ID sicher aus dem Token ableiten.

---

## Audit-Dashboard: 401 beheben

Wenn das Audit-Trail-Dashboard **„Failed to fetch dashboard stats: 401“** oder „Session expired or invalid“ anzeigt:

1. **Backend:** In `backend/.env` setzen:
   - **`SUPABASE_JWT_SECRET`** = JWT Secret aus Supabase (Project Settings → API → JWT Secret). Dann akzeptiert das Backend die Supabase-Bearer-Tokens vom Frontend.
   - **Oder** (nur lokales Dev): **`ALLOW_DEV_DEFAULT_USER=true`**. Backend muss in `development` laufen (kein VERCEL/RENDER etc.). Dann wird bei fehlgeschlagener Token-Prüfung ein Default-Admin angenommen und die geschützten Endpoints (inkl. Audit) antworten mit 200.

2. **Umgebung prüfen:** Das Backend erkennt „development“, wenn weder `VERCEL` noch `RENDER` noch `HEROKU` noch `RAILWAY` gesetzt sind. Bei lokaler Ausführung (z. B. `uvicorn` auf localhost) ist das in der Regel der Fall.

3. Nach Änderung der `.env` Backend neu starten.

---

## Wo ist das JWT Secret? (Supabase)

**Nicht auf der Seite „API Keys“.** Die Publishable/Secret Keys dort sind für den **API-Zugriff** (anon, service_role), nicht das JWT-Verifizierungs-Secret.

1. **Gleiches Projekt:** Das Secret muss vom **gleichen** Supabase-Projekt stammen wie `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`.
2. **Im Dashboard:** [app.supabase.com](https://app.supabase.com) → dein **Projekt** → links **Project Settings** (Zahnrad).
3. **Eintrag „JWT Keys“** (nicht „API Keys“) wählen: **Project Settings → JWT Keys** – „Control the keys used to sign JSON Web Tokens“.
4. Dort gibt es je nach Projekt:
   - **JWT Signing Keys (JWKS):** Wenn Supabase asymmetrische Keys (RS256/ES256) nutzt, verifiziert das Backend automatisch per **JWKS**, sobald **SUPABASE_URL** gesetzt ist – kein Secret nötig.
   - **„Legacy JWT Secret“** oder Tab **Legacy:** Das **Secret** anzeigen (Reveal) und kopieren → `SUPABASE_JWT_SECRET`. Wird als Fallback genutzt, wenn JWKS nicht greift (z. B. HS256-Token).
5. **Nicht verwechseln:** anon key, service_role key, Publishable/Secret Keys und **kid** (Key ID) sind **nicht** das JWT Secret. Für JWKS reicht **SUPABASE_URL**; für den Legacy-Fallback brauchst du das **JWT Secret** aus **JWT Keys** (bzw. Legacy) oder **API → JWT Settings**.
6. In `backend/.env` eintragen: `SUPABASE_JWT_SECRET=<eingefügter Wert>` (ohne Leerzeichen) → Backend neu starten.

**Falls du den Wert nirgends kopieren kannst:** In **JWT Keys** nach einem „Reveal“- oder „Show secret“-Button bzw. einem Copy-Icon neben dem Secret schauen. Alternativ für lokales Dev: `ALLOW_DEV_DEFAULT_USER=true` in `backend/.env` setzen – dann akzeptiert das Backend bei Token-Fehlern einen Default-User und du brauchst das JWT Secret für Tests nicht.

---

## Wie wird tenant_id / organization_id gesetzt?

Das Backend liest die Tenant-/Organisations-Zuordnung des Users aus dem JWT und nutzt sie z. B. für Audit (Filter `tenant_id`), Multi-Tenancy und RLS.

1. **Aus dem JWT (Supabase)**  
   - **App Metadata:** Supabase Dashboard → **Authentication** → **Users** → User wählen → **App Metadata** (oder per API beim Anlegen/Invite).  
   - Dort z. B. setzen: `{ "tenant_id": "deine-org-uuid" }` oder `"organization_id"`.  
   - Das Backend verwendet: `payload.tenant_id` oder `payload.app_metadata.tenant_id` oder `app_metadata.organization_id`.

2. **Fallback**  
   - Wenn weder `tenant_id` noch `organization_id` im JWT stehen, wird die **User-ID** (`sub`) als `tenant_id` verwendet.

3. **Dev-Default-User**  
   - Bei `ALLOW_DEV_DEFAULT_USER=true` und Development: fester Default-User inkl. fester `tenant_id` / `organization_id` (UUID).

4. **Audit-Logs**  
   - Einträge mit `tenant_id = NULL` in der DB werden für User mit `tenant_id = "default"` angezeigt (Fallback für unzugeordnete Einträge).

---

## Kurzreferenz

| Variable | Wo | Wert |
|----------|-----|-----|
| `SUPABASE_URL` | Backend `.env` | Supabase Projekt-URL – aktiviert JWKS-Verifikation (RS256/ES256) |
| `SUPABASE_JWT_SECRET` | Backend `.env` + Next.js `.env.local` | Fallback: JWT Secret (Project Settings → API / JWT Keys) |
| `ALLOW_DEV_DEFAULT_USER` | Backend `.env` (optional) | `true` nur für lokales Dev ohne echte Tokens |
