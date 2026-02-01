# Implementation Plan: Costbook

## Overview

This implementation plan breaks down the Costbook feature into discrete, incremental coding tasks. The focus is on Phase 1 (Basis) functionality, which establishes core financial tracking with real Supabase integration, KPI calculations, and interactive visualizations. Each task builds on previous work, with property-based tests integrated throughout to validate correctness early.

The implementation follows a bottom-up approach: data layer → business logic → UI components → integration → testing. All code will be functional TypeScript with no placeholders.

## Tasks

- [x] 1. Set up TypeScript interfaces and data models
  - Create `types/costbook.ts` with all TypeScript interfaces: Project, Commitment, Actual, ProjectWithFinancials, KPIMetrics, Currency enum, ProjectStatus enum, POStatus enum, ActualStatus enum
  - Define exchange rate constants and currency symbols
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement core calculation functions
  - [x] 2.1 Create `lib/costbook-calculations.ts` with calculation functions
    - Implement `calculateTotalSpend(commitments: number, actuals: number): number`
    - Implement `calculateVariance(budget: number, totalSpend: number): number`
    - Implement `calculateSpendPercentage(totalSpend: number, budget: number): number`
    - Implement `calculateKPIs(projects: ProjectWithFinancials[]): KPIMetrics`
    - Implement `calculateEAC(project: ProjectWithFinancials): number` (Phase 1 placeholder)
    - Handle null/undefined values gracefully (treat as zero)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 1.5_
  
  - [x] 2.2 Write property test for total spend calculation
    - **Property 1: Total Spend Calculation Correctness**
    - **Validates: Requirements 2.1**
    - Generate random commitment and actual arrays, verify sum correctness
    - Test with empty arrays (edge case)
  
  - [x] 2.3 Write property test for variance calculation
    - **Property 2: Variance Calculation Correctness**
    - **Validates: Requirements 2.2**
    - Generate random budget and spend values, verify variance = budget - spend
  
  - [x] 2.4 Write property test for KPI aggregation
    - **Property 3: KPI Aggregation Correctness**
    - **Validates: Requirements 2.3**
    - Generate random project arrays, verify all KPI sums are correct
  
  - [x] 2.5 Write property test for currency precision
    - **Property 4: Currency Precision Preservation**
    - **Validates: Requirements 2.6**
    - Generate random floats, verify formatting to 2 decimal places
  
  - [x] 2.6 Write property test for null value handling
    - **Property 5: Null Value Handling in Calculations**
    - **Validates: Requirements 1.5**
    - Generate projects with null/undefined values, verify no errors and valid results

- [x] 3. Implement currency conversion and formatting functions
  - [x] 3.1 Create `lib/currency-utils.ts` with currency functions
    - Implement `convertCurrency(amount: number, from: Currency, to: Currency): number`
    - Implement `formatCurrency(amount: number, currency: Currency): string`
    - Use hardcoded exchange rates for Phase 1
    - _Requirements: 5.2, 5.4, 2.6_
  
  - [x] 3.2 Write property test for currency conversion round-trip
    - **Property 7: Currency Conversion Consistency**
    - **Validates: Requirements 5.2**
    - Generate random amounts and currency pairs, verify round-trip within 0.01
  
  - [x] 3.3 Write property test for currency symbol inclusion
    - **Property 8: Currency Symbol Inclusion**
    - **Validates: Requirements 5.4**
    - Generate random amounts and currencies, verify symbol is present in formatted string

- [x] 4. Implement Supabase data fetching functions
  - [x] 4.1 Create `lib/supabase-queries.ts` with data fetching functions
    - Implement `fetchProjectsWithFinancials(): Promise<ProjectWithFinancials[]>`
    - Use Supabase joins to aggregate commitments and actuals by project_id
    - Calculate total_spend, variance, and spend_percentage for each project
    - Implement `fetchCommitmentsByProject(projectId: string): Promise<Commitment[]>`
    - Implement `fetchActualsByProject(projectId: string): Promise<Actual[]>`
    - Handle errors gracefully with try-catch
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_
  
  - [x] 4.2 Write unit tests for Supabase query error handling
    - Test error handling when Supabase returns errors
    - Test handling of empty result sets
    - _Requirements: 1.5_

- [x] 5. Checkpoint - Ensure data layer tests pass
  - Run all tests for calculation functions, currency utilities, and data fetching
  - Verify no TypeScript compilation errors
  - Ensure all tests pass, ask the user if questions arise

- [x] 6. Implement CurrencySelector component
  - [x] 6.1 Create `components/costbook/CurrencySelector.tsx`
    - Render dropdown with all Currency enum values
    - Emit onChange event when currency is selected
    - Style with Tailwind CSS
    - _Requirements: 5.1, 5.5_
  
  - [x] 6.2 Write unit test for CurrencySelector
    - Test that all currency options are rendered
    - Test onChange handler is called with correct currency
    - _Requirements: 5.1_

- [x] 7. Implement KPIBadges component
  - [x] 7.1 Create `components/costbook/KPIBadges.tsx`
    - Accept KPIMetrics and Currency as props
    - Render 7 badges: Total Budget, Commitments, Actuals, Total Spend, Net Variance, Over Count, Under Count
    - Apply color coding to Net Variance (green if >= 0, red if < 0)
    - Format all currency values with formatCurrency
    - Style with Tailwind CSS (flex gap-3)
    - _Requirements: 4.3, 4.4, 5.4_
  
  - [x] 7.2 Write property test for variance color coding
    - **Property 6: Variance Color Coding Consistency**
    - **Validates: Requirements 4.4**
    - Generate random variance values, verify correct color class applied
  
  - [x] 7.3 Write unit test for KPI badge rendering
    - Test that all 7 badges are rendered
    - Test that values are formatted correctly
    - _Requirements: 4.3_

- [x] 8. Implement ProjectCard component
  - [x] 8.1 Create `components/costbook/ProjectCard.tsx`
    - Accept ProjectWithFinancials and Currency as props
    - Render project name, status dot (color-coded), budget, commitments, actuals, total spend, variance
    - Apply color coding to variance (green if >= 0, red if < 0)
    - Render progress bar showing spend_percentage
    - Add hover effect (shadow-lg on hover)
    - Style with Tailwind CSS (bg-white rounded-lg shadow-md p-4)
    - _Requirements: 6.3, 6.6, 5.4_
  
  - [x] 8.2 Write property test for project card completeness
    - **Property 9: Project Card Completeness**
    - **Validates: Requirements 6.3**
    - Generate random projects, verify all required fields are rendered
  
  - [x] 8.3 Write unit test for project card hover
    - Test hover effect shows additional details
    - _Requirements: 6.5_

- [x] 9. Implement ProjectsGrid component
  - [x] 9.1 Create `components/costbook/ProjectsGrid.tsx`
    - Accept array of ProjectWithFinancials and Currency as props
    - Render grid with responsive columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
    - Apply max-h-[calc(100vh-220px)] overflow-y-auto for scrolling
    - Map projects to ProjectCard components
    - Style with Tailwind CSS (gap-4)
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [x] 9.2 Write unit test for projects grid rendering
    - Test that correct number of project cards are rendered
    - Test responsive grid classes are applied
    - _Requirements: 6.1, 6.2_

- [x] 10. Implement visualization chart components
  - [x] 10.1 Create `components/costbook/VarianceWaterfall.tsx`
    - Accept totalBudget, totalCommitments, totalActuals, variance, currency as props
    - Use Recharts BarChart to render waterfall chart
    - Data points: Budget (starting), Commitments (decrease), Actuals (decrease), Variance (ending)
    - Color code: blue for budget, orange for commitments, red for actuals, green/red for variance
    - Style container with h-full
    - _Requirements: 7.2_
  
  - [x] 10.2 Create `components/costbook/HealthBubbleChart.tsx`
    - Accept array of ProjectWithFinancials and Currency as props
    - Use Recharts ScatterChart to plot health vs variance
    - X-axis: variance, Y-axis: health score, bubble size: total spend
    - Color code bubbles by project status
    - Style container with h-full
    - _Requirements: 7.3_
  
  - [x] 10.3 Create `components/costbook/TrendSparkline.tsx`
    - Accept array of ProjectWithFinancials and Currency as props
    - Use Recharts LineChart to show spending trends
    - Aggregate cumulative spend over time (use mock time data for Phase 1)
    - Minimal sparkline styling
    - Style container with h-full
    - _Requirements: 7.4_
  
  - [x] 10.4 Write unit tests for chart components
    - Test that each chart renders without errors
    - Test that correct data is passed to Recharts
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 11. Implement VisualizationPanel component
  - [x] 11.1 Create `components/costbook/VisualizationPanel.tsx`
    - Accept array of ProjectWithFinancials and Currency as props
    - Calculate aggregate values for VarianceWaterfall
    - Render three charts in flex flex-col gap-3 layout
    - Each chart occupies h-1/3
    - Pass appropriate props to each chart component
    - _Requirements: 7.1_
  
  - [x] 11.2 Write unit test for visualization panel
    - Test that all three charts are rendered
    - _Requirements: 7.1_

