# Costbook 10x – Design

## Overview

UI and layout design for the Unified Costbook view on the Financials page, including panels, grid/cards, forecast Gantt, and Distribution Settings modal.

---

## 1. Route and Container

- **Route**: `app/financials/page.tsx` – Tab **Costbook**.
- **Container**: When Costbook tab is active, render a single container with **Unified View** layout:
  - CSS Grid: `grid grid-rows-[auto_1fr_auto]` (or equivalent) so that:
    - Row 1: Header/KPIs (auto height).
    - Row 2: Main content (Overview + Forecast + List) – takes remaining space, internal scroll.
    - Row 3: Optional footer (auto height).
  - No page-level vertical scroll; overflow only inside the main content area.

---

## 2. Projects Grid (Left / Overview)

- **Position**: Left or top section in the main content (Overview panel).
- **Content**: Project cards (or rows in list mode) with **all Cost Book columns** as key-value pairs.
- **Columns** (each as label : value):
  - Pending Budget, Approved Budget, Control Estimate  
  - Open Committed, Invoice Value, Remaining Commitment  
  - VOWD, Accruals, ETC, EAC, Delta EAC, Variance  
- **Hover**: Show additional details or tooltip (e.g. breakdown, last updated).
- **Responsive**: Cards on small screens; compact list or table on larger screens.

---

## 3. Forecast Panel (Right)

- **Content**: Gantt chart (existing `CashOutGantt`) with **Distribution Rules**.
- **Behaviour**:
  - Show cash-out timeline per project/line.
  - Duration and Profile (from distribution settings) drive the shape of the forecast.
  - Button or link to open **Distribution Settings** modal and/or **Distribution Rules** panel.
- **Data**: From costbook API and distribution engine (periods, amounts).

---

## 4. List Panel (CES/WBS Tree + Table)

- **Hierarchy**: Hierarchical CES/WBS tree (existing `HierarchyTreeView`) – expandable nodes.
- **Optional**: Virtualized transaction table with line-level distribution (e.g. `VirtualizedTransactionTable`).
- **Columns** on tree nodes: Budget, Spend, Variance (and optionally EAC, etc.) as defined in Cost Book columns.

---

## 5. Distribution Settings Modal

- **Type**: Inline modal (overlay), not full-page.
- **Controls**:
  - **Profile** dropdown: Manual (Linear), Custom, (Phase 2: AI suggested).
  - **Duration** dropdown: Project, Task, Custom.
  - **From date** / **To date**: Date pickers; disabled or pre-filled when Duration = Project/Task.
- **AI** (Phase 2):
  - Buttons such as “Based on history: Linear recommended” that set Profile (and optionally Duration/Dates).
- **Live preview**: Use existing `DistributionPreview` component; show period breakdown and amounts.
- **Voice input** (Phase 2): Button to activate Web Speech API; parse date phrases (e.g. “March 15 2025”) and fill From/To.

---

## 6. Distribution Rules Panel

- Shown in Forecast area or as a slide-out/panel.
- List of rules (project-level and, in Phase 3, line-level).
- Each rule: name, profile, duration type, from/to, scope (project vs. line/WBS).
- Actions: Create, Edit, Delete, Apply to selected projects/lines.

---

## 7. Component Map

| Area | Component | Notes |
|------|-----------|--------|
| Page | `app/financials/page.tsx` | Tab Costbook; container with grid-rows |
| Main view | `Costbook.tsx` | Unified layout: Overview, Forecast, List |
| Overview | `ProjectsGrid`, `ProjectCard` | Cards/rows with Cost Book columns |
| Forecast | `CashOutGantt`, `DistributionRulesPanel` | Gantt + rules |
| List | `HierarchyTreeView`, optional `VirtualizedTransactionTable` | CES/WBS tree |
| Modal | `DistributionSettingsDialog` | Profile, Duration, From/To, AI, Voice, Preview |
| Preview | `DistributionPreview` | Live distribution preview inside modal |

---

## 8. Data Flow

- **Costbook data**: Backend `GET /api/v1/costbook/rows` (or `/summary`) → Frontend fetches and passes to grid/cards and tree.
- **Distribution**: Existing distribution API and `distribution-engine.ts` for preview and rules; modal and Gantt consume same settings and rules.
