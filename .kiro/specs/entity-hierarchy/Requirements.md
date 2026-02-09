# Entity Hierarchy (Portfolio, Program, Project) – Requirements

## Overview

Domain-Driven Design für die PPM-Entitäten mit **Portfolio > Program > Project**, **ltree** für effiziente Hierarchie-Queries, **RBAC** (Admin/Manager/User), **AI-Sync** (Roche, Commitments/Actuals-Matching) und **proaktiven Alerts**. 10x besser durch: AI-Zuordnung, Drag&Drop-Hierarchie, Realtime-Alerts.

---

## 1. Hierarchie & Datenmodell

| ID | Requirement | Priority |
|----|-------------|----------|
| R1.1 | Die Hierarchie SHALL sein: **Portfolio > Program > Project**. Jedes Program gehört zu genau einem Portfolio; jedes Project zu genau einem Portfolio und optional einem Program. | Must |
| R1.2 | **ltree** SHALL für effiziente Pfad-Queries verwendet werden: `path` (ltree) in portfolios, programs, projects (z. B. Portfolio: `p.<id>`, Program: `p.<pid>.g.<gid>`, Project: `p.<pid>.g.<gid>.j.<jid>`). | Must |
| R1.3 | **portfolios** SHALL folgende Felder haben: id, name, organization_id, path (ltree), created_at, updated_at. (description, owner_id optional beibehalten.) | Must |
| R1.4 | **programs** SHALL haben: id, portfolio_id, name, path (ltree), created_at, updated_at. | Must |
| R1.5 | **projects** SHALL haben: id, program_id (nullable), portfolio_id, name, budget, health, status, start_date, end_date, path (ltree), created_at, updated_at. | Must |
| R1.6 | Bei Änderung der Zuordnung (z. B. Project in anderes Program ziehen) SHALL der **path** automatisch aktualisiert werden (Trigger oder App-Logik). | Must |

---

## 2. RBAC (Rollen & Scoping)

| ID | Requirement | Priority |
|----|-------------|----------|
| R2.1 | **Admin/Global**: Darf alle Portfolios, Programs und Projects anlegen, bearbeiten und löschen (org-übergreifend). | Must |
| R2.2 | **Manager (Org/Sub-Org)**: Darf nur in der eigenen Organisation bzw. Sub-Organisation Portfolios/Programs/Projects anlegen und bearbeiten. | Must |
| R2.3 | **User**: Darf nur sehen und zuordnen (z. B. Project einem Program zuweisen), keine Struktur anlegen/löschen. | Must |
| R2.4 | Zugriff auf Entitäten SHALL über **organization_id** (Portfolio) und ggf. Sub-Org-Pfad begrenzt werden. | Must |
| R2.5 | Endpoints SHALL einen **RBAC-Check** vor Create/Update/Delete durchführen (z. B. require_permission + Org-Scope). | Must |

---

## 3. UI – Zentrale Hierarchy-Verwaltung

| ID | Requirement | Priority |
|----|-------------|----------|
| R3.1 | Es SHALL eine zentrale Admin-Seite **/admin/hierarchy** geben mit **Tree-View** (Portfolio → Program → Project). | Must |
| R3.2 | Die Tree-View SHALL **Drag&Drop** unterstützen (Reorder, Zuordnung Project zu anderem Program). | Must |
| R3.3 | **No-Scroll-Layout**: Tree links, **Detail-Card rechts** mit Formular für Create/Edit der gewählten Entität. | Must |
| R3.4 | **Modals** SHALL für "New Portfolio", "New Program", "New Project" verwendet werden (mit Feldern name, organization_id/portfolio_id/program_id). | Must |
| R3.5 | Die Seite SHALL mit **Suspense** und Lazy-Load testbar sein. | Should |

---

## 4. Endpoints (Validation & RBAC)

| ID | Requirement | Priority |
|----|-------------|----------|
| R4.1 | **POST /api/portfolios** (Create): Validierung (name, organization_id), RBAC-Check (portfolio_create + Org-Scope). | Must |
| R4.2 | **POST /api/programs** (Create): Validierung (name, portfolio_id), RBAC-Check (program_create + Zugriff auf Portfolio). | Must |
| R4.3 | **POST /api/projects** (Create): Validierung (name, portfolio_id, program_id optional), RBAC-Check (project_create). | Must |
| R4.4 | PATCH/GET/DELETE für Portfolios, Programs, Projects SHALL ebenfalls RBAC und ggf. path-Update berücksichtigen. | Must |

---

## 5. Sync (Roche) & AI-Matching

| ID | Requirement | Priority |
|----|-------------|----------|
| R5.1 | **POST /api/projects/sync** SHALL externe Daten (z. B. Roche API) abrufen, auf **projects** mappen und optional Commitments/Actuals zuordnen. | Must |
| R5.2 | **AI-Matching** SHALL für Zuordnung von Commitments/Actuals zu Projects verwendet werden (z. B. po_number, vendor, Beschreibung) mit Ziel **≥95% Accuracy** (z. B. Grok/OpenAI). | Must |
| R5.3 | Die API SHALL einen **Match-Score** (z. B. "87% Fit") pro Vorschlag zurückgeben. | Should |
| R5.4 | "Match neue PO zu Project X – 87% Fit" SHALL im UI angezeigt werden können (Proaktive Empfehlung). | Should |

---

## 6. Proaktive Alerts (Realtime)

| ID | Requirement | Priority |
|----|-------------|----------|
| R6.1 | **Supabase Realtime** SHALL für Alerts genutzt werden (z. B. "Neuer Project in Program – approve?"). | Should |
| R6.2 | Alerts SHALL konfigurierbar sein (z. B. nur für Manager, nur bei bestimmten Programmen). | Could |
| R6.3 | UI SHALL Alerts anzeigen (Toast/Banner oder zentrale Notifications). | Should |

---

## 7. Datenmodell-Referenz (Bestehend + Neu)

- **projects**: id, budget, health, name, status, start_date, end_date, portfolio_id, program_id, path (ltree), …
- **commitments**: id, project_id, total_amount, po_number, po_status, vendor, currency, …
- **actuals**: id, project_id, amount, po_no, vendor_invoice_no, posting_date, …
- **portfolios** (neu/erweitert): id, name, organization_id, path (ltree), created_at, updated_at
- **programs** (neu/erweitert): id, portfolio_id, name, path (ltree), created_at, updated_at
- **projects**: Erweiterung program_id, path (ltree)

---

## 8. Non-Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| R8.1 | ltree-Queries SHALL für "alle Nachfahren eines Portfolios" (path-Ancestor) verwendet werden. | Must |
| R8.2 | Alle neuen Endpoints SHALL testbar sein (Unit/Integration + optional Playwright für Hierarchy + RBAC). | Should |
