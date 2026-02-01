# Enterprise Test Strategy

**Implementation plan:** `.kiro/specs/enterprise-test-strategy/tasks.md`

## Test pyramid

- **Unit tests (base):** Fast, no I/O, high coverage. Run on every push.
- **Integration tests (middle):** API + DB (mocked or test DB). Run on every push.
- **E2E / UI tests (top):** Critical user flows. Run on PRs.

Target distribution (by execution time): ~70% unit, ~20% integration, ~10% E2E.

## Test-first workflow

1. Write a failing test for the new behavior.
2. Implement the minimal code to pass.
3. Refactor and keep tests green.

## Property-based testing

- **Backend:** `hypothesis` (e.g. `@given`, `strategies`). Mark with `@pytest.mark.property`.
- **Frontend:** `fast-check` in Jest. Use `*.property.test.ts`.
- Run at least 100 examples per property; increase in CI.

## Compliance testing

- **Audit trail:** Immutability and completeness (Tasks 9.x).
- **Encryption:** At-rest and TLS (Tasks 10.x).
- **AI bias:** Demographic parity and disparate impact (Tasks 11.x).
- **GDPR:** Data subject rights, consent, retention (Tasks 12.x).
- **SOC2/ISO27001:** RBAC, change audit, incident response (Tasks 13.x).

## Running tests

| Scope        | Backend              | Frontend           |
|-------------|----------------------|--------------------|
| Unit        | `pytest tests/ -m unit` | `npm run test:ci`   |
| Integration | `pytest tests/ -m integration` | `npm run test:ci -- --testPathPattern=integration` |
| E2E         | -                    | `npm run test:e2e` |
| Performance | k6 scripts           | Lighthouse CI      |
| Security    | Bandit, ZAP          | npm audit          |

## CI/CD

- **Unit / integration:** `.github/workflows/unit-tests.yml`, `integration-tests.yml`
- **E2E:** `.github/workflows/e2e-tests.yml`
- **Performance:** `.github/workflows/performance-tests.yml`
- **Security:** `.github/workflows/security-scan.yml`
- **Compliance:** `.github/workflows/compliance-tests.yml`

Coverage thresholds: 80% (backend: pytest `--cov-fail-under=80`; frontend: Jest `coverageThreshold`).
