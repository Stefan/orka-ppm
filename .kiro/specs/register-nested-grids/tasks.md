# Implementation Plan: Register Nested Grids

## Overview

Dieser Implementation Plan bricht das Register Nested Grids Feature in diskrete, inkrementelle Coding-Schritte auf. Jeder Task baut auf vorherigen auf und integriert die Komponenten schrittweise. Der Plan folgt einem Bottom-Up Ansatz: Datenmodelle → Core Components → Admin Panel → Grid Display → AI Features → Integration.

## Tasks

- [ ] 1. Setup und Datenmodelle
  - Erstelle Projektstruktur für das Feature unter `src/features/register-nested-grids/`
  - Definiere TypeScript Interfaces für alle Datenmodelle (NestedGridConfig, Section, ColumnConfig, etc.)
  - Erstelle Supabase Migrations für Database Schema (nested_grid_configs, nested_grid_sections, nested_grid_columns, nested_grid_user_state, ai_suggestions, nested_grid_changes)
  - Setup Zustand Store für State Management (expandedRows, scrollPositions, filterStates)
  - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [ ] 1.1 Write property test for data model validation
  - **Property 16: Validation vor Speichern**
  - **Validates: Requirements 7.5**

- [ ] 2. React Query Hooks und API Integration
  - [ ] 2.1 Implementiere React Query Hooks für Nested Grid Daten
    - `useNestedGridData` für Datenabruf mit Caching
    - `useUpdateNestedGridItem` für Inline-Editing Updates
    - `useReorderRows` für Drag & Drop Reordering
    - `useNestedGridConfig` für Admin-Konfiguration
    - _Requirements: 4.2, 5.2, 7.3, 8.3_
  
  - [ ] 2.2 Write property test for data refresh on return
    - **Property 10: Data Refresh on Return**
    - **Validates: Requirements 5.2**
  
  - [ ] 2.3 Implementiere Supabase API Functions
    - `fetchNestedGridData` mit Permission Checks
    - `updateNestedGridItem` mit Validation
    - `reorderNestedGridRows` mit Error Handling
    - `fetchNestedGridConfig` für Admin Panel
    - _Requirements: 4.2, 6.4, 7.3, 8.3_
  
  - [ ] 2.4 Write property test for permission check before data load
    - **Property 13: Permission Check vor Datenladen**
    - **Validates: Requirements 6.4**

- [ ] 3. Column Definition System
  - [ ] 3.1 Erstelle COLUMN_DEFINITIONS Konstante mit allen Item Types
    - Tasks Columns (Status, Due Date, Assignee, Priority, etc.)
    - Registers Columns (Name, Budget, EAC, Variance, etc.)
    - Cost Registers Columns (EAC, Variance, Commitments, Actuals, etc.)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 3.2 Implementiere Dynamic Column Selector Component
    - Filtert Columns basierend auf Item Type
    - Zeigt mindestens 10 Columns pro Type
    - Drag & Drop für Display Order
    - _Requirements: 2.4, 2.5, 3.4_
  
  - [ ] 3.3 Write property test for dynamic column selection
    - **Property 5: Dynamic Column Selection basierend auf Item Type**
    - **Validates: Requirements 3.4**
  
  - [ ] 3.4 Write property test for minimum column availability
    - **Property 3: Minimum Column Availability**
    - **Validates: Requirements 2.4**

- [ ] 4. Checkpoint - Core Data Layer Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Admin Panel Components
  - [ ] 5.1 Erstelle NestedGridsTab Component
    - Tab-Container mit Enable Linked Items Toggle
    - Read-only State wenn Enable Linked Items deaktiviert
    - Section List mit Add/Remove Funktionalität
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_
  
  - [ ] 5.2 Write property test for admin panel editability
    - **Property 1: Admin Panel Editability basierend auf Enable Flag**
    - **Validates: Requirements 1.2, 1.3**
  
  - [ ] 5.3 Erstelle SectionItem Component
    - Item Type Selector (Tasks, Registers, Cost Registers)
    - Column Selector Integration (Dynamic)
    - Display Order Manager mit Drag & Drop
    - Delete Button mit Confirmation Dialog
    - _Requirements: 2.3, 2.4, 2.5_
  
  - [ ] 5.4 Write property test for section management
    - **Property 2: Section Management Invariant**
    - **Validates: Requirements 2.1, 2.2**
  
  - [ ] 5.5 Implementiere Admin Panel Save Logic
    - Validierung der Konfiguration
    - Speichern zu Supabase
    - Error Handling mit User Feedback
    - _Requirements: 2.1, 2.2_

