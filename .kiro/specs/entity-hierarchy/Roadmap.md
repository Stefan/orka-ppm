# Entity Hierarchy – Roadmap

## Phase 1: Basis-Hierarchie (1–2 Wochen)

**Ziel:** DB-Hierarchie mit ltree + zentrale Admin-UI mit Tree und Drag&Drop.

| # | Aktivität | Deliverable |
|---|-----------|-------------|
| 1.1 | Migration 064: ltree, organization_id (portfolios), path (portfolios, programs, projects), Trigger | 064_entity_hierarchy_ltree_rls.sql |
| 1.2 | RLS-Policies für portfolios, programs, projects (Org-Scope, Admin-Bypass) | In 064 |
| 1.3 | Frontend: /admin/hierarchy – Layout (Tree links, Detail rechts) | page.tsx |
| 1.4 | Tree-Daten laden (portfolios → programs → projects), Node-Struktur | entities.ts + page |
| 1.5 | Tree-Komponente mit Drag&Drop (Project → Program), PATCH project | HierarchyTree |
| 1.6 | Modals: New Portfolio, New Program, New Project | Modals + API calls |
| 1.7 | Detail-Card: Form Edit für gewählten Node | HierarchyDetailCard |

**Exit-Kriterium:** Admin kann Hierarchie sehen, neue Entitäten anlegen, Projects per Drag zuordnen.

---

## Phase 2: Governance & AI (2–3 Wochen)

**Ziel:** RBAC-Scoping, Validation, Sync-Endpoint mit AI-Matching.

| # | Aktivität | Deliverable |
|---|-----------|-------------|
| 2.1 | Backend: Portfolios/Programs/Projects Create mit Validation + RBAC (Org-Scope) | routers |
| 2.2 | Backend: path nach Create/Update setzen (Service oder Trigger) | Trigger in 064 / service |
| 2.3 | POST /projects/sync: Fetch (Roche-Mock/API), Map, Response | projects_sync router |
| 2.4 | project_sync.py: AI-Matching (Grok/OpenAI) für Commitments/Actuals → project_id + score | project_sync.py |
| 2.5 | Frontend: Sync-Button/Page oder Integration in hierarchy (optional) | UI |
| 2.6 | RBAC: Manager nur eigene Org; User nur Lesen/Zuordnen | rbac.py + policies |

**Exit-Kriterium:** Create/Sync mit RBAC; AI-Matching liefert Score (z. B. 87% Fit).

---

## Phase 3: Polish (1 Woche)

**Ziel:** Realtime-Alerts, Playwright-Tests, Dokumentation.

| # | Aktivität | Deliverable |
|---|-----------|-------------|
| 3.1 | Supabase Realtime: Channel für projects INSERT; Frontend Toast "Neuer Project …" | Realtime + Toast |
| 3.2 | Playwright: hierarchy page load, New Program, Drag project, RBAC (403) | e2e tests |
| 3.3 | Docs: README oder Spec-Update mit Runbook (Migration, Env) | Roadmap/Design |

**Exit-Kriterium:** Alerts sichtbar; Tests grün; Deployment-ready.
