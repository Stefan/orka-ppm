# CI/CD Pipeline Documentation

**Enterprise Test Strategy - Task 26.3**

## Setup: regularly running all tests

### 1. Push workflows to GitHub

- Commit and push `.github/workflows/*.yml` (including `nightly-full-tests.yml`). CI runs automatically once Actions is enabled.

### 2. Enable GitHub Actions

1. On GitHub, open your repo.
2. Go to **Settings** → **Actions** → **General**.
3. Under **Actions permissions**, choose **Allow all actions and reusable workflows** (or your org’s allowed set).
4. Under **Workflow permissions**, choose **Read and write permissions** if you want workflows to push (e.g. coverage comments); otherwise **Read repository contents and packages** is enough for running tests.
5. Click **Save**.

### 3. What runs when

- **Every push/PR to `main` or `develop`:** Unit tests, Integration tests, and the main CI/CD pipeline (build, lint, optional deploy).
- **E2E / Performance / Compliance:** On pull requests or via **Actions** → **Run workflow** (manual).
- **Scheduled:** Security scan weekly (Mon 02:00 UTC); Continuous testing hourly; **Nightly full tests** daily at 02:00 UTC (unit, integration, E2E, performance, compliance).

### 4. Nightly full suite

The workflow **Nightly Full Tests** (`nightly-full-tests.yml`) runs daily at 02:00 UTC and on manual trigger. It runs: backend unit, frontend unit, backend integration, frontend integration, E2E (Playwright), performance (Lighthouse + k6), and compliance tests. To run it manually: **Actions** → **Nightly Full Tests** → **Run workflow**.

### 5. Add repository secrets (optional)

1. On GitHub: **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add:

| Name               | When to add |
|--------------------|-------------|
| `CODECOV_TOKEN`    | You use Codecov for coverage (get token from codecov.io). |
| `BASE_URL`         | E2E tests hit a live staging/production URL (use in E2E job env). |
| `SLACK_WEBHOOK_URL`| You want failure notifications from `continuous-testing.yml`. |

### 6. Branch protection (require tests before merge)

1. On GitHub: **Settings** → **Branches**.
2. Click **Add branch protection rule** (or edit the rule for `main`).
3. **Branch name pattern:** `main` (and add another rule for `develop` if you use it).
4. Enable **Require status checks before merging**.
5. In **Search for status checks**, add:
   - **Unit Tests**
   - **Integration Tests**
   - **CI/CD Pipeline** (if you want the full build/lint/deploy to be required)
6. Optionally enable **Require branches to be up to date before merging**.
7. Click **Create** / **Save changes**.

---

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `unit-tests.yml` | Push, PR to main/develop | Backend pytest unit + frontend Jest; coverage upload |
| `integration-tests.yml` | Push, PR to main/develop | Backend/frontend integration tests |
| `e2e-tests.yml` | PR, manual | Playwright E2E; upload report on failure |
| `performance-tests.yml` | PR to main, manual | Lighthouse + k6 |
| `security-scan.yml` | Weekly (Mon 02:00), manual | Bandit SAST, npm audit |
| `compliance-tests.yml` | PR to main, manual | Audit, encryption, GDPR, SOC2 compliance tests |
| `continuous-testing.yml` | Hourly, manual | Regression suite (e.g. against staging) |
| **`nightly-full-tests.yml`** | **Daily 02:00 UTC, manual** | **Full suite: unit, integration, E2E, performance, compliance** |
| `ci-cd.yml` | Push, PR | Existing full CI/CD (build, lint, deploy) |

## Interpreting test reports

- **Unit / integration:** Check job logs and coverage (Codecov if configured).
- **E2E:** Download `playwright-report` artifact and open `index.html`.
- **Security:** Download `bandit-report` artifact; fix high/critical findings.
- **Performance:** Lighthouse and k6 output in job logs; compare to baseline.

## Handling test failures

1. Reproduce locally: run the same command (e.g. `pytest tests/ -m unit`, `npm run test:ci`).
2. Fix the root cause or add a skip with a ticket reference; do not disable tests without a reason.
3. For flaky tests: replace fixed sleeps with explicit waits and add a flakiness ticket.

## Updating test configuration

- **Backend coverage:** `backend/tests/pytest.ini` and `test-config/coverage.rc`; CI uses `--cov-fail-under=80`.
- **Frontend coverage:** `jest.config.js` and `__tests__/jest.config.js`; `coverageThreshold` 80%.
- **Markers:** Backend markers in `pytest.ini`; frontend tags in test names or `@regression` etc.