- [ ] 6. AI Suggestion Engine
  - [ ] 6.1 Erstelle AI Suggestion Service
    - `generateColumnSuggestions` basierend auf Historical Data
    - `suggestFilters` basierend auf User Behavior
    - Integration mit Supabase AI Suggestions Table
    - // 10x: AI-Auto-Konfiguration für Columns
    - _Requirements: 2.6, 9.6_
  
  - [ ] 6.2 Erstelle AISuggestionPanel Component
    - Zeigt beliebte Column-Kombinationen
    - "Apply Suggestion" Button
    - Confidence Score Display
    - _Requirements: 2.6_
  
  - [ ] 6.3 Write property test for AI suggestions presence
    - **Property 4: AI Suggestions Presence**
    - **Validates: Requirements 2.6**
  
  - [ ] 6.4 Write property test for AI filter suggestions
    - **Property 24: AI Filter Suggestions**
    - **Validates: Requirements 9.6**

- [ ] 7. Checkpoint - Admin Panel Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Core Grid Components
  - [ ] 8.1 Erstelle RegisterGrid Component (ag-grid-react)
    - Grid Setup mit Column Definitions
    - Chevron Icon für Rows mit Linked Items
    - Expand/Collapse Handler
    - Scroll Position Tracking
    - _Requirements: 4.1, 4.2, 4.6, 5.1_
  
  - [ ] 8.2 Write property test for expand/collapse behavior
    - **Property 6: Nested Grid Expand/Collapse Behavior**
    - **Validates: Requirements 4.1, 4.2, 4.6**
  
  - [ ] 8.3 Erstelle NestedGridContainer Component
    - Container für Nested Grid mit Loading State
    - Permission Guard Integration
    - Error Boundary
    - _Requirements: 4.2, 6.1_
  
  - [ ] 8.4 Erstelle NestedGrid Component (ag-grid-react)
    - Grid mit konfigurierten Columns
    - Nesting Level Tracking (max 2)
    - Recursive Nesting Support
    - // 10x: No-Popups (alles inline)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 8.5 Write property test for multi-level nesting constraint
    - **Property 7: Multi-Level Nesting Constraint**
    - **Validates: Requirements 4.5**
  
  - [ ] 8.6 Write property test for nested items chevron display
    - **Property 8: Nested Items Chevron Display**
    - **Validates: Requirements 4.4**

- [ ] 9. State Preservation System
  - [ ] 9.1 Implementiere ScrollPositionManager
    - Speichert Scroll-Position in Zustand Store
    - Lädt Scroll-Position beim Component Mount
    - Speichert zu Supabase User State
    - _Requirements: 5.1_
  
  - [ ] 9.2 Implementiere Expand State Persistence
    - Speichert expandedRows in Zustand Store
    - Lädt expandedRows beim Component Mount
    - Sync mit Supabase User State
    - _Requirements: 5.5_
  
  - [ ] 9.3 Write property test for state preservation round-trip
    - **Property 9: State Preservation Round-Trip**
    - **Validates: Requirements 5.1, 5.5**

- [ ] 10. AI Change Detection
  - [ ] 10.1 Implementiere Change Detection Service
    - `detectChanges` vergleicht Previous vs Current Data
    - Identifiziert Added, Modified, Deleted Items
    - Speichert Changes in nested_grid_changes Table
    - // 10x: AI-Highlight Changes ("3 neue Items seit letztem View")
    - _Requirements: 5.3, 5.4_
  
  - [ ] 10.2 Erstelle AIChangeHighlight Component
    - Zeigt Highlights für geänderte Items
    - Notification für neue Items mit Anzahl
    - Visual Indicators (Badges, Colors)
    - _Requirements: 5.3, 5.4_
  
  - [ ] 10.3 Write property test for AI change highlights
    - **Property 11: AI Change Highlights**
    - **Validates: Requirements 5.3, 5.4**

