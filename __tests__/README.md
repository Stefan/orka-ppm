# Frontend Test Structure

Tests are organized as follows. Run with `npm test` (see [docs/TESTING_GUIDE.md](../docs/TESTING_GUIDE.md)).

## Categories

| Directory / pattern | Purpose |
|--------------------|--------|
| **`__tests__/`** (root) | Integration tests, component tests, domain tests (costbook, admin, etc.). |
| **`__tests__/property/`** | Property-based tests (*.property.test.ts(x)) – zentrale Ablage. |
| **`__tests__/unit/`** | Unit tests (reine Modul-/Funktionstests, z. B. evm-calculations, nl-query-parser). |
| **`__tests__/api-routes/`** | Next.js API route handlers (e.g. `*.route.test.ts`). |
| **`__tests__/register-nested-grids/`** | Nested grids: unit, property, integration. |
| **`__tests__/components/`** | Component tests (e.g. HelpChat, pmr, navigation). |
| **`__tests__/lib/`** | Lib unit/property tests (e.g. gamification-engine, distribution-engine). |
| **`**/*.property.test.ts(x)`** | Property-based tests (Hypothesis-style invariants). |
| **`app/**/__tests__/`**, **`components/**/__tests__/`**, **`lib/**/__tests__/`** | Co-located unit tests. |
| **`__tests__/e2e/`** | E2E / Playwright-style specs (if present). |

## Conventions

- **Unit:** Fast, isolated; mock external deps.
- **Integration:** Multiple units or API; may hit Next.js API routes or mocks.
- **Property:** Invariants and generators; file name `*.property.test.ts(x)`.
- **API routes:** Test handler request/response; use `__tests__/api-routes/*.route.test.ts`.

Snapshots live next to tests (e.g. `__snapshots__/`) or under `__tests__/snapshots/`.

## Neue Tests platzieren

- **Property-Tests** (*.property.test.ts(x)) → möglichst unter `property/` (oder thematisch z. B. `register-nested-grids/`, `lib/`).
- **Unit-Tests** (reine Modul-/Funktionstests) → möglichst unter `unit/` oder thematisch z. B. `lib/`, `components/`.
- **API-Route-Tests** → `api-routes/` mit Namensschema `*.route.test.ts`.

Weitere Strukturempfehlungen: [docs/codebase-structure-recommendations.md](../docs/codebase-structure-recommendations.md).
