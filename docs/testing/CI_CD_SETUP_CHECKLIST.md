# CI/CD setup checklist

Use this list after pushing the workflow files. Everything under "In this repo" is already done; the rest you do in GitHub.

## In this repo (already done)

- [x] Workflows in `.github/workflows/` (unit, integration, e2e, performance, compliance, security, continuous, **nightly-full-tests**)
- [x] Nightly full test suite runs daily at 02:00 UTC and on manual trigger

## On GitHub (do these once)

### 1. Push workflows

- [ ] Commit and push `.github/workflows/*.yml` (including `nightly-full-tests.yml`)

### 2. Enable Actions

- [ ] Repo → **Settings** → **Actions** → **General**
- [ ] **Actions permissions:** "Allow all actions and reusable workflows" (or your org’s choice)
- [ ] **Workflow permissions:** "Read and write" if you want coverage/deploy; else "Read repository contents"
- [ ] **Save**

### 3. Secrets (optional)

- [ ] **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- [ ] Add `CODECOV_TOKEN` if you use Codecov
- [ ] Add `BASE_URL` if E2E uses a live URL
- [ ] Add `SLACK_WEBHOOK_URL` if you want failure notifications

### 4. Branch protection

- [ ] **Settings** → **Branches** → **Add branch protection rule** (or edit rule for `main`)
- [ ] **Branch name pattern:** `main` (and optionally `develop`)
- [ ] Enable **Require status checks before merging**
- [ ] Add status checks: **Unit Tests**, **Integration Tests**, **CI/CD Pipeline**
- [ ] **Create** / **Save changes**

## What runs when

| When              | What runs                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Every push/PR     | Unit tests, Integration tests, CI/CD pipeline (build, lint, deploy)     |
| Nightly 02:00 UTC | Full suite: unit, integration, E2E, performance, compliance             |
| Weekly Mon 02:00  | Security scan (Bandit, npm audit)                                        |
| Hourly            | Continuous testing (regression suite)                                    |
| Manual            | Any workflow via **Actions** → select workflow → **Run workflow**        |

Full details: [CI_CD_PIPELINES.md](./CI_CD_PIPELINES.md).