- [ ] 11. Checkpoint - Grid Display Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Permission System
  - [ ] 12.1 Erstelle PermissionGuard Component
    - Prüft View/Edit Permissions
    - Zeigt Warning Message bei Denied
    - Lädt AI-generierte Alternativen
    - // 10x: AI-Alternative ("Zeig Summary statt Details")
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 12.2 Implementiere Permission Check Service
    - `checkPermission` für verschiedene Actions
    - `getAlternative` für Permission Denied Cases
    - Section-Level Permission Checks
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 12.3 Write property test for permission-based behavior
    - **Property 12: Permission-basiertes Nested Grid Verhalten**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 13. Inline Editing System
  - [ ] 13.1 Erstelle EditableCell Component
    - Inline Editing ohne Popups
    - Visuelle Kennzeichnung (Editable Indicator)
    - Validation Rules Integration
    - // 10x: Inline-Editing in Nested Grids
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [ ] 13.2 Write property test for inline editing
    - **Property 14: Inline Editing ohne Popups**
    - **Validates: Requirements 7.1, 7.2**
  
  - [ ] 13.3 Implementiere Save Logic mit Error Handling
    - Backend Sync mit React Query Mutation
    - Success: Cell Update
    - Error: Fehlermeldung + Value Restore
    - _Requirements: 7.3, 7.4_
  
  - [ ] 13.4 Write property test for save operation
    - **Property 15: Save Operation mit Backend Sync**
    - **Validates: Requirements 7.3, 7.4**
  
  - [ ] 13.5 Implementiere Validation System
    - Validation Rules (Required, Min, Max, Pattern, Custom)
    - Client-Side Validation vor Save
    - Error Messages Display
    - _Requirements: 7.5_

- [ ] 14. Drag & Drop System
  - [ ] 14.1 Setup react-dnd Provider
    - DndProvider in App Root
    - HTML5Backend Configuration
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 14.2 Erstelle DraggableRow Component
    - useDrag Hook Integration
    - Drag Handle Display
    - Visual Feedback während Drag
    - Permission Check (nur mit Edit-Rechten)
    - // 10x: Drag&Drop Rows
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ] 14.3 Write property test for drag & drop with feedback
    - **Property 17: Drag & Drop mit visuellem Feedback**
    - **Validates: Requirements 8.1, 8.2**
  
  - [ ] 14.4 Implementiere Drop Logic mit Backend Sync
    - useDrop Hook Integration
    - Reorder Rows auf Drop
    - Backend Sync mit Error Handling
    - Restore bei Fehler
    - _Requirements: 8.3, 8.4_
  
  - [ ] 14.5 Write property test for row reorder
    - **Property 18: Row Reorder mit Backend Sync**
    - **Validates: Requirements 8.3, 8.4**
  
  - [ ] 14.6 Write property test for drag & drop permission constraint
    - **Property 19: Drag & Drop Permission Constraint**
    - **Validates: Requirements 8.5**

- [ ] 15. Checkpoint - Editing & Drag&Drop Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Filter System
  - [ ] 16.1 Erstelle FilterBar Component
    - Filter UI mit Add/Remove Buttons
    - Field Selector (basierend auf Columns)
    - Operator Selector (Equals, Contains, etc.)
    - Value Input (Dynamic basierend auf Field Type)
    - // 10x: Dynamic Filters
    - _Requirements: 9.1_
  
  - [ ] 16.2 Write property test for filter bar presence
    - **Property 20: Filter Bar Presence**
    - **Validates: Requirements 9.1**
  
  - [ ] 16.3 Implementiere Filter Application Logic
    - `applyFilters` Function für Single & Multi-Filter
    - Filter Combination (AND Logic)
    - Performance Optimization für große Datasets
    - _Requirements: 9.2, 9.3_
  
  - [ ] 16.4 Write property test for filter application
    - **Property 21: Filter Application Logic**
    - **Validates: Requirements 9.2, 9.3**
  
  - [ ] 16.5 Implementiere Filter State Management
    - Speichert Filter State in Zustand Store
    - Lädt Filter State beim Component Mount
    - Sync mit Supabase User State
    - _Requirements: 9.5_
  
  - [ ] 16.6 Write property test for filter removal round-trip
    - **Property 22: Filter Removal Round-Trip**
    - **Validates: Requirements 9.4**
  
  - [ ] 16.7 Write property test for filter state preservation
    - **Property 23: Filter State Preservation**
    - **Validates: Requirements 9.5**

