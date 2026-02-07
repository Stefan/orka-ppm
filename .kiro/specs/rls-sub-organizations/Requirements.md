# RLS-Erweiterung mit Sub-Organizations – Requirements

## Kontext
PPM-SaaS (Next.js 16 + Tailwind + Supabase + FastAPI). Bestehendes Datenmodell: `projects`, `commitments`, `actuals` mit `organization_id`. Erweiterung um hierarchische Organisationen und durchgängige RLS.

## Funktionale Anforderungen

### RLS-Policies
- **FR-1** Tabellen `projects`, `commitments`, `actuals` (und ggf. `financial_variances`): Zugriff nur auf Zeilen, deren `organization_id` zur sichtbaren Organisation des Users gehört **oder** zu einer Sub-Organization (Hierarchie).
- **FR-2** Sub-Organizations: Zugriff über `path` (ltree). User mit Zugriff auf Org A sieht automatisch alle Daten von Org A und allen Kindern (path <@ user_path).
- **FR-3** Admin-Override: Nutzer mit Rolle `super_admin` oder `admin` (global) sehen alle Organisationen und alle Daten (keine RLS-Einschränkung auf Org-Ebene).

### SOX-konforme Audit-Trail
- **FR-4** Alle Änderungen an geschützten Entitäten werden in `audit_logs` protokolliert: `user_id`, `action` (CREATE/UPDATE/DELETE), `entity`, `entity_id`, `old_value`, `new_value`, `occurred_at`, `organization_id`.
- **FR-5** `audit_logs` ist append-only (kein UPDATE/DELETE durch Anwendung).

### Automatisierung
- **FR-6** Auto-Policy-Script: Generierung von RLS-Policies für neue Tabellen mit `organization_id` (Template-basiert), sodass dieselben Regeln (Org + Sub-Orgs via path, Admin-Override) konsistent angewendet werden können.

### Tests
- **FR-7** E2E-Test (Playwright): User sieht nur eigene + Sub-Org-Daten; nach Wechsel der Org/Scope wird nur die erwartete Datenmenge angezeigt.

## Nicht-funktionale Anforderungen

- **NFR-1** Performance: Nutzung von `path` (ltree) und Indizes, sodass Abfragen wie `path <@ '1.2'` effizient sind.
- **NFR-2** Real-time: RLS-Checks laufen bei jeder Lese-/Schreiboperation in Supabase (Postgres); Frontend filtert keine sensiblen Daten nachträglich, sondern Backend/DB erzwingt Sichtbarkeit.
- **NFR-3** Abwärtskompatibilität: Bestehende `organization_id`-Spalten bleiben; Migration führt `path`/`depth`/`parent_id`/`type` in `organizations` ein und füllt sie für bestehende Zeilen (root = depth 0, path = id-basiert oder 1.2.3).

## Datenmodell (Organizations)

- **FR-DM1** `organizations`: `id` (uuid PK), `parent_id` (uuid nullable, FK → organizations), `name` (text), `type` (text: 'Company' | 'Division' | 'BusinessUnit' | 'Country' | 'Site'), `path` (ltree), `depth` (int4).
- **FR-DM2** ltree ermöglicht Queries: "alle Sub-Orgs unter Path" z. B. `WHERE path <@ '1.2'` bzw. "Org und Sub-Orgs" `WHERE path @> '1.2' OR path = '1.2'` (bzw. `<@` je nach Definition).
- **FR-DM3** RLS-Policies nutzen User-Org-Path: User sieht nur Rows mit `organization_id` in Menge { Org selbst + Sub-Orgs }, z. B. über Join mit `organizations` und `path <@ user_org_path`.

## Abhängigkeiten
- Supabase (Postgres) mit RLS und ltree-Extension.
- Bestehende Tabellen: `organizations`, `commitments`, `actuals`, `financial_variances`, `audit_logs`, `user_roles`.
