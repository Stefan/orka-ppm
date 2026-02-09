# Entity Hierarchy – Design

## 1. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js App                                                     │
│  /admin/hierarchy  →  AdminHierarchyPage (Tree + Detail-Card)    │
│       │                                                          │
│       ├── Tree (react-arborist oder @dnd-kit Tree)              │
│       │     Portfolio → Program → Project (Drag&Drop)            │
│       │                                                          │
│       └── Detail-Card (rechts): Form Create/Edit                 │
│             Modals: New Portfolio / New Program / New Project   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js API Routes (Proxy)                                      │
│  /api/portfolios, /api/programs, /api/projects                   │
│  /api/projects/sync  →  Backend POST /projects/sync              │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend                                                 │
│  routers/portfolios.py, routers/programs.py, routers/projects.py │
│  services/project_sync.py  (AI-Matching, Roche Fetch)            │
│  RBAC: require_permission + organization_id scope               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase                                                        │
│  portfolios (organization_id, path ltree)                       │
│  programs (portfolio_id, path ltree)                            │
│  projects (program_id, portfolio_id, path ltree)                │
│  Realtime: optional channel für Alerts                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. /admin/hierarchy – Seiten-Layout

**Datei:** `app/admin/hierarchy/page.tsx`

- **No-Scroll-Layout**: Zwei Spalten (z. B. CSS Grid oder Flex).
  - **Links (z. B. 40%)**: Tree-View, feste Höhe (z. B. calc(100vh - header)), overflow-y auto.
  - **Rechts (60%)**: Detail-Card mit Formular für die aktuell gewählte Entität (Portfolio, Program, Project) oder Platzhalter "Select a node".
- **Tree**:
  - Wurzel-Knoten: "Portfolios" (virtuell) → Kinder: Portfolio-Nodes.
  - Portfolio-Node: Kinder = Programs.
  - Program-Node: Kinder = Projects.
  - Drag&Drop: Project in anderes Program verschieben; optional Program unter anderes Portfolio (wenn gewünscht). Reorder innerhalb derselben Ebene.
- **Modals**:
  - "New Portfolio": Felder name, organization_id (Dropdown/Input).
  - "New Program": name, portfolio_id (aus Tree-Kontext).
  - "New Project": name, portfolio_id, program_id (optional).
  - Submit → POST an entsprechende API; bei Erfolg Tree neu laden oder optimistisch einfügen.
- **Technik**: react-arborist für Tree (mit react-dnd oder @dnd-kit für Drag&Drop), oder eigener Tree mit @dnd-kit (bereits im Projekt). Suspense für Lazy-Load der Seite.

---

## 3. ltree – Pfad-Schema

- **portfolios**: `path = 'p.' || id::text` (z. B. `p.a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`). Labels: nur alphanumerische Kurzform (ltree-konform), z. B. `p.<short_uuid>`.
- **programs**: `path = (SELECT path FROM portfolios WHERE id = programs.portfolio_id) || 'g.' || programs.id::text` (z. B. `p.xxx.g.yyy`).
- **projects**: `path = (SELECT p.path FROM programs pr JOIN portfolios p ON pr.portfolio_id = p.id WHERE pr.id = projects.program_id) || 'j.' || projects.id::text`; wenn program_id NULL, dann Portfolio-Pfad + `j.<id>` (z. B. über portfolio_id).
- **Ancestor-Query**: "Alle Projects unter Portfolio X" → `WHERE path <@ 'p.<portfolio_id>'::ltree`.
- **Trigger**: Bei INSERT/UPDATE von program_id/portfolio_id den path neu setzen.

---

## 4. Backend – Create-Endpoints & Validation

- **portfolios**: POST Body { name, organization_id }. Validation: name nicht leer; organization_id optional wenn Admin. RBAC: portfolio_create; bei Manager: organization_id muss eigene Org sein.
- **programs**: POST Body { name, portfolio_id }. Validation: portfolio_id existiert. RBAC: program_create; Zugriff auf Portfolio prüfen (über organization_id des Portfolios).
- **projects**: POST Body { name, portfolio_id, program_id? }. Validation: portfolio_id existiert; falls program_id gesetzt, muss Program zu diesem Portfolio gehören. RBAC: project_create. Path nach Insert setzen (Service oder DB-Trigger).

---

## 5. Backend – /projects/sync

- **POST /projects/sync** (FastAPI): Body z. B. { "source": "roche", "options": { "dry_run": true } }.
  - **Flow**: 1) Externe API anfragen (Roche); 2) Response auf Projekt-Liste mappen; 3) Für jede Zeile (oder für Commitments/Actuals) **AI-Matching** (Grok/OpenAI): bestehende projects nach name, description, po_number, vendor vergleichen → Score (0–100); 4) Response: { "created": [...], "matched": [ { "project_id", "score", "suggestion" } ] }.
- **AI-Matching**: Service `project_sync.py` mit Funktion `match_commitment_to_projects(po_number, vendor, amount, ...)` → Liste von (project_id, score). Ziel ≥95% Accuracy durch Prompt + Fallback auf Heuristik.

---

## 6. Proaktive Alerts (Supabase Realtime)

- **Channel**: z. B. `entity_changes` mit Filter auf organization_id oder user_id.
- **Events**: INSERT auf projects (optional programs/portfolios) → Payload { type: "new_project", program_id, project_id, name }. Frontend abonnieren und Toast/Banner anzeigen: "Neuer Project in Program X – approve?".
- **Konfiguration**: Optional Tabelle `alert_rules` (user_id, event_type, scope) für Phase 3.

---

## 7. Domain-Modelle (Frontend + Backend)

- **Frontend** (`lib/domain/entities.ts`): TypeScript-Typen für Portfolio, Program, Project (mit path, organization_id); Helper für Tree-Nodes (id, type, label, children, parentId).
- **Backend**: Bereits in `models/projects.py` (PortfolioCreate/Response, ProgramCreate/Response, ProjectCreate/Update/Response). Erweiterung: organization_id in Portfolio; path in Response optional für Queries.

---

## 8. Dateistruktur (Implementierung)

- `lib/domain/entities.ts` – Typen + Tree-Node-Builder
- `app/admin/hierarchy/page.tsx` – AdminHierarchyPage (Tree + Detail + Modals)
- `app/api/portfolios/route.ts`, `app/api/programs/route.ts`, `app/api/projects/route.ts` – bestehend; ggf. `app/api/projects/sync/route.ts` (Proxy)
- `backend/routers/portfolios.py`, `backend/routers/programs.py`, `backend/routers/projects.py` – erweitern (Validation, RBAC, path)
- `backend/services/project_sync.py` – Sync + AI-Matching
- `backend/routers/projects_sync.py` oder Endpoint in `projects.py`: POST /projects/sync
