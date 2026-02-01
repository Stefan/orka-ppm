# Design Document: Features Overview Page

## Overview

The Features Overview is a Next.js 16 page that displays a hierarchical catalog of PPM-SaaS features. It uses a split-view: left = tree (react-arborist or equivalent), right = detail card. Search is Fuse.js + optional AI; screenshots are captured via Playwright; updates are driven by a webhook. Stack: Next.js 16, Tailwind, Recharts (if needed for future charts), Supabase, FastAPI (optional backend for webhook/scan).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo + Search Bar (Fuse + AI suggestions)               │
├──────────────────────────────┬──────────────────────────────────┤
│  Tree View (react-arborist)  │  Detail Card                      │
│  - Financials                │  - Description                    │
│    - Costbook                │  - Screenshot (thumbnail, zoom)   │
│    - EAC Calculation         │  - Link                           │
│  - Data                      │  - "Explain" AI button            │
│    - Import Builder          │  - Tailwind: rounded-xl shadow   │
└──────────────────────────────┴──────────────────────────────────┘
```

## Data Model

**Supabase: feature_catalog** (avoids conflict with existing `features` table)

- `id` uuid PK
- `name` text
- `parent_id` uuid nullable (FK to features.id)
- `description` text
- `screenshot_url` text
- `link` text
- `icon` text (lucide name or emoji)
- `created_at`, `updated_at` timestamptz

## Page Layout

### /app/features/page.tsx

- **Layout:** No-scroll; `h-screen grid grid-rows-[auto_1fr]`
- **Row 1:** Header with search bar (AI-powered). Search input + optional "Suggest" button that calls `/api/features/search` with natural language.
- **Row 2:** Split-view:
  - **Left (e.g. 320px or min-w):** Tree view. Build tree from flat list (parent_id). Use react-arborist `Tree` with nodes built from features. On node select, set selected feature and show detail card.
  - **Right (flex-1):** Detail card. When a feature is selected: description, screenshot thumbnail (`<img src={screenshot_url} />`), link (`<a href={link}>`), "Explain" button (opens help chat or modal with AI explanation).
- **Cards:** Tailwind `rounded-xl shadow-sm hover:shadow-md`; lucide-react for icons.
- **Screenshots:** Thumbnail with optional hover-zoom (CSS scale or lightbox).
- **Mobile:** Tree collapses to a drawer or accordion; detail remains. Use `lg:` breakpoints for split; below `lg`, show tree in a slide-over or top accordion.

## Search

- **Client:** Fuse.js over in-memory list of features (name, description, link). Debounced input; on change, filter tree data and highlight/open matching nodes.
- **Optional AI:** `GET/POST /api/features/search?q=Zeig Import Features`. Backend or Next.js API route calls OpenAI (or internal) to rewrite query or return feature IDs; frontend then filters or navigates tree accordingly.

## Auto-Update (Webhook + Playwright)

- **Webhook:** `POST /api/features/update` (Next.js route or FastAPI). Verifies secret/token from Git provider; then:
  1. Optionally run AI scan (e.g. Grok or script) on repo/diff to detect new or changed features → update `features` table.
  2. Run Playwright snapshot script: for each configured route (e.g. `/financials`, `/import`), open URL, take screenshot, upload to storage, set `screenshot_url` for corresponding feature.
- **Playwright script:** Standalone script (e.g. `scripts/playwright-feature-screenshots.ts` or `.js`) or invoked from webhook. Uses Playwright to navigate to baseUrl + path, take full-page or viewport screenshot, save to file or upload to Supabase Storage; update feature row with new URL.
- **Idempotent:** Same push can trigger multiple times; updates overwrite; no duplicate rows.

## Admin Page: /admin/features/page.tsx

- **Layout:** Table or tree list of features; "Add", "Edit", "Delete" actions.
- **Form fields:** name, parent_id (dropdown of existing features), description, screenshot_url, link, icon.
- **AI suggestion:** Button "Suggest description" that calls API with name/link and fills description (OpenAI or internal).
- **Protection:** Check admin role or redirect to login.

## Component Structure

- `FeaturesOverviewPage` – main page; fetches features (Supabase), builds tree, state for selected feature and search query.
- `FeatureSearchBar` – input + optional AI suggest; calls Fuse and/or `/api/features/search`.
- `FeatureTree` – tree component (react-arborist); receives tree data, onSelect sets selected feature.
- `FeatureDetailCard` – shows selected feature: description, screenshot, link, "Explain" button.
- `FeatureScreenshot` – thumbnail with hover-zoom or lightbox.

## API Routes (Next.js)

- `GET /api/features` – list all features (for client fetch or server component).
- `GET /api/features/search?q=...` – optional AI search; returns feature IDs or rewritten query.
- `POST /api/features/update` – webhook: verify, run Playwright script, optionally AI scan, update DB.

## Backend (FastAPI) – Optional

- If webhook or AI scan is heavy, implement in FastAPI:
  - `POST /api/v1/features/update` – same contract; calls Playwright script and updates Supabase (via service or direct client).
- `backend/routers/features.py` – register router under `/api/v1/features`.

## Testing

- Use React Suspense for lazy-loaded tree or detail component so that the page is testable (e.g. wrap in Suspense with fallback).
- Unit tests: buildTree(flatList), Fuse search, selection state.
- E2E: open /features, search "Import", select node, see detail card and link.

## Security and Performance

- Webhook: validate GitHub/GitLab secret; rate-limit.
- Screenshots: run Playwright in sandbox; timeouts to avoid hangs.
- Features list: cache on client (e.g. React Query) or server component; invalidate on webhook if needed.
