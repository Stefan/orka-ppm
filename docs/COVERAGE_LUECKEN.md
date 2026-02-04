# Test-Coverage: Was fehlt noch (Stand zum Plan)

Aktuelle **globale Coverage:** ~18 % (Statements/Branches/Lines/Functions).  
Referenz: **docs/COVERAGE_80_PERCENT_PLAN.md**.

---

## Phase 0 (Voraussetzungen) – erledigt

- Globale Schwellen auf ~15–16 % gesetzt, path-basierte 80 %-Schwellen für erste Lib-Pfade eingeführt.
- Optional: `scripts/coverage-summary.js` und CI-Artefakt für Coverage noch nicht umgesetzt.

---

## Phase 1: Lib – fehlt noch viel

### Bereits mit path-basierten 80 %-Schwellen (teilweise noch nicht erreicht)

| Datei | Schwellen in jest.config | Anmerkung |
|-------|--------------------------|-----------|
| `lib/currency-utils.ts` | 80 % | Sollte erreicht sein |
| `lib/design-system.ts` | 80 % | design-system.ts im Report ~37 % Lines – **Tests ausbauen** |
| `lib/utils/formatting.ts` | 70/80 % | Sollte nahe dran sein |
| `lib/utils/env.ts` | 75/80 % | Sollte nahe dran sein |
| `lib/monitoring/logger.ts` | 80 % | Sollte erreicht sein |
| `lib/monitoring/performance-utils.ts` | 80 % | Sollte erreicht sein |
| `lib/monitoring/intercept-console-error.ts` | 59–64 % | Schwellen niedriger, **mehr Branches/Funktionen testen** |
| `lib/costbook/import-templates.ts` | 80 % | Sollte erreicht sein |
| `lib/costbook/costbook-keys.ts` | 80 % | Sollte erreicht sein |
| `lib/diagnostics/diagnostic-collector.ts` | 55 % branches, 73 % functions | **Mehr Tests für Branches/Funktionen** |

### Laut Plan 1.2 noch ohne / mit wenig Tests

| Modul | Aufwand | Status |
|-------|---------|--------|
| `lib/costbook/anomaly-detection.ts` | mittel | Tests vorhanden, Coverage prüfen |
| `lib/recommendation-engine.ts` | mittel | Tests prüfen/ergänzen |
| `lib/comments-service.ts` | mittel | Kaum Coverage |
| `lib/sync/storage.ts` | mittel | ~88 % – Lücken schließen |
| `lib/sync/session-continuity.ts` | mittel | ~45 % – **viele Tests fehlen** |
| `lib/offline/storage.ts`, `sync.ts` | hoch | **0 % – komplett fehlen** |
| `lib/utils/error-handler.ts` | klein | ~65 % – Edge-Cases ergänzen |
| `lib/utils/chrome-scroll-logger.ts`, `chrome-detection-optimization.ts` | mittel | Teilweise getestet, auf 80 % bringen |
| `lib/workers/data-processor-worker.ts`, `monte-carlo-worker.ts` | mittel | **Sehr niedrig (~8–10 %) – Worker-Logik isoliert testen** |

### Plan 1.1 (bereits gut getestet – Lücken schließen)

- `lib/feature-flags/`, `lib/i18n/*`, `lib/api/*`, `lib/testing/*` etc.: im Coverage-Report prüfen, welche Dateien unter 80 % liegen, und fehlende Branches/Edge-Cases ergänzen.

**Meilenstein Phase 1:** Noch nicht erreicht – `lib/` gesamt liegt weit unter 80 %.

---

## Phase 2: API Routes – großer Teil fehlt

### Bereits mit Route-Tests

- `app/api/health/route.ts`
- `app/api/projects/route.ts`, `app/api/projects/[projectId]/budget-variance`, `scenarios`
- `app/api/help-chat/*` (context, feedback, preferences, tips, translate, detect-language, error-report, query)
- `app/api/feedback/bugs`, `feedback/features`
- `app/api/features/route.ts` (ein Test-File)

### Laut Plan 2.3 noch ohne Route-Tests (priorisiert)

1. **Kritisch**
   - `app/api/projects/import/**` (import/route.ts, import/csv/route.ts) – projects-import.route.test.ts ist in **testPathIgnorePatterns**, also deaktiviert; **reparieren oder neuer Test**.

2. **Hoch**
   - `app/api/features/**` – nur ein generischer features.route.test; fehlen: docs, search, suggest-description, sync, update.

3. **Mittel – komplett ohne Tests**
   - `app/api/admin/**` (cache/clear, cache/stats, feature-flags, performance/health, performance/stats, roles, users)
   - `app/api/audit/**` (anomalies, dashboard/stats, detect-anomalies, export, search)
   - `app/api/sync/**` (devices, offline-changes, preferences, session)
   - `app/api/workflows/**` (instances, my-workflows)

