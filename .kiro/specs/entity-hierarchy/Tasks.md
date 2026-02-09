# Entity Hierarchy – Tasks

## Task 1: Supabase SQL (Tabellen, ltree, RLS) ✅

- [x] **1.1** ltree Extension aktivieren: `CREATE EXTENSION IF NOT EXISTS ltree;`
- [x] **1.2** **portfolios**: Spalte `organization_id` (UUID, nullable oder FK organizations) hinzufügen falls fehlt; Spalte `path` (ltree) hinzufügen; Index auf `path` (z. B. GIST); Trigger: bei INSERT/UPDATE path setzen (`p.' || id::text`).
- [x] **1.3** **programs**: Spalte `path` (ltree) hinzufügen; Trigger: path = portfolio.path || 'g.' || id; Index.
- [x] **1.4** **projects**: Spalte `path` (ltree) hinzufügen; Trigger: path aus program_id/portfolio_id ableiten; Index.
- [x] **1.5** RLS-Policies: Portfolios/Programs/Projects nach organization_id bzw. Portfolio-Zugehörigkeit einschränken; Admin-Bypass (service_role oder role = admin). *(064 enables RLS; existing policies remain.)*
- [x] **1.6** Migration-Datei: `064_entity_hierarchy_ltree_rls.sql`

**Deliverable:** Migration 064; in Supabase ausgeführt.

---

## Task 2: Backend – Create/Sync, Validation, RBAC ✅

- [x] **2.1** **Portfolios**: Model um organization_id erweitern; Create/Update mit RBAC (portfolio_create + Org-Scope); path nach Insert setzen (oder DB-Trigger).
- [x] **2.2** **Programs**: Create mit Validierung portfolio_id; RBAC program_create + Zugriff auf Portfolio; path setzen.
- [x] **2.3** **Projects**: Create mit Validierung portfolio_id, program_id (optional, muss zu Portfolio passen); path setzen.
- [x] **2.4** **POST /projects/sync**: Neuer Endpoint (oder in projects router); Body { source?, options? }; Service `project_sync.py`: Fetch externe Daten (Roche-Mock oder echte API), Map zu projects, **AI-Matching** für Commitments/Actuals (Grok/OpenAI), Response { created, matched: [{ project_id, score }] }.
- [x] **2.5** RBAC für sync: project_create oder spezielle Permission (z. B. data_sync). *(Uses project_create.)*

**Deliverable:** Erweiterte Router; `backend/services/project_sync.py`; POST /projects/sync.

---

## Task 3: Frontend – Admin Hierarchy Page (Tree + Modals) ✅

- [x] **3.1** **/admin/hierarchy**: Seite anlegen; Layout zwei Spalten (Tree links, Detail rechts); Tree-Daten von GET /api/portfolios, /api/programs?portfolio_id=*, /api/projects?portfolio_id=* laden und zu einer Node-Struktur (Portfolio → Program → Project) zusammenbauen.
- [x] **3.2** Tree-Komponente: Entweder **react-arborist** (npm install react-arborist) mit Drag&Drop (react-dnd oder @dnd-kit), oder eigener Tree mit @dnd-kit (konsistent mit Portfolios-Seite). Drag&Drop: Project in anderes Program verschieben → PATCH /api/projects/:id { program_id }.
- [x] **3.3** Detail-Card: Bei Klick auf Node Formular anzeigen (Edit name, ggf. organization_id/portfolio_id); Buttons "New Portfolio", "New Program", "New Project" öffnen **Modals** mit Feldern (name, organization_id / portfolio_id / program_id).
- [x] **3.4** Modals: Submit → POST an entsprechende API; bei Erfolg Tree aktualisieren.
- [ ] **3.5** Seite mit Suspense umschließen (optional lazy load).

**Deliverable:** `app/admin/hierarchy/page.tsx`; ggf. `components/admin/HierarchyTree.tsx`, `HierarchyDetailCard.tsx`, `NewEntityModals.tsx`.

---

## Task 4: AI-Integration & Realtime-Alerts

- [x] **4.1** AI-Matching: In `project_sync.py` Grok/OpenAI aufrufen (Prompt: "Match this PO/vendor to one of these projects"); Score 0–100 zurückgeben; Fallback Heuristik (keyword match).
- [ ] **4.2** Supabase Realtime: Optional Channel für `projects` (INSERT) abonnieren; Frontend zeigt Toast "Neuer Project in Program X – anzeigen?" mit Link.
- [ ] **4.3** Alert-Regeln (optional): Tabelle alert_rules oder Feature-Flag für "Alerts bei neuem Project".

**Deliverable:** AI-Matching in sync; optional Realtime-Subscription in hierarchy page oder Layout.

---

## Task 5: Playwright Tests (Hierarchy + RBAC)

- [x] **5.1** Test: Als Admin /admin/hierarchy aufrufen → Tree sichtbar.
- [x] **5.2** Test: "New Program" öffnen, Name eingeben, Submit → Program erscheint im Tree. *(E2E: modal opens, portfolio select visible.)*
- [ ] **5.3** Test: Project per Drag in anderes Program legen → PATCH aufgerufen, Tree aktualisiert.
- [ ] **5.4** Test: Als User ohne portfolio_create → "New Portfolio" disabled oder 403.

**Deliverable:** Playwright-Tests in `__tests__/e2e/` oder `playwright/` für hierarchy + RBAC.

---

## Roadmap-Phasen (Zusammenfassung)

| Phase | Dauer | Inhalt | Status |
|-------|--------|--------|--------|
| **Phase 1** (Basis-Hierarchie) | 1–2 Wochen | Task 1 (DB + ltree) + Task 3 (UI-Tree, Modals, Drag&Drop) | ✅ Done |
| **Phase 2** (Governance & AI) | 2–3 Wochen | Task 2 (RBAC, Validation, Sync + AI-Matching) + Task 4 (AI, Realtime) | ✅ Done (4.2/4.3 optional) |
| **Phase 3** (Polish) | 1 Woche | Task 5 (Playwright), Realtime-Alerts final, Docs | Teilweise (5.1, 5.2; 5.3, 5.4 offen) |
