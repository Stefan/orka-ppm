# Requirements Document: Costbook

## Introduction

Costbook is a sophisticated financial management dashboard for project management applications that provides real-time visibility into project budgets, commitments, actuals, and variances. The system integrates with Supabase to aggregate financial data across projects and presents it through an interactive, no-scroll dashboard with KPI metrics, project cards, and visual analytics. The feature will be delivered in three phases: Phase 1 (Basis) establishes core financial tracking, Phase 2 (AI) adds intelligent anomaly detection and natural language capabilities, and Phase 3 (Extended) introduces earned value management and collaborative features.

## Glossary

- **Costbook_System**: The financial management dashboard component
- **Project**: A work initiative with defined budget, timeline, and financial tracking
- **Commitment**: A purchase order or financial obligation against a project budget
- **Actual**: A posted invoice or actual expenditure against a project
- **Total_Spend**: The sum of all commitments and actuals for a project
- **Variance**: The difference between project budget and total spend
- **EAC**: Estimate at Completion - projected final cost of a project
- **KPI**: Key Performance Indicator - aggregate financial metrics across all projects
- **Currency_Selector**: UI component allowing users to view financials in different currencies
- **Projects_Grid**: Visual display of project cards with financial summaries
- **Variance_Waterfall**: Chart showing budget breakdown and variance components
- **Health_Bubble_Chart**: Scatter plot showing project health vs variance
- **Trend_Sparkline**: Line chart showing spending trends over time
- **Anomaly**: Unusual financial pattern detected by AI analysis
- **EVM**: Earned Value Management - performance measurement methodology
- **CPI**: Cost Performance Index - ratio of earned value to actual cost
- **SPI**: Schedule Performance Index - ratio of earned value to planned value
- **Vendor_Score**: Performance rating for vendors based on delivery and cost metrics
- **Rundown_Profile**: Monthly budget progression showing planned vs actual contingency consumption
- **Rundown_Generator**: Backend service that calculates and stores rundown profiles
- **Planned_Profile**: Linear distribution of original budget over project duration
- **Actual_Profile**: Adjusted profile reflecting approved changes from commitments/actuals
- **Prediction_Engine**: AI component that forecasts future budget consumption based on trends
- **Real_Time_Trigger**: Database trigger that initiates profile updates on data changes
- **Cron_Job**: Scheduled task for automated daily profile regeneration

## Requirements

### Requirement 1: Data Model Integration

**User Story:** As a financial manager, I want the system to integrate with Supabase tables for projects, commitments, and actuals, so that I can access real-time financial data.

#### Acceptance Criteria

1. THE Costbook_System SHALL connect to the Supabase projects table with fields: id, budget, health, name, status, start_date, end_date
2. THE Costbook_System SHALL connect to the Supabase commitments table with fields: id, project_id, total_amount, po_number, po_status, vendor, currency, po_date, po_line_nr, po_line_text, vendor_description, requester, cost_center, wbs_element, account_group_level1, account_subgroup_level2, account_level3, custom_fields
3. THE Costbook_System SHALL connect to the Supabase actuals table with fields: id, project_id, amount, po_no, vendor_invoice_no, posting_date, status, currency, vendor, vendor_description, gl_account, cost_center, wbs_element, item_text, quantity, net_due_date, custom_fields
4. WHEN querying financial data, THE Costbook_System SHALL perform joins using project_id as the foreign key
5. THE Costbook_System SHALL handle missing or null values in financial data gracefully

### Requirement 2: Financial Calculations

**User Story:** As a financial manager, I want accurate calculations of total spend, variance, and EAC, so that I can understand project financial health.

#### Acceptance Criteria

1. WHEN calculating total spend, THE Costbook_System SHALL compute Total_Spend as SUM(commitments.total_amount) + SUM(actuals.amount) for each project
2. WHEN calculating variance, THE Costbook_System SHALL compute Variance as projects.budget - Total_Spend for each project
3. WHEN calculating aggregate KPIs, THE Costbook_System SHALL sum values across all projects
4. THE Costbook_System SHALL calculate EAC using the formula: VOWD + ETC + Trends (with placeholder logic for Phase 1)
5. WHEN a project has no commitments or actuals, THE Costbook_System SHALL treat missing values as zero in calculations
6. THE Costbook_System SHALL preserve numeric precision to two decimal places for all currency values

### Requirement 3: Dashboard Layout and Structure

**User Story:** As a financial manager, I want a no-scroll dashboard layout that displays all key information on one screen, so that I can quickly assess financial status.

#### Acceptance Criteria

1. THE Costbook_System SHALL render within a h-screen overflow-hidden container with max-w-7xl mx-auto p-3 styling
2. THE Costbook_System SHALL use a grid layout with three rows: header (auto), main content (1fr), and footer (auto)
3. WHEN the dashboard loads, THE Costbook_System SHALL display all content without requiring vertical scrolling on standard desktop screens
4. THE Costbook_System SHALL maintain a 3-pixel gap between major layout sections
5. THE Costbook_System SHALL use Tailwind CSS for all styling implementations

### Requirement 4: Header Section with KPIs

