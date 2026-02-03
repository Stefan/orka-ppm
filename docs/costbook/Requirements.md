# Costbook 10x – Requirements

## Overview

Structured requirements for the Unified Costbook view in the PPM-SaaS app (Next.js 16, Tailwind, Recharts, Supabase, FastAPI). The Costbook integrates Cost Book columns, Cash Out Forecast, Distribution Settings, and 10x enhancements (AI, interactive, proactive).

---

## 1. Unified No-Scroll Costbook View

- **Single view** with three panels: **Overview**, **Forecast**, **List**.
- **No vertical scroll** of the overall page: use a grid layout (e.g. `grid-rows-[auto_1fr_auto]`) or fixed-height regions with internal scroll containers for each panel.
- All three panels visible in one screen; overflow handled inside each panel.

---

## 2. Hierarchical CES/WBS Tree

- **Expandable hierarchy** (CES and WBS views).
- Data sourced from commitments and WBS elements.
- Existing `HierarchyTreeView` component to be extended; data from commitments/wbs_element.

---

## 3. Cost Book Columns (Grid / Card)

Columns to be displayed and optionally editable:

| Column | Description |
|--------|-------------|
| **Pending Budget** | Budget not yet approved |
| **Approved Budget** | Approved budget (e.g. from project) |
| **Control Estimate** | Baseline/control estimate |
| **Open Committed** | Sum of open commitments (e.g. PO not yet fully invoiced) |
| **Invoice Value** | Sum of invoiced amounts (actuals) |
| **Remaining Commitment** | Open Committed minus amount already invoiced/downpaid |
| **VOWD** | Value of Work Done = Actual Cost + Downpayments |
| **Accruals** | Accrued amounts (e.g. received not yet invoiced) |
| **ETC** | Estimate to Complete |
| **EAC** | Estimate at Completion |
| **Delta EAC** | EAC minus Approved Budget (or Control Estimate) |
| **Variance** | Auto-calculated (e.g. EAC − Budget, or Approved − Actual) |

All numeric columns must support formatting (currency, decimals) and optional tooltips.

---

## 4. Cash Out Forecast

- **Columns** for **Duration** and **Profile** (e.g. linear, custom) at project or line level.
- **Distribution Rules** per line: linear or custom distribution; rules configurable per WBS/line.
- Integration with existing Gantt (CashOutGantt) and distribution engine.

---

## 5. Distribution Settings Modal

- **Profile**: Dropdown – Manual (linear), Custom, optionally AI suggested (Phase 2).
- **Duration**: Dropdown – Project (use project start/end), Task, Custom (user-defined From/To).
- **From / To dates**: Date pickers; when Duration = Project or Task, can be pre-filled from project/task dates.
- **Optional 10x**:
  - AI suggestions for profile (e.g. “Based on history: Linear recommended”).
  - Live preview of distribution (existing DistributionPreview).
  - Voice input for dates (Web Speech API).

---

## 6. 10x Requirements (AI, Interactive, Proactive)

- **AI suggestions** for distribution profile (e.g. from historical spend pattern).
- **Live preview** in the Distribution Settings modal (periods and amounts).
- **Voice input** for From/To dates (Web Speech API; e.g. “March 15 2025”).
- **Predictive EAC** in columns (Phase 2): EAC field may be AI/ML-enhanced; show in grid/card with optional “AI-predictive” indicator.
- **Line-level distribution rules** (Phase 3): Apply rules per WBS/line; full rules engine support.

---

## 7. Data Model (Supabase Reference)

- **projects**: id, budget, health, name, status, start_date, end_date
- **commitments**: id, project_id, total_amount, po_number, po_status, vendor, currency, po_date, po_line_nr, po_line_text, vendor_description, requester, cost_center, wbs_element, account_group_level1, account_subgroup_level2, account_level3, custom_fields
- **actuals**: id, project_id, amount, po_no, vendor_invoice_no, posting_date, status, currency, vendor, vendor_description, gl_account, cost_center, wbs_element, item_text, quantity, net_due_date, custom_fields

Calculations (VOWD, Accruals, ETC, EAC, Variance) are defined in backend/costbook service and exposed via API.

---

## 8. Out of Scope (for this spec)

- Changes to Supabase schema beyond existing tables (unless explicitly required for new columns).
- Full ERP integration; data is assumed to be in `projects`, `commitments`, `actuals`.
