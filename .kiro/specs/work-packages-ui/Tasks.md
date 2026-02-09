# Work Packages UI – Tasks

**Alle Tasks 1–10 umgesetzt.** MVP (1–5), UX (6–7), Extended (8–9), Productivity (10).

## Task 1: Backend – Work Package CRUD API ✅

- [x] **1.1** Extend `backend/services/work_package_service.py`:
  - Add `create_work_package(project_id, body)` – validate hierarchy (parent_package_id in same project, no cycle, max depth); insert into `work_packages`.
  - Add `update_work_package(project_id, wp_id, body)` – partial update; validate hierarchy if parent_package_id changed.
  - Add `delete_work_package(project_id, wp_id)` – delete row (or set is_active=false if soft-delete preferred); handle children per schema (ON DELETE SET NULL for parent_package_id).
- [x] **1.2** Add or extend router (e.g. `backend/routers/work_packages.py` or under project_controls):
  - GET `/projects/{project_id}/work-packages` – return list (flat) from WorkPackageService.get_work_packages.
  - POST `/projects/{project_id}/work-packages` – body WorkPackageCreate; call create_work_package.
  - GET `/projects/{project_id}/work-packages/{wp_id}` – return one (404 if not found or wrong project).
  - PATCH `/projects/{project_id}/work-packages/{wp_id}` – body WorkPackageUpdate; call update_work_package.
  - DELETE `/projects/{project_id}/work-packages/{wp_id}` – call delete_work_package.
- [x] **1.3** Use existing Pydantic models from `backend/models/project_controls.py` (WorkPackageCreate, WorkPackageUpdate, WorkPackageResponse); ensure response includes all fields needed by frontend.
- [x] **1.4** Register routes in FastAPI app (main.py or existing project router).
- [x] **1.5** Apply RBAC: ensure only users with project access can read/write work packages (reuse project-level checks or add work_package_* permissions).

**Deliverable:** Backend CRUD endpoints; WorkPackageService extended; RBAC applied.

---

## Task 2: Next.js API Routes (Proxy) ✅

- [x] **2.1** Create `app/api/projects/[projectId]/work-packages/route.ts`:
  - GET: proxy to backend GET `/projects/{projectId}/work-packages` (forward auth).
  - POST: proxy to backend POST with body (create).
- [x] **2.2** Create `app/api/projects/[projectId]/work-packages/[wpId]/route.ts`:
  - GET: proxy to backend GET one.
  - PATCH: proxy to backend PATCH with body.
  - DELETE: proxy to backend DELETE.
- [x] **2.3** Ensure backend base URL and auth (e.g. service token or forward user token) are correct for server-side calls.

**Deliverable:** Next.js API routes for work package CRUD; frontend can call `/api/projects/:id/work-packages` and `/api/projects/:id/work-packages/:wpId`.

---

## Task 3: Frontend API Client and Types ✅

- [x] **3.1** Add TypeScript types for WorkPackage (id, project_id, name, description, budget, start_date, end_date, percent_complete, actual_cost, earned_value, responsible_manager, parent_package_id, is_active, created_at, updated_at) in e.g. `types/project-controls.ts` or existing types file.
- [x] **3.2** In `lib/project-controls-api.ts` add:
  - `listWorkPackages(projectId)` → GET /api/projects/{projectId}/work-packages.
  - `createWorkPackage(projectId, body)` → POST.
  - `updateWorkPackage(projectId, wpId, body)` → PATCH.
  - `deleteWorkPackage(projectId, wpId)` → DELETE.
  - Keep existing `getWorkPackageSummary(projectId)`.
- [ ] **3.3** Optional: add React Query hooks (useWorkPackages(projectId), useWorkPackageSummary(projectId), useMutation for create/update/delete) with cache invalidation.

**Deliverable:** Types and API client; optional hooks.

---

## Task 4: Work Package Hub – Tab and Tree Table (MVP) ✅

- [x] **4.1** In `ProjectControlsDashboard.tsx` add a new tab "Work Packages"; when active and projectId is set, render a new component `WorkPackageHub` (or inline content).
- [x] **4.2** Implement `WorkPackageHub`:
  - Fetch work packages via listWorkPackages(projectId) (or useWorkPackages).
  - Build tree from flat list (group by parent_package_id); compute rollups for parents (sum budget, AC, EV; average or weighted % complete).
  - Toolbar: "Add work package" (root), "Add child" (when row selected); "Expand all" / "Collapse all".
  - Table: columns Name, Responsible, Budget, Actual cost, Earned value, % Complete, Start, End, Actions (Edit, Delete). Rows indented by depth; expand/collapse per parent.
- [x] **4.3** Create/Edit: use a side panel or modal with form (name, description, budget, dates, responsible_manager, parent for create); on submit call createWorkPackage or updateWorkPackage; then refetch or optimistic update.
- [x] **4.4** Delete: confirmation dialog; on confirm call deleteWorkPackage; refetch or optimistic remove.
- [x] **4.5** Link from ETC/EAC: when method is bottom_up, show "Based on N work packages" and link to switch to Work Packages tab (or scroll to Hub). Use getWorkPackageSummary for N if not loading full list.

