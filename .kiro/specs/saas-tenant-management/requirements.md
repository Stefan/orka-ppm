# Requirements Document: SaaS Tenant / Organisation Management

## Introduction

Diese Spec beschreibt die Verwaltung von Tenants (Kunden/Organisationen) für das PPM-SaaS. Die Verwaltung erfolgt **in der gleichen App** in einem speziell abgesicherten Bereich. Es gibt zwei Ebenen: **Super-Admin** (Plattformbetreiber) und **Org-Admin** (Kunden-Administrator pro Tenant). Die bestehende Tenant-Isolation (`tenant_id` / `organization_id`) bleibt zentral; neue Funktionen erweitern sie um sichtbare Verwaltung und optional Limits/Billing.

## Glossary

- **Tenant / Organisation**: Ein Kunde (Firma, Abteilung) mit eigener Datenisolierung; alle fachlichen Daten sind über `tenant_id` / `organization_id` gefiltert.
- **Super-Admin**: Rolle des Plattformbetreibers; darf alle Tenants sehen, anlegen, bearbeiten, deaktivieren und (optional) Limits/Billing verwalten.
- **Org-Admin**: Rolle pro Tenant; verwaltet nur die eigene Organisation (Mitglieder, Rollen, ggf. Organisations-Settings wie Name/Logo).
- **Tenant-Verwaltung**: CRUD für Tenants/Organisationen, nur für Super-Admins sichtbar.
- **Organisations-Settings**: Einstellungen pro Tenant (Name, Slug, Logo, aktiv/inaktiv, Limits), für Super-Admin voll, für Org-Admin nur lesend/begrenzt bearbeitbar (z. B. Name/Logo).

## Data Model (Supabase)

**Table: organizations** (falls noch nicht vorhanden oder erweitern)

| Column          | Type         | Nullable | Description |
|-----------------|--------------|----------|-------------|
| id              | uuid         | NO       | PK, default gen_random_uuid() |
| name            | text         | NO       | Anzeigename (z. B. Firmenname) |
| slug            | text         | YES      | Eindeutiger Slug (z. B. für Subdomains/URLs) |
| logo_url        | text         | YES      | Logo-URL |
| is_active       | boolean      | NO       | default true; false = Tenant deaktiviert |
| settings        | jsonb        | YES      | Erweiterbar: plan, limits, billing_id, etc. |
| created_at      | timestamptz  | NO       | default now() |
| updated_at      | timestamptz  | NO       | default now() |

- Unique constraint auf `slug` (wenn verwendet).
- Bestehende Tabellen (projects, audit_logs, user_roles, …) referenzieren weiterhin `tenant_id` / `organization_id` (UUID = organizations.id).

**Optional: organization_members** (falls Zuordnung User ↔ Organisation explizit verwaltet wird)

| Column          | Type         | Nullable | Description |
|-----------------|--------------|----------|-------------|
| id              | uuid         | NO       | PK |
| organization_id | uuid         | NO       | FK organizations(id) |
| user_id         | uuid         | NO       | FK auth.users(id) |
| role            | text         | NO       | z. B. org_admin, member |
| created_at      | timestamptz  | NO       | default now() |

- Ein User kann mehreren Organisationen angehören (optional; sonst reicht JWT app_metadata.tenant_id).

## Requirements

### Requirement 1: Super-Admin-Bereich (Tenant-Verwaltung)

**User Story:** Als Plattformbetreiber (Super-Admin) möchte ich alle Kunden (Tenants/Organisationen) zentral anlegen, bearbeiten und deaktivieren können.

#### Acceptance Criteria

