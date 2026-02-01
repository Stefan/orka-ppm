# Feature Overview: Ideas for More Comprehensive and Automated

## Focus

The Feature Overview is written from a **PPM (Project Portfolio Management) point of view**: it describes the **features that Orka PPM provides to its users** (portfolio dashboards, projects, resources, financials, risks, reports, Monte Carlo, change management, audit, etc.). It is **not** engineering documentation: cross-browser compatibility, build optimization, CI/CD, testing, design system, fixes, and cleanup are irrelevant in the PPM context and are excluded. Content is **textual descriptions and screenshots**; app routes are not shown. Specs (.kiro/specs) and docs (docs/) are filtered and enriched so only PPM features appear with user-facing names and descriptions.

## Current state

- **Catalog tab:** Supabase `feature_catalog` (descriptions, screenshots, optional link). Manual or admin; sync can add new specs from crawl.
- **Documentation tab:** Shows **specs** (.kiro/specs) and **docs** (docs/) only — no app routes. Auto-updates with the repo.
- **Discovered:** Only "Discovered specs" (specs not yet in catalog); no discovered routes.
- **Help Chat RAG:** Indexes `docs/` and `.kiro/specs` (requirements, design).

## Ideas (comprehensive + automated)

### 1. **Index requirements and design in RAG** ✅ implemented

- Extend the indexing script to include `.kiro/specs/**/*.md` (design.md, requirements.md, tasks.md).
- Help Chat can then answer from specs and design; Feature Overview and help stay aligned with the same source of truth.

### 2. **Merged / discovered view in Catalog** ✅ implemented

- In the Catalog tab, optionally show **discovered** items (from crawl) that are not yet in the catalog.
- One list: catalog entries first, then “Discovered from project” (routes + specs without a catalog row). Users see the full picture; admins can later add discovered items to the catalog.

### 3. **Sync catalog from project** ✅ implemented

- **POST /api/features/sync:** Run the same crawler, then upsert `feature_catalog`: insert new routes/specs that don’t exist (e.g. by `link` or name). Optional `dry_run`.
- Call from Admin (“Sync from project”) or from the webhook on push so the catalog stays in sync without manual data entry.

### 4. **Webhook triggers sync and screenshots**

- When **POST /api/features/update** runs (e.g. GitHub push), optionally:
  1. Call sync (crawl → upsert catalog).
  2. Run Playwright screenshot script (with `UPDATE_SUPABASE=1` to set `screenshot_url`).
- Document in CI: “On push to main, call webhook; sync + screenshots run in CI or a worker.”

### 5. **Richer Documentation detail**

- For specs in the Documentation tab: show more than the first paragraph (e.g. “Overview” section from design.md, or first N lines). Optionally link to the raw file in the repo.

### 6. **Single “Features” tree (catalog + discovered)**

- One tree: catalog entries with a “source: catalog” badge; discovered items with “source: discovered”. Filter/toggle by source. Selection opens the same detail card (catalog data or crawled data).

### 7. **Crawl API routes (optional, not current focus)**

- Extend the crawler to list `app/api/**/route.ts` as “API endpoints” (e.g. under “App routes” or a separate section). Makes the overview a full map of the app surface.

### 8. **Cache crawl result (ISR or build)**

- Precompute crawl at build time or use ISR (e.g. revalidate every 60s or on webhook). Reduces latency on the Documentation tab and on sync.

### 9. **“Related docs” in detail card**

- In the feature/spec detail card: “Related documentation” from RAG (query by feature name or description; show top 2–3 chunks or links to docs). Ties Overview to the knowledge base.

### 10. **Tasks / progress from tasks.md**

- Parse `tasks.md` (e.g. `- [ ]` / `- [x]`) and show “Tasks: 3/5 done” or a mini checklist in the spec’s detail card. Keeps Overview aligned with implementation status.

---

**Implemented:** (1) Index .kiro/specs in RAG, (2) Merged view with discovered specs in Catalog, (3) POST /api/features/sync (specs only). **Focus:** Routes removed from Overview; emphasis on textual descriptions and screenshots.
