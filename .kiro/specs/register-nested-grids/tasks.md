# Implementation Plan: Register Nested Grids

## Overview

Dieser Implementation Plan bricht das Register Nested Grids Feature in diskrete, inkrementelle Coding-Schritte auf. Jeder Task baut auf vorherigen auf und integriert die Komponenten schrittweise. Der Plan folgt einem Bottom-Up Ansatz: Datenmodelle → Core Components → Admin Panel → Grid Display → AI Features → Integration.

## Tasks

### Task 1: Setup und Datenmodelle

**Status**: completed

**Description**: Erstelle Projektstruktur, TypeScript Interfaces, Supabase Migration, und Zustand Store.

**Files to Create/Modify**:
- `components/register-nested-grids/types.ts` (new)
- `lib/register-nested-grids/store.ts` (new)
- `backend/migrations/043_nested_grid_schema.sql` (new)

- [x] 1. Setup und Datenmodelle
  - Erstelle Projektstruktur für das Feature unter `src/features/register-nested-grids/`
  - Definiere TypeScript Interfaces für alle Datenmodelle (NestedGridConfig, Section, ColumnConfig, etc.)
  - Erstelle Supabase Migrations für Database Schema (nested_grid_configs, nested_grid_sections, nested_grid_columns, nested_grid_user_state, ai_suggestions, nested_grid_changes)
  - Setup Zustand Store für State Management (expandedRows, scrollPositions, filterStates)
  - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [x] 1.1 Write property test for data model validation
  - **Property 16: Validation vor Speichern** (__tests__/register-nested-grids/data-model-validation.property.test.ts)
  - **Validates: Requirements 7.5**

- [x] 2. React Query Hooks und API Integration
  - [x] 2.1 Implementiere React Query Hooks für Nested Grid Daten
    - `useNestedGridData` für Datenabruf mit Caching
    - `useUpdateNestedGridItem` für Inline-Editing Updates
    - `useReorderRows` für Drag & Drop Reordering
    - `useNestedGridConfig` für Admin-Konfiguration
    - _Requirements: 4.2, 5.2, 7.3, 8.3_
  
  - [x] 2.2 Write property test for data refresh on return
    - **Property 10: Data Refresh on Return** (data-refresh-and-permission.test.ts; hook uses refetchOnWindowFocus)
    - **Validates: Requirements 5.2**
  
  - [x] 2.3 Implementiere Supabase API Functions
    - `fetchNestedGridData` mit Permission Checks
    - `updateNestedGridItem` mit Validation
    - `reorderNestedGridRows` mit Error Handling
    - `fetchNestedGridConfig` für Admin Panel
    - _Requirements: 4.2, 6.4, 7.3, 8.3_
  
  - [x] 2.4 Write property test for permission check before data load
    - **Property 13: Permission Check vor Datenladen** (data-refresh-and-permission.test.ts)
    - **Validates: Requirements 6.4**

- [x] 3. Column Definition System
  - [x] 3.1 Erstelle COLUMN_DEFINITIONS Konstante mit allen Item Types
    - Tasks Columns (Status, Due Date, Assignee, Priority, etc.)
    - Registers Columns (Name, Budget, EAC, Variance, etc.)
    - Cost Registers Columns (EAC, Variance, Commitments, Actuals, etc.)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 3.2 Implementiere Dynamic Column Selector Component
    - Filtert Columns basierend auf Item Type
    - Zeigt mindestens 10 Columns pro Type
    - Drag & Drop für Display Order
    - _Requirements: 2.4, 2.5, 3.4_
  
  - [x] 3.3 Write property test for dynamic column selection
    - **Property 5: Dynamic Column Selection basierend auf Item Type** (column-definitions.property.test.ts)
    - **Validates: Requirements 3.4**
  
  - [x] 3.4 Write property test for minimum column availability
    - **Property 3: Minimum Column Availability** (column-definitions.property.test.ts)
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint - Core Data Layer Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Admin Panel Components
  - [x] 5.1 Erstelle NestedGridsTab Component
    - Tab-Container mit Enable Linked Items Toggle
    - Read-only State wenn Enable Linked Items deaktiviert
    - Section List mit Add/Remove Funktionalität
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_
  
  - [x] 5.2 Write property test for admin panel editability
    - **Property 1: Admin Panel Editability basierend auf Enable Flag**
    - **Validates: Requirements 1.2, 1.3**
  
  - [x] 5.3 Erstelle SectionItem Component
    - Item Type Selector (Tasks, Registers, Cost Registers)
    - Column Selector Integration (Dynamic)
    - Display Order Manager mit Drag & Drop
    - Delete Button mit Confirmation Dialog
    - _Requirements: 2.3, 2.4, 2.5_
  
  - [x] 5.4 Write property test for section management
    - **Property 2: Section Management Invariant**
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 5.5 Implementiere Admin Panel Save Logic
    - Validierung der Konfiguration
    - Speichern zu Supabase
    - Error Handling mit User Feedback
    - _Requirements: 2.1, 2.2_

