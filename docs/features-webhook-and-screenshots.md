# Features Overview: Webhook, Screenshots, and AI Enrichment

## AI-generated feature documentation (PPM point of view)

The Feature Overview describes **Orka PPM features**—what the app provides to PPM users (portfolio managers, project managers). Documentation is created from a **PPM point of view**, not engineering.

- **Only PPM features:** Included specs are user-facing PPM capabilities: portfolio dashboards, project management, resource planning, financial tracking, risk management, Monte Carlo simulation, reporting, change management, audit trail, collaboration, etc.
- **Excluded (irrelevant in PPM context):** Cross-browser compatibility, build optimization, CI/CD, testing infrastructure, design system implementation, layout fixes, cleanup, refactors—anything that is engineering/infra, not a feature the PPM user uses. These are always filtered out (blocklist + AI).
- **Feature names and descriptions:** For each PPM feature spec, the AI generates a short **feature name** and **1–2 sentence description** for end users in PPM terms.

**How to run:**

1. Set `OPENAI_API_KEY` (and optionally `OPENAI_BASE_URL`, `OPENAI_MODEL` e.g. `gpt-4o-mini`).
2. Run: `npm run enrich-feature-docs`
3. The script writes `public/feature-docs-enrichments.json`. Commit it so the Overview uses it without re-running.
4. `GET /api/features/docs` applies a PPM blocklist (always excludes known non-PPM specs), then uses the enrichments file to exclude AI-classified non-features and to use AI-generated names/descriptions.

Re-run after adding or changing specs in `.kiro/specs`.

---

# Webhook and Playwright Screenshots

## Webhook: `POST /api/features/update`

- **Purpose:** Trigger auto-update of the feature catalog (e.g. after a Git push). Verifies a shared secret, then can trigger the Playwright screenshot job or an optional AI scan.
- **Auth:** Send `x-webhook-secret` header or `Authorization: Bearer <secret>` with the value of `FEATURES_WEBHOOK_SECRET`.
- **Body:** Optional JSON (e.g. GitHub webhook payload with `ref`, `repository.full_name`). The handler is idempotent and safe to call repeatedly.
- **Env:** Set `FEATURES_WEBHOOK_SECRET` in production. If unset, the route still accepts requests (useful for local testing).

### GitHub/GitLab

- **Webhook URL:** `https://<your-app>/api/features/update`
- **Secret:** Use the same value as `FEATURES_WEBHOOK_SECRET`. Configure it in the repo’s webhook settings.
- **Events:** Push (or custom) as needed. The handler does not require a specific payload shape.

## Playwright screenshot script

- **Run:** `npm run feature-screenshots` or `npx tsx scripts/feature-screenshots.ts`
- **Env:**
  - `BASE_URL` – App origin (default: `http://localhost:3000`)
  - `FEATURE_SCREENSHOTS_DIR` – Output directory (default: `public/feature-screenshots`)
  - `UPDATE_SUPABASE=1` – If set, update `feature_catalog.screenshot_url` for each captured route (requires Supabase env below)
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or anon key) – For DB updates when `UPDATE_SUPABASE=1`

Screenshots are written to `public/feature-screenshots/` so they are served at `/feature-screenshots/<slug>.png`. With `UPDATE_SUPABASE=1`, the script updates the corresponding feature row’s `screenshot_url` to that public URL.

Routes and optional feature IDs are defined in the script (`DEFAULT_ROUTES`). Add or change entries there to capture more pages.

## Triggering screenshots from the webhook

The webhook handler does **not** run Playwright in-process (to avoid long-running work and platform limits). To run screenshots on push:

1. **CI:** In GitHub Actions (or similar), call `POST /api/features/update` with the secret, then run `npm run feature-screenshots` in the same job with `BASE_URL` set to your app URL and optional `UPDATE_SUPABASE=1` and Supabase env.
2. **Queue/worker:** Have the webhook enqueue a job that runs the script on a worker with Playwright and env configured.

Document the chosen approach in your CI or deployment docs.

## Sync catalog from project: `POST /api/features/sync`

- **Purpose:** Crawl the project (app routes, .kiro/specs) and insert new items into `feature_catalog` that don’t already exist (by `link` for routes, by `name` for specs). Keeps the catalog in sync with the codebase without manual data entry.
- **Auth:** Same as webhook: `x-webhook-secret` or `Authorization: Bearer <FEATURES_WEBHOOK_SECRET>`.
- **Body:** `{ "dry_run": true }` to only return what would be inserted (no DB writes).
- **Note:** If RLS blocks inserts, use `SUPABASE_SERVICE_ROLE_KEY` in the environment for this route (or add an RLS policy that allows the sync caller to insert).
