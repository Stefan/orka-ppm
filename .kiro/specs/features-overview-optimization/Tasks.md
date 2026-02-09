# Tasks: Features Overview Optimization

## Task 1: Extend /api/features/search with RAG AI Suggestions

**Goal:** Search API returns contextual feature IDs using RAG when available; fallback to keyword match.

- [ ] **1.1** In `app/api/features/search/route.ts`: Accept query param `rag=1`. When set, call backend (e.g. `GET ${BACKEND_URL}/api/v1/search?q=...`) or a server-side RAG/embedding step over feature_catalog or KB; map response to feature IDs. Return `{ ids: string[], suggestions?: { id, name, snippet }[] }`.
- [ ] **1.2** When RAG is disabled or backend fails, keep current behavior: keyword filter over Supabase feature_catalog (name, description, link), return `{ ids: string[] }`.
- [ ] **1.3** Ensure response shape is stable so frontend can use `ids` for selection/expand and optional `suggestions` for dropdown UI.

**Deliverable:** Updated `app/api/features/search/route.ts`, testable via `GET /api/features/search?q=costbook&rag=1`.

---

## Task 2: Frontend Tree – Hover Previews + Auto-Expand on Search

**Goal:** Tree shows hover mini-cards and auto-expands to reveal search results.

- [ ] **2.1** Add component `FeatureHoverPreview` (or `TreeRowHoverPreview`): receives node (and optional position). Renders mini-card with name, truncated description, optional screenshot. Shown after ~350 ms hover; hide on mouse leave. Use portal or absolute positioning so it doesn’t shift layout.
- [ ] **2.2** In tree row (e.g. inside virtualized row render): on mouse enter/leave, set hovered node and position; render `FeatureHoverPreview` when hovered node is set.
- [ ] **2.3** When `highlightIds` (from search) update: compute set of ancestor IDs for each highlighted id; set expanded state so those ancestors are expanded. Optionally select first highlighted id and scroll it into view in the virtualized list.

**Deliverable:** `components/features/FeatureHoverPreview.tsx`, updates to tree row component and page state (expandedIds, auto-expand logic).

---

## Task 3: Inline-Edit Modal with Form

**Goal:** Admin can edit feature description (and name/link) in a modal from the detail panel.

- [ ] **3.1** Add `InlineEditFeatureModal` component: props `feature`, `open`, `onClose`, `onSaved`. Form fields: name, description (textarea), link; optionally icon, screenshot_url. Submit via PATCH to Supabase (from client) or to Next.js API that updates feature_catalog. On success call `onSaved(updated)` and `onClose()`.
- [ ] **3.2** In `FeatureDetailCard`, add an "Edit" button (lucide-react `Edit` icon). On click, open `InlineEditFeatureModal` with current feature. When modal calls `onSaved`, parent (page) updates feature in cache/query and closes modal.
- [ ] **3.3** Ensure modal is accessible (focus trap, Escape to close, aria-label). Use existing Tailwind and layout patterns.

**Deliverable:** `components/features/InlineEditFeatureModal.tsx`, `FeatureDetailCard.tsx` with Edit button and modal state in page.

---

## Task 4: Virtualization + Caching in page.tsx

**Goal:** Tree is virtualized with react-window; data loaded with react-query and 5 min staleTime.

- [ ] **4.1** In `app/features/page.tsx`: Replace direct Supabase and fetch calls with `useQuery` (e.g. one query for feature_catalog, one for `/api/features/docs`). Set `staleTime: 5 * 60 * 1000` (5 minutes). Derive `features` and `routes` from query data; show loading state from `isLoading` of both queries.
- [ ] **4.2** Build visible tree rows: from `pageTree` and `expandedIds`, compute flat list `visibleRows = { node, depth }[]`. Pass to a wrapper that renders `react-window` FixedSizeList (or VariableSizeList). Row height e.g. 40px; each row renders current tree row UI (chevron, icon, name, indent by depth). Handle expand/collapse by toggling `expandedIds` and recomputing visible rows.
- [ ] **4.3** Wrap `FeaturesContent` (or tree + detail) in Suspense if using lazy-loaded components; keep existing Suspense boundary at page level for consistency. Ensure no layout shift when data loads.

**Deliverable:** Updated `app/features/page.tsx` (useQuery, staleTime 5 min, virtualized tree), and tree component using react-window.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Extend /api/features/search with RAG AI suggestions |
| 2 | Frontend tree: hover previews + auto-expand on search |
| 3 | Inline-edit modal with form + Edit button on detail card |
| 4 | Virtualization (react-window) + caching (react-query 5 min) in page.tsx |
