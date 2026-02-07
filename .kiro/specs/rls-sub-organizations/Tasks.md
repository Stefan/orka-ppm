# RLS-Erweiterung mit Sub-Organizations – Tasks

## Task 1: Supabase SQL – organizations-Erweiterung, ltree, RLS-Policies
- **1.1** ltree-Extension aktivieren: `CREATE EXTENSION IF NOT EXISTS ltree;`
- **1.2** Tabelle `organizations` erweitern: Spalten `parent_id`, `type`, `path` (ltree), `depth` (int4); Migrationsskript idempotent (ADD COLUMN IF NOT EXISTS / DO $$).
- **1.3** Bestehende Zeilen migrieren: `parent_id = NULL`, `depth = 0`, `path` eindeutig setzen (z. B. row_number oder feste '1', '2' für Roots).
- **1.4** Trigger oder Funktion: Bei INSERT/UPDATE von `organizations` `path` und `depth` aus `parent_id` ableiten (path = parent.path + self_label, depth = parent.depth + 1).
- **1.5** Hilfsfunktionen: `user_primary_org_id(uuid)` (aus user_roles/profile), `user_org_path(uuid)` (path der primären Org), `is_admin(uuid)` (super_admin/admin global).
- **1.6** RLS-Policies für `organizations`, `commitments`, `actuals`, `financial_variances`: SELECT/INSERT/UPDATE/DELETE nach Muster "organization_id in sichtbaren Orgs (path <@ user path) oder is_admin()".
- **1.7** Policies für `audit_logs`: SELECT nur eigene/Org-relevante Einträge; INSERT nur service_role/authenticated mit user_id = auth.uid().

**Deliverable:** Ein ausführbares SQL-Script (z. B. `lib/supabase/policies.sql` oder Migration unter `backend/migrations/`), das auf Supabase/Postgres ausgeführt werden kann.

---

## Task 2: audit_logs erweitern (falls nötig)
- **2.1** Sicherstellen, dass `audit_logs` Spalten hat: user_id, action, entity, entity_id, old_value, new_value, occurred_at, organization_id. Fehlende Spalten ergänzen.
- **2.2** Trigger für commitments/actuals (optional): Bei INSERT/UPDATE/DELETE automatisch Zeile in audit_logs schreiben (SOX). Alternativ im Backend (FastAPI) zentral loggen.

**Deliverable:** Migration oder Ergänzung in `policies.sql`.

---

## Task 3: Auth-Provider Update (user path, react-query)
- **3.1** Neuer API-Endpoint (Next.js): GET `/api/users/me/organization-context` (oder Erweiterung von `/api/rbac/user-permissions`) liefert `organizationId`, `organizationPath`, `isAdmin` für aktuellen User.
- **3.2** SupabaseAuthProvider: Nach Session-Load zusätzlich Organization-Context fetchen; State `userOrganizationId`, `userOrganizationPath`, `isOrgAdmin`; in Context bereitstellen.
- **3.3** Optional: React Query (`useQuery`) für Organization-Context mit Cache und Stale-Time; bei Logout Invalidierung.

**Deliverable:** Erweiterter SupabaseAuthProvider + ggf. API-Route.

---

## Task 4: Admin Orgs-Page mit Tree-View + Edit
- **4.1** Route `/admin/orgs`: Seite mit Tree-View (rekursive Tailwind-Komponente oder react-arborist). Daten: GET `/api/admin/organizations?hierarchy=1` (oder bestehenden Endpoint erweitern) mit Baum-Struktur.
- **4.2** Edit-Modal: Name, Type, Parent (Dropdown), ggf. Slug/Code. PATCH/POST an `/api/admin/organizations` bzw. `/api/admin/organizations/:id`. Bei Parent-Änderung Backend neu berechnet path/depth.
- **4.3** Create: Gleiches Modal, Parent wählbar (inkl. "Root"). Nach Create Tree neu laden.
- **4.4** Suspense: Seite mit `<Suspense fallback=…>` für asynchrone Tree-Daten.

**Deliverable:** `app/admin/orgs/page.tsx` vollständig, testbar.

---

## Task 5: Playwright E2E – RLS + Sub-Orgs
- **5.1** Test-Setup: Zwei User (A: normale Org, B: Sub-Org von A) oder ein User mit zwei Org-Kontexten; Test-Daten: commitments/actuals mit unterschiedlichen organization_id.
- **5.2** Szenario 1: User A loggt ein; Liste Commitments/Actuals zeigt nur A + Sub-Orgs. User B loggt ein; zeigt nur B (und ggf. eigene Sub-Orgs).
- **5.3** Szenario 2: Admin-User loggt ein; sieht alle Organisationen und kann alle Daten sehen (Listen enthalten Einträge aus mehreren Orgs).
- **5.4** Optional: API-Tests (über Next.js Route oder Backend) prüfen, dass Response nur erlaubte organization_id enthält.

**Deliverable:** Playwright-Testdatei unter `__tests__/e2e/` (z. B. `rls-sub-organizations.spec.ts`).

---

## Reihenfolge
1 → 2 → 3 → 4 → 5 (SQL zuerst, dann Backend/API, dann Frontend, dann E2E).
