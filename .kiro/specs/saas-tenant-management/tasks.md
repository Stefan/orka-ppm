# Implementation Plan: SaaS Tenant / Organisation Management

## Overview

Implementierung der Tenant-/Organisationsverwaltung in der bestehenden App: Super-Admin-Bereich für alle Tenants, Org-Admin-Bereich für die eigene Organisation, Backend-APIs mit Rollenprüfung und optional Prüfung „Organisation aktiv“. Die bestehende tenant_id/organization_id-Isolation bleibt unverändert.

## Tasks

### Task 1: Data Model und Migration

- [ ] 1.1 Prüfen, ob Tabelle `organizations` bereits existiert (z. B. in migrations oder Supabase). Falls nein: Migration anlegen mit Spalten `id`, `name`, `slug` (unique), `logo_url`, `is_active` (default true), `settings` (jsonb), `created_at`, `updated_at`.
- [ ] 1.2 Unique-Constraint auf `slug` (wenn slug genutzt wird); Index auf `is_active` für Filter.
- [ ] 1.3 RLS: Tabelle `organizations` aktivieren; Policy für SELECT (authenticated: eigene Org oder super_admin alle); INSERT/UPDATE/DELETE nur über Backend (service_role) oder Policy mit super_admin-Check.
- [ ] 1.4 Bestehende Referenzen auf organization_id/tenant_id in anderen Tabellen dokumentieren; sicherstellen, dass FK auf organizations(id) gesetzt werden kann, wo sinnvoll.

### Task 2: Backend – Rollen und Permission

- [ ] 2.1 Rolle **super_admin** im System verankern (z. B. in auth/rbac.py oder Permissions-Enum): z. B. `Permission.SUPER_ADMIN` oder Nutzung bestehender Admin-Rolle mit erweiterter Berechtigung.
- [ ] 2.2 Dependency `require_super_admin` (oder erweitern require_permission) für Endpoints, die nur Super-Admins erlauben.
- [ ] 2.3 Optional: Prüfung „Organisation aktiv“ in Middleware oder Dependency: nach get_current_user abfragen, ob organizations.is_active für current_user.organization_id true ist; sonst 403 mit klarer Meldung.

### Task 3: Backend – Admin Organisations API

- [ ] 3.1 Router anlegen (z. B. `backend/routers/organizations.py` oder unter `admin`) mit Prefix `/api/v1/admin/organizations`.
- [ ] 3.2 `GET /api/v1/admin/organizations` – Liste aller Organisationen (optional Query `?is_active=true|false`); Auth: super_admin; Response: Liste mit id, name, slug, logo_url, is_active, settings, created_at.
- [ ] 3.3 `POST /api/v1/admin/organizations` – Body: name, slug (optional), logo_url (optional), is_active (optional), settings (optional); Auth: super_admin; Validierung (name erforderlich, slug eindeutig); Insert in organizations; Response: erstellte Organisation.
- [ ] 3.4 `GET /api/v1/admin/organizations/:id` – eine Organisation; Auth: super_admin.
- [ ] 3.5 `PATCH /api/v1/admin/organizations/:id` – Teil-Update; Auth: super_admin; Response: aktualisierte Organisation.
- [ ] 3.6 Nutzung von service_supabase oder bestehendem DB-Client für Schreibzugriffe; Tenant-Isolation nur lesend (Super-Admin sieht alle).

### Task 4: Backend – Current Organisation API (Org-Admin)

- [ ] 4.1 `GET /api/v1/organizations/current` – liefert Organisation des aktuellen Users (organization_id aus current_user); Auth: authenticated; Abfrage organizations nach id = current_user.organization_id; Response: ein Objekt (ohne sensible Felder, wenn nötig).
- [ ] 4.2 `PATCH /api/v1/organizations/current` – Body: nur name, logo_url erlaubt; Auth: org_admin oder super_admin; Prüfung: nur eigene organization_id; Update organizations set name, logo_url; Response: aktualisierte Organisation.

### Task 5: Frontend – Super-Admin Tenant-Verwaltung