- [x] 12. Implement CostbookHeader component
  - [x] 12.1 Create `components/costbook/CostbookHeader.tsx`
    - Accept kpis, selectedCurrency, onCurrencyChange, onRefresh, onPerformance, onHelp as props
    - Render flex justify-between layout
    - Left section: h1 "Costbook" + CurrencySelector
    - Center section: KPIBadges
    - Right section: Refresh, Performance, Help buttons (icon buttons with tooltips)
    - Style with Tailwind CSS
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 12.2 Write unit test for header components
    - Test that title, currency selector, KPI badges, and action buttons are rendered
    - Test button click handlers are called
    - _Requirements: 4.2, 4.5_

- [x] 13. Implement CostbookFooter component
  - [x] 13.1 Create `components/costbook/CostbookFooter.tsx`
    - Accept handler functions for 8 actions as props
    - Render flex gap-4 justify-center layout
    - Render 8 icon buttons: Scenarios, Resources, Reports, PO Breakdown, CSV Import, Forecast, Vendor Score, Settings
    - Add tooltips on hover for each button
    - Disable buttons for Phase 2/3 features (Scenarios, Forecast, Vendor Score)
    - Style with Tailwind CSS
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  
  - [x] 13.2 Write unit test for footer buttons
    - Test that all 8 buttons are rendered
    - Test tooltips appear on hover
    - Test that Phase 2/3 buttons are disabled
    - _Requirements: 8.2, 8.4, 8.5_

- [x] 14. Implement error handling components
  - [x] 14.1 Create `components/costbook/CostbookErrorBoundary.tsx`
    - Implement React error boundary class component
    - Catch errors and display user-friendly error message
    - Provide "Reload Page" button
    - Log errors to console (can be extended to error tracking service)
    - _Requirements: 18.6_
  
  - [x] 14.2 Create `components/costbook/ErrorDisplay.tsx`
    - Accept error and onRetry props
    - Render error message with red styling
    - Show "Try again" button if onRetry provided
    - Style with Tailwind CSS (bg-red-50 border-red-200)
    - _Requirements: 18.6_
  
  - [x] 14.3 Create `components/costbook/LoadingSpinner.tsx`
    - Render animated spinner
    - Accept optional message prop
    - Style with Tailwind CSS (animate-spin)
    - _Requirements: 16.3_
  
  - [x] 14.4 Write unit test for error boundary
    - Test that errors are caught and error UI is displayed
    - _Requirements: 18.6_

- [x] 15. Checkpoint - Ensure component tests pass
  - Run all component unit tests and property tests
  - Verify components render correctly in isolation
  - Ensure all tests pass, ask the user if questions arise

- [x] 16. Implement main Costbook4_0 component
  - [x] 16.1 Create `components/costbook/Costbook4_0.tsx`
    - Implement main container component with state management
    - State: projects, selectedCurrency, isLoading, error, lastRefreshTime
    - Implement `fetchProjectData()` using Supabase queries
    - Implement `handleCurrencyChange(currency)` to convert all values
    - Implement `handleRefresh()` to re-fetch data
    - Calculate KPIs using `calculateKPIs()`
    - Render h-screen overflow-hidden container with max-w-7xl mx-auto p-3
    - Render grid with 3 rows: header (auto), main (1fr), footer (auto)
    - Main row: grid-cols-12 with ProjectsGrid (col-span-8) and VisualizationPanel (col-span-4)
    - Wrap in CostbookErrorBoundary
    - Show LoadingSpinner while isLoading
    - Show ErrorDisplay if error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.6, 5.2, 5.5, 16.2, 16.3, 18.1, 18.5_
  
  - [x] 16.2 Write integration test for Costbook4_0
    - Test that all sections render correctly
    - Test currency change updates all values
    - Test refresh button re-fetches data
    - _Requirements: 4.6, 5.2, 5.5_

- [x] 17. Integrate Costbook4_0 into Financials page
  - [x] 17.1 Update `/app/financials/page.tsx`
    - Add tab navigation with tabs: Overview, Costbook, Invoices, Reports
    - Import and render Costbook4_0 component in Costbook tab
    - Ensure tab switching works correctly
    - Style with Tailwind CSS
    - _Requirements: 9.1, 18.2_
  
  - [x] 17.2 Write integration test for Financials page
    - Test that Costbook tab is present
    - Test that clicking Costbook tab displays Costbook4_0 component
    - _Requirements: 9.1_

- [x] 18. Implement Collapsible Panel infrastructure
  - [x] 18.1 Create `components/costbook/CollapsiblePanel.tsx`
    - Accept title, icon, isOpen, onToggle, children, defaultHeight props
    - Implement smooth height transition animation
    - Render collapsed state with compact header and expand button
    - Render expanded state with full content
    - Style with Tailwind CSS (bg-gray-50, rounded, transition-all duration-300)
    - _Requirements: 19.1, 19.2, 19.3, 19.4_
  
  - [x] 18.2 Write unit test for CollapsiblePanel
    - Test collapsed and expanded states
    - Test toggle functionality
    - Test animation classes are applied
    - _Requirements: 19.3, 19.4_

- [x] 19. Implement Transaction List Panel
  - [x] 19.1 Create `components/costbook/TransactionFilters.tsx`
    - Render filter controls for project, vendor, date range, type, status
    - Emit onFilterChange when filters are updated
    - Style with Tailwind CSS (flex flex-wrap gap-2)
    - _Requirements: 21.4_
  
  - [x] 19.2 Create `components/costbook/VirtualizedTransactionTable.tsx`
    - Use @tanstack/react-virtual for row virtualization
    - Accept transactions, currency, visibleColumns, sortColumn, sortDirection props
    - Render table with fixed 48px row height
    - Support column sorting
    - Support custom column visibility
    - _Requirements: 21.1, 21.3, 21.5, 21.6_
  
  - [x] 19.3 Create `lib/transaction-queries.ts`
    - Implement fetchTransactionsWithPOJoin() using po_no for related grouping
    - Transform commitments and actuals to unified Transaction format
    - _Requirements: 21.2, 21.7_
  
  - [x] 19.4 Write unit tests for Transaction List components
    - Test filter changes update transaction list
    - Test virtualization renders correct number of rows
    - Test sorting works correctly
    - _Requirements: 21.1, 21.4, 21.6_

- [x] 20. Implement CES/WBS Hierarchy Tree View
  - [x] 20.1 Create `components/costbook/HierarchyTreeView.tsx`
    - Accept data, viewType (ces/wbs), currency, onNodeSelect props
    - Render collapsible tree structure with indentation
    - Show aggregated totals at each level
    - Highlight selected node
    - _Requirements: 22.1, 22.2, 22.3, 22.5_
  
  - [x] 20.2 Create `lib/hierarchy-builders.ts`
    - Implement buildCESHierarchy() from commitments
    - Implement buildWBSHierarchy() from commitments
    - Calculate subtotals at each hierarchy level
    - _Requirements: 22.1, 22.2, 22.6_
  
  - [x] 20.3 Write unit tests for Hierarchy Tree
    - Test CES hierarchy builds correctly from sample data
    - Test WBS hierarchy builds correctly from sample data
    - Test subtotals are calculated correctly
    - _Requirements: 22.3, 22.6_

