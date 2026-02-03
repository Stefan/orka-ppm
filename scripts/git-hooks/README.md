# Git hooks

## pre-push

Runs before `git push`:

1. **Health check** – `npm run health-check` (syntax check, optional-deps check, type-check). Catches e.g. "Module not found" for optional packages early.
2. **Property-based tests** – `scripts/run-pbt-on-changes.sh` on changed files.

### Installation

- **With Husky:** After `npm install`, `prepare` runs `husky install`, which sets up `.husky/pre-push` to call this script. No extra steps.
- **Without Husky:** Copy the hook and make it executable:
  ```bash
  cp scripts/git-hooks/pre-push .git/hooks/pre-push
  chmod +x .git/hooks/pre-push
  ```

### Bypass

```bash
git push --no-verify
```

Use only when necessary (e.g. emergency push).