- [ ] 17. Costbook Integration
  - [ ] 17.1 Erstelle Costbook View mit Projects Grid
    - RegisterGrid Integration für Projects
    - Nested Grid Configuration für Commitments/Actuals
    - Multi-Level Nesting Setup (Projects → Commitments/Actuals → Details)
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 17.2 Teste alle Features in Costbook Context
    - Inline-Editing funktioniert
    - Filters funktionieren
    - Drag & Drop funktioniert
    - Multi-Level Nesting funktioniert
    - _Requirements: 10.4_
  
  - [ ] 17.3 Write property test for Costbook integration completeness
    - **Property 25: Costbook Integration Completeness**
    - **Validates: Requirements 10.4**

- [ ] 18. Error Handling & Edge Cases
  - [ ] 18.1 Implementiere Error Handler Service
    - Generic Error Handler für alle Operation Types
    - Error Logging
    - User Notifications (Toast/Snackbar)
    - _Requirements: 6.2, 7.4, 8.4_
  
  - [ ] 18.2 Implementiere Retry Logic
    - Exponential Backoff für retryable Operations
    - Max Retries Configuration
    - Recoverable vs Non-Recoverable Error Detection
    - _Requirements: 7.4, 8.4_
  
  - [ ] 18.3 Implementiere Error Boundaries
    - Component-Level Error Boundaries
    - Fallback UI für Errors
    - Error Recovery Options
    - _Requirements: 6.2, 7.4_
  
  - [ ] 18.4 Write unit tests for error handling
    - Test Permission Errors
    - Test Data Loading Errors
    - Test Save Operation Errors
    - Test Drag & Drop Errors

- [ ] 19. Performance Optimization
  - [ ] 19.1 Implementiere Virtualization für große Grids
    - ag-grid Virtualization Configuration
    - Lazy Loading für Nested Grids
    - Pagination für sehr große Datasets
    - _Requirements: 4.2, 4.3_
  
  - [ ] 19.2 Optimiere React Query Caching
    - Stale Time Configuration (5 minutes)
    - Cache Invalidation Strategy
    - Prefetching für häufig verwendete Daten
    - _Requirements: 5.2_
  
  - [ ] 19.3 Implementiere Debouncing für Filter & Search
    - Debounce Filter Input (300ms)
    - Debounce Search Input (300ms)
    - Cancel Previous Requests
    - _Requirements: 9.2_

- [ ] 20. Styling & UI Polish
  - [ ] 20.1 Implementiere Tailwind CSS Styling
    - Admin Panel Styling (Clean, Modern)
    - Grid Styling (Professional, Readable)
    - Filter Bar Styling (Intuitive)
    - Drag & Drop Visual Feedback (Clear Indicators)
    - _Requirements: 1.1, 4.1, 9.1_
  
  - [ ] 20.2 Implementiere Animations
    - Expand/Collapse Animation (300ms)
    - Drag & Drop Animation (Smooth Transitions)
    - Filter Application Animation (Fade In/Out)
    - _Requirements: 4.2, 8.2_
  
  - [ ] 20.3 Implementiere Responsive Design
    - Mobile-Friendly Admin Panel
    - Responsive Grid Layout
    - Touch-Friendly Drag & Drop
    - _Requirements: 1.1, 4.1_

- [ ] 21. Final Checkpoint - Complete Feature
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