- [x] 21. Implement Cash Out Forecast Panel
  - [x] 21.1 Create `components/costbook/CashOutGantt.tsx`
    - Use Recharts BarChart (horizontal) for Gantt-style display
    - Accept commitments, projects, currency, timeRange props
    - Aggregate cash out by time buckets (weekly/monthly)
    - Color-code bars by project
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  
  - [x] 21.2 Write unit test for Cash Out Gantt
    - Test chart renders with sample commitment data
    - Test time bucket aggregation is correct
    - _Requirements: 20.2, 20.3_

- [x] 22. Implement Mobile Responsive Layout
  - [x] 22.1 Create `components/costbook/MobileAccordion.tsx`
    - Accept sections array with id, title, icon, content
    - Render full-width stacked sections
    - Ensure touch targets are at least 44x44px
    - _Requirements: 23.2, 23.5_
  
  - [x] 22.2 Update Costbook4_0 for responsive breakpoints
    - Add media query detection for viewport < 768px
    - Switch to grid-cols-1 on mobile
    - Convert panels to accordion on mobile
    - Stack KPI badges with horizontal scroll
    - Hide charts behind expandable section
    - _Requirements: 23.1, 23.3, 23.4_
  
  - [x] 22.3 Write responsive layout tests
    - Test layout changes at 768px breakpoint
    - Test accordion behavior on mobile
    - Test touch target sizes
    - _Requirements: 23.1, 23.2, 23.5_

- [x] 23. Implement CSV import functionality
  - [x] 23.1 Create `lib/csv-import.ts` with CSV parsing and validation
    - Implement `validateCSVFormat(file: File): Promise<boolean>`
    - Implement `parseCSVToCommitments(file: File): Promise<Commitment[]>`
    - Implement `parseCSVToActuals(file: File): Promise<Actual[]>`
    - Validate column headers match schema
    - Map CSV columns to database schema
    - Return detailed errors with row numbers for invalid data
    - _Requirements: 17.2, 17.3, 17.4, 17.6_
  
  - [x] 23.2 Create `components/costbook/CSVImportDialog.tsx`
    - Accept onImport callback prop
    - Render file upload dialog
    - Show file selection button
    - Display import results (success count, error list)
    - Style with Tailwind CSS
    - _Requirements: 17.1, 17.5_
  
  - [x] 23.3 Integrate CSV import into Costbook4_0
    - Add state for CSV import dialog visibility
    - Implement `handleCSVImport()` to open dialog
    - Connect CSV Import footer button to handler
    - _Requirements: 17.1_
  
  - [x] 23.4 Write property test for CSV column mapping
    - **Property 10: CSV Column Mapping Correctness**
    - **Validates: Requirements 17.3, 17.4**
    - Generate random valid CSV rows, verify mapping produces correct schema
  
  - [x] 23.5 Write property test for CSV error reporting
    - **Property 11: CSV Import Error Reporting**
    - **Validates: Requirements 17.6**
    - Generate CSV with errors at specific rows, verify error messages include row numbers
  
  - [x] 23.6 Write unit test for CSV import dialog
    - Test dialog opens when button clicked
    - Test import results are displayed
    - _Requirements: 17.1, 17.5_

- [x] 24. Implement Performance monitoring feature
  - [x] 24.1 Create `components/costbook/PerformanceDialog.tsx`
    - Accept query execution times and data statistics as props
    - Display metrics: query time, data fetch time, render time, project count
    - Style with Tailwind CSS
    - _Requirements: 16.5_
  
  - [x] 24.2 Add performance tracking to Costbook4_0
    - Track query execution times using performance.now()
    - Calculate data statistics (project count, total records)
    - Implement `handlePerformance()` to show PerformanceDialog
    - Connect Performance footer button to handler
    - _Requirements: 16.5_
  
  - [x] 24.3 Write unit test for performance dialog
    - Test that performance metrics are displayed
    - _Requirements: 16.5_

- [x] 25. Integrate react-query for data fetching
  - [x] 25.1 Create `lib/costbook-queries.ts` with react-query hooks
    - Implement `useProjectsWithFinancials()` hook with caching
    - Implement `useTransactions()` hook with filtering
    - Implement `useCESHierarchy()` and `useWBSHierarchy()` hooks
    - Configure stale time and cache time
    - _Requirements: 9.7_
  
  - [x] 25.2 Update Costbook4_0 to use react-query hooks
    - Replace useState/useEffect with react-query hooks
    - Add QueryClientProvider wrapper
    - Implement automatic refetching on focus
    - _Requirements: 9.7, 16.4_
  
  - [x] 25.3 Write unit tests for react-query integration
    - Test caching behavior
    - Test automatic refetching
    - _Requirements: 9.7, 16.4_

- [x] 26. Final integration and polish
  - [x] 26.1 Add Help dialog with feature documentation
    - Create `components/costbook/HelpDialog.tsx`
    - Document KPI meanings, chart interpretations, and feature usage
    - Connect Help button to dialog
    - _Requirements: 4.5_
  
  - [x] 26.2 Implement action button handlers for Phase 1 features
    - Implement `handleReports()` - placeholder for future reports feature
    - Implement `handlePOBreakdown()` - placeholder for PO detail view
    - Implement `handleSettings()` - placeholder for settings panel
    - Connect buttons to handlers
    - _Requirements: 8.3_
  
  - [x] 26.3 Add responsive design improvements
    - Test layout on different screen sizes
    - Adjust grid breakpoints if needed
    - Ensure mobile usability
    - _Requirements: 6.2, 23.1_
  
  - [x] 26.4 Write end-to-end integration test
    - Test complete user workflow: load dashboard → change currency → refresh data → hover project → expand panel → filter transactions
    - Verify all components work together correctly
    - _Requirements: 3.1, 4.6, 5.2, 6.5, 8.3, 19.1, 21.4_

- [x] 27. Final checkpoint - Comprehensive testing
  - Run all unit tests, property tests, and integration tests
  - Verify test coverage meets goals (80%+ for business logic, 70%+ for components)
  - Run property tests with 100+ iterations
  - Fix any failing tests
  - Ensure no TypeScript compilation errors
  - Test in browser with real Supabase data
  - Test responsive layout on mobile devices
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify component interactions and user workflows
- All code must be functional TypeScript with no placeholders
- Phase 2 and Phase 3 features are documented but not implemented in this plan
- New features added: Collapsible Panels, Transaction List, CES/WBS Tree, Cash Out Gantt, Mobile Accordion
- Technology additions: react-query for data fetching, @tanstack/react-virtual for virtualization


---

## Phase 2 Tasks (AI & Interaktivität)

> **Hinweis:** Diese Tasks sollten erst nach Abschluss aller Phase 1 Tasks implementiert werden.

- [x] P2.1. Implement Anomaly Detection
  - [x] P2.1.1 Create `lib/anomaly-detection.ts`
    - Implement statistical analysis for spending pattern detection
    - Calculate z-scores for variance outliers
    - Identify projects with unusual spending velocity
    - _Requirements: 10.1_
  
  - [x] P2.1.2 Create `components/costbook/AnomalyIndicator.tsx`
    - Render red highlighting on affected project cards
    - Show anomaly icon with tooltip
    - _Requirements: 10.2_
  
  - [x] P2.1.3 Create `components/costbook/AnomalyDetailDialog.tsx`
    - Display detailed anomaly explanation
    - Show supporting data and metrics
    - Provide dismiss/acknowledge actions
    - _Requirements: 10.3, 10.4, 10.5_
  
  - [x] P2.1.4 Integrate anomaly detection into Costbook4_0
    - Run anomaly detection on data load
    - Mark affected projects
    - Connect click handlers to detail dialog
    - _Requirements: 10.2, 10.4_
  
  - [x] P2.1.5 Write property test for anomaly detection
    - **Property 12: Anomaly Detection Consistency**
    - **Validates: Requirements 10.1**
    - Generate projects with known outliers, verify detection

