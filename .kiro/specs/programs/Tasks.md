# Programs – Tasks

## Task 1: Database – Programs Table and program_id on Projects

- [ ] **1.1** Create migration `063_programs.sql`:
  - Create table `programs` (id UUID PK, portfolio_id UUID NOT NULL FK portfolios(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, description TEXT, sort_order INT DEFAULT 0, created_at, updated_at).
  - Add column `program_id` (UUID nullable FK programs(id) ON DELETE SET NULL) to `projects`.
  - Create index on `programs(portfolio_id)` and `projects(program_id)`.
- [ ] **1.2** Apply migration in Supabase (SQL Editor or migration runner).
- [ ] **1.3** Optionally add CHECK or trigger so that when project.program_id IS NOT NULL, project.portfolio_id = (SELECT portfolio_id FROM programs WHERE id = project.program_id).

**Deliverable:** Migration file; DB updated.

---

## Task 2: Backend – Programs API and AI Suggest

- [ ] **2.1** Add Pydantic models: ProgramCreate, ProgramUpdate, ProgramResponse (id, portfolio_id, name, description, sort_order, created_at, updated_at; response can include total_budget, total_actual_cost, project_count).
- [ ] **2.2** Create `backend/routers/programs.py`:
  - GET /programs?portfolio_id= – list programs for portfolio; optionally include aggregated metrics.
  - POST /programs – create program.
  - GET /programs/{id} – get one program (with optional aggregates).
  - PATCH /programs/{id} – update program.
  - DELETE /programs/{id} – delete program (set projects.program_id = NULL or leave ON DELETE SET NULL).
  - POST /programs/suggest – body: { portfolio_id, project_ids?: [] }; return { suggestions: [ { program_name, project_ids } ] }; use OpenAI if available, else heuristic/keyword grouping.
- [ ] **2.3** Add RBAC: program_read, program_create, program_update, program_delete; assign to admin and portfolio_manager. Use service_supabase where needed (same pattern as portfolios).
- [ ] **2.4** Register router in `main.py`: `app.include_router(programs_router)`.

**Deliverable:** `backend/routers/programs.py`, model updates, RBAC updates, main.py change.

---

## Task 3: Frontend – Tree View and Drag & Drop

- [ ] **3.1** Next.js API routes:
  - GET/POST `/api/programs` (GET with query portfolio_id).
  - GET/PATCH/DELETE `/api/programs/[programId]`.
  - POST `/api/programs/suggest` (proxy to backend).
- [ ] **3.2** Rewrite `app/portfolios/page.tsx`:
  - Load portfolios, then for each portfolio load programs and projects.
  - Build tree: Portfolio → [ Program → Projects[], Ungrouped → Projects[] ].
  - Render tree with expand/collapse (per portfolio); Program row shows aggregated budget/count if API provides it.
  - Use **@dnd-kit** (DndContext, draggable project rows, droppable program/ungrouped).
  - On drop: PATCH project with new program_id; update local state.
- [ ] **3.3** “AI vorschlagen” / “Gruppier thematisch”: button opens modal or inline; call POST /api/programs/suggest; show suggestions; “Anwenden” creates programs and PATCHes projects.
- [ ] **3.4** Links: Portfolio → /portfolios/{id}, Project → /projects/{id} (or existing project detail). Program → optional /portfolios/{portfolioId}?program={programId} or program detail page later.

**Deliverable:** `/api/programs/*` routes; updated `app/portfolios/page.tsx` with tree and drag-drop; testable in browser.

---

## Task 4: Proactive Alerts (Optional)

- [ ] **4.1** Backend: endpoint or field for program alerts (e.g. budget overrun, at-risk count).
- [ ] **4.2** Frontend: badge/icon on Program row when alerts present.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Supabase: programs table + program_id in projects |
| 2 | Backend: /api/programs CRUD + /api/programs/suggest (AI) |
| 3 | Frontend: Tree view + Drag&Drop (react-dnd / @dnd-kit) on Portfolios page |
