# Welche Tests fehlen noch?

Kurzüberblick nach Quellen: **docs/COVERAGE_LUECKEN.md**, **docs/COVERAGE_80_PERCENT_PLAN.md**, **docs/why-runtime-api-errors-are-not-caught-by-tests.md**, **jest.config.js** (testPathIgnorePatterns), **app/api** vs. **__tests__/api-routes**.

---

## 1. Frontend (Jest) – fehlende oder deaktivierte Tests

### 1.1 API-Route-Tests (Next.js)

| Status | Route / Bereich | Anmerkung |
|--------|-----------------|-----------|
| ~~Deaktiviert~~ ✅ | `projects-import.route.test.ts` | Repariert (fetch-Spy im 401-Test), aus testPathIgnorePatterns entfernt |
| ~~Fehlt~~ ✅ | `app/api/costbook/optimize/route.ts` | **Ergänzt:** `costbook-optimize.route.test.ts` |
| ~~Teilweise~~ ✅ | `app/api/features/suggest-description`, `update`, **sync** | **Ergänzt:** suggest-description, update; **sync:** `features-sync.route.test.ts` (401, 500 Supabase, 200 dry_run) |
| ~~Teilweise~~ ✅ | `app/api/audit/` | **Ergänzt:** `audit-detect-anomalies.route.test.ts`, `audit-anomalies-feedback.route.test.ts` (401, 200) |
| ~~Teilweise~~ ✅ | `app/api/ai/resource-optimizer/` | **Ergänzt:** `ai-resource-optimizer-apply.route.test.ts`, `ai-resource-optimizer-team-composition.route.test.ts` (200, 400/500) |
| ~~Fehlt~~ ✅ | `app/api/v1/monte-carlo/simulations/.../visualizations/generate` | **Ergänzt:** `v1-monte-carlo-visualizations-generate.route.test.ts` (401, 200, 503) |
| **Teilweise** | `app/api/workflows/instances/[id]/approve` | instances/[id] getestet; approve-Subroute ggf. abdecken |