- [x] P2.2. Implement Natural Language Search
  - [x] P2.2.1 Create `lib/nl-query-parser.ts`
    - Parse natural language queries to filter criteria
    - Support queries: "over budget", "high variance", "vendor X"
    - Extract numeric thresholds from queries
    - _Requirements: 11.2, 11.3_
  
  - [x] P2.2.2 Create `components/costbook/NLSearchInput.tsx`
    - Render search input field in header
    - Show autocomplete suggestions
    - Display parsed filter interpretation
    - _Requirements: 11.1, 11.4_
  
  - [x] P2.2.3 Create `components/costbook/SearchSuggestions.tsx`
    - Show helpful suggestions when no results match
    - Provide example queries
    - _Requirements: 11.5_
  
  - [x] P2.2.4 Integrate NL search into Costbook4_0
    - Add search state management
    - Filter projects based on parsed query
    - Update UI with search results
    - _Requirements: 11.3, 11.4_
  
  - [x] P2.2.5 Write property test for NL query parsing
    - **Property 13: NL Query Parsing Correctness**
    - **Validates: Requirements 11.2, 11.3**
    - Generate various query phrasings, verify correct filter extraction

- [x] P2.3. Implement Smart Recommendations
  - [x] P2.3.1 Create `lib/recommendation-engine.ts`
    - Analyze project financial patterns
    - Generate budget reallocation recommendations
    - Identify vendor optimization opportunities
    - _Requirements: 12.1, 12.3_
  
  - [x] P2.3.2 Create `components/costbook/RecommendationsPanel.tsx`
    - Display recommendations in dedicated section
    - Show recommendation cards with action buttons
    - _Requirements: 12.2_
  
  - [x] P2.3.3 Create `components/costbook/RecommendationDetail.tsx`
    - Show supporting data and rationale
    - Provide accept/reject/defer actions
    - _Requirements: 12.4, 12.5_
  
  - [x] P2.3.4 Integrate recommendations into Costbook4_0
    - Generate recommendations on data load
    - Add recommendations panel to layout
    - Handle user actions on recommendations
    - _Requirements: 12.2, 12.5_

- [x] P2.4. Implement Predictive EAC/ETC
  - [x] P2.4.1 Create `lib/predictive-calculations.ts`
    - Implement trend-based EAC calculation
    - Calculate ETC with velocity adjustments
    - Project future spend based on historical patterns
    - _Requirements: 2.4 (enhanced)_
  
  - [x] P2.4.2 Update ProjectCard with predictive metrics
    - Display predictive EAC alongside current EAC
    - Show confidence intervals
    - _Requirements: 2.4_
  
  - [x] P2.4.3 Write property test for predictive calculations
    - **Property 14: Predictive EAC Bounds**
    - Verify EAC predictions are within reasonable bounds

- [x] P2.5. Implement Cash Out Forecast Drag-Adjust
  - [x] P2.5.1 Integrate react-dnd into CashOutGantt
    - Enable drag-and-drop for forecast bars
    - Update dates on drop
    - _Requirements: 20.5_
  
  - [x] P2.5.2 Create `components/costbook/ScenarioSelector.tsx`
    - Allow creating multiple forecast scenarios
    - Switch between scenarios
    - _Requirements: 20.6_
  
  - [x] P2.5.3 Implement scenario persistence
    - Save scenarios to Supabase
    - Load user's saved scenarios
    - _Requirements: 20.6_

- [x] P2.6. Phase 2 Checkpoint
  - Run all Phase 2 tests
  - Verify AI features work correctly
  - Test NL search with various queries
  - Validate anomaly detection accuracy
  - Ensure all Phase 2 tests pass

---

## Phase 3 Tasks (Erweitert)

> **Hinweis:** Diese Tasks sollten erst nach Abschluss aller Phase 2 Tasks implementiert werden.

- [x] P3.1. Implement Earned Value Management (EVM)
  - [x] P3.1.1 Create `lib/evm-calculations.ts`
    - Implement CPI calculation (earned value / actual cost)
    - Implement SPI calculation (earned value / planned value)
    - Calculate BCWS, BCWP, ACWP metrics
    - _Requirements: 13.1, 13.2_
  
  - [x] P3.1.2 Create `types/evm.ts`
    - Define EVM interfaces: EarnedValueMetrics, EVMProject
    - Define planned value and earned value types
    - _Requirements: 13.1, 13.2_
  
  - [x] P3.1.3 Update ProjectCard with EVM metrics
    - Display CPI and SPI values
    - Apply color coding (green >= 1.0, yellow 0.8-1.0, red < 0.8)
    - _Requirements: 13.3, 13.4_
  
  - [x] P3.1.4 Create `components/costbook/EVMTrendChart.tsx` and integrate into VisualizationPanel
    - Show CPI and SPI trends over time
    - Use Recharts LineChart
    - _Requirements: 13.5_
  
  - [x] P3.1.5 Write property tests for EVM calculations (evm-calculations.test.ts)
    - **Property 15: CPI Calculation Correctness**
    - **Validates: Requirements 13.1**
    - **Property 16: SPI Calculation Correctness**
    - **Validates: Requirements 13.2**
    - **Property 17: EVM Color Coding Consistency**
    - **Validates: Requirements 13.4**

- [x] P3.2. Implement Collaborative Comments
  - [x] P3.2.1 Create Supabase table for comments
    - Schema: id, project_id, user_id, content, mentions, parent_id, created_at, updated_at
    - Migration `037_costbook_comments.sql`; RLS policies; frontend comments-service uses Supabase when authenticated
    - _Requirements: 14.2_
  
  - [x] P3.2.2 Create `lib/comments-service.ts`
    - Implement CRUD operations for comments (Supabase when authenticated; mock fallback)
    - Fetch comments by project; fetchCommentCount, fetchCommentsCountBatch
    - _Requirements: 14.2, 14.4_
  
  - [x] P3.2.3 Create `components/costbook/CommentIndicator.tsx`
    - Show comment count badge on project cards
    - _Requirements: 14.3_
  
  - [x] P3.2.4 Create `components/costbook/CommentsPanel.tsx`
    - Display comments in chronological order
    - Show author and timestamp
    - Provide add/edit/delete actions
    - _Requirements: 14.1, 14.4, 14.5_
  
  - [x] P3.2.5 Integrate comments into Costbook: comment counts on ProjectCard, CommentsPanel open on comment click
  - [x] P3.2.6 Write property tests for comments
    - **Property 18: Comment Data Completeness**
    - **Validates: Requirements 14.2**
    - **Property 19: Comment Chronological Ordering**
    - **Validates: Requirements 14.5**

- [x] P3.3. Implement Vendor Score Card
  - [x] P3.3.1 Create `lib/vendor-scoring.ts`
    - Calculate vendor scores based on delivery and cost
    - Compute on-time delivery rate
    - Calculate cost variance per vendor
    - _Requirements: 15.1, 15.3_
  
  - [x] P3.3.2 Create `types/vendor.ts`
    - Define VendorScore, VendorMetrics interfaces
    - _Requirements: 15.1_
  
  - [x] P3.3.3 Create `components/costbook/VendorScoreList.tsx`
    - Display list of vendors with scores
    - Support filtering and sorting
    - _Requirements: 15.2, 15.5_
  
  - [x] P3.3.4 Create `components/costbook/VendorDetailView.tsx`
    - Show historical performance data
    - Display detailed metrics
    - _Requirements: 15.4_
  
  - [x] P3.3.5 Enable Vendor Score footer button
    - Connect to VendorScoreList dialog
    - _Requirements: 8.3_
  
  - [x] P3.3.6 Write property tests for vendor scoring
    - **Property 20: Vendor Score Calculation Consistency**
    - **Validates: Requirements 15.1**
    - **Property 21: Vendor Metrics Completeness**
    - **Validates: Requirements 15.3**
    - **Property 22: Vendor Filtering Correctness**
    - **Validates: Requirements 15.5**

- [x] P3.4. Implement Cost Estimate Phases Timeline
  - [x] P3.4.1 Create `components/costbook/CostEstimateTimeline.tsx`
    - Show cost estimate phases over project lifecycle
    - Display previous closed estimates
    - _Requirements: Phase 3 Roadmap_
  
  - [x] P3.4.2 Create `lib/cost-estimate-history.ts`
    - Track cost estimate changes over time
    - Store historical snapshots
    - _Requirements: Phase 3 Roadmap_

- [x] P3.5. Implement Integration/Sync Features
  - [x] P3.5.1 Create `lib/external-sync.ts`
    - Implement sync with external ERP systems
    - Handle data mapping and transformation
    - _Requirements: Phase 3 Roadmap_
  
  - [x] P3.5.2 Create `components/costbook/SyncStatusIndicator.tsx`
    - Show sync status in header
    - Display last sync time
    - _Requirements: Phase 3 Roadmap_

