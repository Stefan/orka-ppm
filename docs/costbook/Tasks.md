# Costbook 10x – Tasks

## Task 1: Backend – Supabase Queries and Costbook Columns

- **Goal**: Provide Costbook rows (per project, optionally per WBS/line) with all required columns and calculations.
- **Actions**:
  - Add backend router `backend/routers/costbook.py` with prefix `/api/v1/costbook`.
  - Add service `backend/services/costbook_aggregates.py` for aggregations and formulas.
  - Implement Joins over `projects`, `commitments`, `actuals`.
  - Compute and expose:
    - Pending Budget, Approved Budget, Control Estimate (from projects / config).
    - Open Committed (e.g. sum of commitments with open status).
    - Invoice Value (sum of actuals).
    - Remaining Commitment (Open Committed minus invoiced/downpaid).
    - VOWD (Value of Work Done = Actual Cost + Downpayments; clarify if downpayments are in commitments or actuals).
    - Accruals (from actuals/commitments per business rule).
    - ETC, EAC, Delta EAC, Variance (e.g. EAC = ACWP + ETC; Variance = EAC − Budget).
  - Register costbook router in the FastAPI app.
- **Deliverable**: `GET /api/v1/costbook/rows` (or `/summary`) returning list of costbook rows with the above fields.

---

## Task 2: Frontend – Grid/Card with New Columns

- **Goal**: Show all Cost Book columns in project cards and list.
- **Actions**:
  - Extend types: `CostbookRow` or extend `CostBreakdownRow` / `ProjectWithFinancials` with pending_budget, approved_budget, control_estimate, open_committed, invoice_value, remaining_commitment, vowd, accruals, etc, eac, delta_eac, variance.
  - Update `ProjectCard`: accept and display these fields as key-value pairs; add hover for details/tooltip.
  - Update `ProjectsGrid`: pass new fields to cards and list header/rows.
  - Wire data from costbook API (or existing Supabase + client-side calc) into grid/cards.
- **Deliverable**: Projects grid and cards show all Cost Book columns; layout matches Design (Overview panel).

---

## Task 3: Forecast Gantt with Distribution Rules Engine

- **Goal**: Gantt shows cash-out forecast driven by distribution rules; rules applicable at project (and later line) level.
- **Actions**:
  - Backend: Ensure distribution API supports project-scoped rules (and later line/wbs_element).
  - Frontend: Pass distribution settings and rules from Costbook state into `CashOutGantt`.
  - Add Duration and Profile columns/indicators in Gantt (or in a small table next to it).
  - DistributionRulesPanel: allow create/edit/delete/apply rules; Phase 3: add line-level scope (e.g. wbs_element).
- **Deliverable**: Cash Out Forecast panel shows Gantt with distribution-driven timeline; rules panel functional.

---

## Task 4: Distribution Settings Modal with AI and Voice

- **Goal**: Full modal experience with Profile/Duration/From/To, AI suggestions, live preview, and voice input.
- **Actions**:
  - **Phase 1**: Dropdowns for Profile (Manual/Custom), Duration (Project/Task/Custom), From/To date pickers; integrate existing `DistributionPreview` for live preview.
  - **Phase 2**: Add AI suggestion endpoint or client heuristic; add “Based on history: Linear recommended” (or similar) button that sets Profile/Duration; optional Predictive EAC in grid with “AI-predictive” indicator.
  - **Phase 2**: Voice input (Web Speech API) for From/To dates: button to start recognition, parse date phrase, fill date fields.
  - Ensure modal works for both project-level and (Phase 3) line-level distribution.
- **Deliverable**: Distribution modal with dropdowns, live preview, AI suggestion button(s), and voice input for dates.

---

## VOWD / Accruals (Phase 3)

- **VOWD**: Value of Work Done = Actual Cost + Downpayments. Backend `costbook_aggregates.py` computes VOWD as sum of actuals (invoice_value); when downpayment fields exist on commitments, add them to VOWD.
- **Accruals**: Placeholder 0 in backend until schema or business rule defines accrual source (e.g. received-not-invoiced).
- **Line-Level Rules**: `DistributionRule` type includes optional `scope` ('project' | 'line'), `wbs_element`, and `line_id`. Apply rules per WBS/line in Distribution Rules Panel and backend distribution API when scope is `line`.

---

## Implementation Order (from Plan)

1. Create docs: Requirements.md, Design.md, Tasks.md (this file).
2. Backend: costbook router + costbook_aggregates service; register router.
3. Extend types (CostbookRow, DistributionSettings with duration_type, customDistribution).
4. Costbook.tsx: Unified layout (Overview / Forecast / List), no-scroll.
5. ProjectCard / ProjectsGrid: new columns.
6. DistributionSettingsDialog: Duration type, Profile dropdown, From/To.
7. Distribution modal: AI suggestion buttons + live preview.
8. Distribution modal: Voice input (Web Speech API).
9. CashOutGantt: Duration/Profile columns, rules binding.
10. Rules engine line-level + VOWD/Accruals refinement.
