# SSO (Single Sign-On) – Requirements

## Kontext
PPM-SaaS (Next.js 16 + Tailwind + Supabase + FastAPI). Bestehendes Supabase-Auth (JWT, organization_id). SSO 10x besser: OAuth2 (Google/Microsoft), SAML (Okta/Azure AD), Real-time Session-Management, Admin-Config, AI-gestütztes Error-Handling.

## Funktionale Anforderungen

### OAuth2-Provider
- **FR-1** Google OAuth2 für SMBs: Login mit Google-Konto, Redirect zurück in die App, Session über Supabase.
- **FR-2** Microsoft OAuth2 (Azure AD / Entra) für SMBs: Login mit Microsoft-Konto, gleicher Flow wie Google.

### SAML / Enterprise
- **FR-3** Okta als IdP (Enterprise): Optional SAML-Flow oder Okta als OAuth2-IdP, sodass Roche-ähnliche Kunden sich mit Unternehmens-Login anmelden.
- **FR-4** Azure AD (SAML/OpenID) für Enterprise: Einmalanmeldung mit bestehendem Azure AD-Mandanten.

### Admin-UI
- **FR-5** Route `/admin/sso`: Tabelle mit allen SSO-Providern (Name, Status Enabled/Disabled, letzter Fehler). Button „Config“ öffnet Modal mit Key/Secret- oder Metadata-Eingabe (je nach Provider).
- **FR-6** Enable/Disable pro Provider ohne Config zu löschen; nur aktivierte Provider werden auf der Login-Seite angezeigt.

### Frontend-Login
- **FR-7** Auth-Page (Login) erweitern: SSO-Buttons „Login with Google“, „Login with Microsoft“ (lucide-react Icons). Bei Klick Redirect an Supabase OAuth bzw. Backend-Callback-URL.
- **FR-8** Nach erfolgreichem SSO-Login: Redirect zu /dashboards; Session wie bei E-Mail/Passwort.

### Backend / Callback
- **FR-9** Callback-Endpoint für OAuth-Redirects: Empfängt Code/State von IdP, tauscht gegen Tokens, liest E-Mail aus Profil, mappt E-Mail-Domain auf organization_id (z. B. @roche.com → Org Roche), erstellt/aktualisiert User in Supabase und leitet Frontend mit Session weiter.
- **FR-10** RBAC-Integration: SSO-User erhalten Rolle basierend auf Claims (z. B. role aus IdP oder Default-Rolle pro Org).

### Session & Fehler
- **FR-11** Real-time Session-Management: Bestehendes Supabase onAuthStateChange beibehalten; optional Session-Check über Backend für Konsistenz.
- **FR-12** AI-gestütztes Error-Handling: Bei typischen Fehlern (z. B. invalid_client) Anzeige eines Vorschlags wie „Vorschlag: Überprüfe Client-ID/Secret in Supabase Dashboard“.

### Tests
- **FR-13** E2E mit Playwright: SSO-Flow simulieren (z. B. Login-Seite öffnen, SSO-Button sichtbar, Klick führt zu Redirect oder Mock-Callback).

## Nicht-funktionale Anforderungen
- **NFR-1** Client IDs/Secrets nur serverseitig oder im Supabase Dashboard; nicht im Frontend-Bundle.
- **NFR-2** Redirect-URIs strikt prüfen (Whitelist), CSRF (State) bei OAuth nutzen.
- **NFR-3** Logging von SSO-Login-Versuchen (Erfolg/Fehler) für Audit.

## Abhängigkeiten
- Supabase Auth (OAuth-Provider in Projekt aktivieren).
- Optional: Backend für eigenen Callback (Code-Exchange, Org-Mapping, dann Redirect mit Token).