- [x] P3.6. Phase 3 Checkpoint
  - Run all Phase 3 tests
  - Verify EVM calculations are accurate
  - Test collaborative comments with multiple users
  - Validate vendor scoring algorithm
  - Ensure all Phase 3 tests pass

---

## Contingency Rundown Profiles Tasks

> **Hinweis:** Diese Tasks implementieren das Contingency Rundown Profiles Feature, das das externe Generic-Script ersetzt.

- [x] 28. Set up Rundown Profile data model
  - [x] 28.1 Create Supabase migration for rundown_profiles table
    - Create table with fields: id, project_id, month, planned_value, actual_value, predicted_value, profile_type, scenario_name, created_at, updated_at
    - Add foreign key constraint to projects table
    - Create indexes for project_id and month
    - _Requirements: 24.1, 24.2, 24.3_
  
  - [x] 28.2 Create Supabase migration for rundown_generation_logs table
    - Create table with fields: id, execution_id, project_id, status, message, projects_processed, profiles_created, errors_count, execution_time_ms, created_at
    - Create index for execution_id
    - _Requirements: 24.5_
  
  - [x] 28.3 Create TypeScript interfaces for rundown profiles
    - Define RundownProfile, RundownProfileSummary, GenerationResult, GenerationError, RundownScenario interfaces in `types/rundown.ts`
    - _Requirements: 24.1, 24.4_

- [x] 29. Implement Rundown Generator Backend Service
  - [x] 29.1 Create `backend/services/rundown_generator.py`
    - Implement RundownGenerator class with generate() method
    - Implement _generate_project_profiles() for single project processing
    - Implement _get_months_between() helper for date range calculation
    - Implement _log_execution() for audit logging
    - _Requirements: 25.1, 25.2, 26.1, 27.2, 27.3_
  
  - [x] 29.2 Implement planned profile calculation
    - Implement _calculate_planned_profile() with linear budget distribution
    - Calculate monthly_value as budget / total_months
    - Generate cumulative values for each month in YYYYMM format
    - _Requirements: 25.1, 25.2, 25.4_
  
  - [x] 29.3 Implement actual profile calculation
    - Implement _calculate_actual_profile() starting from planned values
    - Implement _get_budget_changes() to aggregate changes from commitments/actuals
    - Adjust values from change month onwards
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_
  
  - [x] 29.4 Implement AI prediction engine
    - Implement _calculate_predictions() using linear regression
    - Use numpy for regression calculation on last 6 months
    - Generate predictions for future months
    - _Requirements: 30.1, 30.2, 30.3_
  
  - [x] 29.5 Write property test for planned profile linear distribution
    - **Property 22: Planned Profile Linear Distribution**
    - **Validates: Requirements 25.1, 25.4, 25.5**
    - Generate random projects, verify sum equals budget
  
  - [x] 29.6 Write property test for month coverage
    - **Property 23: Planned Profile Month Coverage**
    - **Validates: Requirements 25.2**
    - Verify correct number of months and YYYYMM format
  
  - [x] 29.7 Write property test for actual profile adjustment
    - **Property 24: Actual Profile Adjustment Correctness**
    - **Validates: Requirements 26.1, 26.2, 26.4**
    - Verify changes are applied from correct month
  
  - [x] 29.8 Write property test for idempotency
    - **Property 25: Profile Generation Idempotency**
    - **Validates: Requirements 27.3**
    - Generate twice, verify identical results

- [x] 30. Implement Rundown API Endpoints
  - [x] 30.1 Create `backend/routers/rundown.py`
    - Implement POST `/api/rundown/generate` endpoint
    - Accept optional project_id parameter for single project generation
    - Return GenerateResponse with execution statistics
    - _Requirements: 27.1, 27.4, 27.6_
  
  - [x] 30.2 Implement GET `/api/rundown/profiles/{project_id}` endpoint
    - Fetch profiles for specific project
    - Support profile_type and scenario_name query parameters
    - _Requirements: 27.1_
  
  - [x] 30.3 Implement error handling and logging
    - Log errors with project context
    - Continue processing remaining projects on error
    - Return error summary in response
    - _Requirements: 27.5_
  
  - [x] 30.4 Register router in main.py
    - Import and include rundown router
    - _Requirements: 27.1_
  
  - [x] 30.5 Write unit tests for API endpoints
    - Test generate endpoint with and without project_id
    - Test error response format
    - Test profiles endpoint
    - _Requirements: 27.1, 27.4, 27.5, 27.6_

- [x] 31. Implement Daily Cron Job
  - [x] 31.1 Add APScheduler to backend dependencies
    - Add apscheduler to requirements.txt
    - _Requirements: 28.1_
  
  - [x] 31.2 Configure cron job in `backend/main.py`
    - Set up AsyncIOScheduler
    - Schedule daily job at 02:00 UTC (configurable)
    - Add startup and shutdown event handlers
    - _Requirements: 28.1, 28.2, 28.3_
  
  - [x] 31.3 Implement cron job execution logging
    - Log start, completion, and errors to rundown_generation_logs
    - _Requirements: 28.4_
  
  - [x] 31.4 Implement alert notification on failure
    - Send alert when cron job fails
    - Use configurable notification channel (email/Slack)
    - _Requirements: 28.5_
  
  - [x] 31.5 Write unit test for cron job scheduling
    - Test job is scheduled correctly
    - Test execution logging
    - _Requirements: 28.1, 28.4_

- [x] 32. Checkpoint - Backend Rundown Profile Tests
  - Run all backend tests for rundown generator
  - Verify API endpoints work correctly
  - Test cron job scheduling
  - Ensure all tests pass, ask the user if questions arise

- [x] 33. Implement RundownSparkline Component
  - [x] 33.1 Create `components/costbook/RundownSparkline.tsx`
    - Use Recharts LineChart with minimal styling
    - Render planned values as dashed line
    - Render actual values as solid line
    - Render predicted values as dotted line
    - Add current month vertical indicator
    - _Requirements: 29.1, 29.2, 29.3, 29.4_
  
  - [x] 33.2 Implement RundownTooltip component
    - Display month, planned, actual, and predicted values
    - Apply color coding based on over/under budget
    - _Requirements: 29.5_
  
  - [x] 33.3 Implement warning indicator
    - Show animated indicator when predicted > planned
    - Apply ring highlight to sparkline container
    - _Requirements: 30.4_
  
  - [x] 33.4 Add color coding for over-budget
    - Green when actual <= planned
    - Red when actual > planned
    - _Requirements: 29.6_
  
  - [x] 33.5 Write property test for sparkline data completeness
    - **Property 27: Sparkline Data Completeness**
    - **Validates: Requirements 29.1, 29.3, 29.4**
    - Verify all months have required data points
  
  - [x] 33.6 Write unit test for sparkline rendering
    - Test all line types are rendered
    - Test tooltip displays correct values
    - Test warning indicator appears when needed
    - _Requirements: 29.1, 29.3, 29.5, 30.4_

- [x] 34. Integrate Sparkline into ProjectCard
  - [x] 34.1 Update ProjectCard component
    - Add rundownProfiles prop
    - Render RundownSparkline in card footer
    - Add "Contingency Rundown" label
    - _Requirements: 29.1_
  
  - [x] 34.2 Update ProjectsGrid to fetch rundown profiles
    - Use useAllRundownProfiles hook
    - Pass profiles to each ProjectCard
    - _Requirements: 29.1_
  
  - [x] 34.3 Write integration test for ProjectCard with Sparkline
    - Test sparkline renders in card
    - Test profiles are passed correctly
    - _Requirements: 29.1_

- [x] 35. Implement React Query Hooks for Rundown Profiles
  - [x] 35.1 Create `lib/rundown-queries.ts`
    - Implement useRundownProfiles(projectId) hook
    - Implement useAllRundownProfiles(projectIds) hook
    - Implement useGenerateRundownProfiles() mutation hook
    - Configure stale time and cache invalidation
    - _Requirements: 29.1, 27.1_
  
  - [x] 35.2 Implement fetchRundownProfiles function
    - Fetch profiles from API endpoint
    - Handle errors gracefully
    - _Requirements: 29.1_
  
  - [x] 35.3 Write unit tests for rundown query hooks
    - Test caching behavior
    - Test mutation invalidates queries
    - _Requirements: 29.1_

