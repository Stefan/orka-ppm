# Design: Features Overview Optimization

## Overview

Optimization of the existing Features Overview: same layout (tree left, detail right), with virtualized tree (react-window), RAG-backed search API, hover previews, auto-expand on search, inline-edit modal, and react-query caching (staleTime 5 min).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Header: Title + FeatureSearchBar (debounced, AI Suggest → RAG)         │
├────────────────────────────┬────────────────────────────────────────────┤
│  Tree (virtualized)        │  Detail Panel                               │
│  - react-window            │  - FeatureDetailCard / PageDetailCard       │
│  - Flat list of rows       │  - Edit button (lucide-react Edit)          │
│  - Hover → Mini-card       │  - Inline-Edit Modal (form) on Edit click   │
│  - Auto-expand on search   │  - Explain, Open link                       │
└────────────────────────────┴────────────────────────────────────────────┘
```

## Data Flow

1. **Initial load:** Page uses `useQuery` (react-query) for feature_catalog and for `/api/features/docs`. staleTime 5 min. Single loading state until both are ready.
2. **Search:** User types → debounced client-side filter (existing) + optional "Suggest" → `GET /api/features/search?q=...&rag=1` → returns `{ ids: string[], suggestions?: { id, name, snippet }[] }`. Frontend sets highlightIds and expandedIds so all result ancestors are expanded; optionally selects first id and scrolls into view.
3. **Tree:** Built from `buildPageTree(routes, features)`. Flattened to a list of visible rows (respecting expand/collapse). Rendered inside `react-window` FixedSizeList (or VariableSizeList) so only visible rows mount. Each row: indent by depth, chevron, icon, name; on hover show HoverPreviewCard after delay.
4. **Detail:** Selected node → FeatureDetailCard or PageDetailCard. Add Edit button (lucide-react `Edit`) that opens InlineEditModal. Modal form: name, description, link, optional icon/screenshot_url; submit → PATCH/PUT to update feature (Supabase or Next API), then invalidate query and close modal.

## Tree: Flat List + react-window Virtualization

- **No react-arborist** in this design; tree is built in memory (existing `buildPageTree`), then flattened to visible rows with `expandedIds` (see `VirtualizedPageFeatureTree`).
- **react-window:** `FixedSizeList` (item size 40px). Each item renders one tree row (chevron, icon, name, paddingLeft by depth). Row key = node.id.
- **Expand/collapse:** State `expandedIds: Set<string>`. When toggled, recompute visible rows and re-render list. Auto-expand on search: merge ancestor IDs of highlight IDs into `expandedIds`.

## Detail: Edit Button and Modal

- **FeatureDetailCard** (and optionally PageDetailCard for page nodes): Add an "Edit" button next to "Explain", using `Edit` icon from lucide-react. Visible when `feature` is non-null and user has edit permission (or always for now with a TODO).
- **InlineEditModal:** Client component. Props: `feature`, `onClose`, `onSaved`. Form fields: name, description (textarea), link; optional icon, screenshot_url. Submit: call `fetch('/api/features/...', { method: 'PATCH', body: JSON.stringify({ id, name, description, link, ... }) })` or Supabase client update. On 200, call `onSaved(updatedFeature)`, parent invalidates react-query and closes modal.

## Search API: RAG Extension

- **GET /api/features/search?q=...&rag=1**
  - If `rag=1`: Call backend (e.g. `GET /api/v1/search?q=...` or a dedicated feature-semantic endpoint) or server-side RAG over feature_catalog/vector_chunks. Map results to feature IDs; return `{ ids: string[], suggestions?: Array<{ id, name, snippet }> }`.
  - If no RAG or backend error: Fallback to current keyword match over feature_catalog (name, description, link). Return same shape.
  - Response: `{ ids: string[] }` or `{ ids: string[], suggestions: { id, name, snippet }[] }`.

## Hover Preview

- **Component:** `FeatureHoverPreview` or `TreeRowHoverPreview`. Rendered in a portal or absolute div. Props: `node: PageOrFeatureNode`, `anchorRef` or position. Content: node.name, truncated description (e.g. 120 chars), optional screenshot thumbnail (small). Show after 350 ms hover; hide on mouse leave. Position: below and left-aligned to node, or near cursor; avoid overflow (flip upward if needed).

## File Changes Summary

| File | Change |
|------|--------|
| `app/features/page.tsx` | useQuery (staleTime 5min), virtualized tree, expandedIds + auto-expand, InlineEditModal state, Edit callback |
| `app/api/features/search/route.ts` | Optional RAG: proxy to backend or server-side RAG; return ids + suggestions |
| `components/features/PageFeatureTree.tsx` | Replace full render with react-window list; add hover preview per row |
| `components/features/FeatureDetailCard.tsx` | Add Edit button (lucide-react Edit) |
| New: `components/features/FeatureHoverPreview.tsx` | Mini-card for hover |
| New: `components/features/InlineEditFeatureModal.tsx` | Modal with form, PATCH, onSaved |

## Dependencies

- **Existing:** react-window (already in package.json), @tanstack/react-query, lucide-react.
- **No new package** required for react-arborist; tree remains in-memory + flat list + react-window.