1. ES SOLL einen abgesicherten Bereich geben (z. B. `/admin/tenants` oder `/admin/organizations`), der NUR für Nutzer mit Rolle **super_admin** zugänglich ist.
2. DIE Liste SHALL alle Organisationen mit mindestens: Name, Slug, Status (aktiv/inaktiv), Erstellungsdatum anzeigen.
3. DER Super-Admin SOLL eine neue Organisation anlegen können (Name, optional Slug, optional Logo, is_active).
4. DER Super-Admin SOLL eine bestehende Organisation bearbeiten können (Name, Slug, Logo, is_active, optional settings/Limits).
5. DER Super-Admin SOLL eine Organisation deaktivieren können (is_active = false); deaktivierte Tenants SHALL keinen Login/Zugriff mehr haben (Backend prüft Organisation aktiv).
6. DIE Aktionen SHALL über Backend-API laufen; alle Schreibzugriffe SHALL nur mit super_admin-Berechtigung möglich sein.

### Requirement 2: Org-Admin-Bereich (Eigene Organisation)

**User Story:** Als Org-Admin möchte ich die eigene Organisation (Name, Logo) und die Mitglieder/Rollen meiner Organisation verwalten.

#### Acceptance Criteria

1. ES SOLL einen Bereich geben (z. B. `/settings/organization` oder erweiterter Admin-Bereich), der für **org_admin** der jeweiligen Organisation zugänglich ist.
2. DER Org-Admin SOLL die eigene Organisations-Info (Name, optional Logo) bearbeiten können, sofern vom Design erlaubt; Limits/Billing SHALL nur Super-Admin ändern können.
3. DIE bestehende User-/Rollen-Verwaltung (z. B. `/admin/users`) SOLL weiterhin pro Tenant genutzt werden können; Org-Admin SHALL nur Nutzer der eigenen Organisation sehen und zuweisen können.
4. KEIN Org-Admin SOLL andere Tenants sehen oder bearbeiten können.

### Requirement 3: Sicherheit und Isolation

1. ALLE Endpoints für Tenant-CRUD (Liste, Create, Update, Deaktivieren) SHALL im Backend die Rolle **super_admin** prüfen.
2. Endpoints für Organisations-Settings (eigene Org) SHALL die **organization_id** des aktuellen Users mit der angefragten Organisation abgleichen und nur org_admin oder super_admin erlauben.
3. BEI deaktivierter Organisation (is_active = false) SHALL das Backend bei jedem Request (oder bei Login) prüfen und Zugriff verweigern (401/403).
4. DIE bestehende Datenisolation (tenant_id / organization_id in allen fachlichen Abfragen) SHALL unverändert bleiben; neue Tabellen SHALL RLS/Policy nutzen, wo sinnvoll.

### Requirement 4: Integration mit bestehendem Auth/JWT

1. DIE Zuordnung User → Organisation SOLL weiterhin über JWT **app_metadata.tenant_id** (oder organization_id) und/oder über **organization_members** / user_roles erfolgen.
2. BEI Anlegen eines neuen Tenants SOLL optional ein erster Org-Admin angelegt oder eingeladen werden können (Link zu bestehendem User-Management).
3. DIE bestehende Logik in auth/dependencies (tenant_id, organization_id aus JWT/Bridge) SHALL beibehalten und ggf. um Prüfung „Organisation aktiv“ erweitert werden.

### Requirement 5: UI/UX

1. DIE Tenant-Verwaltung SOLL im bestehenden Admin-Bereich (z. B. unter dem gleichen Menü wie User Management, Performance) erreichbar sein.
2. DIE Oberfläche SOLL ein klares, konsistentes Layout (Tabelle oder Karten) mit Aktionen „Anlegen“, „Bearbeiten“, „Deaktivieren/Aktivieren“ bieten.
3. FEHLER (z. B. Slug bereits vergeben, Validierung) SHALL benutzerfreundlich angezeigt werden.

## Out of Scope (optional spätere Erweiterungen)

- Separates „Operator“-Frontend für Plattformbetrieb.
- Vollständiges Billing/Stripe-Integration (nur Platzhalter in settings möglich).
- Subdomain-basierte Tenant-Auflösung (slug in URL); kann später ergänzt werden.