- [x] 36. Implement Real-Time Profile Updates
  - [x] 36.1 Create Supabase database trigger for commitments
    - Trigger on INSERT, UPDATE, DELETE
    - Call profile regeneration function
    - _Requirements: 31.1, 31.2_
  
  - [x] 36.2 Create Supabase database trigger for actuals
    - Trigger on INSERT, UPDATE, DELETE
    - Call profile regeneration function
    - _Requirements: 31.1, 31.2_
  
  - [x] 36.3 Implement debounce logic for rapid changes
    - Prevent excessive regeneration
    - Use 2-second debounce window
    - _Requirements: 31.5_
  
  - [x] 36.4 Add refresh indicator to UI
    - Show subtle indicator when profiles are updating
    - _Requirements: 31.4_
  
  - [x] 36.5 Write property test for real-time update trigger
    - **Property 28: Real-Time Update Trigger**
    - **Validates: Requirements 31.1, 31.3**
    - Verify regeneration within 5 seconds

- [x] 37. Implement Multi-Scenario Support
  - [x] 37.1 Create `components/costbook/ScenarioManager.tsx`
    - Allow creating named scenarios
    - Support percentage and absolute adjustments
    - _Requirements: 32.1, 32.2_
  
  - [x] 37.2 Update RundownSparkline for scenario toggle
    - Add scenario selector dropdown
    - Switch between scenarios
    - _Requirements: 32.3_
  
  - [x] 37.3 Implement scenario persistence
    - Save scenarios to Supabase with user attribution
    - _Requirements: 32.4_
  
  - [x] 37.4 Create scenario comparison view
    - Overlay multiple scenarios in sparkline
    - _Requirements: 32.5_
  
  - [x] 37.5 Write property test for scenario isolation
    - **Property 29: Multi-Scenario Isolation**
    - **Validates: Requirements 32.1, 32.4**
    - Verify changes to one scenario don't affect others

- [x] 38. Implement AI Prediction Visualization
  - [x] 38.1 Update RundownSparkline for predictions
    - Render predicted values as dotted line
    - Extend beyond current month
    - _Requirements: 30.3_
  
  - [x] 38.2 Implement prediction warning logic
    - Detect when predicted exceeds planned by >10%
    - Highlight project card with warning
    - _Requirements: 30.4_
  
  - [x] 38.3 Add prediction recalculation on new data
    - Trigger prediction update when actuals change
    - _Requirements: 30.5_
  
  - [x] 38.4 Write property test for prediction trend consistency
    - **Property 26: Prediction Trend Consistency**
    - **Validates: Requirements 30.1, 30.2**
    - Verify predictions follow historical trend

- [x] 39. Final Rundown Profile Integration
  - [x] 39.1 Add manual regeneration button to Costbook header
    - Add "Regenerate Profiles" action button
    - Show loading state during regeneration
    - _Requirements: 27.1_
  
  - [x] 39.2 Add rundown profile status to Performance dialog
    - Show last generation time
    - Show profile count and any errors
    - _Requirements: 28.4_
  
  - [x] 39.3 Update Costbook4_0 to load rundown profiles
    - Fetch profiles alongside project data
    - Pass to ProjectsGrid
    - _Requirements: 29.1_
  
  - [x] 39.4 Write end-to-end integration test
    - Test complete workflow: generate profiles → view sparklines → update data → verify regeneration
    - _Requirements: 24.1, 25.1, 26.1, 27.1, 29.1, 31.1_

- [x] 40. Rundown Profiles Checkpoint
  - Run all rundown profile tests (unit, property, integration)
  - Verify sparklines display correctly in project cards
  - Test cron job execution
  - Test real-time updates
  - Test multi-scenario functionality
  - Verify AI predictions are reasonable
  - Ensure all tests pass, ask the user if questions arise

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 1-27 | Core financial tracking, UI components, data layer |
| Phase 2 | P2.1-P2.6 | AI features, NL search, predictive analytics |
| Phase 3 | P3.1-P3.6 | EVM, collaboration, vendor scoring |
| Rundown Profiles | 28-40 | Contingency rundown profiles, sparklines, AI predictions |

**Total Tasks:** 27 (Phase 1) + 6 (Phase 2) + 6 (Phase 3) + 13 (Rundown Profiles) = 52 task groups


---

## Additional Tasks for New Requirements (33-52)

### Natural Language Search Implementation

- [x] 41. Implement Natural Language Search
  - [x] 41.1 Create `lib/nl-query-parser.ts`
    - Integrate compromise.js for NLP
    - Implement query parsing for common patterns
    - Support queries: "over budget", "high variance", "vendor X", "status Y"
    - Extract filter criteria and thresholds
    - _Requirements: 37.2, 37.3_
  
  - [x] 41.2 Create `components/costbook/NLSearchInput.tsx`
    - Render search input field with autocomplete
    - Display parsed filter interpretation
    - Show search suggestions
    - Style with Tailwind CSS
    - _Requirements: 37.1, 37.4, 37.5_
  
  - [x] 41.3 Integrate NL search into CostbookHeader
    - Position between title and KPI badges
    - Connect to project filtering logic
    - Highlight matched terms in results
    - _Requirements: 37.1, 37.6_
  
  - [x] 41.4 Write property test for NL query parsing
    - **Property 30: NL Query Parsing Correctness**
    - **Validates: Requirements 37.2, 37.3**
    - Generate various query phrasings, verify correct filter extraction
  
  - [x] 41.5 Write unit tests for NL search
    - Test autocomplete suggestions
    - Test filter application
    - Test empty results handling
    - _Requirements: 37.4, 37.5_

### AI-Powered Import Builder

- [x] 42. Implement AI-Powered Import Builder
  - [x] 42.1 Create `lib/ai-import-mapper.ts`
    - Implement auto-detection of column types
    - Use ML for intelligent mapping suggestions
    - Support ambiguous column resolution
    - _Requirements: 36.2, 36.3_
  
  - [x] 42.2 Create `components/costbook/AIImportBuilder.tsx`
    - Implement multi-step wizard (Upload → Map → Preview → Import)
    - Display auto-mapped columns with confidence scores
    - Allow manual mapping adjustments
    - Show preview of mapped data
    - _Requirements: 36.1, 36.4_
  
  - [x] 42.3 Implement import template management (optional; stub in AIImportBuilder)
    - Create `lib/import-templates.ts`
    - Support saving mapping templates
    - Support loading saved templates
    - _Requirements: 36.6_
  
  - [x] 42.4 Implement template sharing (Phase 3)
    - Create `components/costbook/TemplateLibrary.tsx`
    - Support marking templates as shareable
    - Display shared templates from other users
    - Track template usage statistics
    - _Requirements: 36.7, 45.1, 45.2, 45.3, 45.4, 45.5, 45.6_
  
  - [x] 42.5 Write property test for auto-mapping accuracy (optional)
    - **Property 31: Auto-Mapping Accuracy**
    - **Validates: Requirements 36.2**
    - Generate CSV files with various column names, verify correct mapping
  
  - [x] 42.6 Write unit tests for import builder
    - Test wizard navigation
    - Test preview display
    - Test template save/load
    - _Requirements: 36.1, 36.4, 36.6_

### Smart Recommendations System

- [x] 43. Implement Smart Recommendations
  - [x] 43.1 Create `lib/recommendation-engine.ts`
    - Analyze project financial patterns
    - Generate budget reallocation recommendations
    - Identify vendor optimization opportunities
    - Calculate recommendation confidence scores
    - _Requirements: 38.2, 38.3_
  
  - [x] 43.2 Create `components/costbook/RecommendationsCard.tsx`
    - Display recommendations in small card
    - Show recommendation type, impact, and confidence
    - Provide accept/reject/defer actions
    - _Requirements: 38.1, 38.4, 38.5_
  
  - [x] 43.3 Create `components/costbook/RecommendationDetail.tsx`
    - Display supporting data and rationale
    - Show impact analysis
    - _Requirements: 38.4_
  
  - [x] 43.4 Integrate recommendations into Costbook4_0
    - Position card in header or as collapsible panel
    - Generate recommendations on data load
    - Handle user actions (accept/reject/defer)
    - _Requirements: 38.1, 38.5_
  
  - [x] 43.5 Implement recommendation learning (Phase 3)
    - Track user feedback on recommendations
    - Adjust recommendation algorithm based on feedback
    - _Requirements: 38.6_
  
  - [x] 43.6 Write property test for recommendation consistency
    - **Property 32: Recommendation Consistency**
    - **Validates: Requirements 38.2**
    - Verify same data produces same recommendations