**User Story:** As a financial manager, I want to see aggregate KPI metrics in the header, so that I can understand overall portfolio health at a glance.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a header row with flex justify-between layout
2. WHEN rendering the header left section, THE Costbook_System SHALL display an h1 "Costbook" title and Currency_Selector component
3. THE Costbook_System SHALL display KPI badges in the center section showing: Total Budget, Commitments, Actuals, Total Spend, Net Variance, Over Count, and Under Count
4. WHEN displaying Net Variance, THE Costbook_System SHALL apply color coding (green for positive, red for negative)
5. THE Costbook_System SHALL display Refresh, Performance, and Help buttons in the header right section
6. THE Costbook_System SHALL update all KPI values when the Refresh button is clicked

### Requirement 5: Currency Selection and Conversion

**User Story:** As a financial manager working with international projects, I want to select different currencies for viewing financial data, so that I can analyze costs in my preferred currency.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a Currency_Selector dropdown in the header
2. WHEN a user selects a currency, THE Costbook_System SHALL convert all displayed financial values to the selected currency
3. THE Costbook_System SHALL store currency conversion rates or retrieve them from a data source
4. WHEN displaying currency values, THE Costbook_System SHALL include the currency symbol or code
5. THE Costbook_System SHALL maintain the selected currency preference during the user session

### Requirement 6: Projects Grid Display

**User Story:** As a financial manager, I want to see individual project cards with financial summaries, so that I can identify which projects need attention.

#### Acceptance Criteria

1. THE Costbook_System SHALL render a Projects_Grid in the left section (col-span-8) of the main content area
2. THE Costbook_System SHALL display project cards in a responsive grid (grid-cols-1 md:2 lg:3) with minmax(250px, 1fr) sizing
3. WHEN rendering a project card, THE Costbook_System SHALL display: project name, status dot, budget, commitments, actuals, total spend, variance, and progress bar
4. THE Costbook_System SHALL apply max-h-[calc(100vh-220px)] overflow-y-auto to the Projects_Grid for scrolling when needed
5. WHEN a user hovers over a project card, THE Costbook_System SHALL display additional details
6. WHEN displaying variance on a project card, THE Costbook_System SHALL apply color coding based on positive or negative values

### Requirement 7: Visualization Charts

**User Story:** As a financial manager, I want visual charts showing variance breakdown, project health, and spending trends, so that I can identify patterns and outliers.

#### Acceptance Criteria

1. THE Costbook_System SHALL render three charts in the right section (col-span-4) of the main content area, each occupying h-1/3 height
2. THE Costbook_System SHALL display a Variance_Waterfall chart using Recharts showing budget breakdown components
3. THE Costbook_System SHALL display a Health_Bubble_Chart using Recharts ScatterChart plotting project health vs variance
4. THE Costbook_System SHALL display a Trend_Sparkline using Recharts LineChart showing spending trends over time
5. WHEN chart data updates, THE Costbook_System SHALL re-render charts with smooth transitions
6. THE Costbook_System SHALL use consistent color schemes across all visualizations

### Requirement 8: Footer Action Buttons

**User Story:** As a financial manager, I want quick access to additional features and tools, so that I can perform detailed analysis and data management.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a footer row with flex gap-4 justify-center layout
2. THE Costbook_System SHALL render eight icon buttons: Scenarios, Resources, Reports, PO Breakdown, CSV Import, Forecast, Vendor Score, and Settings
3. WHEN a user clicks an action button, THE Costbook_System SHALL navigate to or open the corresponding feature
4. THE Costbook_System SHALL display tooltips on hover for each action button
5. THE Costbook_System SHALL disable action buttons for features not yet implemented in the current phase

### Requirement 9: Phase 1 Implementation Scope

**User Story:** As a product owner, I want Phase 1 to deliver core financial tracking functionality, so that users can begin using the Costbook immediately.

#### Acceptance Criteria

1. THE Costbook_System SHALL implement a "Costbook" tab within the Financials page at /app/financials/page.tsx
2. THE Costbook_System SHALL implement the complete wireframe layout with real Supabase joins on project_id and po_no
3. THE Costbook_System SHALL calculate all KPI metrics using SUM aggregations from commitments and actuals tables
4. THE Costbook_System SHALL display all three financial values (Budget, Commitments, Actuals) in the Projects_Grid
5. THE Costbook_System SHALL contain no placeholder code - all functionality must be fully implemented
6. THE Costbook_System SHALL use functional React components with TypeScript
7. THE Costbook_System SHALL use react-query for data fetching with caching and automatic refetching
8. THE Costbook_System SHALL calculate ETC (Estimate to Complete) as projects.budget - Total_Spend

### Requirement 10: Anomaly Detection (Phase 2)

**User Story:** As a financial manager, I want the system to automatically detect unusual spending patterns, so that I can investigate potential issues proactively.

#### Acceptance Criteria

1. WHEN analyzing financial data, THE Costbook_System SHALL identify anomalies using statistical analysis or machine learning
2. WHEN an anomaly is detected, THE Costbook_System SHALL mark the affected project card with red highlighting
3. THE Costbook_System SHALL provide an explanation of why a pattern was flagged as anomalous
4. WHEN a user clicks on an anomaly indicator, THE Costbook_System SHALL display detailed anomaly information
5. THE Costbook_System SHALL allow users to dismiss or acknowledge anomalies

### Requirement 11: Natural Language Search (Phase 2)

**User Story:** As a financial manager, I want to search for projects and financial data using natural language queries, so that I can find information quickly without complex filters.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a natural language search input field
2. WHEN a user enters a natural language query, THE Costbook_System SHALL parse the intent and parameters
3. THE Costbook_System SHALL filter and display projects matching the search criteria
4. THE Costbook_System SHALL support queries like "show projects over budget" or "find projects with high variance"
5. WHEN no results match the query, THE Costbook_System SHALL display helpful suggestions

