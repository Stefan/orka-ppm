# Implementation Plan: Resources Page Structure Fix

## Overview

This implementation plan addresses the resources page structure verification failure by ensuring the `resources-grid` test ID is always present. The approach is to refactor the view mode rendering to always include a parent container with the test ID, with conditional content inside.

**Backend-API, Routen & Rollen:** Siehe [backend-api-and-roles.md](./backend-api-and-roles.md) für die bestehenden Backend-Routen, Next.js-Proxy, RBAC-Permissions und Migrationen. Die folgenden Tasks (Backend-API, Migration) sind an diese Spezifikation angepasst.

## Tasks

- [x] 1. Refactor resources page view mode rendering
  - Wrap all three view modes (cards, table, heatmap) in a single container with `data-testid="resources-grid"`
  - Move the grid layout className from the cards-only div to the cards content div
  - Ensure table and heatmap views render inside the resources-grid container
  - Verify no styling or layout changes occur
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 2. Write unit tests for view mode rendering
  - [x] 2.1 Test resources-grid test ID exists in cards view
    - Render page with viewMode='cards'
    - Assert element with data-testid="resources-grid" exists
    - _Requirements: 1.1, 1.2_
  
  - [x] 2.2 Test resources-grid test ID exists in table view
    - Render page with viewMode='table'
    - Assert element with data-testid="resources-grid" exists
    - Assert VirtualizedResourceTable is rendered inside
    - _Requirements: 1.1, 1.3_
  
  - [x] 2.3 Test resources-grid test ID exists in heatmap view
    - Render page with viewMode='heatmap'
    - Assert element with data-testid="resources-grid" exists
    - Assert heatmap content is rendered inside
    - _Requirements: 1.1, 1.4_
  
  - [x] 2.4 Test only one view mode renders at a time
    - Test with viewMode='cards', verify only card content visible
    - Test with viewMode='table', verify only table content visible
    - Test with viewMode='heatmap', verify only heatmap content visible
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Write property tests for structure verification
  - [x] 3.1 Property test: Test ID always present
    - **Property 1: Test ID Always Present**
    - **Validates: Requirements 1.1, 4.4**
    - Generate random view modes (cards, table, heatmap)
    - For each view mode, render the page
    - Assert resources-grid test ID exists in DOM
    - Run 100 iterations
  
  - [x] 3.2 Property test: View mode content exclusivity
    - **Property 2: View Mode Content Exclusivity**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Generate random view modes
    - Render page with each view mode
    - Assert exactly one view mode's content is visible (cards XOR table XOR heatmap)
    - Run 100 iterations
  
  - [x] 3.3 Property test: View mode switching preserves structure
    - **Property 3: View Mode Switching Preserves Structure**
    - **Validates: Requirements 2.4, 4.5**
    - Generate random sequences of view mode changes (length 3-10)
    - Apply each view mode change
    - After each change, assert resources-grid test ID still exists
    - Assert no errors thrown during transitions
    - Run 100 iterations
  
  - [x] 3.4 Property test: Required elements present
    - **Property 4: Required Elements Present**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Generate random view modes and mock data states
    - Render page with generated state
    - Assert all three required test IDs present: resources-header, resources-title, resources-grid
    - Run 100 iterations

- [x] 4. Checkpoint - Verify tests pass
  - Run all unit tests and property tests
  - Ensure all tests pass
  - Fix any issues found
  - Ask the user if questions arise

- [x] 5. Run E2E structure verification tests
  - Run existing Playwright structure tests for resources page
  - Verify resources page passes structure verification
  - Test with different view modes if possible
  - Capture any failures and fix
  - _Requirements: 4.1, 4.5_

- [x] 6. Manual verification of view modes
  - Start development server
  - Navigate to /resources page
  - Verify cards view displays correctly
  - Click view mode toggle to switch to table view
  - Verify table view displays correctly
  - Click view mode toggle to switch to heatmap view
  - Verify heatmap view displays correctly
  - Verify no console errors during transitions
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property, E2E)
  - Verify no regressions in other tests
  - Ensure structure verification passes
  - Ask the user if questions arise

