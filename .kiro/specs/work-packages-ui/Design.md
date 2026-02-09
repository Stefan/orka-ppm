# Work Packages UI – Design

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js App                                                                 │
│  /project-controls (project selected)                                        │
│       ├── Tab: ETC/EAC  (existing; add "Based on N WPs" + link)             │
│       ├── Tab: Forecast (existing)                                           │
│       ├── Tab: Earned Value (existing; add WP summary cards)                  │
│       ├── Tab: Work Packages (NEW – Hub)                                      │
│       │     Tree table, toolbar, inline edit, drag-drop                      │
│       └── Tab: Analytics (existing)                                           │
│  /projects/[id]  →  optional block: WP summary + "Manage work packages"     │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js API Routes (Proxy)                                                  │
│  GET    /api/projects/[projectId]/work-packages                               │
│  POST   /api/projects/[projectId]/work-packages                              │
│  GET    /api/projects/[projectId]/work-packages/[wpId]                        │
│  PATCH  /api/projects/[projectId]/work-packages/[wpId]                        │
│  DELETE /api/projects/[projectId]/work-packages/[wpId]                        │
│  GET    /api/earned-value/work-packages/[projectId]  (existing summary)       │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FastAPI Backend                                                             │
│  New or extend: routers/work_packages.py or project_controls                  │
│  GET/POST   /projects/{project_id}/work-packages                              │
│  GET/PATCH/DELETE /projects/{project_id}/work-packages/{wp_id}               │
│  Existing: GET /earned-value/work-packages/{project_id} (summary)            │
│  Services: WorkPackageService (extend with create, update, delete)            │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Supabase                                                                    │
│  work_packages (existing 020_project_controls_schema.sql)                   │
│  Triggers: validate_work_package_hierarchy, update_updated_at                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Design

### Backend (FastAPI)

| Method | Path | Description |
|--------|------|-------------|
| GET | /projects/{project_id}/work-packages | List all work packages for project (flat or tree); optional ?parent_id= for lazy children. |
| POST | /projects/{project_id}/work-packages | Create work package (body: name, description?, budget, start_date, end_date, responsible_manager, parent_package_id?). Validate hierarchy. |
| GET | /projects/{project_id}/work-packages/{wp_id} | Get one work package. |
| PATCH | /projects/{project_id}/work-packages/{wp_id} | Update (partial: name, budget, dates, percent_complete, actual_cost, earned_value, responsible_manager, parent_package_id, is_active). Validate hierarchy. |
| DELETE | /projects/{project_id}/work-packages/{wp_id} | Delete (or soft-delete is_active=false). Handle children (cascade or set parent to null per schema). |
| GET | /earned-value/work-packages/{project_id} | **Existing.** Summary: work_package_count, total_budget, total_earned_value, total_actual_cost, average_percent_complete. |

### Next.js API (Proxy)

- `GET/POST /api/projects/[projectId]/work-packages` – proxy to backend.
- `GET/PATCH/DELETE /api/projects/[projectId]/work-packages/[wpId]` – proxy by id.
- `GET /api/earned-value/work-packages/[projectId]` – existing proxy (if any) or call backend from server action.

---

## 3. Work Package Hub – Layout and Components

**Location:** Tab "Work Packages" inside `ProjectControlsDashboard` when a project is selected.

**File:** e.g. `components/project-controls/WorkPackageHub.tsx` or `app/project-controls/components/WorkPackageHub.tsx`.

- **Toolbar**
  - "Add work package" (root).
  - "Add child" (enabled when one row selected).
  - "Expand all" / "Collapse all".
  - Filter: responsible (dropdown), date range (optional).
  - Search: filter by name (client-side or query param).
- **Tree table**
  - Columns: (expand/collapse), name, responsible, budget, actual cost, earned value, % complete, start, end, actions (edit, delete).
  - Rows: one per work package; indentation by depth (e.g. padding-left: depth * 16px).
  - Parent rows: show **rollup** (sum of children for budget, AC, EV; weighted average or sum for % complete); or compute client-side from flat list.
  - Inline edit: click cell (or F2) → input/dropdown; Save on blur/Enter, Cancel on Escape.
