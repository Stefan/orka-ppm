# Requirements Document: Features Overview Page

## Introduction

The Features Overview page is a structured, hierarchical catalog of PPM-SaaS capabilities. It provides users with a tree-view navigation, AI-powered search, detail cards with screenshots and links, and auto-update via webhook when code changes. The system uses Supabase for persistence, Fuse.js for fuzzy search, and optional AI (OpenAI) for natural-language query suggestions. Import Builder is the example feature (AI auto-mapping, live preview, error-fix suggestions).

## Glossary

- **Features_Overview**: The main page at `/features` showing the feature catalog
- **Feature**: A capability or module (e.g. Financials > Costbook > EAC Calculation)
- **Tree_View**: Hierarchical navigation using parent_id (e.g. react-arborist)
- **Detail_Card**: Card showing description, screenshot thumbnail, link, and "Explain" AI chat button
- **AI_Search**: Fuzzy search (Fuse.js) plus optional AI suggestions (e.g. "Show Import Features" → relevant results)
- **Webhook**: HTTP endpoint `/api/features/update` triggered on Git push to refresh features and screenshots
- **Playwright_Snapshot**: Automated screenshot of a URL (e.g. /financials → Costbook screenshot)
- **Import_Builder**: Example feature—custom templates, mapping, sections, validation; 10x: AI auto-mapping, live preview, error-fix suggestions
- **Admin_Features**: Page at `/admin/features` for Add/Edit/Delete with AI suggestions for descriptions

## Data Model (Supabase)

**Table: feature_catalog** (dedicated table to avoid conflict with existing `features` table, e.g. feedback/feature_flags)

| Column         | Type         | Nullable | Description                    |
|----------------|--------------|----------|--------------------------------|
| id             | uuid         | NO       | Primary key, default gen_random_uuid() |
| name           | text         | NO       | Feature name                   |
| parent_id      | uuid         | YES      | Parent feature (null = root)   |
| description    | text         | YES      | Long description               |
| screenshot_url | text         | YES      | URL of screenshot image       |
| link           | text         | YES      | Deep link to feature (e.g. /financials) |
| icon           | text         | YES      | Lucide icon name or emoji     |
| created_at     | timestamptz  | NO       | default now()                 |
| updated_at     | timestamptz  | NO       | default now()                 |

## Requirements

### Requirement 1: Hierarchical Tree-View

**User Story:** As a user, I want to browse features in a tree (e.g. Financials > Costbook > EAC Calculation) so that I can find capabilities by category.

#### Acceptance Criteria

1. THE Features_Overview SHALL display a tree-view of features using parent_id (e.g. react-arborist or equivalent)
2. THE tree SHALL support expand/collapse of nodes
3. THE tree SHALL show at least: name, icon; optional: badge count for children
4. WHEN a node is selected, THE Detail_Card SHALL show the selected feature
5. THE tree SHALL be responsive: on mobile, THE tree SHALL collapse to an accordion or drawer (Mobile Collapse)

### Requirement 2: Search (Fuse.js + AI Suggestions)

**User Story:** As a user, I want to search features with fuzzy matching and natural-language hints (e.g. "Show Import Features") so that I get relevant results quickly.

#### Acceptance Criteria

1. THE Features_Overview SHALL provide a search bar in the header (AI-powered)
2. THE search SHALL use Fuse.js for fuzzy search over name, description, and optionally link
3. THE system SHALL offer an optional AI search endpoint (e.g. /api/features/search) that accepts natural language and returns relevant feature IDs or query rewrites
4. WHEN the user types "Zeig Import Features" or similar, THE AI SHALL suggest or return results relevant to Import Builder and related features
5. Search results SHALL be displayed in the tree (highlight/open) and/or in the detail area
6. THE search bar SHALL be accessible and visible on all viewport sizes

### Requirement 3: Detail Cards