---

## Backend-API, Proxy, Rollen & Migration (an bestehende Routen/Rollen angepasst)

Referenz: [backend-api-and-roles.md](./backend-api-and-roles.md).

### Backend-API & Validierung

- [x] **8.1** ResourceCreate: `role` optional
  - In `backend/models/resources.py`: `role: Optional[str] = ""`, damit Anlegen ohne Role (Frontend sendet role nur wenn ausgefüllt) keine 422 auslöst.
  - _Routen: POST `/resources/`, Permission: `resource_create`._

- [x] **8.2** Fehlerantworten bei Create durchreichen
  - In `app/api/resources/route.ts`: Bei `!response.ok` Backend-Body als JSON parsen und unverändert mit gleichem Status zurückgeben (nicht durch generisches `{ error: "Backend error: 422" }` ersetzen).
  - So erhält das Frontend FastAPI-`detail` (z. B. Pydantic-Validierungsfehler) für aussagekräftige Meldungen.

- [x] **8.3** Frontend-Fehleranzeige bei Create
  - In `app/resources/page.tsx`: Bei 4xx/5xx `errorData.detail` (Array oder String) auswerten; Fallback auf `errorData.error`; klare Fehlermeldung anzeigen (z. B. in `alert` oder UI-Banner).

### Migration (bestehende Schema-Stände)

- [x] **9.1** Dokumentation bestehender Migrationen
  - Resources-Tabelle: Erweiterung in `001_initial_schema_enhancement.sql` (email, role, availability, hourly_rate, current_projects, capacity, location).
  - Keine RLS/tenant_id für `resources` in `024_tenant_isolation_policies.sql` (siehe backend-api-and-roles.md).

- [ ] **9.2** (Optional) Tenant-Isolation für Resources
  - Nur wenn gewünscht: Neue Migration (z. B. `resources` um `tenant_id` ergänzen, RLS-Policies mit `get_current_tenant_id()`), Backend bei Insert/Update/Select tenant_id setzen/filtern.
  - Abgleich mit bestehenden Rollen: weiterhin `resource_*`-Permissions; RLS filtert nach Tenant.

### Next.js-Proxy (Erweiterung optional)

- [ ] **10.1** (Optional) Proxy für weitere Backend-Routen
  - Aktuell: Nur GET und POST auf `/api/resources` → Backend GET/POST `/resources/`.
  - Bei Bedarf: Route-Handler für PUT/DELETE/GET-by-ID (z. B. `app/api/resources/[resourceId]/route.ts`) und ggf. `/api/resources/search`, `/api/resources/utilization/summary` ergänzen; Auth-Header durchreichen; gleiche Fehlerweiterleitung wie in 8.2.

### Rollen-Check (Abnahme)

- [x] **11.1** Rollen-Matrix abgeglichen
  - admin: create, read, update, delete, allocate.
  - resource_manager: create, read, update, allocate (kein delete).
  - portfolio_manager / project_manager: read, allocate.
  - team_member / viewer: read only.
  - Siehe `backend/auth/rbac.py` und backend-api-and-roles.md.

## Notes

- Tasks 1–7 und 8.x, 9.1, 11.1 sind für die Struktur- und Create-Fix-Implementierung relevant; 9.2 und 10.1 sind optionale Erweiterungen.
- The core fix is in task 1 - refactoring the view mode rendering
- Property tests use fast-check library for JavaScript property-based testing
- Each property test runs 100 iterations minimum
- Structure tests already exist in `__tests__/e2e/page-structure.spec.ts`
- Manual verification (task 6) is not automated but important for UX validation
- Backend-Routen und RBAC siehe immer `backend-api-and-roles.md` für Abgleich mit Code.