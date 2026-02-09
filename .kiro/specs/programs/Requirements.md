# Programs – Requirements

## Overview

Programs are the middle layer in the PPM hierarchy: **Portfolio > Program > Project**. They enable thematic grouping, aggregated metrics, and proactive alerts. This spec targets a 10x better UX than Cora: AI auto-grouping, proactive alerts, and interactive drag-and-drop.

---

## 1. Hierarchy

| ID | Requirement | Priority |
|----|-------------|----------|
| R1.1 | The system SHALL support a three-level hierarchy: **Portfolio → Program → Project**. | Must |
| R1.2 | Each Program SHALL belong to exactly one Portfolio. | Must |
| R1.3 | Each Project SHALL belong to at most one Program (optional) and exactly one Portfolio. | Must |
| R1.4 | Moving a Project between Programs SHALL update only `program_id`; `portfolio_id` SHALL remain that of the Program’s Portfolio. | Must |

---

## 2. Metrics Aggregation

| ID | Requirement | Priority |
|----|-------------|----------|
| R2.1 | Program budget SHALL be computed as **SUM(project.budget)** for all projects in that program. | Must |
| R2.2 | Program actual cost SHALL be computed as **SUM(project.actual_cost)** for all projects in that program. | Must |
| R2.3 | Aggregated metrics SHALL be available in the Program API and in the Portfolios tree view (Program row). | Must |
| R2.4 | Projects without a Program (`program_id` NULL) SHALL be excluded from Program aggregates but SHALL still count toward Portfolio totals. | Must |

---

## 3. AI Auto-Grouping

| ID | Requirement | Priority |
|----|-------------|----------|
| R3.1 | The system SHALL provide an **AI suggest** capability: “Gruppier Projekte thematisch” (group projects thematically). | Must |
| R3.2 | AI suggest SHALL accept a portfolio ID and optional list of project IDs, and SHALL return suggested Program names and project-to-program assignments. | Must |
| R3.3 | The user SHALL be able to apply suggestions (create programs and assign projects) or dismiss them. | Must |
| R3.4 | Suggestions SHALL be based on project name and description (and optionally status/priority) when available. | Should |

---

## 4. Proactive Alerts

| ID | Requirement | Priority |
|----|-------------|----------|
| R4.1 | The system SHALL support proactive alerts at Program level (e.g. budget overrun, too many at-risk projects). | Should |
| R4.2 | Program-level alerts SHALL be visible in the Portfolios tree (e.g. badge or icon on Program row). | Should |
| R4.3 | Alert rules SHALL be configurable (e.g. threshold for “at-risk” count). | Could |

---

## 5. Interaktiver Drag & Drop

| ID | Requirement | Priority |
|----|-------------|----------|
| R5.1 | In the Portfolios page tree view, the user SHALL be able to **drag** a Project and **drop** it onto a Program to assign it. | Must |
| R5.2 | The user SHALL be able to drag a Project to “Ungrouped” (or root of portfolio) to clear `program_id`. | Must |
| R5.3 | Drag-and-drop SHALL trigger an immediate API call to update the project’s `program_id` and SHALL reflect in the tree without full reload. | Must |
| R5.4 | Programs SHALL be draggable for reordering within a Portfolio (optional; sort_order). | Could |

---

## 6. Data Model (Summary)

- **programs**: id, portfolio_id, name, description, sort_order, created_at, updated_at
- **projects**: existing fields + **program_id** (nullable FK to programs.id)
- Program budget/actual_cost: computed (SUM) or cached; API returns aggregated values.

---

## 7. Non-Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| R7.1 | Programs API SHALL be protected by RBAC (program_read, program_create, program_update, program_delete). | Must |
| R7.2 | Portfolios page SHALL remain testable (tree and drag-drop with @dnd-kit). | Must |
| R7.3 | AI suggest SHALL degrade gracefully if AI is unavailable (e.g. return empty or heuristic grouping). | Should |
