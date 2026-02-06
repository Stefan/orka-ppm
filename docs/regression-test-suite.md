# Regression Test Suite

Enterprise Test Strategy – Requirement 12: Regression tests on every CI run.

## Backend (pytest)

- **Marker:** `@pytest.mark.regression`
- **Run only regression tests:**  
  `cd backend && python -m pytest -m regression -v -o addopts=""`
- **Marked modules:**  
  `test_projects_endpoints`, `test_audit_permission_enforcement`, `test_audit_permission_403`, `test_financial_tracking_endpoints` (selected tests)

## Frontend (Jest)

- **Convention:** Include `[@regression]` in the `describe()` or `it()` name.
- **Run only regression tests:**  
  `npm run test:regression`  
  (runs `jest --testNamePattern="@regression"`)
- **Marked suites:**  
  `lib/api/client`, `PermissionGuard.unit`, `EnhancedAuthProvider.unit`

- **Weitere Lücken / Reparatur-Backlog:** siehe [fehlende-tests-uebersicht.md](fehlende-tests-uebersicht.md).

## CI

- Full CI runs the complete test suite (`npm run test:ci` for frontend; backend as configured in GitHub Actions).
- To run only the regression subset: use the commands above.

---

## Warum erhöht sich die Testanzahl nicht? (npm run test -- --coverage)

Wenn du neue Testdateien oder neue `it()`-Blöcke hinzufügst, die Anzahl der Tests aber gleich bleibt:

1. **Jest-Cache**  
   Jest speichert, welche Dateien zu den Tests gehören. Nach dem Anlegen neuer Testdateien den Cache leeren und erneut laufen lassen:
   ```bash
   npm run test -- --coverage --clearCache
   npm run test -- --coverage
   ```
   Oder einmalig: `npm run test:fresh` (siehe package.json).

2. **Neue Tests in ignorierten Dateien**  
   Stehen die neuen Tests in einer Datei, die in `jest.config.js` unter **testPathIgnorePatterns** steht, werden sie nie ausgeführt. Neue Tests in eigenen Dateien anlegen (z. B. `*.unit.test.tsx`) oder die Datei aus den Ignore-Patterns nehmen.

3. **Dateiname / testMatch**  
   Es werden nur Dateien ausgeführt, die zu **testMatch** passen, z. B. `**/*.test.{ts,tsx}`, `**/*.property.test.{ts,tsx}`. Dateien wie `*.spec.ts` oder `*.test.js` werden nur erfasst, wenn ein passendes Pattern in der Config steht.