- **Virtualization**
  - Use existing pattern (e.g. react-window List or similar) when row count > 50; flatten tree to "visible rows" (expanded nodes only) and render only visible slice.
- **Drag-and-drop**
  - @dnd-kit (consistent with portfolios/hierarchy): draggable row, droppable row as "drop as child"; on drop call PATCH to update parent_package_id; validate no cycles (backend returns 400 if invalid).

**Data flow**

- Fetch: GET /api/projects/{projectId}/work-packages → build tree in state (or use flat list + parent_id for rendering).
- Create: POST with parent_package_id=null or selected id; then invalidate cache and refetch or optimistic add.
- Update: PATCH; optimistic update; on error revert and toast.
- Delete: DELETE with confirmation modal; then invalidate and refetch or optimistic remove.

---

## 4. Integration Points in Existing UI

- **ETCEACCalculator.tsx**
  - When method is "bottom_up": show line "Based on N work packages" (N from summary or from list length); link "View / Edit work packages" → switch to Work Packages tab or open Hub.
- **EarnedValueDashboard.tsx**
  - Fetch `getWorkPackageSummary(projectId)` (existing API); display cards or a row: Count, Total budget, Total EV, Total AC, Avg % complete; link "Manage work packages" to Hub tab.
- **Project detail page** (`app/projects/[id]/page.tsx`)
  - Optional block: "Work packages: N packages, €X budget, Y% complete" + button "Manage work packages" → `/project-controls?project=:id` with Work Packages tab active (or direct route if preferred).
- **Change orders**
  - In change order line item form: add optional field "Work package" (dropdown or combobox from GET /api/projects/{id}/work-packages); save as work_package_id. Existing backend supports this.

---

## 5. Database (No Schema Change for MVP)

- Table `work_packages` already exists (migration 020).
- Optional: add `sort_order` (integer) per parent for sibling order if drag-drop reorder is required; otherwise order by name or created_at.

---

## 6. RBAC

- Reuse project-level access: user who can read/edit the project can read/edit its work packages.
- Or define: work_package_read, work_package_create, work_package_update, work_package_delete and map to same roles as project_controls (e.g. admin, project_manager).

---

## 7. File and Component Structure

- `backend/routers/work_packages.py` or extend `routers/earned_value.py` / project_controls router with work package CRUD.
- `backend/services/work_package_service.py` – extend with create, update, delete; keep get_work_packages, get_work_package_summary.
- `app/api/projects/[projectId]/work-packages/route.ts` – GET list, POST create.
- `app/api/projects/[projectId]/work-packages/[wpId]/route.ts` – GET one, PATCH, DELETE.
- `lib/project-controls-api.ts` – add listWorkPackages(projectId), createWorkPackage(projectId, body), updateWorkPackage(projectId, wpId, body), deleteWorkPackage(projectId, wpId).
- `components/project-controls/WorkPackageHub.tsx` – main Hub (toolbar + tree table).
- `components/project-controls/WorkPackageTreeTable.tsx` – virtualized tree table with inline edit and DnD.
- `components/project-controls/WorkPackageSummaryCards.tsx` – reusable summary block (for EV tab and project detail).
- `ProjectControlsDashboard.tsx` – add tab "Work Packages" and render WorkPackageHub when projectId present.

---

## 8. Optional Later: Templates, Copy, Bulk, Import

- **Copy from project:** Modal "Copy work packages from project" → select project → GET that project's WPs → POST to current project (with optional "reset budget/dates").
- **Bulk edit:** Multi-select (checkboxes) + toolbar "Set responsible", "Shift dates"; PATCH multiple in one or N calls.
- **Import:** Upload CSV; parse columns; validate; preview table; "Apply" → POST each or batch endpoint.
- **Templates:** Predefined JSON structures (name + hierarchy); "Apply template" creates WPs via POST.
