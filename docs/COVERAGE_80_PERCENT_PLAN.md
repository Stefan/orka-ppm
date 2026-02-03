# Plan: 80 % Test Coverage erreichen

**Ausgangslage:** Global ~15–16 % Coverage (Statements/Branches/Lines/Functions). Schwellen in `jest.config.js` sind auf 80 % gesetzt, werden aber nicht erreicht.

**Ziel:** Schrittweise 80 % Coverage auf kritischen Pfaden, optional global.

---

## Phase 0: Voraussetzungen (1–2 Tage)

### 0.1 Coverage-Schwellen entkoppeln

Aktuell blockiert das globale 80 %-Ziel den CI. Statt sofort 80 % überall zu fordern:

- **Jest:** In `jest.config.js` `coverageThreshold.global` vorübergehend auf aktuelle Werte setzen (z. B. 15 %) oder entfernen, damit CI grün ist.
- **Neue Schwellen:** Pro Bereich (Path-basiert) einführen und schrittweise anheben.

**Beispiel `jest.config.js` (Path-basierte Schwellen):**

```js
coverageThreshold: {
  global: { branches: 15, functions: 13, lines: 16, statements: 15 }, // aktueller Stand
  // Pro Pfad 80 % anheben, sobald erreicht:
  './lib/feature-flags/**/*.ts': { branches: 80, functions: 80, lines: 80, statements: 80 },
  './lib/i18n/**/*.{ts,tsx}': { branches: 80, functions: 80, lines: 80, statements: 80 },
  './lib/utils/voice-control.ts': { branches: 80, functions: 80, lines: 80, statements: 80 },
  // ... weitere Pfade nach und nach
}
```

### 0.2 Metriken etablieren

- **Wöchentlich:** `npm run test:coverage` ausführen, Report (z. B. `coverage/lcov-report/index.html`) prüfen.
- **CI:** Coverage-Report als Artefakt speichern (z. B. `lcov-report`) und optional in ein Tool (z. B. Codecov/coveralls) hochladen.
- **Script:** Optional `scripts/coverage-summary.js`, das pro Ordner (lib, app/api, components, hooks) die aktuellen Prozente ausgibt.

---

## Phase 1: Lib – reine Logik (Priorität 1, 2–3 Wochen)

**Ziel:** 80 % Coverage für `lib/` (ohne schwere Integration).

### 1.1 Bereits gut getestet (behalten, Lücken schließen)

- `lib/feature-flags/filterFlags.ts` – bereits hoch
- `lib/i18n/*` (loader, pluralization, formatters, server, coverage, types)
- `lib/voice-control.ts`, `lib/gamification-engine.ts`
- `lib/nl-query-parser.ts`, `lib/costbook-calculations.ts`, `lib/evm-calculations.ts`
- `lib/vendor-scoring.ts`, `lib/predictive-calculations.ts`
- `lib/costbook/ai-import-mapper.ts`, `lib/costbook/distribution-engine.ts`, `lib/costbook/hierarchy-builders.ts`
- `lib/api/dashboard-loader.ts`, `lib/api/client.ts`, `lib/api/resilient-fetch.ts`
- `lib/testing/*`, `lib/testing/pbt-framework/*`

Für diese Module: fehlende Branches/Edge-Cases ergänzen, bis jeweiliger Pfad ≥ 80 %.

### 1.2 Noch ohne / mit wenig Tests (neu abdecken)

| Modul | Aufwand | Art der Tests |
|-------|---------|----------------|
| `lib/currency-utils.ts` | klein | Unit: Formatierung, Parsing, Rundung |
| `lib/design-system.ts` | mittel | Unit: Theme/Spacing-Tokens, cn() |
| `lib/costbook/import-templates.ts`, `costbook-keys.ts` | klein | Unit |
| `lib/costbook/anomaly-detection.ts` | mittel | Unit + ggf. property |
| `lib/recommendation-engine.ts` | mittel | Unit mit Mock-Daten |
| `lib/comments-service.ts` | mittel | Unit mit Mock-Supabase |
| `lib/diagnostics/diagnostic-collector.ts` | mittel | Unit |
| `lib/monitoring/logger.ts`, `intercept-console-error.ts`, `performance-utils.ts` | klein–mittel | Unit |
| `lib/sync/storage.ts`, `session-continuity.ts` | mittel | Unit + Mocks |
| `lib/offline/storage.ts`, `sync.ts` | hoch | Unit mit Storage-Mock |
| `lib/utils/formatting.ts`, `error-handler.ts`, `env.ts` | klein | Unit |
| `lib/utils/chrome-scroll-logger.ts`, `chrome-detection-optimization.ts` | mittel | Unit mit JSDOM/requestAnimationFrame-Mock |
| `lib/workers/data-processor-worker.ts`, `monte-carlo-worker.ts` | mittel | Unit (Worker-Code isoliert testen) |

Reihenfolge: zuerst `lib/utils`, dann `lib/costbook`, dann `lib/sync`/`lib/offline`/`lib/monitoring`/`lib/diagnostics`.