4. **Niedrig**
   - `app/api/analytics/**`, `app/api/csv-import/**`, `app/api/financial-tracking/**`
   - `app/api/notifications`, `app/api/optimized/**`, `app/api/rbac/**`, `app/api/resources`
   - `app/api/schedules/**`, `app/api/tips`, `app/api/v1/**` (column-views, costbook/rows, erp/sync, financials, monte-carlo, projects/cash-forecast, projects/evm, workflows)
   - `app/api/ai/help/**`, `app/api/ai/resource-optimizer/**`

**Meilenstein Phase 2:** Noch nicht erreicht – die meisten API-Routen haben keine dedizierten Tests.

---

## Phase 3: Hooks – Teil erledigt, Rest fehlt

### Bereits mit Tests

- useCacheManager, useIntersectionObserver, useWindowSize, useRoutePrefetch, useProgressiveEnhancement, useMonteCarloWorker
- useToggle, usePrevious, useLocalStorage, useAsync, useLanguage

### Laut Plan noch mit wenig / ohne Tests

- **useDataProcessor** – Tests fehlen
- **useDebounce**, **useClickOutside**, **useWorkflowRealtime** – laut Plan „bereits gut getestet“, prüfen ob Suites existieren und Coverage ausreicht
- **usePerformanceMonitoring**, **useScrollPerformance**, **usePredictiveAnalytics** – prüfen/ergänzen
- **Schwer / später:** usePermissions (in testPathIgnorePatterns), useHelpChat, useOffline, useOfflineSync, usePMRContext

**Meilenstein Phase 3:** Noch nicht erreicht – hooks/ gesamt unter 80 %.

---

## Phase 4: Komponenten – fast nichts umgesetzt

### Laut Plan 4.1 priorisiert, aber kaum aktiv

- **Kritisch:** ErrorBoundary, PermissionGuard, RoleBasedNav, Button, Card, Input, Modal, Alert, ErrorMessage  
  – Viele davon haben Tests, die in **testPathIgnorePatterns** stehen (werden nicht ausgeführt).
- **Hoch:** CostbookErrorBoundary, DistributionSettingsDialog, VirtualizedTransactionTable, ProjectImportModal, GuestProjectView, AdaptiveDashboard
- **Mittel:** HelpChatToggle, MessageRenderer, VisualGuideSystem, PMRChart, PMREditor, InteractiveChart, GlobalLanguageSelector

### Wichtig

- **Ignorierte Tests reaktivieren:** Über 100 Einträge in `testPathIgnorePatterns`; viele Komponenten-/Integration-Tests laufen nicht.  
  Vorgehen: pro Datei Mocks/Umgebung fixen (z. B. fetch, Router, Timer), dann aus der Ignore-Liste entfernen.

**Meilenstein Phase 4:** Noch nicht angegangen – components/ trägt kaum zur globalen Coverage bei.

---

## Phase 5: App (Pages/Provider)

- Optional, im Plan niedrig priorisiert – aktuell nicht gestartet.

---

## Kurz: Warum die Coverage so niedrig ist

1. **lib:** Viele Module (offline, workers, sync/session-continuity, Teile von utils) haben 0 % oder wenig Tests; path-basierte 80 % sind nur für wenige Dateien definiert und teils noch nicht erfüllt.
2. **app/api:** Nur ein kleiner Teil der Routen hat eigene Route-Tests; admin, audit, sync, workflows, v1, ai, csv-import, financial-tracking etc. haben keine.
3. **hooks:** Einige Hooks getestet, viele (useDataProcessor, useHelpChat, useOffline, …) ohne oder mit geringer Coverage.
4. **components:** Kaum gezielte Tests; viele bestehende Suites sind ignoriert und laufen nicht.

---

## Empfohlene nächste Schritte (Reihenfolge)

1. **Phase 1 Lib:**  
   - Path-Schwellen für `design-system.ts`, `diagnostic-collector.ts`, `intercept-console-error.ts` durch mehr Tests erreichen.  
   - Tests für `lib/sync/session-continuity.ts`, `lib/offline/storage.ts` (und ggf. `sync.ts`), `lib/utils/error-handler.ts` und Worker-Logik ergänzen.

2. **Phase 2 API:**  
   - Route-Tests für **admin** (mind. cache, feature-flags, performance), **sync** (mind. session, preferences), **workflows** (instances, my-workflows).  
   - projects/import reparieren oder neuen Test hinzufügen und aus testPathIgnorePatterns entfernen.

3. **Phase 3 Hooks:**  
   - useDataProcessor testen; useDebounce/useClickOutside/usePerformanceMonitoring prüfen und Lücken schließen.

4. **Phase 4 Komponenten:**  
   - Zuerst ignorierte Suites schrittweise reparieren (fetch/Router-Mocks, Timer), dann neue Tests für ErrorBoundary, Button, Card, Input, Modal, Alert, ErrorMessage.

5. **Metriken:**  
   - Optional `scripts/coverage-summary.js` bauen; wöchentlich `npm run test:coverage` und path-basierte Schwellen für erreichte 80 %-Bereiche anpassen.

Wenn du willst, kann als Nächstes eine konkrete Reihenfolge (z. B. „diese 5 Lib-Dateien, dann diese 3 API-Gruppen“) oder ein kleines Script für die Coverage-Zusammenfassung ausgearbeitet werden.