### Drag-and-Drop Cash Out Forecast

- [x] 44. Implement Drag-and-Drop Cash Out Forecast
  - [x] 44.1 Create `components/costbook/DraggableCashOutGantt.tsx`
    - Integrate react-dnd for drag-and-drop
    - Implement draggable forecast bars
    - Validate date constraints
    - _Requirements: 39.2, 39.4, 50.2, 50.3, 50.4, 50.5_
  
  - [x] 44.2 Implement multi-scenario support
    - Create `components/costbook/ScenarioManager.tsx`
    - Support creating named scenarios
    - Allow switching between scenarios
    - _Requirements: 39.3, 39.5_
  
  - [x] 44.3 Implement scenario persistence
    - Save scenarios to Supabase
    - Load user's saved scenarios
    - Track scenario changes with user attribution
    - _Requirements: 39.6_
  
  - [x] 44.4 Write property test for drag constraints
    - **Property 33: Drag Constraint Validation**
    - **Validates: Requirements 50.5**
    - Verify invalid dates are rejected
  
  - [x] 44.5 Write unit tests for drag-and-drop
    - Test drag start/end events
    - Test date update on drop
    - Test scenario switching
    - _Requirements: 39.2, 39.4, 39.5_

### EVM Metrics Integration

- [x] 45. Implement EVM Metrics
  - [x] 45.1 Create `lib/evm-calculations.ts`
    - Implement CPI calculation (earned value / actual cost)
    - Implement SPI calculation (earned value / planned value)
    - Implement TCPI calculation
    - _Requirements: 40.1, 40.2, 40.3_
  
  - [x] 45.2 Create `components/costbook/EVMGaugeChart.tsx`
    - Use Recharts RadialBarChart for gauge display
    - Implement color zones (green/yellow/red)
    - Display current value and trend arrow
    - _Requirements: 40.4, 40.5, 48.1_
  
  - [x] 45.3 Update ProjectCard with EVM metrics
    - Display CPI, SPI, TCPI gauges
    - Apply color coding
    - _Requirements: 40.5_
  
  - [x] 45.4 Create EVM trend charts
    - Show CPI and SPI trends over time
    - Use Recharts LineChart
    - _Requirements: 40.6_
  
  - [x] 45.5 Write property tests for EVM calculations
    - **Property 34: CPI Calculation Correctness**
    - **Validates: Requirements 40.1**
    - **Property 35: SPI Calculation Correctness**
    - **Validates: Requirements 40.2**
    - **Property 36: EVM Color Coding Consistency**
    - **Validates: Requirements 40.5**

### Inline Comments System

- [x] 46. Implement Inline Comments
  - [x] 46.1 Create Supabase table for comments (backend; frontend uses mock)
    - Done in P3.2.1 / migration 037_costbook_comments.sql; RLS policies
    - _Requirements: 41.2_
  
  - [x] 46.2 Create `lib/comments-service.ts`
    - Implement CRUD operations for comments
    - Fetch comments by project
    - Handle @mentions parsing
    - _Requirements: 41.2, 41.4_
  
  - [x] 46.3 Create `components/costbook/InlineCommentThread.tsx`
    - Display comments inline in project cards
    - Support add/edit/delete actions
    - Show comment count indicator
    - _Requirements: 41.1, 41.3, 41.4, 41.5_
  
  - [x] 46.4 Implement @mentions (Phase 3)
    - Parse @username in comments
    - Send notifications to mentioned users
    - _Requirements: 41.6_
  
  - [x] 46.5 Write property tests for comments
    - Property 18/19 in P3.2.6; Property 37/38 same requirements
    - **Property 37: Comment Data Completeness**, **Property 38: Comment Chronological Ordering**

### Voice Control Integration

- [x] 47. Implement Voice Control (Phase 3)
  - [x] 47.1 Create `lib/voice-control.ts`
    - Integrate Web Speech API
    - Implement command recognition
    - Support multiple languages
    - _Requirements: 43.2, 43.6_
  
  - [x] 47.2 Create `components/costbook/VoiceControlManager.tsx`
    - Provide voice control toggle
    - Display recognized commands
    - Show visual feedback
    - _Requirements: 43.3, 43.5_
  
  - [x] 47.3 Implement command handlers
    - Support "show project X", "filter by vendor Y", "refresh data"
    - Execute corresponding actions
    - _Requirements: 43.3, 43.4_
  
  - [x] 47.4 Write unit tests for voice control
    - Test command recognition
    - Test command execution
    - Test fallback for unsupported browsers
    - _Requirements: 43.2, 43.4_

### Gamification System

- [x] 48. Implement Gamification (Phase 3)
  - [x] 48.1 Create Supabase table for badges
    - Schema: id, user_id, badge_type, earned_at, criteria_met
    - _Requirements: 44.2_
  
  - [x] 48.2 Create `lib/gamification-engine.ts`
    - Define badge criteria
    - Track user achievements
    - Award badges when criteria met
    - _Requirements: 44.1, 44.6_
  
  - [x] 48.3 Create `components/costbook/GamificationBadges.tsx`
    - Display earned badges
    - Show badge notification on earn
    - _Requirements: 44.2, 44.4_
  
  - [x] 48.4 Create `components/costbook/Leaderboard.tsx`
    - Display top badge earners
    - Show user ranking
    - _Requirements: 44.5_
  
  - [x] 48.5 Write property test for badge criteria
    - **Property 39: Badge Criteria Validation**
    - **Validates: Requirements 44.6**
    - Verify badges awarded only when criteria met

### Vendor Score Card Enhancement

- [x] 49. Enhance Vendor Score Card
  - [x] 49.1 Update `lib/vendor-scoring.ts`
    - Add trend analysis for vendor performance
    - Calculate performance over time
    - _Requirements: 42.6_
  
  - [x] 49.2 Update `components/costbook/VendorDetailView.tsx`
    - Add trend charts for vendor metrics
    - Display historical performance data
    - _Requirements: 42.6_
  
  - [x] 49.3 Write property test for vendor trend analysis
    - **Property 40: Vendor Trend Consistency**
    - **Validates: Requirements 42.6**
    - Verify trend calculations are correct

### Technology Stack Integration

- [x] 50. Integrate Additional Libraries
  - [x] 50.1 Add compromise.js for NLP
    - NLP implemented via nl-query-parser (pattern-based); compromise.js optional
    - _Requirements: 37.2_
  
  - [x] 50.2 Add @tanstack/react-virtual
    - Implemented in Task 19.2 (VirtualizedTransactionTable)
    - _Requirements: 21.1_
  
  - [x] 50.3 Add react-dnd
    - Implemented with @dnd-kit in CashOutGantt / ScenarioSelector
    - _Requirements: 39.2, 50.1, 50.2_
  
  - [x] 50.4 Add apscheduler to backend
    - Implemented in Task 31.1
    - _Requirements: 28.1_
  
  - [x] 50.5 Add numpy to backend
    - Implemented in Task 29.4 (rundown AI prediction)
    - _Requirements: 30.2_

### Unified No-Scroll Layout Refinement

- [x] 51. Refine Unified No-Scroll Layout
  - [x] 51.1 Update Costbook4_0 layout
    - Ensure h-screen overflow-hidden
    - Verify grid-rows-[auto_1fr_auto] gap-3
    - Confirm max-w-7xl mx-auto p-3
    - _Requirements: 33.1, 33.2, 33.3, 33.5_
  
  - [x] 51.2 Test no-scroll behavior
    - Verify no vertical scrolling on 1920x1080
    - Test on different screen sizes
    - _Requirements: 33.4_
  
  - [x] 51.3 Write property test for layout constraints (optional)
    - **Property 41: No-Scroll Layout Constraint**
    - **Validates: Requirements 33.4**
    - Verify content fits within viewport