### 1.3 Geringe Priorität / schwere Abhängigkeiten

- `lib/ai/*` (risk-management, resource-optimizer, predictive-analytics): teils schon Coverage; Rest optional später.
- `lib/help-chat/api.ts`: komplex, teils schon getestet; Lücken gezielt schließen.
- `lib/pmr-api.ts`: groß; schrittweise Route-/Query-Handler testen.
- `lib/features/*` (crawl-docs, search, tree): wenn genutzt, Unit mit Mocks.

**Meilenstein Phase 1:** `lib/` gesamt ≥ 80 % (oder mind. alle Unterordner feature-flags, i18n, utils, costbook, api, monitoring, sync mit 80 %).

---

## Phase 2: API Routes (Priorität 2, 2–3 Wochen)

**Ziel:** 80 % Coverage für `app/api/**/*.ts` (Route-Handler).

### 2.1 Bereits getestet

- `app/api/health/route.ts`
- `app/api/projects/route.ts`
- `app/api/help-chat/query/route.ts`
- `app/api/v1/financials/commitments/route.ts`
- Weitere in `__tests__/api-routes/`

Diese beibehalten und Lücken (Branches, Fehlerpfade) schließen.

### 2.2 Route-Tests standardisieren

- **Umgebung:** API-Route-Tests in Node-Umgebung (nicht jsdom), wie bereits für bestehende Route-Tests.
- **Pattern:**  
  - Request mit `NextRequest` / GET/POST-Body bauen  
  - Handler aufrufen  
  - Response-Status und JSON-Body asserten  
- **Mocks:** Backend/Supabase/DB per `jest.mock()` oder MSW mocken, keine echten Netzwerkaufrufe.

### 2.3 Priorisierte Routes (nach Nutzung/Risiko)

1. **Kritisch:** Auth, Projekte, Gesundheitscheck  
   - `app/api/projects/[projectId]/**`, `app/api/projects/import/**`  
   - Weitere Auth-/RBAC-Routes falls vorhanden  

2. **Hoch:** Help-Chat, Features, Feedback  
   - `app/api/help-chat/**` (context, feedback, preferences, tips, translate)  
   - `app/api/features/**`, `app/api/feedback/**`  

3. **Mittel:** Admin, Audit, Sync, Workflows  
   - `app/api/admin/**`, `app/api/audit/**`  
   - `app/api/sync/**`, `app/api/workflows/**`  

4. **Niedrig:** Analytics, Financial-Tracking, Optimized, Tips  
   - Rest von `app/api/**`  

Pro Route mindestens: Happy Path, 400/401/500-Szenarien, fehlende/ungültige Body/Query.

**Meilenstein Phase 2:** Alle „kritisch“- und „hoch“-Routes mit Tests, Gesamt-Coverage `app/api/` ≥ 80 %.

---

## Phase 3: Hooks (Priorität 3, 1–2 Wochen)

**Ziel:** 80 % Coverage für `hooks/*.ts`.

### 3.1 Bereits gut getestet

- `useDebounce`, `useWorkflowRealtime`, `useClickOutside`
- `usePerformanceMonitoring`, `useScrollPerformance`
- `usePredictiveAnalytics` (teilweise)

### 3.2 Hooks mit wenig Coverage

- `useCacheManager`, `useAsync`, `useDataProcessor`, `useLocalStorage`
- `useIntersectionObserver`, `usePrevious`, `useRoutePrefetch`, `useWindowSize`
- `useToggle`, `useProgressiveEnhancement`, `useMonteCarloWorker`

Strategie: Mit `@testing-library/react` und `renderHook()` testen; Timer mit `jest.useFakeTimers`, Browser-APIs (localStorage, IntersectionObserver) mocken.

### 3.3 Schwer / später

- `usePermissions` (bereits in testPathIgnorePatterns – fetch/API-Mock-Problem angehen)
- `useHelpChat`, `useOffline`, `useOfflineSync`, `useLanguage`, `usePMRContext`

Zuerst: einfache Hooks (useToggle, usePrevious, useLocalStorage, useDebounce-Edge-Cases), dann useCacheManager, useIntersectionObserver.

**Meilenstein Phase 3:** `hooks/` gesamt ≥ 80 % (oder Liste „kritischer“ Hooks mit 80 %).

---

## Phase 4: Komponenten (Priorität 4, 3–4 Wochen)

**Ziel:** Deutlich erhöhte Coverage für `components/`, ohne jeden Button zu 100 % zu treiben.

### 4.1 Priorisierung

- **Kritisch:** Fehlerbehandlung, Auth, zentrale UI  
  - `ErrorBoundary`, `PermissionGuard`, `RoleBasedNav`  
  - `Button`, `Card`, `Input`, `Modal`, `Alert`, `ErrorMessage`  