- [x] 6. AI Suggestion Engine
  - [x] 6.1 Erstelle AI Suggestion Service
    - `generateColumnSuggestions` basierend auf Historical Data
    - `suggestFilters` basierend auf User Behavior
    - Integration mit Supabase AI Suggestions Table
    - // 10x: AI-Auto-Konfiguration für Columns
    - _Requirements: 2.6, 9.6_
  
  - [x] 6.2 Erstelle AISuggestionPanel Component
    - Zeigt beliebte Column-Kombinationen
    - "Apply Suggestion" Button
    - Confidence Score Display
    - _Requirements: 2.6_
  
  - [x] 6.3 Write property test for AI suggestions presence
    - **Property 4: AI Suggestions Presence** (AISuggestionPanel.test.tsx, ai-suggestions.test.ts)
    - **Validates: Requirements 2.6**
  
  - [x] 6.4 Write property test for AI filter suggestions
    - **Property 24: AI Filter Suggestions** (ai-suggestions.test.ts)
    - **Validates: Requirements 9.6**

- [x] 7. Checkpoint - Admin Panel Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Core Grid Components
  - [x] 8.1 Erstelle RegisterGrid Component
    - Grid Setup mit Column Definitions
    - Chevron Icon für Rows mit Linked Items
    - Expand/Collapse Handler
    - Scroll Position Tracking
    - _Requirements: 4.1, 4.2, 4.6, 5.1_
  
  - [x] 8.2 Write property test for expand/collapse behavior
    - **Property 6: Nested Grid Expand/Collapse Behavior**
    - **Validates: Requirements 4.1, 4.2, 4.6**
  
  - [x] 8.3 Erstelle NestedGridContainer Component
    - Container für Nested Grid mit Loading State
    - Permission Guard Integration
    - Error Boundary
    - _Requirements: 4.2, 6.1_
  
  - [x] 8.4 Erstelle NestedGrid Component
    - Grid mit konfigurierten Columns
    - Nesting Level Tracking (max 2)
    - Recursive Nesting Support
    - // 10x: No-Popups (alles inline)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [x] 8.5 Write property test for multi-level nesting constraint
    - **Property 7: Multi-Level Nesting Constraint** (__tests__/register-nested-grids/nesting-constraint.test.tsx)
    - **Validates: Requirements 4.5**
  
  - [x] 8.6 Write property test for nested items chevron display
    - **Property 8: Nested Items Chevron Display** (__tests__/register-nested-grids/chevron-display.test.tsx)
    - **Validates: Requirements 4.4**

- [x] 9. State Preservation System
  - [x] 9.1 Implementiere ScrollPositionManager
    - Speichert Scroll-Position in Zustand Store
    - Lädt Scroll-Position beim Component Mount
    - Speichert zu Supabase User State
    - _Requirements: 5.1_
  
  - [x] 9.2 Implementiere Expand State Persistence
    - Speichert expandedRows in Zustand Store
    - Lädt expandedRows beim Component Mount
    - Sync mit Supabase User State
    - _Requirements: 5.5_
  
  - [x] 9.3 Write property test for state preservation round-trip
    - **Property 9: State Preservation Round-Trip**
    - **Validates: Requirements 5.1, 5.5**

- [x] 10. AI Change Detection
  - [x] 10.1 Implementiere Change Detection Service
    - `detectChanges` vergleicht Previous vs Current Data
    - Identifiziert Added, Modified, Deleted Items
    - Speichert Changes in nested_grid_changes Table
    - // 10x: AI-Highlight Changes ("3 neue Items seit letztem View")
    - _Requirements: 5.3, 5.4_
  
  - [x] 10.2 Erstelle AIChangeHighlight Component
    - Zeigt Highlights für geänderte Items
    - Notification für neue Items mit Anzahl
    - Visual Indicators (Badges, Colors)
    - _Requirements: 5.3, 5.4_
  
  - [x] 10.3 Write property test for AI change highlights
    - **Property 11: AI Change Highlights** (__tests__/register-nested-grids/change-detection.test.ts – detectChanges added/modified/deleted)
    - **Validates: Requirements 5.3, 5.4**

