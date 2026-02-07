# Codebase Cleanup Investigation

Summary of findings and recommended cleanup areas. Use the `chore/codebase-cleanup` branch and PR for follow-up work.

---

## 1. Documentation and one-off docs

### Root-level docs (move or archive) — DONE
- Root one-off docs have been moved to **docs/archive/**.
- **docs/README.md** added as an index; **docs/fixes/** reserved for future fix writeups.

### *_SUMMARY.md sprawl
- ~60 files matching `*_SUMMARY.md` exist across the repo (backend/, components/, .kiro/specs/, etc.).
- **Recommendation:** Archive or delete obsolete ones into docs/archive/summaries/ as a follow-up; leave in place any that are still current.

---

## 2. Logging and diagnostics

### Frontend: console usage
- ~1,127 `console.log` / `console.warn` / etc. across 168 TS/TSX files (including scripts and tests).
- **Recommendation:** In app/lib (production), use a small logger (e.g. lib/monitoring/logger.ts) and remove or gate `console.*` by env.

### Backend: print vs logging
- ~6,046 `print()` calls across 243 Python files (many in tests/scripts).
- **Recommendation:** In production code (routers, services), use `logging`; leave or standardize `print` in tests/scripts.

---

## 3. TODO / FIXME / tech debt markers

- ~107 matches for TODO, FIXME, HACK, XXX, or deprecated across 30 files.
- **Recommendation:** Triage: create issues for actionable items; remove or fix obsolete deprecated comments.

---

## 4. Duplication and structure

### Screenshot service
- **lib/screenshot-service.ts** — Used by VisualGuideManager and tests; exports ScreenshotService, VisualGuideBuilder, types.
- **lib/services/screenshot-service.ts** — Extended implementation with different types and VisualGuideSystem integration.
- **Recommendation:** Treat lib/screenshot-service.ts as the canonical app entry; lib/services/screenshot-service.ts as the extended/help-chat implementation. Document in code; consolidate in a later PR if desired.

### Supabase / API clients
- Multiple touchpoints: lib/api/supabase.ts, lib/api/supabase-minimal.ts, lib/costbook/supabase-queries.ts, lib/costbook/supabase-rpc.ts.
- **Recommendation:** Document intended roles (minimal vs full client, costbook helpers); consolidate only if redundant.

### API entry points
- **lib/api.ts** — Legacy generic fetch helpers (get, post, put, del, getApiUrl, apiRequest).
- **lib/api/** — Next.js proxy client, supabase, auth (getApiUrl from client.ts).
- **Recommendation:** Prefer **lib/api/** (client, supabase, auth) for app code; lib/api.ts is legacy generic helpers. Some code imports get/post from lib/api (resolves to lib/api.ts). Document; migrate to lib/api/client or keep both with clear comments.

---

## 5. Noise and accidental artifacts

- Accidental dirs (#/, Use/, if/, etc.) are in **.gitignore**. Remove from working tree if present; they should not be committed.

---

## 6. Suggested cleanup order

1. **Done:** Move root one-off docs to docs/archive; add docs/README.md; ensure .gitignore.
2. **Done:** Archive obsolete *_SUMMARY.md to docs/archive/summaries/; screenshot-service + lib/api documented in code.
3. **Done:** Logger for frontend (prod: no console output); logging in backend main.py; TODO in main.py cleared. **Ongoing:** Replace remaining console.* in app/ with logger; use logging in routers/services where still print().

---

## 7. Ungenutzte Exports

- **Erledigt:** In `lib/monitoring/index.ts` die Re-Exports von `production-monitoring` und `security` entfernt (keine Imports im Projekt). Direktimport z. B. `@/lib/monitoring/production-monitoring` bleibt möglich.
- **Tooling:** Ungenutzte Exports finden mit `npx ts-prune` (kann in großen Repos langsam sein) oder [knip](https://github.com/webpro/knip). Empfehlung: `npx ts-prune --project tsconfig.json 2>&1 | grep -v __tests__ | grep -v node_modules` oder knip einmalig einrichten.

---

## 8. Metrics snapshot

| Area                    | Count / scope     | Status |
|-------------------------|-------------------|--------|
| TODO/FIXME/deprecated   | ~107 in 30 files  | main.py cleared; rest on demand |
| console.* (frontend)    | ~1,127 in 168 files | Logger gates prod; ThemeProvider uses logger; rest incremental |
| print() (backend)        | ~6,046 in 243 files | main.py → logging; routers/services on demand |
| *_SUMMARY.md            | ~60 files         | Backend root → docs/archive/summaries/backend |
| Root one-off docs       | —                 | Moved to docs/archive |
| Duplicate modules       | screenshot (2); API entry (2) | Documented in code |
| Unused barrel exports   | lib/monitoring (production, security) | Removed from index; direct import still available |