- **Hoch:** Costbook, Dashboard, Projekte  
  - `CostbookErrorBoundary`, `DistributionSettingsDialog`, `VirtualizedTransactionTable`  
  - `ProjectImportModal`, `GuestProjectView`  
  - `AdaptiveDashboard` (stückweise)  
- **Mittel:** Help-Chat, PMR, Charts, Navigation  
  - `HelpChatToggle`, `MessageRenderer`, `VisualGuideSystem`  
  - `PMRChart`, `PMREditor` (Kernfälle)  
  - `InteractiveChart`, `GlobalLanguageSelector`  
- **Niedrig:** Einmalige/Admin-/Spezial-UI  
  - Viele Admin- und Nischen-Komponenten  

### 4.2 Vorgehen

- Vorhandene Snapshot-/Struktur-Tests beibehalten.
- Für prioritäre Komponenten:  
  - Rendering (verschiedene Props),  
  - User-Interaktionen (Klicks, Formulare),  
  - Fehler-/Loading-Zustände,  
  - Zugänglichkeit (jest-axe) wo sinnvoll.  
- Schwere Abhängigkeiten (Supabase, Router, große Libs) mocken; Provider minimal wrappen.

### 4.3 Ignorierte Tests schrittweise reaktivieren

Viele Einträge in `testPathIgnorePatterns` scheitern an:  
- fetch/API-Mocks greifen nicht (z. B. usePermissions, ShareLinkManager, GuestProjectAccess).  
- Timing (property tests mit echten Timern).  

Maßnahmen:  
- Globale fetch-Mock-Strategie in `jest.setup.js` / `jest.env.js` vereinheitlichen.  
- Für property tests: `jest.useFakeTimers` und kontrolliertes `runAllTimers`/`advanceTimersByTime`.  
- Pro Datei: Fix oder gezielte Enge der Tests (z. B. nur Unit-Teil), dann aus ignore rausnehmen.

**Meilenstein Phase 4:** Kritische und hohe Komponenten mit Tests; `components/` gesamt z. B. ≥ 60 %, kritische Unterordner ≥ 80 %.

---

## Phase 5: App (Pages/Provider) – optional (2+ Wochen)

- **Pages:** Oft nur Layout/Wrapper; Fokus auf Datenfluss und Fehlerbehandlung (z. B. loading/error), nicht auf 80 % pro Page.
- **Provider:** SupabaseAuthProvider, HelpChatProvider, ThemeProvider: mit Mock-Provider und Kindern testen.
- **Priorität:** Niedrig; nach lib, api, hooks, components.

---

## CI und Schwellen (Dauerhaft)

1. **CI-Job:**  
   - `npm run test:ci` (mit Coverage)  
   - Artefakt: `coverage/lcov-report` und optional `coverage/coverage-final.json`  

2. **Schwellen:**  
   - Zuerst nur path-basierte Schwellen für fertige Bereiche (z. B. `lib/feature-flags`, `lib/i18n`, dann mehr).  
   - Global 80 % erst anheben, wenn alle Phasen-Meilensteine erreicht sind.  

3. **PR-Check:**  
   - Optional: „Coverage darf nicht sinken“ (z. B. über Codecov) für ausgewählte Pfade.  

4. **Health-Check:**  
   - `npm run health-check` und `npm run test:coverage` in CI; bei Abbau ignorierter Tests darauf achten, dass die Suite stabil bleibt.  

---

## Kurz-Übersicht (Reihenfolge)

| Phase | Fokus | Ziel-Coverage | Dauer (Orientierung) |
|-------|--------|----------------|------------------------|
| 0 | Schwellen + Metriken | CI grün, Messbarkeit | 1–2 Tage |
| 1 | lib/ | 80 % lib | 2–3 Wochen |
| 2 | app/api/ | 80 % API Routes | 2–3 Wochen |
| 3 | hooks/ | 80 % hooks | 1–2 Wochen |
| 4 | components/ | 80 % kritische Komponenten, 60 %+ gesamt | 3–4 Wochen |
| 5 | app/ (Pages/Provider) | Erhöhung wo sinnvoll | optional, 2+ Wochen |

---

## Nächste konkrete Schritte

1. In `jest.config.js` globale Schwellen auf aktuelle Werte setzen (oder path-basierte Schwellen für erste „fertige“ Pfade).  
2. `scripts/coverage-summary.js` (optional) bauen: liest lcov/coverage-final und gibt pro Ordner (lib, app/api, hooks, components) Prozent aus.  
3. Phase 1 starten: Liste der `lib/`-Dateien mit < 80 % aus letztem Coverage-Report nehmen, mit Tabelle 1.2 abgleichen, erste neuen Tests für `lib/utils`, `lib/currency-utils`, `lib/design-system` anlegen.  
4. Wöchentlich Coverage laufen lassen und Report prüfen; path-basierte Schwellen für erreichte 80 %-Bereiche aktivieren.

Wenn du willst, kann als Nächstes die konkrete Änderung an `jest.config.js` (path-basierte Schwellen + abgesenkte global) und ein minimales `scripts/coverage-summary.js` ausgearbeitet werden.