### Requirement 12: Smart Recommendations (Phase 2)

**User Story:** As a financial manager, I want AI-powered recommendations for budget optimization, so that I can make data-driven decisions.

#### Acceptance Criteria

1. THE Costbook_System SHALL analyze project financial patterns to generate recommendations
2. WHEN recommendations are available, THE Costbook_System SHALL display them in a dedicated section
3. THE Costbook_System SHALL provide actionable recommendations such as budget reallocation or vendor changes
4. WHEN a user clicks on a recommendation, THE Costbook_System SHALL show supporting data and rationale
5. THE Costbook_System SHALL allow users to accept, reject, or defer recommendations

### Requirement 13: Earned Value Management (Phase 3)

**User Story:** As a project controller, I want to track earned value metrics (CPI/SPI), so that I can measure project performance against schedule and budget.

#### Acceptance Criteria

1. THE Costbook_System SHALL calculate CPI (Cost Performance Index) as earned value divided by actual cost
2. THE Costbook_System SHALL calculate SPI (Schedule Performance Index) as earned value divided by planned value
3. WHEN displaying EVM metrics, THE Costbook_System SHALL show CPI and SPI values on project cards
4. THE Costbook_System SHALL apply color coding to CPI/SPI values (green for >= 1.0, yellow for 0.8-1.0, red for < 0.8)
5. THE Costbook_System SHALL provide trend charts for CPI and SPI over time

### Requirement 14: Collaborative Comments (Phase 3)

**User Story:** As a team member, I want to add comments and notes to projects, so that I can collaborate with colleagues on financial decisions.

#### Acceptance Criteria

1. WHEN viewing a project card, THE Costbook_System SHALL provide an option to add comments
2. THE Costbook_System SHALL store comments with timestamp, author, and project association
3. WHEN comments exist for a project, THE Costbook_System SHALL display a comment indicator on the project card
4. THE Costbook_System SHALL allow users to view, edit, and delete their own comments
5. THE Costbook_System SHALL display comments in chronological order with author attribution

### Requirement 15: Vendor Score Card (Phase 3)

**User Story:** As a procurement manager, I want to see vendor performance scores, so that I can make informed decisions about vendor selection.

#### Acceptance Criteria

1. THE Costbook_System SHALL calculate vendor scores based on delivery performance and cost accuracy
2. WHEN accessing the Vendor Score feature, THE Costbook_System SHALL display a list of vendors with scores
3. THE Costbook_System SHALL show detailed metrics for each vendor including on-time delivery rate and cost variance
4. WHEN a user clicks on a vendor, THE Costbook_System SHALL display historical performance data
5. THE Costbook_System SHALL allow filtering and sorting vendors by score or other criteria

### Requirement 16: Data Refresh and Performance

**User Story:** As a financial manager, I want fast data loading and refresh capabilities, so that I can work efficiently with up-to-date information.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Costbook_System SHALL fetch and display data within 2 seconds for up to 100 projects
2. WHEN the Refresh button is clicked, THE Costbook_System SHALL reload all financial data from Supabase
3. THE Costbook_System SHALL display a loading indicator during data fetch operations
4. THE Costbook_System SHALL cache data appropriately to minimize unnecessary database queries
5. WHEN the Performance button is clicked, THE Costbook_System SHALL display query execution times and data statistics

### Requirement 17: CSV Import Functionality

**User Story:** As a financial manager, I want to import commitment and actual data from CSV files, so that I can bulk-load financial information.

#### Acceptance Criteria

1. WHEN the CSV Import button is clicked, THE Costbook_System SHALL open a file upload dialog
2. THE Costbook_System SHALL validate CSV file format and column headers before import
3. WHEN importing commitments, THE Costbook_System SHALL map CSV columns to the commitments table schema
4. WHEN importing actuals, THE Costbook_System SHALL map CSV columns to the actuals table schema
5. THE Costbook_System SHALL display import results showing successful records and any errors
6. WHEN import errors occur, THE Costbook_System SHALL provide detailed error messages with row numbers

### Requirement 18: Component Architecture

**User Story:** As a developer, I want a well-structured component architecture, so that the codebase is maintainable and extensible.

#### Acceptance Criteria

1. THE Costbook_System SHALL be implemented as a Costbook4_0.tsx component
2. THE Costbook_System SHALL be integrated into /app/financials/page.tsx as a tab
3. THE Costbook_System SHALL separate concerns into sub-components for header, projects grid, charts, and footer
4. THE Costbook_System SHALL use TypeScript for type safety
5. THE Costbook_System SHALL follow React best practices including hooks for state management
6. THE Costbook_System SHALL implement proper error boundaries for graceful error handling

### Requirement 19: Collapsible Panels

**User Story:** As a financial manager, I want collapsible panels for Cash Out Forecast and Transaction List, so that I can access detailed information without leaving the main view.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a collapsible Cash Out Forecast panel that opens inline without tab switching
2. THE Costbook_System SHALL provide a collapsible Transaction List panel that opens inline without tab switching
3. WHEN a panel is collapsed, THE Costbook_System SHALL show only a compact header with expand button
4. WHEN a panel is expanded, THE Costbook_System SHALL animate the expansion smoothly
5. THE Costbook_System SHALL allow multiple panels to be open simultaneously
6. THE Costbook_System SHALL persist panel open/closed state during the user session

