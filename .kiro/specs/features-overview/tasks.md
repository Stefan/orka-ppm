# Implementation Plan: Features Overview Page

## Overview

This plan implements the Features Overview page and Admin page with hierarchical tree, Fuse + AI search, detail cards, webhook-driven auto-update, and Playwright screenshots. All code is production-ready and testable with Suspense.

## Tasks

### Task 1: Supabase Table and Seed

- [x] 1.1 Create migration `038_features_overview.sql`
  - Table `feature_catalog`: id (uuid PK), name (text), parent_id (uuid nullable FK), description (text), screenshot_url (text), link (text), icon (text), created_at, updated_at
  - RLS: enable for authenticated read; admin write if needed
  - Index on parent_id for tree queries
- [x] 1.2 Create seed script or SQL insert with example hierarchy:
  - Root: "Financials" (parent_id null), "Data" (parent_id null)
  - Children: "Costbook" (parent = Financials), "EAC Calculation" (parent = Costbook); "Import Builder" (parent = Data) with description: custom templates, mapping, sections, validation; 10x: AI auto-mapping, live preview, error-fix suggestions
  - Links: e.g. /financials, /import; icon names (lucide)
- [x] 1.3 Apply migration and run seed (document in README or migration comment)

### Task 2: Frontend Page with Tree-View and Detail Card

- [x] 2.1 Add dependencies: react-arborist (or equivalent), fuse.js
- [x] 2.2 Create types: `Feature`, `FeatureTreeNode` in types/features.ts
- [x] 2.3 Create lib: `buildFeatureTree(flatFeatures)` and optional Fuse search helper in lib/features/
- [x] 2.4 Implement `/app/features/page.tsx`:
  - Layout: h-screen grid-rows-[auto_1fr]; Row 1: header with search bar; Row 2: split (tree | detail)
  - Fetch features (Supabase client or GET /api/features); build tree; state: selectedFeature, searchQuery
  - Left: Tree component (react-arborist) with expand/collapse; onSelect update selectedFeature
  - Right: FeatureDetailCard for selectedFeature; placeholder when none
  - Cards: Tailwind rounded-xl shadow-sm hover:shadow-md; lucide-react icons
  - Screenshot: thumbnail img, optional hover-zoom
  - Link: anchor to feature link; "Explain" button (placeholder or help chat)
- [x] 2.5 Responsive: below lg, tree in drawer/accordion (Mobile Collapse)
- [x] 2.6 Wrap heavy components in Suspense with fallback for testing

### Task 3: Search with Fuse and AI Endpoint

- [x] 3.1 Integrate Fuse.js in features page: search over name, description, link; debounce; filter/highlight tree and optionally open matching nodes
- [x] 3.2 Create `GET /api/features/search?q=...` (Next.js route): optional OpenAI call to interpret query (e.g. "Zeig Import Features") and return feature IDs or rewritten query; or return top Fuse results by ID
- [x] 3.3 Connect search bar to Fuse (client) and optionally to /api/features/search for "Suggest" or AI path
- [x] 3.4 Display search results in tree (expand and highlight) and/or list in detail area

### Task 4: Webhook and Playwright Screenshots

- [x] 4.1 Create `POST /api/features/update` (Next.js): verify webhook secret (e.g. from env); optionally parse Git payload; trigger screenshot job
- [x] 4.2 Implement Playwright snapshot script (e.g. scripts/feature-screenshots.ts or within API): read config (list of routes and optional feature ids); for each route, navigate with Playwright, take screenshot; upload to Supabase Storage or public dir; update feature_catalog.screenshot_url
- [x] 4.3 Document webhook URL and secret for GitHub/GitLab; idempotent and safe to re-run
- [ ] 4.4 Optional: AI scan step (e.g. Grok or script over diff) to suggest new/updated features and update table

### Task 5: Admin Edit Page

- [x] 5.1 Create `/admin/features/page.tsx`: list features (table or tree); Add / Edit / Delete
- [x] 5.2 Form: name, parent_id (dropdown of features), description, screenshot_url, link, icon
- [x] 5.3 "Suggest description" button: call API (e.g. /api/features/suggest-description) with name/link; fill description
- [x] 5.4 Protect route: admin check or redirect
- [x] 5.5 Persist to Supabase (via client or API route POST/PATCH/DELETE)

### Task 6: Integration and Testing

- [x] 6.1 Add link to Features Overview in app navigation (e.g. sidebar or header)
- [x] 6.2 Add Features card/link on Admin dashboard to /admin/features
- [ ] 6.3 Unit tests: buildFeatureTree, Fuse search, selection state
- [ ] 6.4 E2E or manual: open /features, search "Import", select Import Builder, see detail and link; open /admin/features, add/edit feature
- [x] 6.5 All components used in page support Suspense where applicable

## Code Locations

- **Page:** `/app/features/page.tsx` (main), `/admin/features/page.tsx` (admin)
- **API:** `/app/api/features/route.ts` (list), `/app/api/features/search/route.ts`, `/app/api/features/update/route.ts`, `/app/api/features/suggest-description/route.ts` (optional)
- **Backend (optional):** `backend/routers/features.py` for webhook and Playwright orchestration
- **Types:** `types/features.ts`
- **Lib:** `lib/features/tree.ts`, `lib/features/search.ts`
- **Components:** `components/features/FeatureTree.tsx`, `components/features/FeatureDetailCard.tsx`, `components/features/FeatureSearchBar.tsx`
- **Migration:** `backend/migrations/038_features_overview.sql`, seed in same or separate SQL file