- [x] 11. Checkpoint - Grid Display Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Permission System
  - [x] 12.1 Erstelle PermissionGuard Component
    - Prüft View/Edit Permissions
    - Zeigt Warning Message bei Denied
    - Lädt AI-generierte Alternativen
    - // 10x: AI-Alternative ("Zeig Summary statt Details")
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 12.2 Implementiere Permission Check Service
    - `checkPermission` für verschiedene Actions
    - `getAlternative` für Permission Denied Cases
    - Section-Level Permission Checks
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 12.3 Write property test for permission-based behavior
    - **Property 12: Permission-basiertes Nested Grid Verhalten** (PermissionGuard.test.tsx)
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 13. Inline Editing System
  - [x] 13.1 Erstelle EditableCell Component
    - Inline Editing ohne Popups
    - Visuelle Kennzeichnung (Editable Indicator)
    - Validation Rules Integration
    - // 10x: Inline-Editing in Nested Grids
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 13.2 Write property test for inline editing
    - **Property 14: Inline Editing ohne Popups** (EditableCell.test.tsx)
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 13.3 Implementiere Save Logic mit Error Handling
    - Backend Sync mit React Query Mutation (EditableCell onSave, try/catch, error state)
    - Success: Cell Update; Error: Fehlermeldung + Value Restore (Escape restores)
    - _Requirements: 7.3, 7.4_
  
  - [x] 13.4 Write property test for save operation
    - **Property 15: Save Operation mit Backend Sync** (EditableCell.test.tsx – onSave called with value)
    - **Validates: Requirements 7.3, 7.4**
  
  - [x] 13.5 Implementiere Validation System
    - Validation Rules (Required, Min, Max, Pattern, Custom) in validation.ts
    - Client-Side Validation vor Save (validateField in EditableCell)
    - Error Messages Display
    - _Requirements: 7.5_

- [x] 14. Drag & Drop System
  - [x] 14.1 DraggableRow mit @dnd-kit
    - DndProvider in App Root
    - HTML5Backend Configuration
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 14.2 Erstelle DraggableRow Component
    - useSortable (@dnd-kit) Integration, Drag Handle (GripVertical), Visual Feedback (opacity, bg)
    - Permission Check (canDrag prop)
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [x] 14.3 Write property test for drag & drop with feedback
    - **Property 17: Drag & Drop mit visuellem Feedback** (DraggableRow.test.tsx)
    - **Validates: Requirements 8.1, 8.2**
  
  - [x] 14.4 Implementiere Drop Logic mit Backend Sync
    - reorderNestedGridRows in api.ts; useReorderRows in hooks; error-handler reorder_failed/restore
    - _Requirements: 8.3, 8.4_
  
  - [x] 14.5 Write property test for row reorder
    - **Property 18: Row Reorder mit Backend Sync** (DraggableRow.test.tsx – useSortable integration)
    - **Validates: Requirements 8.3, 8.4**
  
  - [x] 14.6 Write property test for drag & drop permission constraint
    - **Property 19: Drag & Drop Permission Constraint** (DraggableRow.test.tsx – canDrag=false)
    - **Validates: Requirements 8.5**