### Requirement 20: Cash Out Forecast Panel

**User Story:** As a financial manager, I want to see a cash out forecast with a Gantt-style timeline, so that I can plan future expenditures.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a Gantt-style chart showing planned cash outflows over time
2. THE Costbook_System SHALL aggregate cash out data from commitments by po_date and expected payment dates
3. WHEN viewing the forecast, THE Costbook_System SHALL show monthly or weekly time buckets
4. THE Costbook_System SHALL color-code forecast bars by project or vendor
5. THE Costbook_System SHALL support drag-adjust for forecast dates (Phase 2 feature, disabled in Phase 1)
6. THE Costbook_System SHALL support multi-scenario forecasting (Phase 2 feature, disabled in Phase 1)

### Requirement 21: Transaction List Panel

**User Story:** As a financial manager, I want to see a detailed list of all transactions with filtering capabilities, so that I can drill down into specific financial data.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a virtualized table for efficient rendering of large transaction lists
2. THE Costbook_System SHALL combine commitments and actuals into a unified transaction view
3. WHEN displaying transactions, THE Costbook_System SHALL show: date, type (commitment/actual), amount, vendor, PO number, status
4. THE Costbook_System SHALL provide filter controls for: project, vendor, date range, transaction type, status
5. THE Costbook_System SHALL support custom column visibility (user can show/hide columns)
6. THE Costbook_System SHALL support sorting by any visible column
7. THE Costbook_System SHALL join commitments and actuals using po_no for related transaction grouping

### Requirement 22: Hierarchical CES/WBS Tree View

**User Story:** As a financial manager, I want to see costs organized by Cost Element Structure (CES) and Work Breakdown Structure (WBS), so that I can analyze spending by organizational hierarchy.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a collapsible tree view showing CES hierarchy (account_group_level1 → account_subgroup_level2 → account_level3)
2. THE Costbook_System SHALL display a collapsible tree view showing WBS hierarchy (wbs_element breakdown)
3. WHEN expanding a tree node, THE Costbook_System SHALL show aggregated totals for that level
4. THE Costbook_System SHALL allow switching between CES and WBS views
5. WHEN clicking a tree node, THE Costbook_System SHALL filter the transaction list to show only items in that category
6. THE Costbook_System SHALL calculate subtotals at each hierarchy level

### Requirement 23: Responsive Mobile Layout

**User Story:** As a mobile user, I want the Costbook to adapt to smaller screens, so that I can access financial data on any device.

#### Acceptance Criteria

1. WHEN viewport width is below 768px, THE Costbook_System SHALL switch to a single-column layout (grid-cols-1)
2. WHEN on mobile, THE Costbook_System SHALL convert collapsible panels to accordion-style navigation
3. THE Costbook_System SHALL stack KPI badges vertically on mobile with horizontal scroll
4. THE Costbook_System SHALL hide visualization charts behind an expandable section on mobile
5. THE Costbook_System SHALL ensure all touch targets are at least 44x44 pixels
6. THE Costbook_System SHALL support swipe gestures for panel navigation on mobile

### Requirement 24: Contingency Rundown Profile Data Model

**User Story:** Als Finanzmanager möchte ich Rundown-Profile für Contingency-Budgets speichern, damit ich die monatliche Budget-Progression über die Projektlaufzeit verfolgen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL store rundown profiles in a Supabase table `rundown_profiles` with fields: id (uuid), project_id (uuid), month (text YYYYMM), planned_value (numeric), actual_value (numeric), type (text: 'planned' or 'actual'), created_at (timestamp), updated_at (timestamp)
2. THE Costbook_System SHALL enforce a foreign key relationship between rundown_profiles.project_id and projects.id
3. WHEN storing rundown profile values, THE Costbook_System SHALL preserve numeric precision to two decimal places
4. THE Costbook_System SHALL support both 'contingency' and 'total_budget' profile types for future extensibility
5. THE Costbook_System SHALL maintain audit logs for all rundown profile changes in Supabase

### Requirement 25: Planned Rundown Profile Generation

**User Story:** Als Finanzmanager möchte ich automatisch generierte Planned Profiles sehen, die das Original-Budget linear über die Projektlaufzeit verteilen.

#### Acceptance Criteria

1. WHEN generating a planned profile, THE Rundown_Generator SHALL calculate monthly values by linearly distributing the project's original contingency budget from start_date to end_date
2. THE Rundown_Generator SHALL generate monthly entries in YYYYMM format for each month within the project duration
3. WHEN a project has no start_date or end_date, THE Rundown_Generator SHALL skip profile generation and log a warning
4. THE Rundown_Generator SHALL calculate planned_value as: original_budget / total_months for each month
5. FOR ALL valid projects, generating then reading the planned profile SHALL produce values that sum to the original budget (round-trip property)

### Requirement 26: Actual Rundown Profile Generation

**User Story:** Als Finanzmanager möchte ich Actual Profiles sehen, die durch approved Changes aus Commitments und Actuals angepasst werden.

#### Acceptance Criteria

1. WHEN generating an actual profile, THE Rundown_Generator SHALL start with the planned profile values
2. WHEN approved changes exist, THE Rundown_Generator SHALL adjust the actual profile values starting from the change month
3. THE Rundown_Generator SHALL aggregate change amounts from commitments and actuals tables by posting month
4. WHEN calculating actual values, THE Rundown_Generator SHALL subtract consumed budget from remaining planned values
5. THE Rundown_Generator SHALL recalculate remaining months proportionally when changes occur