Alle anderen zentralen API-Routen (admin, sync, workflows, audit, csv-import, financial-tracking, v1/*, …) haben bereits eigene Dateien in `__tests__/api-routes/`.

### 1.2 Ignorierte Test-Suites (testPathIgnorePatterns)

Diese Tests existieren, laufen aber nicht (Jest ignoriert sie). Nach Reparatur (Mocks, Timer, fetch) aus der Ignore-Liste nehmen:

- **API/Backend-Mocks:**  
  `guest-project-access-page.test.tsx`, `share-link-manager.test.tsx`, `RoleManagement.test.tsx`, `EnhancedAuthProvider.test.tsx`, alle **app/changes/components/__tests__/** (PerformanceMonitoringInterface, ChangeAnalyticsDashboard, ChangeRequestManager, …), `dashboard-page-validation.test.tsx`, `dashboard-layout-integration.test.tsx`, `dashboard-components-integration.property.test.tsx`, `rbac-system-integration.property.test.tsx`, `FeatureFlagContext.test.tsx`, `admin-role-management-ui.test.tsx`, `UserRoleManagement.test.tsx`, `share-analytics-dashboard.test.tsx`, `pmr-export-pipeline.test.tsx`, `enhanced-pmr.integration.test.tsx`, `feature-toggle-workflow.integration.test.tsx`, `import-ui-components.test.tsx`, `non-admin-access-denial.property.test.tsx`, `rbac-comprehensive-integration.test.tsx`, `HelpChatProvider.test.tsx`
- **Timer/Timing:**  
  `admin-critical-content-render-time.property.test.tsx`, `admin-critical-content-timing.property.test.tsx`, `admin-lazy-loading-timing.property.test.tsx`, `admin-api-call-prioritization.property.test.ts`
- **Umgebung/ESM:**  
  `HelpChat.test.tsx` (MessageRenderer ESM), `usePermissions.test.ts` (fetch-Mock), `admin-performance-api-integration.test.ts` (Vitest)
- **Playwright/Vitest:**  
  E2E-Dateien in `__tests__/e2e/`, `unused-javascript.property.test.ts`
- **Sonstige:**  
  Diverse Property- und Komponenten-Tests (input-*, error-boundary, etc.) – siehe vollständige Liste in `jest.config.js` unter `testPathIgnorePatterns`.  
  **Repariert und reaktiviert:** `card-border.property.test.tsx`, `currency-utils.property.test.ts`, `FeatureFlagContext.test.tsx`, `usePermissions.test.ts`, `guest-project-access-page.test.tsx` (5 Tests), `share-link-manager.test.tsx` (4 Tests). Jeweils reduzierte Suites wo Fetch/API-Mock in Jest nicht zuverlässig greift.

### 1.2.1 Werden die ignorierten Tests noch benötigt?

| Kategorie | Empfehlung | Beispiele |
|-----------|------------|-----------|
| **Ja – anderer Runner** | Behalten; laufen mit Playwright oder Vitest. | `__tests__/e2e/*.test.tsx` (falls Playwright sie einbindet), `admin-performance-api-integration.test.ts` (Vitest). E2E-**.spec.ts** laufen mit `npm run test:e2e`. |
| **Ja – reparieren geplant** | Behalten; nach Mocks/Umgebung reparieren und aus testPathIgnorePatterns nehmen. | `EnhancedAuthProvider.test.tsx`, `usePermissions.test.ts`, `guest-project-access-page.test.tsx`, `share-link-manager.test.tsx`, Changes-Komponenten, HelpChat/MessageRenderer. |
| **Optional – können weg** | Können gelöscht werden, wenn das zu testende Feature obsolet ist oder nie repariert wird. | Viele Property-Tests (Timing, Performance, CSS-Validation), Teile von `scripts/cleanup/__tests__/` wenn Scripts nicht genutzt werden. Vor dem Löschen: prüfen ob getesteter Code noch existiert. |
| **Unklar** | Einzelfall prüfen. | Tests für Komponenten die es noch gibt (z. B. PermissionGuard, ProjectImportModal) – entweder reparieren oder durch schlankere Unit-Tests ersetzen. |

**Faustregel:** Test-Datei löschen nur, wenn (a) der getestete Code entfernt wurde oder (b) ihr euch bewusst entscheidet, die Abdeckung dafür aufzugeben. Ansonsten: ignoriert lassen oder reparieren.

### 1.3 Lib – geringe oder keine Abdeckung (Phase 1)

- **Kaum/keine Tests:**  
  `lib/sync/session-continuity.ts`, `lib/offline/storage.ts`, `lib/offline/sync.ts`, `lib/workers/data-processor-worker.ts`, `lib/workers/monte-carlo-worker.ts`, `lib/comments-service.ts`
- **Unter 80 % (Branches/Funktionen):**  
  `lib/design-system.ts`, `lib/monitoring/intercept-console-error.ts`, `lib/diagnostics/diagnostic-collector.ts`, `lib/utils/error-handler.ts`
- **Lücken schließen:**  
  `lib/feature-flags/`, `lib/i18n/*`, `lib/api/*`, `lib/testing/*` – im Coverage-Report prüfen und auf 80 % bringen.

### 1.4 Hooks – fehlende oder schwache Tests (Phase 3)

- **Fehlen:**  
  `useDataProcessor`
- **Prüfen/ergänzen:**  
  `useDebounce`, `useClickOutside`, `useWorkflowRealtime`, `usePerformanceMonitoring`, `useScrollPerformance`, `usePredictiveAnalytics`
- **Schwer/optional:**  
  `usePermissions` (bereits Unit-Test, Hauptsuite ignoriert), `useHelpChat`, `useOffline`, `useOfflineSync`, `usePMRContext`

### 1.5 Komponenten – wenig oder ignoriert (Phase 4)

- **Kritisch, teils ignoriert:**  
  ErrorBoundary, PermissionGuard, RoleBasedNav, Button, Card, Input, Modal, Alert, ErrorMessage
- **Hoch:**  
  CostbookErrorBoundary, DistributionSettingsDialog, VirtualizedTransactionTable, ProjectImportModal, GuestProjectView, AdaptiveDashboard
- Viele Komponenten-Tests stehen in `testPathIgnorePatterns` – zuerst Mocks/Umgebung reparieren, dann reaktivieren.

---

## 2. Laufzeit- und E2E-Lücken

- **500 / Backend nicht erreichbar:**  
  Kein E2E-Szenario „Backend antwortet 500“ oder „Backend nicht erreichbar“ für z. B. `/projects`. Siehe **docs/why-runtime-api-errors-are-not-caught-by-tests.md**.
- **Optional:**  
  E2E-Tests für kritische Seiten mit simuliertem Backend-Fehler oder -Ausfall, Assert auf Fehlermeldung/Retry-UI.

---

## 3. Backend (pytest)

Laut **docs/backend-api-route-coverage.md** sind P0/P1 weitgehend mit Literal- und Dedicated-Tests abgedeckt. Optional:

- Weitere **dedizierte** Endpoint-Tests für P2-Router (reports, help_chat_enhanced, feedback, notifications, enhanced_pmr, ai_resource_optimizer, …), wo bisher nur Literal-Routen laufen.
- Neue Backend-Routen beim nächsten Release in `test_api_literal_routes.py` oder in dedizierten Modulen ergänzen.

---

## 4. Priorisierte nächste Schritte

1. ~~**Schnell:** projects-import.route.test.ts reparieren~~ ✅ Erledigt.
2. ~~**Frontend API:** costbook/optimize, features suggest-description & update, **sync**, **audit** (detect-anomalies, anomalies/[id]/feedback), **ai/resource-optimizer** (apply, team-composition), **monte-carlo** (visualizations/generate)~~ ✅ Erledigt (neue Route-Tests ergänzt).
3. **Lib:**  
   Session-continuity und error-handler haben bereits Tests (`lib/sync/__tests__/session-continuity.test.ts`, `lib/utils/__tests__/error-handler.test.ts`). Weitere Module (offline/storage, Worker-Logik) auf mind. 80 % bringen.
4. **Reaktivierung:**  
   Ignorierte Suites reparieren bzw. reduzieren und aus `testPathIgnorePatterns` entfernen. **Erledigt:** card-border, currency-utils, FeatureFlagContext, usePermissions, guest-project-access-page (5 Tests), share-link-manager (4 Tests). **Offen:** RoleManagement, dashboard-page-validation, EnhancedAuthProvider (Supabase-Mock wird nicht genutzt).
5. **E2E (optional):**  
   Ein Szenario „Projects-Seite bei Backend 500 / Backend aus“ mit Assert auf Fehler-UI.

---

## 5. Referenzen

- **Coverage-Plan:** docs/COVERAGE_80_PERCENT_PLAN.md  
- **Lücken im Detail:** docs/COVERAGE_LUECKEN.md  
- **Backend-Routen:** docs/backend-api-route-coverage.md  
- **Laufzeitfehler vs. Tests:** docs/why-runtime-api-errors-are-not-caught-by-tests.md  
- **Ignorierte Tests:** jest.config.js → `testPathIgnorePatterns`
