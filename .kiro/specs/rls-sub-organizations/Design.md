# RLS-Erweiterung mit Sub-Organizations – Design

## Architektur-Überblick

- **Backend (Supabase/Postgres):** RLS-Policies auf Basis von `organization_id` und Organisations-Hierarchie (`path` ltree). Hilfsfunktion z. B. `user_org_path()` oder JWT-Claim liefert den für den User gültigen Org-Path; Policies prüfen `organization_id IN (SELECT id FROM organizations WHERE path <@ current_user_org_path())`.
- **Backend (FastAPI):** Nutzt weiterhin Service-Role oder prüft Tenant-Isolation über `organization_id`; kann gleiche path-Logik in Middleware nutzen.
- **Frontend:** SupabaseAuthProvider erweitert um `userOrganizationPath` / `userOrganizationId`; Abfragen gehen über Next.js API-Routes (getApiUrl), die das Backend aufrufen; optional Filter nach `organization_id`/path im Client für UI (Dropdowns).
- **Admin-UI:** `/admin/orgs` – Tree-View der Organisations-Hierarchie (Tailwind + rekursive Komponente oder react-arborist), Edit-Modal für Name/Type/Parent.
- **Audit-Dashboard:** `/admin/audit` – Tabelle mit Filter (user, entity, action, date range, organization_id).

## Datenmodell (detailliert)

### organizations (erweitert)
| Spalte      | Typ       | Beschreibung |
|------------|-----------|--------------|
| id         | uuid PK   | wie bisher |
| parent_id  | uuid NULL FK(organizations) | übergeordnete Org |
| name       | text      | wie bisher |
| type       | text      | 'Company', 'Division', 'BusinessUnit', 'Country', 'Site' |
| path       | ltree     | Hierarchie-Pfad, z. B. '1', '1.2', '1.2.3' (numerisch oder id-basiert) |
| depth      | int4      | 0 = Root, 1 = direktes Kind, … |
| (bestehend)| code, slug, logo_url, is_active, settings, created_at, updated_at | unverändert |

- **path:** Eindeutig pro Node. Konvention: Root = '1', erste Ebene '1.1', '1.2', zweite '1.1.1' usw. Alternativ: path aus UUID-Kurzformen (z. B. first 4 Zeichen) für stabile IDs. Empfehlung: integer-basierte Pfade (1, 1.1, 1.2) für Lesbarkeit; Zuordnung über `organization_paths` oder direkt `path` pro Zeile.
- **depth:** Redundant, aber nützlich für `WHERE depth <= user_max_depth` oder Anzeige-Level.

### Hilfsview / Funktion
- **user_organization_paths:** View oder Funktion `get_user_visible_org_ids(auth.uid())` → Set von organization_id, die der User sehen darf (eigene zugewiesene Org + alle Sub-Orgs via path).
- **Admin:** Wenn User `super_admin` oder globaler `admin` → keine Einschränkung (Policy WITH CHECK / USING true für diese Rollen).

### RLS-Policy-Muster (Beispiel commitments)
```sql
-- SELECT: User sieht nur commitments, deren organization_id in sichtbaren Orgs liegt
CREATE POLICY "commitments_select_org_path" ON commitments FOR SELECT
USING (
  is_admin() OR
  organization_id IN (
    SELECT id FROM organizations o
    WHERE o.path <@ (SELECT path FROM organizations WHERE id = user_primary_org_id())
    OR o.id = user_primary_org_id()
  )
);
```
- `user_primary_org_id()`: aus user_roles (scope_type='organization', scope_id) oder aus user_profiles/organization_id; Fallback auf erste zugewiesene Org.
- `is_admin()`: EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin','admin') AND (ur.scope_type IS NULL OR ur.scope_type = 'global')).

## Frontend

- **SupabaseAuthProvider:** Nach Login/Session fetch von `/api/rbac/user-permissions` oder neuer Endpoint `/api/users/me/organization-context`; Response enthält `organizationId`, `organizationPath`, `isAdmin`. Context-Wert z. B. `userOrganizationPath: string | null`, `userOrganizationId: string | null`, `isOrgAdmin: boolean`. Optional React Query für Caching/Invalidation.
- **Filter in Listen:** Bei Abfragen (commitments, actuals, projects) wird serverseitig bereits gefiltert (RLS); Frontend kann aktuell gewählte Org (für Anzeige) in State halten und bei Admin-Override alle Orgs anzeigen.

## Admin Orgs-Page (`/admin/orgs`)

- **Tree-View:** Rekursive Komponente (Tailwind): pro Node Expand/Collapse, Label (name, type), Button Edit. Daten: GET `/api/admin/organizations?hierarchy=1` liefert Baum (parent_id, children).
- **Edit-Modal:** Felder name, type, parent_id (Dropdown/Combobox mit bestehenden Orgs), ggf. slug/code. Bei Änderung von parent_id: Backend berechnet path/depth neu (Trigger oder Service).
- **Create:** Gleiches Modal, parent_id wählbar (null = Root).

## Audit-Dashboard (`/admin/audit`)

- **Tabelle:** Spalten user_id (oder email), action, entity, entity_id, old_value, new_value, occurred_at, organization_id. Pagination, Sortierung.
- **Filter:** User, Entity, Action, Datum von/bis, Organization (Dropdown aus sichtbaren Orgs). API: GET `/api/audit/logs` mit Query-Parametern.

## Auto-Policy-Script (Idee)

- **Input:** Tabellenname, Spalte mit organization_id (default `organization_id`).
- **Output:** SQL-Blöcke für CREATE POLICY (SELECT/INSERT/UPDATE/DELETE) nach obigem Muster. Script kann in CI oder bei Migration ausgeführt werden, um neue Tabellen mit gleichen Regeln zu versehen.

## Migration (organization_id → path)

- Bestehende Zeilen in `organizations`: `parent_id = NULL`, `depth = 0`, `path = '1'` für erste Org, dann '2', '3' für weitere Roots; oder alle unter '1', '1.1', '1.2' wenn eine Root-Org gewünscht ist.
- Daten in commitments/actuals: `organization_id` bleibt; keine Änderung an Fremdschlüsseln. RLS wird um path-Logik erweitert.

## Sicherheit

- RLS immer aktiv für commitments, actuals, financial_variances, organizations, audit_logs.
- Service-Role (Backend) umgeht RLS; Backend muss weiterhin tenant_id/organization_id aus JWT/Header setzen und nur erlaubte Daten zurückgeben.
- Audit: Nur Service-Role oder definierte Rolle darf in audit_logs schreiben; SELECT für User nur eigene/Org-relevante Einträge (Policy mit path/org_id).