**User Story:** As a user, I want to see a detail card with description, screenshot, link, and an "Explain" button so that I can understand and navigate to the feature.

#### Acceptance Criteria

1. THE Detail_Card SHALL display: description, screenshot (thumbnail), link to feature, and an AI chat button ("Erkläre" / "Explain")
2. THE screenshot SHALL be displayed as a thumbnail (img src={screenshot_url}); on hover, optional zoom or lightbox
3. THE link SHALL be clickable and navigate to the feature (e.g. /financials, /import)
4. THE "Explain" button SHALL open an AI chat or tooltip that explains the feature in context
5. Cards SHALL use Tailwind: rounded-xl shadow-sm, hover:shadow-md; icons via lucide-react
6. WHEN no feature is selected, THE Detail_Card area SHALL show a placeholder (e.g. "Select a feature")

### Requirement 4: Auto-Update via Webhook + Playwright

**User Story:** As an admin, I want features and screenshots to update automatically when code changes (Git push) so that the catalog stays current.

#### Acceptance Criteria

1. THE system SHALL expose a webhook endpoint POST /api/features/update (or backend equivalent) that can be called on Git push (e.g. GitHub webhook)
2. WHEN the webhook is triggered, THE system SHALL optionally run an AI scan (e.g. Grok or script) over code/diff to infer new or changed features and update the features table
3. THE system SHALL support Playwright-based snapshot: given a list of URLs (e.g. /financials, /import), capture a screenshot and store URL (e.g. Supabase storage or screenshot_url)
4. THE webhook handler SHALL be idempotent and safe to call repeatedly
5. Screenshots SHALL be stored with a stable naming scheme (e.g. by route or feature id)

### Requirement 5: Admin Edit Page

**User Story:** As an admin, I want to add, edit, and delete features at /admin/features with optional AI suggestions for descriptions so that the catalog is maintainable.

#### Acceptance Criteria

1. THE Admin_Features page SHALL live at /admin/features
2. THE page SHALL allow: Add feature, Edit feature (name, parent_id, description, screenshot_url, link, icon), Delete feature
3. THE page SHALL support AI suggestions for the description field (e.g. call to OpenAI or internal API to generate or improve description from name/link)
4. THE list SHALL be manageable in a table or tree form; parent_id SHALL be selectable (dropdown or tree)
5. THE Admin_Features page SHALL be protected (e.g. admin-only route or role check)

### Requirement 6: Import Builder as Example Feature

**User Story:** As a product owner, I want Import Builder documented as an example feature with industry-standard wording (no proprietary terminology) so that the catalog is clear and compliant.

#### Acceptance Criteria

1. THE feature_catalog table SHALL be seeded with at least one example hierarchy including "Import Builder" (or equivalent)
2. Import Builder SHALL be described with: custom templates, mapping, sections, validation; 10x: AI auto-mapping, live preview, error-fix suggestions
3. Terminology SHALL avoid proprietary product names; use "Import Builder", "AI auto-mapping", "live preview", "error-fix suggestions"
4. THE seed SHALL create a small tree (e.g. Financials > Costbook, Data > Import Builder) for demonstration

### Requirement 7: Layout and Responsiveness

**User Story:** As a user, I want a no-scroll layout on desktop and a collapsible layout on mobile so that the page works on all devices.

#### Acceptance Criteria

1. THE Features_Overview page SHALL use a no-scroll layout: h-screen grid-rows-[auto_1fr]; Row 1: header with search bar; Row 2: split-view (left: tree, right: detail card)
2. ON mobile, THE tree SHALL collapse (e.g. drawer or accordion); the detail area SHALL remain visible when a feature is selected
3. THE page SHALL be testable with React Suspense for lazy-loaded components
4. All UI SHALL use Tailwind CSS and lucide-react icons

## Out of Scope (Phase 1)

- Full AI model training or custom embeddings for features
- Real-time collaborative editing of the feature catalog
- Version history or audit log for feature changes (can be added later)