### Requirement 27: Rundown Profile API Endpoints

**User Story:** Als Entwickler möchte ich API-Endpoints für die Rundown-Profile-Generierung, damit ich Profile manuell oder automatisch generieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a FastAPI endpoint POST `/api/rundown/generate` to trigger profile generation
2. WHEN the generate endpoint is called, THE Rundown_Generator SHALL fetch all active projects and generate profiles
3. THE Rundown_Generator SHALL overwrite existing profiles for a project when regenerating (idempotent operation)
4. WHEN profile generation completes, THE API SHALL return a summary with: projects_processed, profiles_created, errors
5. IF an error occurs during generation, THEN THE API SHALL log the error with project context and continue with remaining projects
6. THE API SHALL support an optional project_id parameter to generate profiles for a single project

### Requirement 28: Automated Daily Profile Generation

**User Story:** Als Finanzmanager möchte ich, dass Rundown-Profile täglich automatisch aktualisiert werden, damit ich immer aktuelle Daten sehe.

#### Acceptance Criteria

1. THE Costbook_System SHALL execute a daily cron job to regenerate all rundown profiles
2. THE Cron_Job SHALL run at a configurable time (default: 02:00 UTC)
3. WHEN the cron job runs, THE Rundown_Generator SHALL process all active projects
4. THE Cron_Job SHALL log execution start, completion, and any errors to Supabase
5. IF the cron job fails, THEN THE Costbook_System SHALL send an alert notification

### Requirement 29: Rundown Profile Sparkline Visualization

**User Story:** Als Finanzmanager möchte ich Sparkline-Visualisierungen der Rundown-Profile in den Project Cards sehen, damit ich Budget-Trends auf einen Blick erkennen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a Sparkline chart in each Project Card showing planned vs actual rundown profiles
2. THE Sparkline SHALL use Recharts LineChart with minimal styling (no axes, no labels)
3. WHEN rendering the Sparkline, THE Costbook_System SHALL show planned values as a dashed line and actual values as a solid line
4. THE Sparkline SHALL highlight the current month with a vertical indicator
5. WHEN hovering over the Sparkline, THE Costbook_System SHALL display a tooltip with month, planned value, and actual value
6. THE Costbook_System SHALL apply color coding: green when actual <= planned, red when actual > planned

### Requirement 30: AI-Powered Trend Prediction

**User Story:** Als Finanzmanager möchte ich AI-basierte Vorhersagen für zukünftige Monate sehen, damit ich proaktiv Budget-Risiken erkennen kann.

#### Acceptance Criteria

1. WHEN displaying future months, THE Prediction_Engine SHALL calculate predicted values based on historical trends
2. THE Prediction_Engine SHALL use linear regression on the last 6 months of actual data for trend calculation
3. THE Sparkline SHALL display predicted values as a dotted line extending beyond the current month
4. WHEN the predicted trend exceeds the planned budget, THE Costbook_System SHALL highlight the project card with a warning indicator
5. THE Prediction_Engine SHALL recalculate predictions whenever new actual data is available

### Requirement 31: Real-Time Profile Updates

**User Story:** Als Finanzmanager möchte ich, dass Profile automatisch aktualisiert werden, wenn sich Daten ändern, damit ich immer aktuelle Informationen sehe.

#### Acceptance Criteria

1. WHEN commitment or actual data changes, THE Costbook_System SHALL trigger a profile regeneration for the affected project
2. THE Real_Time_Trigger SHALL use Supabase database triggers to detect data changes
3. THE Profile_Update SHALL complete within 5 seconds of the triggering change
4. THE Costbook_System SHALL display a subtle refresh indicator when profiles are being updated
5. THE Real_Time_Trigger SHALL debounce multiple rapid changes to prevent excessive regeneration

### Requirement 32: Multi-Scenario Rundown Support

**User Story:** Als Finanzmanager möchte ich verschiedene Szenarien für Rundown-Profile vergleichen können, damit ich Budget-Entscheidungen besser treffen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL support multiple named scenarios for rundown profiles (e.g., 'baseline', 'optimistic', 'pessimistic')
2. WHEN creating a scenario, THE Costbook_System SHALL allow adjustment of planned values by percentage or absolute amount
3. THE Sparkline SHALL support toggling between different scenarios
4. THE Costbook_System SHALL persist scenarios to Supabase with user attribution
5. WHEN comparing scenarios, THE Costbook_System SHALL display a comparison view with all selected scenarios overlaid

### Requirement 33: Unified No-Scroll Layout

**User Story:** Als Finanzmanager möchte ich alle wichtigen Informationen auf einem Bildschirm ohne Scrollen sehen, damit ich schnell einen Überblick über die finanzielle Situation erhalte.

#### Acceptance Criteria

1. THE Costbook_System SHALL render within a h-screen overflow-hidden container
2. THE Costbook_System SHALL use a grid layout with rows: auto (header), 1fr (main), auto (footer)
3. THE Costbook_System SHALL maintain max-w-7xl mx-auto p-3 styling for consistent width
4. WHEN the dashboard loads, THE Costbook_System SHALL display all content without requiring vertical scrolling on standard desktop screens (1920x1080)
5. THE Costbook_System SHALL use gap-3 between major layout sections

