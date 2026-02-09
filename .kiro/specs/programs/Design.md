# Programs – Design

## 1. Hierarchy and Data Flow

```
Portfolio (existing)
  └── Program (new)
        ├── Program name, description
        ├── Aggregated: total_budget, total_actual_cost, project_count
        └── Projects (program_id = program.id)
  └── Ungrouped projects (program_id IS NULL)
```

- **Portfolios page** (`/app/portfolios/page.tsx`): Renders a **tree view**.
  - Level 0: Portfolio (expand/collapse).
  - Level 1: Programs (and “Ungrouped” virtual node).
  - Level 2: Projects.
- Clicking Portfolio/Program/Project navigates to the corresponding detail or list (existing behaviour for portfolio/project; program detail can be added later).
- Drag-and-drop: Project → Program or Project → Ungrouped; one PATCH per drop.

---

## 2. API Design

### Backend (FastAPI)

| Method | Path | Description |
|--------|------|-------------|
| GET | /programs?portfolio_id={id} | List programs for a portfolio; optional aggregated metrics. |
| POST | /programs | Create program (portfolio_id, name, description). |
| GET | /programs/{id} | Get program with optional aggregated metrics and project count. |
| PATCH | /programs/{id} | Update program. |
| DELETE | /programs/{id} | Delete program (projects get program_id = NULL). |
| POST | /programs/suggest | Body: { portfolio_id, project_ids?: [] }. Returns suggested groups (program names + assignments). |

### Next.js API (Proxy)

- `GET/POST /api/programs` – proxy to backend with `?portfolio_id=` for GET.
- `GET/PATCH/DELETE /api/programs/[programId]` – proxy by id.
- `POST /api/programs/suggest` – proxy to backend POST /programs/suggest.

---

## 3. Portfolios Page – Tree View

**File:** `app/portfolios/page.tsx`

- **Data:** Fetch portfolios; for each portfolio fetch programs (GET /api/programs?portfolio_id=) and projects (GET /api/projects?portfolio_id=). Build a tree: `Portfolio → [ Program → Projects[], Ungrouped → Projects[] ]`.
- **UI:**
  - Tree rows: indentation by level (portfolio 0, program 1, project 2).
  - Expand/collapse per portfolio (and optionally per program).
  - Icons: Portfolio (folder), Program (folder or box), Project (file or box).
  - Program row: show aggregated budget/cost and project count if available.
- **Drag-and-drop (@dnd-kit):**
  - Draggable: Project row (and optionally Program row for reorder later).
  - Droppable: Program row, “Ungrouped” area.
  - On drop: PATCH /api/projects/{projectId} with { program_id: programId \| null }; then update local tree.
- **AI grouping:**
  - Button “Gruppier thematisch” (or “AI vorschlagen”) per portfolio.
  - Calls POST /api/programs/suggest with portfolio_id.
  - Modal or inline list: suggested program names and which projects go where; “Anwenden” creates programs and assigns projects via API.

---

## 4. Database

- **programs** (new table): id (UUID), portfolio_id (UUID FK), name, description, sort_order (int, default 0), created_at, updated_at.
- **projects**: add column **program_id** (UUID nullable FK to programs.id). Existing portfolio_id unchanged; program.portfolio_id must equal project.portfolio_id when program_id is set (enforced in API or trigger).

---

## 5. RBAC

- New permissions: program_read, program_create, program_update, program_delete.
- Mapped to admin and portfolio_manager (same as portfolio_*).
- Program list/get filtered by portfolio access (user can only see programs in portfolios they can read).

---

## 6. AI Suggest

- Backend: POST /programs/suggest.
- Input: portfolio_id, optional project_ids (default: all projects in portfolio).
- Logic: Use project name/description (and optionally status) to cluster; return list of { program_name, project_ids[] }. If OpenAI is configured, use a short prompt to suggest thematic names and groupings; else use simple keyword-based grouping or return empty.
- Output: { suggestions: [ { program_name: string, project_ids: string[] } ] }.

---

## 7. Proactive Alerts (Later)

- Program row can show a badge (e.g. “Budget überzogen” or “3 at-risk”) when backend provides alert summary; endpoint can be GET /programs/{id}/alerts or include in GET /programs/{id}.