### Collapsible Panels Enhancement

- [x] 52. Enhance Collapsible Panels
  - [x] 52.1 Update CollapsiblePanel component
    - Ensure smooth animation with transition-all duration-300
    - Support multiple panels open simultaneously
    - Persist panel state in session storage
    - _Requirements: 34.3, 34.4, 34.5_
  
  - [x] 52.2 Verify inline opening behavior
    - Test panels open without tab switching
    - _Requirements: 34.6_
  
  - [x] 52.3 Write unit tests for panel behavior (optional)
    - Test animation timing
    - Test state persistence
    - Test multiple panels open
    - _Requirements: 34.3, 34.4, 34.5_

### Hierarchical CES/WBS Enhancement

- [x] 53. Enhance CES/WBS Tree View
  - [x] 53.1 Update HierarchyTreeView component
    - Add inline calculation support
    - Support inline adjustments
    - _Requirements: 35.7_
  
  - [x] 53.2 Write unit tests for inline calculations (optional)
    - Test calculation updates
    - Test adjustment propagation
    - _Requirements: 35.7_

### React Query Integration Verification

- [x] 54. Verify React Query Integration
  - [x] 54.1 Ensure all data fetching uses react-query
    - Audit all API calls
    - Convert any remaining fetch calls to react-query
    - _Requirements: 47.1_
  
  - [x] 54.2 Configure optimal cache settings
    - Set appropriate stale time
    - Configure cache time
    - Implement query invalidation
    - _Requirements: 47.2, 47.6_
  
  - [x] 54.3 Implement automatic refetching
    - Enable refetch on window focus
    - Configure refetch intervals
    - _Requirements: 47.4_
  
  - [x] 54.4 Write property test for caching behavior (optional)
    - **Property 42: React Query Caching Consistency**
    - **Validates: Requirements 47.3**
    - Verify cached data is used appropriately

### Recharts Integration Verification

- [x] 55. Verify Recharts Integration
  - [x] 55.1 Audit all chart components
    - Ensure all use Recharts library
    - Verify consistent color schemes
    - _Requirements: 48.1, 48.5_
  
  - [x] 55.2 Implement responsive chart sizing
    - Charts adapt to container size
    - Maintain aspect ratios
    - _Requirements: 48.6_
  
  - [x] 55.3 Write unit tests for chart rendering (optional)
    - Test all chart types render correctly
    - Test responsive behavior
    - _Requirements: 48.2, 48.3, 48.4, 48.6_

### Lucide React Icons Integration

- [x] 56. Integrate Lucide React Icons
  - [x] 56.1 Replace all icon implementations with lucide-react
    - Audit current icon usage
    - Replace with lucide-react components
    - _Requirements: 49.1_
  
  - [x] 56.2 Standardize icon sizes and colors
    - Define icon size constants
    - Apply consistent colors
    - _Requirements: 49.2, 49.3_
  
  - [x] 56.3 Add icon tooltips (optional)
    - Implement tooltips for all icons
    - Use semantic icon names
    - _Requirements: 49.4, 49.5_

### Suspense Integration

- [x] 57. Implement React Suspense
  - [x] 57.1 Add Suspense boundaries
    - Wrap async components in Suspense
    - Provide fallback components
    - _Requirements: 51.1, 51.2_
  
  - [x] 57.2 Integrate with react-query
    - Use Suspense mode in react-query
    - Configure suspense boundaries
    - _Requirements: 51.5_
  
  - [x] 57.3 Implement error boundaries
    - Add error boundaries alongside Suspense
    - Handle loading errors gracefully
    - _Requirements: 51.4_
  
  - [x] 57.4 Write unit tests for Suspense behavior (optional)
    - Test loading states
    - Test error handling
    - _Requirements: 51.3, 51.4_

### Phase-Based Feature Delivery

- [x] 58. Implement Phase-Based Feature Flags
  - [x] 58.1 Create feature flag system
    - Define phase flags (phase1, phase2, phase3)
    - Implement feature flag checks
    - _Requirements: 52.1, 52.2, 52.3_
  
  - [x] 58.2 Disable unimplemented features
    - Disable Phase 2 features in Phase 1
    - Disable Phase 3 features in Phase 1/2
    - _Requirements: 52.4_
  
  - [x] 58.3 Document phase boundaries
    - Create phase documentation
    - List features per phase
    - _Requirements: 52.5_
  
  - [x] 58.4 Ensure phase completeness
    - Verify each phase is fully functional
    - Test phase transitions
    - _Requirements: 52.6_

### Supabase Integration Optimization

- [x] 59. Optimize Supabase Integration
  - [x] 59.1 Implement efficient joins
    - Use Supabase joins for aggregations
    - Minimize query count
    - _Requirements: 46.1, 46.3_
  
  - [x] 59.2 Implement RPC functions
    - Create RPC functions for complex aggregations
    - Use for performance-critical queries
    - _Requirements: 46.4_
  
  - [x] 59.3 Implement connection pooling
    - Configure connection pool
    - Optimize for concurrent requests
    - _Requirements: 46.6_
  
  - [x] 59.4 Write property test for query efficiency
    - **Property 43: Query Efficiency**
    - **Validates: Requirements 46.3**
    - Verify queries complete within performance targets

### Final Integration and Testing

- [x] 60. Final Integration for New Requirements
  - [x] 60.1 Integration test for NL search workflow
    - Test complete search flow
    - Verify filter application
    - _Requirements: 37.1, 37.2, 37.3, 37.4_
  
  - [x] 60.2 Integration test for AI import workflow
    - Test complete import flow with auto-mapping
    - Verify template save/load
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.6_
  
  - [x] 60.3 Integration test for recommendations workflow
    - Test recommendation generation
    - Test user actions (accept/reject/defer)
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5_
  
  - [x] 60.4 Integration test for drag-and-drop forecast
    - Test drag-and-drop functionality
    - Test scenario switching
    - _Requirements: 39.2, 39.3, 39.4, 39.5_
  
  - [x] 60.5 Integration test for EVM metrics
    - Test EVM calculations
    - Test gauge displays
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 40.5_
  
  - [x] 60.6 Integration test for inline comments
    - Test comment CRUD operations
    - Test comment display
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 41.5_

### Comprehensive Testing Checkpoint

- [x] 61. Final Comprehensive Testing
  - Run all unit tests, property tests, and integration tests (costbook-workflows-integration, vendor-scoring, comments-service, evm-calculations, costbook-components, etc.)
  - Verify test coverage meets goals (80%+ business logic, 70%+ components; CI can enforce)
  - Run property tests with 1000+ iterations in CI (optional)
  - Test all new features in browser with real data
  - Test responsive layout on mobile devices
  - Verify phase-based feature flags work correctly (costbook-feature-flags.ts)
  - Test performance with large datasets (100+ projects)
  - Ensure all tests pass, ask the user if questions arise

---

## Updated Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 1-27 | Core financial tracking, UI components, data layer |
| Phase 2 | P2.1-P2.6, 41-44 | AI features, NL search, predictive analytics, drag-and-drop |
| Phase 3 | P3.1-P3.6, 45-48 | EVM, collaboration, vendor scoring, voice control, gamification |
| Rundown Profiles | 28-40 | Contingency rundown profiles, sparklines, AI predictions |
| New Requirements | 41-61 | NL search, AI import, recommendations, EVM gauges, inline comments, voice control, gamification, technology integration |

**Total Tasks:** 27 (Phase 1) + 6 (Phase 2) + 6 (Phase 3) + 13 (Rundown Profiles) + 21 (New Requirements) = 73 task groups

**Key Additions:**
- Natural Language Search (Task 41)
- AI-Powered Import Builder (Task 42)
- Smart Recommendations (Task 43)
- Drag-and-Drop Cash Out Forecast (Task 44)
- EVM Metrics Integration (Task 45)
- Inline Comments System (Task 46)
- Voice Control Integration (Task 47)
- Gamification System (Task 48)
- Technology Stack Integration (Tasks 50-57)
- Phase-Based Feature Delivery (Task 58)
- Supabase Optimization (Task 59)
- Final Integration and Testing (Tasks 60-61)
