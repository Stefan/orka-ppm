# SSO (Single Sign-On) – Design

## Architektur

### Option A: Supabase-native OAuth (empfohlen für Phase 1)
- **Login:** Frontend ruft `supabase.auth.signInWithOAuth({ provider: 'google' | 'azure', options: { redirectTo: origin + '/auth/callback' } })` auf und leitet auf `data.url` weiter.
- **Callback:** Supabase leitet nach Login auf `redirectTo` mit Hash (`#access_token=...`) zurück. Eine **Client-Seite** `/auth/callback` (nicht API-Route) lädt die App, Supabase-Client liest den Hash und setzt die Session, dann Redirect zu `/dashboards`.
- **Org-Mapping:** Optional per Supabase Post-Auth Hook oder Backend-Job: E-Mail-Domain → organization_id in user_metadata oder separater Tabelle.

### Option B: Backend-Callback (für flexibles Org-Mapping)
- **Login:** Frontend leitet auf Backend `/api/auth/sso/authorize?provider=google` weiter. Backend baut OAuth-URL (Client ID aus Config), redirect_uri = Backend-Callback-URL, State = CSRF-Token.
- **Callback:** IdP leitet an Backend `/api/auth/sso/callback?code=...&state=...` weiter. Backend tauscht Code gegen Access Token, holt E-Mail/Claims, ermittelt organization_id (z. B. aus Domain oder Config), erstellt/aktualisiert User in Supabase (Admin API) und leitet Frontend mit Session-Token (z. B. Query-Param oder Set-Cookie) auf `/dashboards` weiter.
- **RBAC:** Backend weist beim Anlegen/Update des Users die Rolle zu (aus Claim oder Default pro Org).

## AuthPage (Login)
- **Layout:** Bestehendes Formular (E-Mail/Passwort) beibehalten. Darüber oder darunter: Trenner „Or sign in with“, dann Tailwind-Buttons in einer Zeile:
  - „Login with Google“ (Google-Icon, z. B. lucide-react oder SVG)
  - „Login with Microsoft“ (Microsoft/Window-Icon)
- **Klick:** `signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })`, dann `window.location.href = data.url`. Bei Fehler: Anzeige mit optionalem AI-Vorschlag (z. B. „Überprüfe Key“).

## Callback-Page
- **Route:** `/auth/callback` (Page, nicht API). Seite rendert kurz „Signing you in…“, in useEffect: Supabase liest Session aus URL-Hash (automatisch bei getSession), dann `router.replace('/dashboards')`. Bei Fehler: Redirect zu `/login?error=...`.

## Admin SSO-Page
- **Route:** `/admin/sso`. Tailwind-Table: Spalten Name (Google, Microsoft, Okta, Azure AD), Status (Enabled/Disabled), Letzter Fehler, Actions (Config, ggf. Test).
- **Config-Modal:** Pro Provider Formular: Enabled-Checkbox, Client ID (Text), Client Secret (Password). Hinweis: „Für Supabase OAuth: Konfiguration im Supabase Dashboard unter Authentication → Providers.“ Optional: Speichern in Backend für Option B.
- **Backend:** GET/PUT `/api/auth/sso/config` oder `/api/admin/sso/providers` – Liste/Update Enabled-Status und Platzhalter für Keys (Backend speichert nur verschlüsselt oder verweist auf Supabase).

## E-Mail-Domain → organization_id
- **Regel-Tabelle oder Config:** z. B. `{ "roche.com": "org-uuid-roche", "acme.com": "org-uuid-acme" }`. Backend-Callback oder Post-Auth-Hook nutzt diese Tabelle nach E-Mail-Extrakt (Domain) und setzt user.app_metadata.organization_id oder schreibt in user_organizations.

## RBAC
- **Claims:** Falls IdP Rolle liefert (z. B. `roles` oder `groups`), Backend mappt auf interne Rollen (viewer, manager, admin) und speichert in user_roles.
- **Default:** Ohne Claim: Default-Rolle pro Org (z. B. „user“).

## Sicherheit
- State-Parameter bei OAuth für CSRF. Redirect-URIs nur erlaubte Origins. Keine Secrets im Frontend.
