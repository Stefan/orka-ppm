# Enterprise Test-Strategie – Plan & Umsetzung

**Ziel:** Maximale Qualität bei sinnvollem Aufwand – 80 % Coverage auf Kernbereichen (lib, app/api, hooks), stabile Suites, klare Prioritäten.

**Stand:** Siehe [COVERAGE_LUECKEN.md](./COVERAGE_LUECKEN.md) und [COVERAGE_80_PERCENT_PLAN.md](./COVERAGE_80_PERCENT_PLAN.md).

---

## 1. Coverage-Ziele (Enterprise-Grade)

| Bereich | Ziel | Priorität | Aktuell |
|--------|------|-----------|---------|
| **lib/** (Business-Logik, Sync, Utils) | 80 % | Hoch | ~32 % (global mit hooks/api) |
| **app/api/** (Route-Handler) | 80 % | Hoch | Teilweise Route-Tests |
| **hooks/** (State, Daten) | 70–80 % | Mittel | Teilweise |
| **components/** (kritische UI) | 60–80 % für kritische Komponenten | Mittel | Viele Suites ignoriert |
| **E2E** | Kritische User-Journeys abgedeckt | Hoch | Playwright vorhanden |

**Global:** Schwellen in `jest.config.js` sind so gesetzt, dass CI grün bleibt. Path-basierte 80 %-Schwellen für `lib/` und `app/api/` werden schrittweise eingeführt und erreicht.

---

## 2. Prioritäten der Tests

### 2.1 Hoch (zuerst umsetzen)

- **Lib:** Business-Logik, Sync, Offline, Error-Handling, Costbook, Monitoring, Diagnostics.
- **API:** Alle Route-Handler (GET/POST/PUT/DELETE), inkl. Fehlerpfade (401, 403, 500), Auth-Header-Weitergabe.
- **Stabilität:** Keine flaky Tests; ignorierte Suites entweder reparieren oder bewusst auslagern/entfernen.

### 2.2 Mittel

- **Hooks:** useDataProcessor, usePermissions (reparieren), useHelpChat, useOffline, useOfflineSync, usePMRContext.
- **Komponenten:** ErrorBoundary, PermissionGuard, Button, Card, Input, Modal, Alert – gezielte Unit-Tests oder reaktivierte bestehende Suites.

### 2.3 Niedrig

- Reine Präsentations-UI ohne Logik.
- Storybook-Stories (kein Zwang zur Coverage).
- Einmalige Scripts (optional testen).

---

## 3. Konfiguration (umgesetzt)

- **collectCoverageFrom:** Nur `lib/**`, `hooks/**`, `app/api/**` (keine components/app-Pages in globaler Metrik).
- **coverageThreshold.global:** Auf aktuell erreichbare Werte gesetzt (CI bleibt grün).
- **Path-basierte Schwellen:** Für ausgewählte Lib- und API-Pfade 80 % (in `jest.config.js`), werden schrittweise erfüllt.
- **CI:** Coverage-Report wird erzeugt (`lcov.info`), an Codecov gesendet und als Job-Artefakt hochgeladen.
- **Skript:** `scripts/coverage-summary.js` gibt eine Zusammenfassung pro Ordner (lib, hooks, app/api) aus.

---

## 4. Ignorierte Tests (testPathIgnorePatterns)

Viele Suites stehen in `jest.config.js` unter `testPathIgnorePatterns` und laufen nicht. **Empfehlung:** Pro Datei entscheiden: reparieren (Mocks/Umgebung anpassen) oder dauerhaft auslagern/entfernen.

### 4.1 Reparieren (hoher Nutzen)

| Test-Datei | Grund ignoriert | Maßnahme |
|------------|------------------|----------|
| `__tests__/api-routes/projects-import.route.test.ts` | Import/API-Mocks | fetch/Request-Mock anpassen, aus Ignore-Liste entfernen |
| `hooks/__tests__/usePermissions.test.ts` | fetch/API-URL in Jest-Umgebung | globaler fetch-Mock für `/api/*` |
| `components/auth/__tests__/PermissionGuard.test.tsx` | API/roles | Router + fetch mocken |
| `__tests__/card.test.tsx`, `__tests__/input.test.tsx` | ggf. DOM/Theme | Prüfen; oft mit JSDOM reparierbar |

### 4.2 E2E/Playwright/Vitest (bewusst getrennt)

- `__tests__/e2e/*`, `unused-javascript.property.test.ts`, `admin-performance-api-integration.test.ts` – mit Playwright/Vitest laufen lassen, nicht in Jest.

### 4.3 Property-/Timing-abhängig (optional reparieren oder streichen)

- Viele `*.property.test.ts` – teils flaky wegen Timer/Reihenfolge. Entweder mit Fake-Timern stabilisieren oder als „optional“ markieren.

---

## 5. E2E – Kritische Flows

**Empfehlung:** Wenige, stabile E2E-Tests für:

1. **Login** (inkl. Fehlerfall)
2. **Kern-Workflow** (z. B. Projekt öffnen → Dashboard → eine Hauptaktion)
3. **Rollen/Permissions** (z. B. Admin vs. Nutzer – sichtbare/versteckte Bereiche)
4. **Offline/Online** (falls Offline-Features produktiv genutzt werden)

Playwright ist vorhanden; diese Flows in `playwright/` oder `__tests__/e2e/` pflegen und in CI (z. B. `e2e-tests.yml`) ausführen.

---

## 6. Nächste Schritte (Checkliste)

- [x] Plan dokumentiert (dieses Dokument)
- [x] Path-basierte 80 %-Schwellen für lib/app/api in jest.config.js (schrittweise erfüllbar)
- [x] CI: Coverage als Artefakt hochladen
- [x] `scripts/coverage-summary.js` für Metriken pro Ordner
- [ ] Lib: Fehlende Module auf 80 % bringen (session-continuity, offline, workers, diagnostics, …)
- [ ] API: Alle Routen mit mindestens einem Test (inkl. Fehlerpfade)
- [ ] Ignorierte Suites: Mind. 3–5 reparieren und aus testPathIgnorePatterns entfernen
- [ ] E2E: Kritische Flows (Login, ein Kern-Workflow, ggf. Permissions) in Playwright abdecken und in CI laufen lassen

---

## 7. Referenzen

- **Coverage-Lücken:** [COVERAGE_LUECKEN.md](./COVERAGE_LUECKEN.md)
- **80 %-Plan (Detail):** [COVERAGE_80_PERCENT_PLAN.md](./COVERAGE_80_PERCENT_PLAN.md)
- **Jest-Konfiguration:** `jest.config.js` (collectCoverageFrom, coverageThreshold)
- **CI:** `.github/workflows/ci-cd.yml` (frontend-test), `.github/workflows/unit-tests.yml`
- **Coverage-Summary:** `npm run test:coverage:summary` (nach `npm run test:coverage`)
