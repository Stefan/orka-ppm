# Design: Unified Register-Arten

## Overview

Einheitliche Register-View unter `/app/registers` mit Type-Selector, Grid/Table, Nested Grids und AI-Features. Bau auf dem Datenmodell `registers` (type, project_id, organization_id, data jsonb, status) auf.

## Architecture

### High-Level

```
┌─────────────────────────────────────────────────────────────────┐
│  /app/registers/page.tsx (Unified View)                          │
│  ├── RegisterTypeSelector (Dropdown: risk, change, cost, …)      │
│  ├── RegisterToolbar (Filters, Add, AI Suggest)                  │
│  └── RegisterGrid (ag-grid oder Table mit Inline-Panels)         │
│        ├── Row expand → NestedGrid (z. B. Mitigations, Actions)   │
│        └── RegisterCard (optional Card-View: Status-Dot, Bar)    │
└─────────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  /api/registers/*      Backend /api/registers/{type}
  (Next.js proxy)       (FastAPI CRUD + AI recommend)
         │                    │
         ▼                    ▼
  Supabase (registers)   get_current_user + RLS
```

### Data Model (Supabase)

- **registers**
  - `id` UUID PK
  - `type` TEXT NOT NULL (risk | change | cost | issue | benefits | lessons_learned | decision | opportunities)
  - `project_id` UUID NULL REFERENCES projects(id)
  - `organization_id` UUID NOT NULL
  - `data` JSONB NOT NULL DEFAULT '{}'  -- type-spezifische Felder
  - `status` TEXT NOT NULL DEFAULT 'open'
  - `created_at` TIMESTAMPTZ
  - `updated_at` TIMESTAMPTZ

RLS: SELECT/INSERT/UPDATE/DELETE mit is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()).

### Backend (FastAPI)

- **Router**: `routers/registers.py` Prefix `/api/registers`
- **Endpoints**:
  - `GET /api/registers/{type}` – List (query: project_id, status, limit, offset)
  - `POST /api/registers/{type}` – Create (body: project_id?, data, status?)
  - `GET /api/registers/{type}/{id}` – Get one
  - `PUT /api/registers/{type}/{id}` – Update
  - `DELETE /api/registers/{type}/{id}` – Delete
  - `POST /api/registers/{type}/ai-recommend` – AI recommendations (body: context optional)
- **Models**: Pydantic `RegisterCreate`, `RegisterUpdate`, `RegisterResponse` mit `data: dict`.

### Frontend Structure

- **Page**: `app/registers/page.tsx` – Client Component, Suspense-boundary, Type-Selector state, Filter state, Grid/Table.
- **Components**:
  - `RegisterTypeSelector` – Dropdown der Register-Arten (priorisiert).
  - `RegisterGrid` – Hauptgrid (ag-grid oder einfache Table mit Sort/Filter), Expand für Nested.
  - `RegisterCard` – Optional Card-Ansicht: Flex-Layout, AI-Suggest Button, Status-Dot, Progress-Bar, Hover-Details.
  - `RegisterInlinePanel` – Detail/Edit inline (kein Modal wo möglich).
- **Hooks**: `useRegisters(type, filters)`, `useRegisterRecommend(type, context)`.
- **API**: `getApiUrl('/api/registers/' + type)` für CRUD; Proxy unter `app/api/registers/[...path]/route.ts` zum Backend.

### UX Principles

- No-Pop-ups: Inline-Panels für Detail/Edit.
- Mobile-First: Responsive Grid/Cards.
- AI-Suggest sichtbar pro Register-Art (Button → Recommendations laden).
- Status-Dot und Progress-Bar auf Cards; Hover zeigt Details.
- Optional: No-Code Builder für Custom Fields/Workflows (react-flow) in späterer Phase.

### Grandiose Features (Roadmap)

- **Risk**: AR-Overlay (3D/AR Risiko-Visualisierung), Gamified Tracker (Badges).
- **Change**: Blockchain-Audit-Trail für Änderungs-Historie.
- **Cost**: Sustainability-Score (CO2/ESG).
- **Issue/Action**: Voice-to-Action (Spracheingabe).
- **Lessons Learned**: Natural Language Generation aus Logs.
- **All**: Proaktive Alerts (Supabase Realtime), Badges/Gamification.

## Correctness Properties

- Für jeden gültigen `type` liefern List/Get nur Einträge mit diesem `type` und sichtbarer organization.
- CRUD respektiert RLS (organization_id sichtbar für User).
- AI-Recommend liefert type-spezifische Felder (z. B. Risk: probability, impact; Cost: eac, etc.).

## Error Handling

- 401 bei fehlendem Auth; 403 bei RLS-Verletzung; 404 bei unbekanntem type oder id.
- Validierung von `type` und `data`-Schema optional pro type (Backend).