### Requirement 34: Collapsible Panels for Inline Features

**User Story:** Als Finanzmanager möchte ich zusätzliche Details in collapsible Panels sehen können, damit ich ohne Tab-Wechsel auf detaillierte Informationen zugreifen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide collapsible panels for Cash Out Forecast, Transaction List, and CES/WBS Tree
2. WHEN a panel is collapsed, THE Costbook_System SHALL show only a compact header with expand button
3. WHEN a panel is expanded, THE Costbook_System SHALL animate the expansion smoothly with transition-all duration-300
4. THE Costbook_System SHALL allow multiple panels to be open simultaneously
5. THE Costbook_System SHALL persist panel open/closed state during the user session
6. WHEN panels open, THE Costbook_System SHALL open inline without tab switching

### Requirement 35: Hierarchical CES/WBS Tree View with Inline Calculations

**User Story:** Als Finanzmanager möchte ich Kosten nach CES und WBS hierarchisch organisiert sehen, damit ich Ausgaben nach organisatorischer Struktur analysieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a collapsible tree view showing CES hierarchy (account_group_level1 → account_subgroup_level2 → account_level3)
2. THE Costbook_System SHALL display a collapsible tree view showing WBS hierarchy (wbs_element breakdown)
3. WHEN expanding a tree node, THE Costbook_System SHALL show aggregated totals for that level
4. THE Costbook_System SHALL allow switching between CES and WBS views
5. WHEN clicking a tree node, THE Costbook_System SHALL filter the transaction list to show only items in that category
6. THE Costbook_System SHALL calculate subtotals at each hierarchy level
7. THE Costbook_System SHALL support inline calculations and adjustments within the tree view

### Requirement 36: AI-Powered Import Builder

**User Story:** Als Finanzmanager möchte ich einen intelligenten Import Builder mit Auto-Mapping und Smart Suggestions, damit ich CSV-Daten schnell und fehlerfrei importieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide an AI-powered Import Builder with auto-mapping capabilities
2. WHEN a CSV file is uploaded, THE Import_Builder SHALL automatically detect and map columns to database schema fields
3. THE Import_Builder SHALL provide smart suggestions for ambiguous column mappings
4. THE Import_Builder SHALL display a preview of mapped data before import
5. THE Import_Builder SHALL validate data and show detailed errors with row numbers
6. THE Import_Builder SHALL support saving mapping templates for reuse
7. THE Import_Builder SHALL support template sharing between users (Phase 3)

### Requirement 37: Natural Language Search in Header

**User Story:** Als Finanzmanager möchte ich mit natürlicher Sprache nach Projekten suchen können, damit ich schnell relevante Informationen finde.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a natural language search input field in the header
2. WHEN a user enters a natural language query, THE Costbook_System SHALL parse the intent and parameters
3. THE Costbook_System SHALL support queries like "show projects over budget", "find projects with high variance", "vendor X projects"
4. THE Costbook_System SHALL filter and display projects matching the search criteria
5. WHEN no results match the query, THE Costbook_System SHALL display helpful suggestions
6. THE Costbook_System SHALL highlight matched terms in search results

### Requirement 38: Smart Recommendations Card

**User Story:** Als Finanzmanager möchte ich AI-gestützte Empfehlungen in einer kleinen Card sehen, damit ich proaktiv auf Budget-Probleme reagieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a small recommendations card with AI-powered suggestions
2. WHEN recommendations are available, THE Costbook_System SHALL show them in a non-intrusive card
3. THE Costbook_System SHALL provide actionable recommendations such as budget reallocation or vendor changes
4. WHEN a user clicks on a recommendation, THE Costbook_System SHALL show supporting data and rationale
5. THE Costbook_System SHALL allow users to accept, reject, or defer recommendations
6. THE Costbook_System SHALL learn from user feedback to improve future recommendations (Phase 3)

### Requirement 39: Cash Out Forecast with Drag-Adjust and Multi-Scenario

**User Story:** Als Finanzmanager möchte ich Cash Out Forecasts mit Drag-Adjust und Multi-Scenario-Unterstützung sehen, damit ich verschiedene Zahlungsszenarien planen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL display a Gantt-style Cash Out Forecast chart
2. WHEN in Phase 2, THE Costbook_System SHALL enable drag-and-drop for forecast bars to adjust dates
3. THE Costbook_System SHALL support creating multiple forecast scenarios
4. WHEN a forecast date is adjusted, THE Costbook_System SHALL update the database and recalculate totals
5. THE Costbook_System SHALL allow switching between different forecast scenarios
6. THE Costbook_System SHALL persist scenario changes to Supabase with user attribution

### Requirement 40: EVM Metrics Integration

**User Story:** Als Projekt-Controller möchte ich EVM-Metriken (CPI/SPI/TCPI) in Gauge-Anzeigen sehen, damit ich Projektleistung gegen Zeitplan und Budget messen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL calculate and display CPI (Cost Performance Index) as earned value / actual cost
2. THE Costbook_System SHALL calculate and display SPI (Schedule Performance Index) as earned value / planned value
3. THE Costbook_System SHALL calculate and display TCPI (To-Complete Performance Index)
4. THE Costbook_System SHALL display EVM metrics in gauge visualizations
5. WHEN displaying EVM metrics, THE Costbook_System SHALL apply color coding (green >= 1.0, yellow 0.8-1.0, red < 0.8)
6. THE Costbook_System SHALL provide trend charts for CPI and SPI over time