**Deliverable:** Work Packages tab with list/tree, create/edit/delete via panel/modal; ETC/EAC link.

---

## Task 5: Earned Value and Project Detail Integration ✅

- [x] **5.1** In `EarnedValueDashboard.tsx` call getWorkPackageSummary(projectId); display summary as cards or a row (work_package_count, total_budget, total_earned_value, total_actual_cost, average_percent_complete).
- [x] **5.2** Add link "Manage work packages" that switches to Work Packages tab (or navigates to project-controls with tab=work-packages).
- [x] **5.3** On project detail page (`app/projects/[id]/page.tsx`): add optional block "Work packages" showing summary (count, total budget, avg progress) and button "Manage work packages" linking to Project Controls with project selected and Work Packages tab.

**Deliverable:** WP summary visible in Earned Value tab and on project detail; links to Hub.

---

## Task 6: Inline Edit and Keyboard (UX) ✅

- [x] **6.1** In the Hub table, make cells for name, budget, start_date, end_date, percent_complete, responsible editable inline: click or F2 to focus input/dropdown; Save on blur or Enter; Cancel on Escape.
- [x] **6.2** Validate inline (e.g. end_date >= start_date, percent 0–100); show inline error message.
- [x] **6.3** Keyboard: Arrow up/down to move focus between rows; Enter to start edit or open detail; shortcut "N" for New (optional).
- [x] **6.4** After successful inline save, call updateWorkPackage and update local state or invalidate cache.

**Deliverable:** Inline edit for key fields; keyboard navigation.

---

## Task 7: Virtualization and Performance ✅

- [x] **7.1** When flattened list of visible rows (expanded tree) has length > 50, render table body with a virtualized list (e.g. react-window List or existing project pattern) so only visible rows are in the DOM.
- [x] **7.2** Use optimistic updates for create/update/delete: update UI immediately; on API error revert and show toast.
- [x] **7.3** Cache work package list and summary (React Query or similar); invalidate on create/update/delete and when switching project.

**Deliverable:** Smooth scrolling for large WP lists; optimistic updates; cache invalidation.

---

## Task 8: Drag-and-Drop Hierarchy (Optional) ✅

- [x] **8.1** In the Hub table, make each row draggable and droppable (e.g. @dnd-kit). Drop target: "as child of this row".
- [x] **8.2** On drop: PATCH work package with parent_package_id = target row id; validate no cycle (backend already validates). Update local tree or refetch.
- [ ] **8.3** Optional: reorder among siblings (requires sort_order in DB and API support).

**Deliverable:** Drag-and-drop to reparent work packages.

---

## Task 9: Change Order Line Item – Work Package Field (Optional) ✅

- [x] **9.1** In the change order line item form (create/edit), add optional field "Work package" (dropdown or combobox) populated from listWorkPackages(projectId).
- [x] **9.2** Save selected value as work_package_id in the line item (backend already has column).

**Deliverable:** Change orders can associate line items with a work package.

---

## Task 10: Productivity – Copy from Project, Bulk Edit, Import (Later) ✅

- [x] **10.1** "Copy from project": modal to select another project; fetch its WPs; POST to current project (option to reset budget/dates). Implement in Hub toolbar.
- [x] **10.2** Bulk edit: multi-select rows (checkboxes); toolbar "Set responsible", "Shift dates"; PATCH selected WPs.
- [x] **10.3** Import CSV: upload, parse, validate, preview; "Apply" creates WPs (batch or loop POST).
- [x] **10.4** Templates: predefined structures (JSON); "Apply template" creates set of WPs.

**Deliverable:** Copy, bulk edit, import, templates (as per priority).

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Backend: CRUD API for work packages (create, update, delete, list, get one) | ✅ Done |
| 2 | Next.js: API routes proxy for work packages | ✅ Done |
| 3 | Frontend: types and API client (listWorkPackages, create, update, delete) | ✅ Done |
| 4 | Work Package Hub: tab, tree table, create/edit/delete, ETC/EAC link | ✅ Done |
| 5 | Earned Value tab + project detail: show WP summary and link to Hub | ✅ Done |
| 6 | Inline edit and keyboard navigation in Hub table | ✅ Done |
| 7 | Virtualization and optimistic updates | ✅ Done |
| 8 | Drag-and-drop to reparent (optional) | ✅ Done |
| 9 | Change order line item: work_package_id field (optional) | ✅ Done |
| 10 | Copy from project, bulk edit, import, templates (later) | ✅ Done |

---

## Roadmap Phases

| Phase | Scope | Tasks |
|-------|--------|--------|
| **MVP** | Hub visible, CRUD, ETC/EAC + EV integration | 1, 2, 3, 4, 5 |
| **UX** | Inline edit, keyboard, performance | 6, 7 |
| **Extended** | DnD, Change orders | 8, 9 |
| **Productivity** | Copy, bulk, import, templates | 10 |
