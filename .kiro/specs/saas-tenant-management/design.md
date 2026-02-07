# Design Document: SaaS Tenant / Organisation Management

## Overview

Die Tenant-Verwaltung wird **in der bestehenden App** in einem abgesicherten Admin-Bereich realisiert. Zwei Rollen: **Super-Admin** (alle Tenants verwalten) und **Org-Admin** (eigene Organisation und Mitglieder). Bestehende Nutzer- und Rollenverwaltung sowie `tenant_id`/`organization_id`-Isolation bleiben die Basis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js App (eine Codebase)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Öffentlich / Kunden        │  Admin-Bereich (/admin/*)                      │
│  - Login, Dashboards,       │  - User Management (bestehend)                  │
│    Projekte, Audit, …       │  - Performance, Feature Toggles (bestehend)    │
│  - Alle Daten gefiltert    │  - Tenants/Organisations (NEU, super_admin only) │
│    nach tenant_id          │  - Org-Settings (NEU, org_admin für eigene Org)│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend                                                             │
│  - get_current_user → tenant_id / organization_id aus JWT/Bridge            │
│  - require super_admin für: GET/POST/PATCH /api/v1/admin/organizations       │
│  - require org_admin + scope für: PATCH /api/v1/organizations/:id (eigene)   │
│  - Bei is_active=false → 403 für alle Endpoints der Tenant-Nutzer           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Supabase                                                                    │
│  - organizations (id, name, slug, logo_url, is_active, settings, …)         │
│  - Bestehende Tabellen: tenant_id / organization_id = organizations.id      │
│  - RLS: organizations lesbar für authenticated; Schreibzugriff service_role │
│    oder über Backend-API mit super_admin-Check                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Roles

| Rolle        | Sicht auf Tenants          | Aktionen Tenants              | Org-Settings (eigene Org) |
|-------------|----------------------------|------------------------------|----------------------------|
| super_admin | Alle                       | CRUD, aktivieren/deaktivieren| Lesen + Bearbeiten         |
| org_admin   | Nur eigene (read)           | Keine                        | Lesen + Bearbeiten (Name, Logo) |
| user        | —                          | —                            | Nur lesen (optional)       |

## Data Model (Detail)

**organizations**

- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `slug` (text, UNIQUE, nullable) – für spätere Subdomains/URLs
- `logo_url` (text, nullable)
- `is_active` (boolean, default true)
- `settings` (jsonb) – z. B. `{ "plan": "pro", "max_users": 50, "billing_id": null }`
- `created_at`, `updated_at` (timestamptz)

Bestehende Tabellen (projects, audit_logs, user_roles, …) nutzen weiterhin `tenant_id` bzw. `organization_id`; diese verweisen auf `organizations.id` (oder bleiben NULL für „unassigned“).

## Page Layout and Routes

### Super-Admin: Tenant-Verwaltung

**Route:** `/admin/tenants` (oder `/admin/organizations`)

- **Zugriff:** Nur `super_admin`.
- **Layout:**
  - Oben: Titel „Tenants“ / „Organisationen“, Button „Neue Organisation“.
  - Tabelle: Spalten Name, Slug, Status (aktiv/inaktiv), Erstellt, Aktionen (Bearbeiten, Aktivieren/Deaktivieren).
  - „Bearbeiten“ öffnet Modal oder Seite mit Formular: Name, Slug, Logo-URL, is_active, optional settings (Plan, Limits).
  - „Neue Organisation“: gleiches Formular; nach Speichern optional „Org-Admin einladen“ (Link zu User-Management mit Pre-Filter organization_id).

### Org-Admin: Eigene Organisations-Settings

**Route:** `/settings/organization` (oder unter `/admin` als „Organisation“)

- **Zugriff:** Nutzer mit Rolle `org_admin` (oder `super_admin`) für die **eigene** organization_id.
- **Layout:**
  - Anzeige: Name, Logo, Slug (read-only), Status (aktiv/inaktiv, read-only).
  - Bearbeitbar: Name, Logo-URL (Upload optional später).
  - Keine Bearbeitung von Limits/Billing (nur Super-Admin).

### Bestehende Integration

- **Admin-Navigation:** Neuer Menüpunkt „Tenants“ / „Organisationen“ unter dem bestehenden Admin-Dropdown (TopBar/Sidebar), nur sichtbar wenn `super_admin`.
- **User Management:** Bleibt unter `/admin/users`; Filterung nach organization_id/tenant_id wie bisher; Org-Admin sieht nur User der eigenen Organisation.

## API Design (Backend)

### Super-Admin: Organisations CRUD

- `GET /api/v1/admin/organizations`  
  - Query: `?is_active=true|false` (optional).  
  - Response: Liste `{ id, name, slug, logo_url, is_active, settings, created_at }`.  
  - Auth: `super_admin` erforderlich.

- `POST /api/v1/admin/organizations`  
  - Body: `{ name, slug?, logo_url?, is_active?, settings? }`.  
  - Auth: `super_admin`.  
  - Response: erstellte Organisation.

- `PATCH /api/v1/admin/organizations/:id`  
  - Body: Teil-Update (name, slug, logo_url, is_active, settings).  
  - Auth: `super_admin`.  
  - Response: aktualisierte Organisation.

- `GET /api/v1/admin/organizations/:id`  
  - Auth: `super_admin`.  
  - Response: eine Organisation inkl. optional Nutzeranzahl.

### Org-Admin: Eigene Organisation

- `GET /api/v1/organizations/current`  
  - Liefert die Organisation des aktuellen Users (organization_id aus JWT/Bridge).  
  - Auth: authenticated.  
  - Response: `{ id, name, slug, logo_url, is_active, settings }` (is_active/settings nur lesen).

- `PATCH /api/v1/organizations/current`  
  - Body: `{ name?, logo_url? }` – nur diese Felder erlaubt für org_admin.  
  - Auth: org_admin oder super_admin; Scope = eigene organization_id.  
  - Response: aktualisierte Organisation.

### Aktivitätsprüfung (Middleware oder Dependency)

- Nach `get_current_user`: wenn `organization_id` gesetzt und Organisation existiert mit `is_active = false`, dann 403 mit Hinweis „Organisation deaktiviert“.

## Component Structure (Frontend)

- **`/app/admin/tenants/page.tsx`** – Liste + „Neue Organisation“; Tabellenzeilen mit Aktionen; nur für super_admin sichtbar/aufrufbar.
- **`TenantForm`** (Modal oder Seite) – Felder Name, Slug, Logo, is_active, optional settings; Validierung; Submit → Backend POST/PATCH.
- **`/app/settings/organization/page.tsx`** (oder unter admin) – Lese-/Bearbeiten-Formular für eigene Org (Name, Logo); Nutzung von `GET/PATCH /api/v1/organizations/current`.
- **Permission Guard:** Wiederverwendung bestehender Guards; neue Permission z. B. `Permission.SUPER_ADMIN` oder Nutzung bestehender Admin-Rolle.

## Security Summary

1. **Super-Admin:** Nur explizit vergebene Rolle; alle Tenant-CRUD-Endpoints prüfen diese Rolle.
2. **Org-Admin:** Nur eigene organization_id; PATCH current nur erlaubte Felder.
3. **Deaktivierte Tenant:** Backend lehnt Requests von Nutzern einer inaktiven Organisation ab (403).
4. **RLS:** organizations-Tabelle lesbar für authenticated (nur eigene Org oder alle wenn super_admin); Schreiben über Backend mit service_role oder strikte RLS-Policies.

## Testing

- Backend: Unit-Tests für Organizations-CRUD; Permission-Tests (super_admin vs. org_admin vs. user); Test „deaktivierte Org → 403“.
- Frontend: Guards (super_admin sieht Tenants-Link, andere nicht); Org-Settings nur eigene Org.
- E2E (optional): Super-Admin legt Tenant an, bearbeitet, deaktiviert; Org-Admin bearbeitet Name/Logo.