### Requirement 41: Collaborative Comments with Inline Display

**User Story:** Als Team-Mitglied möchte ich Kommentare inline in Cards hinzufügen können, damit ich mit Kollegen über finanzielle Entscheidungen zusammenarbeiten kann.

#### Acceptance Criteria

1. WHEN viewing a project card, THE Costbook_System SHALL provide an option to add comments inline
2. THE Costbook_System SHALL store comments with timestamp, author, and project association
3. WHEN comments exist for a project, THE Costbook_System SHALL display a comment indicator on the project card
4. THE Costbook_System SHALL allow users to view, edit, and delete their own comments
5. THE Costbook_System SHALL display comments in chronological order with author attribution
6. THE Costbook_System SHALL support @mentions for notifying other users (Phase 3)

### Requirement 42: Vendor Score Card with Performance Metrics

**User Story:** Als Procurement Manager möchte ich Vendor Score Cards mit Leistungsmetriken sehen, damit ich fundierte Entscheidungen über Lieferantenauswahl treffen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL calculate vendor scores based on delivery performance and cost accuracy
2. WHEN accessing the Vendor Score feature, THE Costbook_System SHALL display a list of vendors with scores
3. THE Costbook_System SHALL show detailed metrics for each vendor including on-time delivery rate and cost variance
4. WHEN a user clicks on a vendor, THE Costbook_System SHALL display historical performance data
5. THE Costbook_System SHALL allow filtering and sorting vendors by score or other criteria
6. THE Costbook_System SHALL provide trend analysis for vendor performance over time

### Requirement 43: Voice Control Integration

**User Story:** Als Finanzmanager möchte ich Voice Control nutzen können, damit ich hands-free durch das Dashboard navigieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL integrate Web Speech API for voice control (Phase 3)
2. WHEN voice control is enabled, THE Costbook_System SHALL listen for voice commands
3. THE Costbook_System SHALL support commands like "show project X", "filter by vendor Y", "refresh data"
4. WHEN a voice command is recognized, THE Costbook_System SHALL execute the corresponding action
5. THE Costbook_System SHALL provide visual feedback for recognized commands
6. THE Costbook_System SHALL support multiple languages for voice commands

### Requirement 44: Gamification Badges

**User Story:** Als Finanzmanager möchte ich Gamification-Badges für erreichte Meilensteine sehen, damit ich motiviert bleibe und Best Practices befolge.

#### Acceptance Criteria

1. THE Costbook_System SHALL award badges for achievements like "Budget Master", "Variance Hunter", "Data Quality Champion" (Phase 3)
2. WHEN a user achieves a milestone, THE Costbook_System SHALL display a badge notification
3. THE Costbook_System SHALL store earned badges in user profile
4. WHEN viewing user profile, THE Costbook_System SHALL display all earned badges
5. THE Costbook_System SHALL provide a leaderboard showing top badge earners
6. THE Costbook_System SHALL define clear criteria for each badge

### Requirement 45: Template Sharing in Import Builder

**User Story:** Als Finanzmanager möchte ich Import-Templates mit anderen Nutzern teilen können, damit das Team konsistente Datenimporte durchführen kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL allow users to save import mapping templates (Phase 3)
2. WHEN a template is saved, THE Costbook_System SHALL allow the user to mark it as shareable
3. THE Costbook_System SHALL provide a template library showing available templates
4. WHEN a user selects a shared template, THE Costbook_System SHALL apply the mapping to their import
5. THE Costbook_System SHALL track template usage statistics
6. THE Costbook_System SHALL allow template owners to update or revoke shared templates

### Requirement 46: Supabase Integration with Joins

**User Story:** Als Entwickler möchte ich effiziente Supabase-Queries mit Joins verwenden, damit die Datenabfrage performant ist.

#### Acceptance Criteria

1. THE Costbook_System SHALL use Supabase joins to aggregate commitments and actuals by project_id
2. THE Costbook_System SHALL use Supabase joins to relate transactions by po_no
3. WHEN querying financial data, THE Costbook_System SHALL minimize the number of database queries
4. THE Costbook_System SHALL use Supabase RPC functions for complex aggregations
5. THE Costbook_System SHALL implement proper error handling for database queries
6. THE Costbook_System SHALL use connection pooling for optimal performance

### Requirement 47: React Query for Data Fetching

**User Story:** Als Entwickler möchte ich react-query für Data-Fetching mit Caching verwenden, damit die Anwendung schnell und responsive ist.

#### Acceptance Criteria

1. THE Costbook_System SHALL use react-query (TanStack Query) for all data fetching operations
2. THE Costbook_System SHALL configure appropriate stale time and cache time for queries
3. WHEN data is fetched, THE Costbook_System SHALL cache results to minimize redundant requests
4. THE Costbook_System SHALL implement automatic refetching on window focus
5. THE Costbook_System SHALL provide loading and error states through react-query hooks
6. THE Costbook_System SHALL use query invalidation for data mutations

### Requirement 48: Recharts for Visualizations

**User Story:** Als Entwickler möchte ich Recharts für alle Visualisierungen verwenden, damit die Charts konsistent und performant sind.

#### Acceptance Criteria