- [ ] 5.1 Neue Seite `/app/admin/tenants/page.tsx` (oder `/admin/organizations/page.tsx`): Titel, Button „Neue Organisation“, Tabelle mit Spalten Name, Slug, Status, Erstellt, Aktionen.
- [ ] 5.2 Daten laden via GET `/api/.../admin/organizations` (Next.js API-Route als Proxy zum Backend); nur anzeigen, wenn User super_admin (Guard oder Redirect).
- [ ] 5.3 Modal oder Inline-Formular „Neue Organisation“: Felder Name, Slug (optional), Logo-URL (optional), Aktiv (Checkbox); Submit → POST; bei Erfolg Liste aktualisieren.
- [ ] 5.4 Modal oder Seite „Bearbeiten“: gleiche Felder + is_active; PATCH bei Submit; bei „Deaktivieren“ Bestätigung, dann PATCH is_active=false.
- [ ] 5.5 Admin-Navigation erweitern: Menüpunkt „Tenants“ / „Organisationen“ nur sichtbar für super_admin (z. B. in TopBar, SmartSidebar, MobileNav).

### Task 6: Frontend – Org-Settings (eigene Organisation)

- [ ] 6.1 Seite `/app/settings/organization/page.tsx` (oder unter `/admin` als „Organisation“): Anzeige der aktuellen Organisation (GET current); Felder Name, Logo (Bearbeiten erlaubt für org_admin).
- [ ] 6.2 Formular: Name, Logo-URL; Submit → PATCH `/api/.../organizations/current`; nur anzeigen/bearbeiten wenn org_admin oder super_admin.
- [ ] 6.3 Link zu dieser Seite in Settings oder Admin-Bereich für Org-Admins einbauen.

### Task 7: Next.js API Routes (Proxy)

- [ ] 7.1 `GET/POST /api/admin/organizations` – Proxy zu Backend GET/POST `/api/v1/admin/organizations`; Authorization Header durchreichen.
- [ ] 7.2 `GET/PATCH /api/admin/organizations/[id]/route.ts` – Proxy zu Backend GET/PATCH für eine Organisation.
- [ ] 7.3 `GET/PATCH /api/organizations/current/route.ts` – Proxy zu Backend GET/PATCH `/api/v1/organizations/current`.

### Task 8: Integration und Tests

- [ ] 8.1 Sicherstellen, dass neue Nutzer oder Einladungen optional organization_id (aus organizations.id) in app_metadata oder user_roles erhalten, damit sie dem richtigen Tenant zugeordnet sind.
- [ ] 8.2 Backend-Tests: Organizations CRUD nur mit super_admin; PATCH current nur mit org_admin/super_admin und eigener Org; 403 bei deaktivierter Org (wenn Task 2.3 umgesetzt).
- [ ] 8.3 Frontend: Permission-Guard für /admin/tenants; Org-Settings nur für Berechtigte sichtbar.
- [ ] 8.4 Optional: E2E – Super-Admin legt Organisation an, bearbeitet, deaktiviert; Org-Admin öffnet Organisations-Settings und ändert Name.

## Code Locations (geplant)

- **Backend:** `backend/routers/organizations.py` oder `backend/routers/admin/organizations.py`; Permissions in `backend/auth/rbac.py`; ggf. Middleware/Dependency für is_active-Check in `backend/auth/`.
- **Migrations:** `backend/migrations/xxx_organizations_tenant_management.sql`.
- **Frontend:** `app/admin/tenants/page.tsx`, `app/settings/organization/page.tsx`; API-Proxies unter `app/api/admin/organizations/`, `app/api/organizations/current/`.
- **Navigation:** `components/navigation/TopBar.tsx`, `SmartSidebar.tsx`, `MobileNav.tsx` – Menüpunkt „Tenants“ / „Organisationen“ mit Rollenprüfung.

## Abhängigkeiten

- Bestehende Auth (get_current_user, tenant_id/organization_id aus JWT/Bridge).
- Bestehendes RBAC/Rollenmodell (Erweiterung um super_admin bzw. Nutzung vorhandener Admin-Rolle).
- Supabase (organizations-Tabelle; service_role für Backend-Schreibzugriffe, wenn RLS restriktiv).
