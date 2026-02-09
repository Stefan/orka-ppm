# Work Packages UI – Requirements

## Overview

Work Packages are the smallest controllable units for project controls (budget, schedule, earned value). Today they exist in the backend (table `work_packages`, ETC/EAC bottom-up) but have **no UI**: no list, no CRUD, no integration in Project Controls. This spec makes Work Packages first-class in the UI with 10x better UX than typical competitors: inline edit, keyboard-first, hierarchy with rollups, virtualization, and deep integration with ETC/EAC, Change Orders, and optional WBS/Finances.

---

## 1. Data Model & Backend Read/Write

| ID | Requirement | Priority |
|----|-------------|----------|
| R1.1 | The system SHALL expose **CRUD APIs** for work packages: list by project, get one, create, update, delete. | Must |
| R1.2 | Each work package SHALL have: project_id, name, description (optional), budget, start_date, end_date, percent_complete, actual_cost, earned_value, responsible_manager, parent_package_id (optional), is_active. | Must |
| R1.3 | Work package hierarchy SHALL be validated: no circular references, max depth (e.g. 10); validation SHALL run on create/update. | Must |
| R1.4 | Existing **GET** work package summary (count, total budget, total EV, total AC, average percent complete) SHALL remain and SHALL be used in the UI where project-level rollups are shown. | Must |

---

## 2. UI – Work Package Hub (Single Place of Truth)

| ID | Requirement | Priority |
|----|-------------|----------|
| R2.1 | There SHALL be a **Work Package Hub** for a project: a dedicated view listing all work packages for the selected project in a **tree table** (hierarchy by parent_package_id). | Must |
| R2.2 | The Hub SHALL be reachable from **Project Controls** (e.g. tab "Work Packages" when a project is selected) and optionally linked from the **project detail page** (e.g. "Work Packages" section or link). | Must |
| R2.3 | The tree table SHALL show at least: name, responsible (user), budget, actual cost, earned value, percent complete, start/end dates; and SHALL show **rollup rows** for parent nodes (sum of budget/AC/EV, weighted progress). | Must |
| R2.4 | The user SHALL be able to **create** a work package (root or child of selected node), **edit** (inline or side panel), and **delete** with confirmation. | Must |
| R2.5 | Toolbar SHALL include: Add (root), Add child (when row selected), Expand/Collapse all, filter (e.g. by responsible, date range), search by name. | Should |

---

## 3. UX – Inline Edit, Keyboard, Hierarchy

| ID | Requirement | Priority |
|----|-------------|----------|
| R3.1 | **Inline edit** SHALL be supported for at least: name, budget, start date, end date, percent complete, responsible (dropdown). Save on blur or Enter; cancel on Escape; validation errors SHALL be shown inline. | Must |
| R3.2 | **Keyboard navigation** SHALL be supported: arrow up/down to change row, Enter to edit or open detail, F2 or double-click for inline edit; shortcut for "New" (e.g. N). | Should |
| R3.3 | **Drag-and-drop** SHALL allow moving a work package to another package as child (and optionally reorder among siblings); the system SHALL prevent circular references and SHALL update parent_package_id via API. | Should |
| R3.4 | Hierarchy SHALL be visually clear (indentation, expand/collapse icons); parent rollup SHALL update when children change (optimistic or refetch). | Must |

---

## 4. Performance & Scale

| ID | Requirement | Priority |
|----|-------------|----------|
| R4.1 | For projects with **more than ~50 work packages**, the list SHALL use **virtualization** (only visible rows rendered) so scrolling remains smooth (e.g. 60fps). | Must |
| R4.2 | **Optimistic updates** SHALL be used for create/update/delete: UI updates immediately; on API error, revert and show error. | Should |
| R4.3 | Work package list and summary SHALL be cached (e.g. React Query); cache SHALL be invalidated on mutations and when switching project or ETC/EAC method. | Should |

---

## 5. Integration – Project Controls, ETC/EAC, Change Orders

| ID | Requirement | Priority |
|----|-------------|----------|
| R5.1 | In **ETC/EAC** (Project Controls): when method "Bottom-up" is selected, the UI SHALL indicate that the result is based on work packages (e.g. "Based on N work packages") and SHALL link to the Work Package Hub. | Must |
| R5.2 | **Earned Value** view SHALL display work package summary (work_package_count, total_budget, total_earned_value, total_actual_cost, average_percent_complete) using the existing GET summary API. | Must |
| R5.3 | **Change order line items** SHALL support an optional **work_package_id** in the UI (dropdown or search of project's work packages); existing backend field SHALL be used. | Should |
| R5.4 | **Project detail page** SHALL show a compact work package summary (count, total budget, progress) and a link "Manage work packages" to the Hub. | Should |

---

## 6. Productivity – Templates, Bulk, Import (Later)

| ID | Requirement | Priority |
|----|-------------|----------|
| R6.1 | The system SHALL support **copy from project**: user selects another project and copies its work package structure (names, hierarchy, optionally budget/dates) into the current project. | Should |
| R6.2 | **Bulk edit** SHALL be supported: select multiple work packages and set common fields (e.g. responsible, date shift). | Should |
| R6.3 | **Import** from CSV/Excel SHALL be supported (columns: name, parent ref, budget, start, end, responsible); validation and preview before apply. | Could |
| R6.4 | **Templates** (predefined WP structures, e.g. "Construction", "Software release") SHALL be available to create a set of work packages in one action. | Could |

---

## 7. Data Model Reference (Existing)

- **work_packages**: id, project_id, name, description, budget, start_date, end_date, percent_complete, actual_cost, earned_value, responsible_manager, parent_package_id, is_active, created_at, updated_at.
- **etc_calculations**: optional work_package_id; ETC bottom-up uses work_packages.
- **change_order_line_items**: optional work_package_id (existing).

---

## 8. Non-Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| R8.1 | Work package APIs SHALL be protected by RBAC (project-level or work_package_read / work_package_create / work_package_update / work_package_delete). | Must |
| R8.2 | Work Package Hub and ETC/EAC integration SHALL be testable (unit tests for components, integration for API). | Should |
| R8.3 | Accessibility: keyboard navigation and screen reader friendly labels for table and actions. | Should |