1. THE Costbook_System SHALL use Recharts library for all chart visualizations
2. THE Costbook_System SHALL use BarChart for Variance Waterfall
3. THE Costbook_System SHALL use ScatterChart for Health Bubble Chart
4. THE Costbook_System SHALL use LineChart for Trend Sparkline and Rundown Sparkline
5. THE Costbook_System SHALL apply consistent color schemes across all charts
6. THE Costbook_System SHALL implement responsive chart sizing

### Requirement 49: Lucide React Icons

**User Story:** Als Entwickler möchte ich lucide-react für alle Icons verwenden, damit das UI konsistent und modern aussieht.

#### Acceptance Criteria

1. THE Costbook_System SHALL use lucide-react library for all icon components
2. THE Costbook_System SHALL use consistent icon sizes across the application
3. THE Costbook_System SHALL apply appropriate icon colors based on context
4. THE Costbook_System SHALL use semantic icon names for clarity
5. THE Costbook_System SHALL implement icon tooltips for better UX

### Requirement 50: React DnD for Draggable Elements

**User Story:** Als Entwickler möchte ich react-dnd für Drag-and-Drop-Funktionalität verwenden, damit Nutzer interaktiv Forecasts anpassen können.

#### Acceptance Criteria

1. THE Costbook_System SHALL use react-dnd library for drag-and-drop functionality (Phase 2)
2. THE Costbook_System SHALL implement draggable forecast bars in Cash Out Gantt
3. WHEN a forecast bar is dragged, THE Costbook_System SHALL provide visual feedback
4. WHEN a forecast bar is dropped, THE Costbook_System SHALL update the database
5. THE Costbook_System SHALL implement drag constraints to prevent invalid dates

### Requirement 51: Suspense for Loading States

**User Story:** Als Entwickler möchte ich React Suspense für Loading States verwenden, damit die Anwendung moderne Loading-Patterns nutzt.

#### Acceptance Criteria

1. THE Costbook_System SHALL use React Suspense for component-level loading states
2. THE Costbook_System SHALL provide fallback components for Suspense boundaries
3. WHEN data is loading, THE Costbook_System SHALL display appropriate loading indicators
4. THE Costbook_System SHALL implement error boundaries alongside Suspense
5. THE Costbook_System SHALL use Suspense with react-query for optimal loading UX

### Requirement 52: Phase-Based Feature Delivery

**User Story:** Als Product Owner möchte ich Features in drei Phasen ausliefern, damit wir iterativ Wert liefern und Feedback einarbeiten können.

#### Acceptance Criteria

1. THE Costbook_System SHALL deliver Phase 1 (Basis) with core financial tracking and visualizations
2. THE Costbook_System SHALL deliver Phase 2 (AI & Interaktivität) with anomaly detection, NL search, and smart recommendations
3. THE Costbook_System SHALL deliver Phase 3 (Erweitert) with EVM, collaboration, and gamification
4. WHEN a phase is not yet implemented, THE Costbook_System SHALL disable corresponding UI elements
5. THE Costbook_System SHALL clearly document which features belong to which phase
6. THE Costbook_System SHALL ensure each phase is fully functional and testable before moving to the next

### Requirement 53: Distribution Settings for Cash Out Forecast (Phase 2)

**User Story:** Als Finanzmanager möchte ich Distribution Settings für die Planung von Cash Out Forecasts konfigurieren, damit ich verschiedene Budget-Verteilungsszenarien analysieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL provide a Distribution Settings modal dialog for configuring forecast distributions
2. WHEN configuring distribution settings, THE Costbook_System SHALL support three profile types: Linear, Custom, and AI-generated
3. THE Costbook_System SHALL allow users to specify duration (start date and end date) for distributions
4. THE Costbook_System SHALL support two granularity options: Weekly and Monthly
5. WHEN Linear profile is selected, THE Costbook_System SHALL distribute budget evenly across the duration
6. WHEN Custom profile is selected, THE Costbook_System SHALL allow manual adjustment of distribution percentages
7. WHEN AI-generated profile is selected, THE Costbook_System SHALL use historical patterns to suggest optimal distributions
8. THE Costbook_System SHALL validate that distribution percentages sum to 100%
9. THE Costbook_System SHALL persist distribution settings to the database
10. THE Costbook_System SHALL display a preview of the calculated distribution before applying

### Requirement 54: Distribution Rules Engine (Phase 3)

**User Story:** Als Finanzmanager möchte ich einen Distribution Rules Engine verwenden, der automatisch Budget-Verteilungen basierend auf Regeln und AI anpasst, damit ich proaktiv Forecasts optimieren kann.

#### Acceptance Criteria

1. THE Costbook_System SHALL implement a Distribution Rules Engine with three rule types: Automatic, Reprofiling, and AI Generator
2. WHEN Automatic rule type is selected, THE Costbook_System SHALL distribute budget linearly based on project duration
3. WHEN Reprofiling rule type is selected, THE Costbook_System SHALL adjust planned distributions based on actual commitments and actuals
4. WHEN AI Generator rule type is selected, THE Costbook_System SHALL use machine learning to predict optimal distribution patterns
5. THE Costbook_System SHALL allow users to create, save, and apply distribution rules to projects
6. THE Costbook_System SHALL support rule-based automation triggers when financial data changes
7. WHEN a distribution rule is applied, THE Costbook_System SHALL update the Cash Out Forecast automatically
8. THE Costbook_System SHALL provide a rule management interface for viewing, editing, and deleting rules
9. THE Costbook_System SHALL log all rule applications for audit purposes
10. THE Costbook_System SHALL allow users to preview rule impact before applying