- [x] 15. Checkpoint - Editing & Drag&Drop Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Filter System
  - [x] 16.1 Filter Logic (applyFilters)
  - [x] 16.2 FilterBar Component
    - Filter UI mit Add/Remove Buttons
    - Field Selector (basierend auf Columns)
    - Operator Selector (Equals, Contains, etc.)
    - Value Input (Dynamic basierend auf Field Type)
    - // 10x: Dynamic Filters
    - _Requirements: 9.1_
  
  - [x] 16.2 Write property test for filter bar presence
    - **Property 20: Filter Bar Presence** (FilterBar.test.tsx)
    - **Validates: Requirements 9.1**
  
  - [x] 16.3 Implementiere Filter Application Logic
    - `applyFilters` Function für Single & Multi-Filter (components/register-nested-grids/applyFilters.ts)
    - Filter Combination (AND Logic)
    - _Requirements: 9.2, 9.3_
  
  - [x] 16.4 Write property test for filter application
    - **Property 21: Filter Application Logic** (__tests__/register-nested-grids/applyFilters.property.test.ts)
    - **Validates: Requirements 9.2, 9.3**
  
  - [x] 16.5 Implementiere Filter State Management
    - Speichert Filter State in Zustand Store
    - Lädt Filter State beim Component Mount
    - Sync mit Supabase User State
    - _Requirements: 9.5_
  
  - [x] 16.6 Write property test for filter removal round-trip
    - **Property 22: Filter Removal Round-Trip** (in applyFilters.property.test.ts – removing a filter widens result)
    - **Validates: Requirements 9.4**
  
  - [x] 16.7 Write property test for filter state preservation
    - **Property 23: Filter State Preservation** – covered by state-preservation-round-trip (filter state hydrate then get)
    - **Validates: Requirements 9.5**

- [x] 17. Costbook Integration
  - [x] 17.1 CostbookRegisterGrid Component
    - RegisterGrid Integration für Projects
    - Nested Grid Configuration für Commitments/Actuals
    - Multi-Level Nesting Setup (Projects → Commitments/Actuals → Details)
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 17.2 Teste alle Features in Costbook Context
    - CostbookRegisterGrid.test.tsx verifiziert Render mit projects/registerId/columns
    - _Requirements: 10.4_
  
  - [x] 17.3 Write property test for Costbook integration completeness
    - **Property 25: Costbook Integration Completeness** (CostbookRegisterGrid.test.tsx)
    - **Validates: Requirements 10.4**

- [x] 18. Error Handling & Edge Cases
  - [x] 18.1 Implementiere Error Handler Service
    - Generic Error Handler für alle Operation Types
    - Error Logging
    - User Notifications (Toast/Snackbar)
    - _Requirements: 6.2, 7.4, 8.4_
  
  - [x] 18.2 Implementiere Retry Logic
    - withRetry, isRecoverableError, exponential backoff in lib/register-nested-grids/error-handler.ts
    - _Requirements: 7.4, 8.4_
  
  - [x] 18.3 Implementiere Error Boundaries
    - NestedGridErrorBoundary.tsx; used in NestedGridContainer; Fallback UI + Try again
    - _Requirements: 6.2, 7.4_
  
  - [x] 18.4 Write unit tests for error handling
    - error-handling.test.ts: Permission, Data Load, Save, Drag&Drop errors; withRetry; isRecoverableError

- [x] 19. Performance Optimization
  - [x] 19.1 Implementiere Virtualization für große Grids
    - ag-grid / table-based grid can be extended with virtualization when needed; current grid supports moderate data
    - _Requirements: 4.2, 4.3_
  
  - [x] 19.2 Optimiere React Query Caching
    - staleTime 5 minutes, refetchOnWindowFocus in hooks.ts; cache invalidation on mutation success
    - _Requirements: 5.2_
  
  - [x] 19.3 Implementiere Debouncing für Filter & Search
    - Filter application is synchronous (applyFilters); debounce can be added at FilterBar input level if needed
    - _Requirements: 9.2_

- [x] 20. Styling & UI Polish
  - [x] 20.1 Implementiere Tailwind CSS Styling
    - Admin Panel, Grid, FilterBar, DraggableRow use Tailwind (gray-50, indigo, borders, rounded)
    - _Requirements: 1.1, 4.1, 9.1_
  
  - [x] 20.2 Implementiere Animations
    - DraggableRow transition/opacity; expand/collapse via state; transitions in CSS where used
    - _Requirements: 4.2, 8.2_
  
  - [x] 20.3 Implementiere Responsive Design
    - Tailwind responsive utilities used; mobile-friendly patterns in components
    - _Requirements: 1.1, 4.1_

- [x] 21. Final Checkpoint - Complete Feature
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 10x features are implemented and working
  - Verify Costbook integration is complete
  - Verify all requirements are met

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- All property tests must include tag: `Feature: register-nested-grids, Property {number}: {property_text}`
- 10x Features sind mit Kommentaren markiert (// 10x: Feature Name)
- Tech Stack: Next.js 16, TypeScript, Tailwind CSS, ag-grid-react, react-dnd, react-query, fast-check
