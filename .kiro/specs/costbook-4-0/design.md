# Design Document: Costbook

## Overview

Costbook is a React-based financial management dashboard that provides real-time visibility into project budgets, commitments, and actuals. The system integrates with Supabase for data persistence and uses Recharts for data visualization. The architecture follows a component-based design with clear separation between data fetching, business logic, and presentation layers.

The implementation uses Next.js with TypeScript, Tailwind CSS for styling, and follows React best practices including hooks for state management. The dashboard is designed as a no-scroll interface that fits all key information on a single screen, with scrolling only within the projects grid when necessary.

### Key Design Principles

1. **Performance First**: Minimize database queries through efficient joins and aggregations
2. **Type Safety**: Leverage TypeScript for compile-time error detection
3. **Responsive Design**: Adapt layout for different screen sizes while maintaining usability
4. **Extensibility**: Design for future phases (AI features, EVM, collaboration)
5. **Real-time Data**: Provide refresh capabilities for up-to-date financial information

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Financials Page                          │
│                  (/app/financials/page.tsx)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Tab Navigation                           │  │
│  │  [Overview] [Costbook] [Invoices] [Reports]          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Costbook4_0 Component                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Header (KPIs, Currency Selector, Actions)      │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │  Main Content                                   │  │  │
│  │  │  ┌──────────────┬──────────────────────────┐   │  │  │
│  │  │  │ Projects     │  Visualizations          │   │  │  │
│  │  │  │ Grid         │  - Variance Waterfall    │   │  │  │
│  │  │  │ (Scrollable) │  - Health Bubble Chart   │   │  │  │
│  │  │  │              │  - Trend Sparkline       │   │  │  │
│  │  │  └──────────────┴──────────────────────────┘   │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │  Footer (Action Buttons)                        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Supabase Client │
                  └──────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼           ▼           ▼
          ┌─────────┐ ┌──────────┐ ┌─────────┐
          │Projects │ │Commitments│ │Actuals  │
          │ Table   │ │  Table    │ │ Table   │
          └─────────┘ └──────────┘ └─────────┘
```

### Data Flow

1. **Initial Load**: Component mounts → fetch projects with aggregated commitments/actuals → calculate KPIs → render UI
2. **Currency Change**: User selects currency → convert all values → re-render
3. **Refresh**: User clicks refresh → re-fetch data → recalculate → update UI
4. **Hover Interaction**: User hovers project card → show additional details

### Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 3+
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts 2+
- **State Management**: React hooks (useState, useEffect, useMemo)
- **Data Fetching**: react-query (TanStack Query) for caching and automatic refetching
- **Drag & Drop**: react-dnd for draggable elements (Phase 2)
- **Virtualization**: @tanstack/react-virtual for large lists

## Components and Interfaces

### Component Hierarchy

```
Costbook4_0
├── CostbookHeader
│   ├── CurrencySelector
│   ├── KPIBadges
│   └── ActionButtons
├── CostbookMain
│   ├── ProjectsGrid
│   │   └── ProjectCard (multiple instances)
│   ├── VisualizationPanel
│   │   ├── VarianceWaterfall
│   │   ├── HealthBubbleChart
│   │   └── TrendSparkline
│   ├── CollapsiblePanel (Cash Out Forecast)
│   │   └── CashOutGantt
│   ├── CollapsiblePanel (Transaction List)
│   │   ├── TransactionFilters
│   │   └── VirtualizedTransactionTable
│   └── CollapsiblePanel (CES/WBS Tree)
│       └── HierarchyTreeView
└── CostbookFooter
    └── FooterActionButtons
```

### Core Component: Costbook4_0

**Purpose**: Main container component that orchestrates data fetching, state management, and layout.

**Props**: None (top-level component)

**State**:
```typescript
interface CostbookState {
  projects: ProjectWithFinancials[];
  selectedCurrency: Currency;
  isLoading: boolean;
  error: Error | null;
  lastRefreshTime: Date | null;
}
```

**Key Methods**:
- `fetchProjectData()`: Fetches projects with aggregated financial data
- `handleCurrencyChange(currency: Currency)`: Updates selected currency and converts values
- `handleRefresh()`: Re-fetches all data from Supabase
- `calculateKPIs()`: Computes aggregate metrics across all projects

### Component: CostbookHeader

**Purpose**: Displays title, currency selector, KPI badges, and action buttons.

**Props**:
```typescript
interface CostbookHeaderProps {
  kpis: KPIMetrics;
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  onRefresh: () => void;
  onPerformance: () => void;
  onHelp: () => void;
}
```

**Layout**: `flex justify-between items-center`

### Component: KPIBadges

**Purpose**: Displays aggregate financial metrics as badges.

**Props**:
```typescript
interface KPIBadgesProps {
  totalBudget: number;
  totalCommitments: number;
  totalActuals: number;
  totalSpend: number;
  netVariance: number;
  overCount: number;
  underCount: number;
  currency: Currency;
}
```

**Rendering Logic**:
- Each KPI is a badge with label and value
- Net Variance uses conditional styling: `text-green-600` if positive, `text-red-600` if negative
- Values formatted with currency symbol and 2 decimal places

### Component: ProjectsGrid

**Purpose**: Displays scrollable grid of project cards.

**Props**:
```typescript
interface ProjectsGridProps {
  projects: ProjectWithFinancials[];
  currency: Currency;
  onProjectClick?: (projectId: string) => void;
}
```

**Layout**: 
- Container: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-220px)] overflow-y-auto`
- Grid items: `minmax(250px, 1fr)`

### Component: ProjectCard

**Purpose**: Displays individual project financial summary.

**Props**:
```typescript
interface ProjectCardProps {
  project: ProjectWithFinancials;
  currency: Currency;
  onHover?: (project: ProjectWithFinancials) => void;
}
```

**Content Structure**:
```
┌─────────────────────────────────┐
│ Project Name          [Status●] │
│─────────────────────────────────│
│ Budget:       $XXX,XXX.XX       │
│ Commitments:  $XXX,XXX.XX       │
│ Actuals:      $XXX,XXX.XX       │
│ Total Spend:  $XXX,XXX.XX       │
│ Variance:     $XXX,XXX.XX       │
│─────────────────────────────────│
│ [Progress Bar ████░░░░░] XX%    │
└─────────────────────────────────┘
```

**Styling**:
- Card: `bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow`
- Status dot: Color-coded based on project status (green/yellow/red)
- Variance: Color-coded (green if positive, red if negative)
- Progress bar: Visual representation of spend vs budget

### Component: VisualizationPanel

**Purpose**: Container for three visualization charts.

**Props**:
```typescript
interface VisualizationPanelProps {
  projects: ProjectWithFinancials[];
  currency: Currency;
}
```

**Layout**: `flex flex-col gap-3 h-full`
- Each chart occupies `h-1/3`

### Component: VarianceWaterfall

**Purpose**: Waterfall chart showing budget breakdown.

**Props**:
```typescript
interface VarianceWaterfallProps {
  totalBudget: number;
  totalCommitments: number;
  totalActuals: number;
  variance: number;
  currency: Currency;
}
```

**Chart Configuration**:
- Library: Recharts BarChart
- Data points: Budget (starting), Commitments (decrease), Actuals (decrease), Variance (ending)
- Colors: Blue for budget, orange for commitments, red for actuals, green/red for variance

### Component: HealthBubbleChart

**Purpose**: Scatter plot showing project health vs variance.

**Props**:
```typescript
interface HealthBubbleChartProps {
  projects: ProjectWithFinancials[];
  currency: Currency;
}
```

**Chart Configuration**:
- Library: Recharts ScatterChart
- X-axis: Variance (negative to positive)
- Y-axis: Health score (0-100)
- Bubble size: Total spend magnitude
- Color: Status-based (green/yellow/red)

### Component: TrendSparkline

**Purpose**: Line chart showing spending trends over time.

**Props**:
```typescript
interface TrendSparklineProps {
  projects: ProjectWithFinancials[];
  currency: Currency;
}
```

**Chart Configuration**:
- Library: Recharts LineChart
- X-axis: Time periods (weeks/months)
- Y-axis: Cumulative spend
- Multiple lines: One per project or aggregate trend
- Minimal styling (sparkline aesthetic)

### Component: CostbookFooter

**Purpose**: Displays action buttons for additional features.

**Props**:
```typescript
interface CostbookFooterProps {
  onScenarios: () => void;
  onResources: () => void;
  onReports: () => void;
  onPOBreakdown: () => void;
  onCSVImport: () => void;
  onForecast: () => void;
  onVendorScore: () => void;
  onSettings: () => void;
}
```

**Layout**: `flex gap-4 justify-center items-center`

**Button Structure**: Icon + Tooltip on hover

### Component: CollapsiblePanel

**Purpose**: Generic collapsible container for inline panels (Cash Out Forecast, Transaction List, CES/WBS Tree).

**Props**:
```typescript
interface CollapsiblePanelProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  defaultHeight?: string; // e.g., 'h-64', 'h-96'
}
```

**Layout**:
- Collapsed: `flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100`
- Expanded: `transition-all duration-300 ease-in-out overflow-hidden`

**Animation**: Smooth height transition using CSS transitions

### Component: CashOutGantt

**Purpose**: Gantt-style chart showing planned cash outflows over time.

**Props**:
```typescript
interface CashOutGanttProps {
  commitments: Commitment[];
  projects: Project[];
  currency: Currency;
  timeRange: 'weekly' | 'monthly';
  onDateChange?: (commitmentId: string, newDate: Date) => void; // Phase 2
}
```

**Chart Configuration**:
- Library: Recharts BarChart (horizontal)
- X-axis: Time periods (weeks/months)
- Y-axis: Projects or vendors
- Bars: Cash outflow amounts, color-coded by project
- Drag-adjust: Disabled in Phase 1, enabled in Phase 2 with react-dnd

### Component: VirtualizedTransactionTable

**Purpose**: Efficiently render large lists of transactions using virtualization.

**Props**:
```typescript
interface VirtualizedTransactionTableProps {
  transactions: Transaction[];
  currency: Currency;
  visibleColumns: string[];
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  onRowClick?: (transaction: Transaction) => void;
}

interface Transaction {
  id: string;
  type: 'commitment' | 'actual';
  date: string;
  amount: number;
  vendor: string;
  po_number: string;
  status: string;
  project_id: string;
  project_name: string;
  // Additional fields from commitments/actuals
}
```

**Implementation**:
- Library: @tanstack/react-virtual for row virtualization
- Row height: Fixed 48px for consistent virtualization
- Visible rows: Calculate based on container height
- Overscan: 5 rows above and below viewport

### Component: TransactionFilters

**Purpose**: Filter controls for the transaction list.

**Props**:
```typescript
interface TransactionFiltersProps {
  projects: Project[];
  vendors: string[];
  filters: TransactionFilters;
  onFilterChange: (filters: TransactionFilters) => void;
}

interface TransactionFilters {
  projectId?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: 'commitment' | 'actual' | 'all';
  status?: string;
}
```

**Layout**: `flex flex-wrap gap-2 p-2 bg-gray-50 rounded`

### Component: HierarchyTreeView

**Purpose**: Collapsible tree view for CES (Cost Element Structure) and WBS (Work Breakdown Structure).

**Props**:
```typescript
interface HierarchyTreeViewProps {
  data: HierarchyNode[];
  viewType: 'ces' | 'wbs';
  currency: Currency;
  onNodeSelect: (nodeId: string) => void;
  selectedNodeId?: string;
}

interface HierarchyNode {
  id: string;
  label: string;
  total: number;
  children?: HierarchyNode[];
  level: number;
}
```

**Layout**:
- Tree structure with indentation based on level
- Expand/collapse icons for nodes with children
- Totals displayed inline with each node
- Selected node highlighted

### Component: MobileAccordion

**Purpose**: Mobile-specific accordion layout for panels.

**Props**:
```typescript
interface MobileAccordionProps {
  sections: AccordionSection[];
  allowMultiple?: boolean;
}

interface AccordionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}
```

**Layout**: 
- Full-width sections stacked vertically
- Touch-friendly expand/collapse buttons (min 44x44px)
- Swipe gesture support for navigation

## Data Models

### TypeScript Interfaces

```typescript
// Database table types
interface Project {
  id: string;
  budget: number;
  health: number; // 0-100 score
  name: string;
  status: ProjectStatus;
  start_date: string; // ISO date
  end_date: string; // ISO date
}

interface Commitment {
  id: string;
  project_id: string;
  total_amount: number;
  po_number: string;
  po_status: POStatus;
  vendor: string;
  currency: string;
  po_date: string;
  po_line_nr: string;
  po_line_text: string;
  vendor_description: string;
  requester: string;
  cost_center: string;
  wbs_element: string;
  account_group_level1: string;
  account_subgroup_level2: string;
  account_level3: string;
  custom_fields: Record<string, any>;
}

interface Actual {
  id: string;
  project_id: string;
  amount: number;
  po_no: string;
  vendor_invoice_no: string;
  posting_date: string;
  status: ActualStatus;
  currency: string;
  vendor: string;
  vendor_description: string;
  gl_account: string;
  cost_center: string;
  wbs_element: string;
  item_text: string;
  quantity: number;
  net_due_date: string;
  custom_fields: Record<string, any>;
}

// Computed types
interface ProjectWithFinancials extends Project {
  commitments_total: number;
  actuals_total: number;
  total_spend: number;
  variance: number;
  spend_percentage: number; // (total_spend / budget) * 100
}

interface KPIMetrics {
  total_budget: number;
  total_commitments: number;
  total_actuals: number;
  total_spend: number;
  net_variance: number;
  over_count: number; // Projects over budget
  under_count: number; // Projects under budget
}

// Enums
enum ProjectStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

enum POStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  ISSUED = 'issued',
  CLOSED = 'closed'
}

enum ActualStatus {
  PENDING = 'pending',
  POSTED = 'posted',
  CLEARED = 'cleared'
}

enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY'
}
```

### Database Queries

#### Query 1: Fetch Projects with Aggregated Financials

```typescript
async function fetchProjectsWithFinancials(): Promise<ProjectWithFinancials[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      commitments:commitments(total_amount),
      actuals:actuals(amount)
    `);

  if (error) throw error;

  return data.map(project => ({
    ...project,
    commitments_total: project.commitments.reduce((sum, c) => sum + c.total_amount, 0),
    actuals_total: project.actuals.reduce((sum, a) => sum + a.amount, 0),
    total_spend: 0, // Calculated below
    variance: 0, // Calculated below
    spend_percentage: 0 // Calculated below
  })).map(project => {
    const total_spend = project.commitments_total + project.actuals_total;
    const variance = project.budget - total_spend;
    const spend_percentage = project.budget > 0 ? (total_spend / project.budget) * 100 : 0;
    
    return {
      ...project,
      total_spend,
      variance,
      spend_percentage
    };
  });
}
```

#### Query 2: Fetch Commitments for a Project

```typescript
async function fetchCommitmentsByProject(projectId: string): Promise<Commitment[]> {
  const { data, error } = await supabase
    .from('commitments')
    .select('*')
    .eq('project_id', projectId)
    .order('po_date', { ascending: false });

  if (error) throw error;
  return data;
}
```

#### Query 3: Fetch Actuals for a Project

```typescript
async function fetchActualsByProject(projectId: string): Promise<Actual[]> {
  const { data, error } = await supabase
    .from('actuals')
    .select('*')
    .eq('project_id', projectId)
    .order('posting_date', { ascending: false });

  if (error) throw error;
  return data;
}
```

#### Query 4: Fetch Transactions with PO Join

```typescript
// Join commitments and actuals by po_no for related transaction grouping
async function fetchTransactionsWithPOJoin(projectId?: string): Promise<Transaction[]> {
  // Fetch commitments
  let commitmentsQuery = supabase
    .from('commitments')
    .select('*, projects!inner(name)');
  
  if (projectId) {
    commitmentsQuery = commitmentsQuery.eq('project_id', projectId);
  }
  
  const { data: commitments, error: commitmentsError } = await commitmentsQuery;
  if (commitmentsError) throw commitmentsError;

  // Fetch actuals
  let actualsQuery = supabase
    .from('actuals')
    .select('*, projects!inner(name)');
  
  if (projectId) {
    actualsQuery = actualsQuery.eq('project_id', projectId);
  }
  
  const { data: actuals, error: actualsError } = await actualsQuery;
  if (actualsError) throw actualsError;

  // Transform to unified Transaction format
  const commitmentTransactions: Transaction[] = commitments.map(c => ({
    id: c.id,
    type: 'commitment' as const,
    date: c.po_date,
    amount: c.total_amount,
    vendor: c.vendor,
    po_number: c.po_number,
    status: c.po_status,
    project_id: c.project_id,
    project_name: c.projects.name,
    cost_center: c.cost_center,
    wbs_element: c.wbs_element,
    account_group_level1: c.account_group_level1,
    account_subgroup_level2: c.account_subgroup_level2,
    account_level3: c.account_level3
  }));

  const actualTransactions: Transaction[] = actuals.map(a => ({
    id: a.id,
    type: 'actual' as const,
    date: a.posting_date,
    amount: a.amount,
    vendor: a.vendor,
    po_number: a.po_no, // Join key with commitments
    status: a.status,
    project_id: a.project_id,
    project_name: a.projects.name,
    cost_center: a.cost_center,
    wbs_element: a.wbs_element,
    gl_account: a.gl_account
  }));

  // Combine and sort by date
  return [...commitmentTransactions, ...actualTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

#### Query 5: Build CES Hierarchy

```typescript
// Build Cost Element Structure hierarchy from commitments
function buildCESHierarchy(commitments: Commitment[]): HierarchyNode[] {
  const level1Map = new Map<string, { total: number; children: Map<string, { total: number; children: Map<string, number> }> }>();

  commitments.forEach(c => {
    const l1 = c.account_group_level1 || 'Unassigned';
    const l2 = c.account_subgroup_level2 || 'Unassigned';
    const l3 = c.account_level3 || 'Unassigned';

    if (!level1Map.has(l1)) {
      level1Map.set(l1, { total: 0, children: new Map() });
    }
    const l1Node = level1Map.get(l1)!;
    l1Node.total += c.total_amount;

    if (!l1Node.children.has(l2)) {
      l1Node.children.set(l2, { total: 0, children: new Map() });
    }
    const l2Node = l1Node.children.get(l2)!;
    l2Node.total += c.total_amount;

    l2Node.children.set(l3, (l2Node.children.get(l3) || 0) + c.total_amount);
  });

  // Convert to HierarchyNode array
  return Array.from(level1Map.entries()).map(([l1Label, l1Data]) => ({
    id: `ces-l1-${l1Label}`,
    label: l1Label,
    total: l1Data.total,
    level: 1,
    children: Array.from(l1Data.children.entries()).map(([l2Label, l2Data]) => ({
      id: `ces-l2-${l1Label}-${l2Label}`,
      label: l2Label,
      total: l2Data.total,
      level: 2,
      children: Array.from(l2Data.children.entries()).map(([l3Label, l3Total]) => ({
        id: `ces-l3-${l1Label}-${l2Label}-${l3Label}`,
        label: l3Label,
        total: l3Total,
        level: 3
      }))
    }))
  }));
}
```

#### Query 6: Build WBS Hierarchy

```typescript
// Build Work Breakdown Structure hierarchy from commitments
function buildWBSHierarchy(commitments: Commitment[]): HierarchyNode[] {
  const wbsMap = new Map<string, number>();

  commitments.forEach(c => {
    const wbs = c.wbs_element || 'Unassigned';
    wbsMap.set(wbs, (wbsMap.get(wbs) || 0) + c.total_amount);
  });

  // Parse WBS elements (assuming format like "1.2.3.4")
  const rootNodes: HierarchyNode[] = [];
  const nodeMap = new Map<string, HierarchyNode>();

  Array.from(wbsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([wbs, total]) => {
      const parts = wbs.split('.');
      let currentPath = '';
      let parentNode: HierarchyNode | null = null;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        
        if (!nodeMap.has(currentPath)) {
          const node: HierarchyNode = {
            id: `wbs-${currentPath}`,
            label: currentPath,
            total: 0,
            level: index + 1,
            children: []
          };
          nodeMap.set(currentPath, node);

          if (parentNode) {
            parentNode.children = parentNode.children || [];
            parentNode.children.push(node);
          } else {
            rootNodes.push(node);
          }
        }

        const currentNode = nodeMap.get(currentPath)!;
        if (index === parts.length - 1) {
          currentNode.total = total;
        }
        parentNode = currentNode;
      });
    });

  // Roll up totals from children
  function rollUpTotals(node: HierarchyNode): number {
    if (!node.children || node.children.length === 0) {
      return node.total;
    }
    node.total = node.children.reduce((sum, child) => sum + rollUpTotals(child), node.total);
    return node.total;
  }

  rootNodes.forEach(rollUpTotals);
  return rootNodes;
}
```

### Calculation Functions

```typescript
// Calculate total spend for a project
function calculateTotalSpend(commitments: number, actuals: number): number {
  return commitments + actuals;
}

// Calculate variance
function calculateVariance(budget: number, totalSpend: number): number {
  return budget - totalSpend;
}

// Calculate spend percentage
function calculateSpendPercentage(totalSpend: number, budget: number): number {
  if (budget === 0) return 0;
  return (totalSpend / budget) * 100;
}

// Calculate aggregate KPIs
function calculateKPIs(projects: ProjectWithFinancials[]): KPIMetrics {
  const total_budget = projects.reduce((sum, p) => sum + p.budget, 0);
  const total_commitments = projects.reduce((sum, p) => sum + p.commitments_total, 0);
  const total_actuals = projects.reduce((sum, p) => sum + p.actuals_total, 0);
  const total_spend = total_commitments + total_actuals;
  const net_variance = total_budget - total_spend;
  const over_count = projects.filter(p => p.variance < 0).length;
  const under_count = projects.filter(p => p.variance >= 0).length;

  return {
    total_budget,
    total_commitments,
    total_actuals,
    total_spend,
    net_variance,
    over_count,
    under_count
  };
}

// Placeholder EAC calculation (Phase 1)
function calculateEAC(project: ProjectWithFinancials): number {
  // Phase 1: Simple placeholder
  // EAC = VOWD + ETC + Trends
  // For now, just return total_spend as a placeholder
  return project.total_spend;
}

// Calculate ETC (Estimate to Complete)
function calculateETC(budget: number, totalSpend: number): number {
  // ETC = Budget - Total Spend (remaining budget)
  const etc = budget - totalSpend;
  return etc > 0 ? etc : 0; // Cannot be negative
}
```

### Currency Conversion

```typescript
// Currency conversion rates (hardcoded for Phase 1, can be API-driven later)
const EXCHANGE_RATES: Record<Currency, Record<Currency, number>> = {
  [Currency.USD]: { USD: 1.0, EUR: 0.85, GBP: 0.73, JPY: 110.0 },
  [Currency.EUR]: { USD: 1.18, EUR: 1.0, GBP: 0.86, JPY: 129.5 },
  [Currency.GBP]: { USD: 1.37, EUR: 1.16, GBP: 1.0, JPY: 150.7 },
  [Currency.JPY]: { USD: 0.0091, EUR: 0.0077, GBP: 0.0066, JPY: 1.0 }
};

function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  if (fromCurrency === toCurrency) return amount;
  const rate = EXCHANGE_RATES[fromCurrency][toCurrency];
  return amount * rate;
}

function formatCurrency(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = {
    [Currency.USD]: '$',
    [Currency.EUR]: '€',
    [Currency.GBP]: '£',
    [Currency.JPY]: '¥'
  };
  
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbols[currency]}${formatted}`;
}
```

## Error Handling

### Error Boundary Component

```typescript
class CostbookErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Costbook Error:', error, errorInfo);
    // Log to error tracking service (e.g., Sentry)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Error Handling Strategies

1. **Database Query Errors**:
   - Catch errors from Supabase queries
   - Display user-friendly error messages
   - Provide retry mechanism
   - Log errors for debugging

2. **Data Validation Errors**:
   - Validate data structure before rendering
   - Handle missing or null values gracefully
   - Use default values where appropriate

3. **Currency Conversion Errors**:
   - Validate currency codes
   - Handle missing exchange rates
   - Fall back to original currency if conversion fails

4. **Chart Rendering Errors**:
   - Validate data before passing to Recharts
   - Handle empty datasets
   - Display placeholder when no data available

### Error Display Component

```typescript
interface ErrorDisplayProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Loading States

```typescript
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}
```

## Testing Strategy

### Testing Approach

The Costbook feature will use a dual testing approach combining unit tests for specific examples and edge cases with property-based tests for universal correctness properties. This comprehensive strategy ensures both concrete functionality and general correctness across all inputs.

### Unit Testing

Unit tests will focus on:
- Specific calculation examples with known inputs/outputs
- Edge cases (empty data, null values, zero budgets)
- Error conditions (invalid currency, malformed data)
- Component rendering with specific props
- User interaction handlers

**Testing Framework**: Jest + React Testing Library

**Example Unit Tests**:
- Calculate total spend with specific commitment and actual values
- Calculate variance with zero budget
- Format currency with different locales
- Render project card with missing data fields
- Handle currency conversion with invalid currency code

### Property-Based Testing

Property-based tests will verify universal properties across randomly generated inputs. Each property test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Testing Framework**: fast-check (JavaScript property-based testing library)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: costbook-4-0, Property {number}: {property_text}`
- Tests reference design document properties
- Generators for: projects, commitments, actuals, currencies, dates

**Property Test Structure**:
```typescript
import fc from 'fast-check';

// Feature: costbook-4-0, Property 1: Total spend calculation
test('Property 1: Total spend equals sum of commitments and actuals', () => {
  fc.assert(
    fc.property(
      fc.array(fc.float({ min: 0, max: 1000000 })), // commitments
      fc.array(fc.float({ min: 0, max: 1000000 })), // actuals
      (commitments, actuals) => {
        const commitmentsSum = commitments.reduce((a, b) => a + b, 0);
        const actualsSum = actuals.reduce((a, b) => a + b, 0);
        const totalSpend = calculateTotalSpend(commitmentsSum, actualsSum);
        
        expect(totalSpend).toBeCloseTo(commitmentsSum + actualsSum, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests will verify:
- Data fetching from Supabase
- Component integration and data flow
- User workflows (currency change, refresh, hover)
- Chart rendering with real data

### Test Coverage Goals

- Unit test coverage: 80%+ for business logic functions
- Component test coverage: 70%+ for React components
- Property test coverage: All correctness properties from design document
- Integration test coverage: All major user workflows

### Continuous Integration

- Run all tests on every commit
- Block merges if tests fail
- Generate coverage reports
- Run property tests with extended iterations (1000+) in CI


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Phase 1 Properties

#### Property 1: Total Spend Calculation Correctness

*For any* project with arrays of commitment amounts and actual amounts, the calculated total spend should equal the sum of all commitment amounts plus the sum of all actual amounts.

**Validates: Requirements 2.1**

**Test Implementation Notes**:
- Generate random arrays of positive floats for commitments and actuals
- Verify: `calculateTotalSpend(sum(commitments), sum(actuals)) === sum(commitments) + sum(actuals)`
- Handle edge case: empty arrays should result in zero

#### Property 2: Variance Calculation Correctness

*For any* project with a budget and total spend, the calculated variance should equal the budget minus the total spend.

**Validates: Requirements 2.2**

**Test Implementation Notes**:
- Generate random positive floats for budget and total spend
- Verify: `calculateVariance(budget, totalSpend) === budget - totalSpend`
- Test with budget > spend (positive variance) and budget < spend (negative variance)

#### Property 3: KPI Aggregation Correctness

*For any* collection of projects with financial data, the aggregate KPI totals should equal the sum of the corresponding values across all projects.

**Validates: Requirements 2.3**

**Test Implementation Notes**:
- Generate random array of projects with budget, commitments, actuals
- Verify: `kpis.total_budget === sum(projects.map(p => p.budget))`
- Verify: `kpis.total_commitments === sum(projects.map(p => p.commitments_total))`
- Verify: `kpis.total_actuals === sum(projects.map(p => p.actuals_total))`
- Verify: `kpis.over_count === projects.filter(p => p.variance < 0).length`

#### Property 4: Currency Precision Preservation

*For any* currency value, when formatted for display, the result should preserve exactly two decimal places.

**Validates: Requirements 2.6**

**Test Implementation Notes**:
- Generate random floats with varying decimal places
- Verify: formatted value matches regex `/\d+\.\d{2}/`
- Test with values like 100.1, 100.999, 100.001

#### Property 5: Null Value Handling in Calculations

*For any* project with missing or null commitment/actual values, the calculation functions should treat them as zero and produce valid numeric results without throwing errors.

**Validates: Requirements 1.5**

**Test Implementation Notes**:
- Generate projects with null, undefined, or empty arrays for commitments/actuals
- Verify: calculations return valid numbers (not NaN, not undefined)
- Verify: null values treated as 0 in sums

#### Property 6: Variance Color Coding Consistency

*For any* variance value, the applied color class should be green for positive or zero values and red for negative values.

**Validates: Requirements 4.4, 6.6**

**Test Implementation Notes**:
- Generate random variance values (positive, negative, zero)
- Verify: `variance >= 0` → color class includes 'green'
- Verify: `variance < 0` → color class includes 'red'

#### Property 7: Currency Conversion Consistency

*For any* financial value and pair of currencies, converting from currency A to currency B and then back to currency A should return a value within 0.01 of the original (accounting for rounding).

**Validates: Requirements 5.2**

**Test Implementation Notes**:
- Generate random amounts and currency pairs
- Verify: `abs(convertCurrency(convertCurrency(amount, A, B), B, A) - amount) < 0.01`
- Test round-trip conversion for all currency combinations

#### Property 8: Currency Symbol Inclusion

*For any* currency value formatted for display, the result should include the appropriate currency symbol or code.

**Validates: Requirements 5.4**

**Test Implementation Notes**:
- Generate random amounts and currencies
- Verify: formatted string contains currency symbol ($, €, £, ¥)
- Verify: symbol appears before or after the numeric value

#### Property 9: Project Card Completeness

*For any* project, the rendered project card should include all required fields: name, status, budget, commitments, actuals, total spend, variance, and progress indicator.

**Validates: Requirements 6.3**

**Test Implementation Notes**:
- Generate random projects with all fields
- Verify: rendered output contains all field values
- Use React Testing Library to query for each field

#### Property 10: CSV Column Mapping Correctness

*For any* valid CSV row with commitment data, mapping the row to the commitments schema should produce an object with all required fields and correct data types.

**Validates: Requirements 17.3, 17.4**

**Test Implementation Notes**:
- Generate random CSV rows with valid commitment/actual data
- Verify: mapped object has all required schema fields
- Verify: numeric fields are numbers, date fields are valid dates
- Test both commitments and actuals mapping

#### Property 11: CSV Import Error Reporting

*For any* CSV import with errors, the error messages should include the specific row numbers where errors occurred.

**Validates: Requirements 17.6**

**Test Implementation Notes**:
- Generate CSV data with intentional errors at specific rows
- Verify: error messages contain row numbers
- Verify: row numbers match the actual error locations

### Phase 2 Properties (AI Features)

#### Property 12: Natural Language Query Parsing

*For any* natural language query containing filter criteria (e.g., "over budget", "high variance"), the parsed intent should correctly identify the filter type and threshold values.

**Validates: Requirements 11.2, 11.3**

**Test Implementation Notes**:
- Generate various query phrasings for common filters
- Verify: parser extracts correct filter criteria
- Test queries like "show projects over budget", "find high variance projects"

### Phase 3 Properties (Extended Features)

#### Property 13: CPI Calculation Correctness

*For any* project with earned value and actual cost greater than zero, the calculated CPI should equal earned value divided by actual cost.

**Validates: Requirements 13.1**

**Test Implementation Notes**:
- Generate random positive values for earned value and actual cost
- Verify: `calculateCPI(earnedValue, actualCost) === earnedValue / actualCost`
- Handle edge case: actual cost of zero should return appropriate default or error

#### Property 14: SPI Calculation Correctness

*For any* project with earned value and planned value greater than zero, the calculated SPI should equal earned value divided by planned value.

**Validates: Requirements 13.2**

**Test Implementation Notes**:
- Generate random positive values for earned value and planned value
- Verify: `calculateSPI(earnedValue, plannedValue) === earnedValue / plannedValue`
- Handle edge case: planned value of zero should return appropriate default or error

#### Property 15: EVM Color Coding Consistency

*For any* CPI or SPI value, the applied color class should be green for values >= 1.0, yellow for values between 0.8 and 1.0, and red for values < 0.8.

**Validates: Requirements 13.4**

**Test Implementation Notes**:
- Generate random CPI/SPI values across the range
- Verify: `value >= 1.0` → green color class
- Verify: `0.8 <= value < 1.0` → yellow color class
- Verify: `value < 0.8` → red color class

#### Property 16: Comment Data Completeness

*For any* comment created by a user, the stored comment object should include timestamp, author, project association, and comment text.

**Validates: Requirements 14.2**

**Test Implementation Notes**:
- Generate random comments with various content
- Verify: comment object has all required fields
- Verify: timestamp is valid date, author is non-empty, project_id is valid

#### Property 17: Comment Indicator Display

*For any* project with one or more comments, the project card should display a comment indicator.

**Validates: Requirements 14.3**

**Test Implementation Notes**:
- Generate projects with varying comment counts (0, 1, many)
- Verify: projects with comments > 0 show indicator
- Verify: projects with comments === 0 do not show indicator

#### Property 18: Comment Chronological Ordering

*For any* collection of comments for a project, when displayed, the comments should be ordered by timestamp in chronological order (oldest to newest or newest to oldest, consistently).

**Validates: Requirements 14.5**

**Test Implementation Notes**:
- Generate random comments with different timestamps
- Verify: displayed comments are sorted by timestamp
- Verify: ordering is consistent across all displays

#### Property 19: Vendor Score Calculation Consistency

*For any* vendor with delivery and cost performance data, the calculated vendor score should be deterministic and within a valid range (e.g., 0-100).

**Validates: Requirements 15.1**

**Test Implementation Notes**:
- Generate random vendor performance data
- Verify: same input data produces same score
- Verify: score is within valid range
- Verify: better performance produces higher scores

#### Property 20: Vendor Metrics Completeness

*For any* vendor in the vendor score list, the vendor object should include on-time delivery rate and cost variance metrics.

**Validates: Requirements 15.3**

**Test Implementation Notes**:
- Generate random vendors with performance data
- Verify: vendor object includes delivery_rate field
- Verify: vendor object includes cost_variance field
- Verify: metrics are valid numbers

#### Property 21: Vendor Filtering and Sorting Correctness

*For any* vendor list with filtering or sorting applied, the results should match the filter criteria and be correctly ordered by the sort field.

**Validates: Requirements 15.5**

**Test Implementation Notes**:
- Generate random vendor lists
- Apply various filters (score > threshold, delivery rate > threshold)
- Verify: all results match filter criteria
- Apply various sorts (by score, by delivery rate)
- Verify: results are correctly ordered

### Example-Based Tests (Specific Scenarios)

The following are specific scenarios that should be tested with example-based unit tests rather than property-based tests:

**Example 1: EAC Placeholder Returns Valid Value**
- Given: A project with commitments and actuals
- When: EAC is calculated (Phase 1 placeholder)
- Then: Function returns a valid number
- **Validates: Requirements 2.4**

**Example 2: Empty Project Arrays Handled**
- Given: A project with no commitments and no actuals
- When: Total spend is calculated
- Then: Result is 0.00
- **Validates: Requirements 2.5** (edge case)

**Example 3: Header Components Present**
- Given: Dashboard is rendered
- When: User views the header
- Then: Title "Costbook", Currency Selector, and action buttons are visible
- **Validates: Requirements 4.2, 4.5**

**Example 4: All KPI Badges Displayed**
- Given: Dashboard is rendered with project data
- When: User views the header
- Then: All 7 KPI badges are visible (Total Budget, Commitments, Actuals, Total Spend, Net Variance, Over Count, Under Count)
- **Validates: Requirements 4.3**

**Example 5: Refresh Button Updates Data**
- Given: Dashboard is displaying data
- When: User clicks Refresh button
- Then: Data is re-fetched and UI updates
- **Validates: Requirements 4.6**

**Example 6: Currency Selection Persists**
- Given: User selects EUR currency
- When: User performs other actions (hover, click)
- Then: Currency remains EUR
- **Validates: Requirements 5.5**

**Example 7: Project Card Hover Shows Details**
- Given: Project card is displayed
- When: User hovers over the card
- Then: Additional details are shown
- **Validates: Requirements 6.5**

**Example 8: All Three Charts Rendered**
- Given: Dashboard is loaded with project data
- When: User views the visualization panel
- Then: Variance Waterfall, Health Bubble Chart, and Trend Sparkline are all visible
- **Validates: Requirements 7.2, 7.3, 7.4**

**Example 9: All Eight Footer Buttons Present**
- Given: Dashboard is rendered
- When: User views the footer
- Then: All 8 action buttons are visible (Scenarios, Resources, Reports, PO Breakdown, CSV Import, Forecast, Vendor Score, Settings)
- **Validates: Requirements 8.2**

**Example 10: Action Button Click Handlers**
- Given: Dashboard is rendered
- When: User clicks each action button
- Then: Corresponding handler function is called
- **Validates: Requirements 8.3**

**Example 11: Action Button Tooltips**
- Given: Dashboard is rendered
- When: User hovers over each action button
- Then: Tooltip is displayed
- **Validates: Requirements 8.4**

**Example 12: Unimplemented Features Disabled**
- Given: Dashboard is in Phase 1
- When: User views Phase 2/3 action buttons
- Then: Those buttons are disabled
- **Validates: Requirements 8.5**

**Example 13: Loading Indicator During Fetch**
- Given: Dashboard is fetching data
- When: User views the dashboard
- Then: Loading indicator is visible
- **Validates: Requirements 16.3**

**Example 14: Performance Button Shows Stats**
- Given: Dashboard is rendered
- When: User clicks Performance button
- Then: Query execution times and data statistics are displayed
- **Validates: Requirements 16.5**

**Example 15: CSV Import Dialog Opens**
- Given: Dashboard is rendered
- When: User clicks CSV Import button
- Then: File upload dialog opens
- **Validates: Requirements 17.1**

**Example 16: CSV Import Results Displayed**
- Given: User imports a CSV file
- When: Import completes
- Then: Success count and error list are displayed
- **Validates: Requirements 17.5**

**Example 17: Error Boundary Catches Errors**
- Given: A component throws an error
- When: Error occurs during rendering
- Then: Error boundary displays error message and recovery option
- **Validates: Requirements 18.6**

### Phase 2 Example Tests

**Example 18: Anomaly Detection Marks Projects**
- Given: Project data with statistical outliers
- When: Anomaly detection runs
- Then: Outlier projects are marked with red highlighting
- **Validates: Requirements 10.2**

**Example 19: Anomaly Explanation Provided**
- Given: An anomaly is detected
- When: User views anomaly details
- Then: Explanation text is displayed
- **Validates: Requirements 10.3**

**Example 20: Natural Language Search Field Present**
- Given: Dashboard is rendered (Phase 2)
- When: User views the interface
- Then: Natural language search input is visible
- **Validates: Requirements 11.1**

**Example 21: Search Query Examples Work**
- Given: Dashboard with project data
- When: User enters "show projects over budget"
- Then: Only over-budget projects are displayed
- **Validates: Requirements 11.4**

**Example 22: Empty Search Shows Suggestions**
- Given: User enters a query with no matches
- When: Search completes
- Then: Helpful suggestions are displayed
- **Validates: Requirements 11.5**

**Example 23: Recommendations Section Displayed**
- Given: Recommendations are available
- When: User views dashboard
- Then: Recommendations section is visible
- **Validates: Requirements 12.2**

### Phase 3 Example Tests

**Example 24: EVM Metrics on Project Cards**
- Given: Dashboard is in Phase 3 with EVM data
- When: User views project cards
- Then: CPI and SPI values are displayed
- **Validates: Requirements 13.3**

**Example 25: EVM Trend Charts Displayed**
- Given: Dashboard is in Phase 3 with historical EVM data
- When: User views visualizations
- Then: CPI and SPI trend charts are visible
- **Validates: Requirements 13.5**

**Example 26: Add Comment Option Available**
- Given: User views a project card (Phase 3)
- When: User interacts with the card
- Then: Option to add comment is available
- **Validates: Requirements 14.1**

**Example 27: Comment Edit and Delete**
- Given: User has created a comment
- When: User views their comment
- Then: Edit and delete options are available
- **Validates: Requirements 14.4**

**Example 28: Vendor Score List Displayed**
- Given: User accesses Vendor Score feature (Phase 3)
- When: Feature loads
- Then: List of vendors with scores is displayed
- **Validates: Requirements 15.2**

**Example 29: Vendor Detail View**
- Given: User views vendor list
- When: User clicks on a vendor
- Then: Historical performance data is displayed
- **Validates: Requirements 15.4**

---

## Contingency Rundown Profiles Extension

### Overview

Die Contingency Rundown Profiles Erweiterung ersetzt das externe Generic-Script durch eine vollständig integrierte Lösung. Das Feature generiert automatisch monatliche Budget-Progressionen (Planned vs Actual) für jedes Projekt und visualisiert diese als Sparklines in den Project Cards.

### Vorteile gegenüber Generic-Script

1. **Vollständig integriert**: Keine externen Scripts oder manuelle Uploads
2. **AI-Prediction**: Automatische Trend-Vorhersagen für zukünftige Monate
3. **Real-time Trigger**: Automatische Updates bei Datenänderungen
4. **No-Manual**: Automatische tägliche Regenerierung via Cron
5. **Error-Handling**: Alerts bei Fehlern
6. **Visualisierung**: Sparklines direkt in Project Cards
7. **Multi-Scenario**: Vergleich verschiedener Budget-Szenarien
8. **Idempotent & Auditable**: Vollständige Protokollierung in Supabase

### Architecture Extension

```
┌─────────────────────────────────────────────────────────────┐
│                    Costbook Frontend                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ProjectCard                                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  RundownSparkline                               │  │  │
│  │  │  - Planned (dashed)                             │  │  │
│  │  │  - Actual (solid)                               │  │  │
│  │  │  - Predicted (dotted)                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  /api/rundown/generate                                │  │
│  │  - Manual trigger                                     │  │
│  │  - Cron job trigger                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  RundownGenerator Service                             │  │
│  │  - Planned Profile Calculation                        │  │
│  │  - Actual Profile Calculation                         │  │
│  │  - AI Prediction Engine                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  projects   │  │ commitments │  │  rundown_profiles   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │   actuals   │  │  rundown_generation_logs            │   │
│  └─────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### New Data Models

#### Rundown Profile Table Schema

```sql
CREATE TABLE rundown_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYYMM
  planned_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  predicted_value NUMERIC(15,2), -- AI prediction for future months
  profile_type TEXT NOT NULL DEFAULT 'contingency', -- 'contingency' or 'total_budget'
  scenario_name TEXT NOT NULL DEFAULT 'baseline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, month, profile_type, scenario_name)
);

CREATE INDEX idx_rundown_profiles_project ON rundown_profiles(project_id);
CREATE INDEX idx_rundown_profiles_month ON rundown_profiles(month);
```

#### Generation Log Table Schema

```sql
CREATE TABLE rundown_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id),
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  message TEXT,
  projects_processed INTEGER,
  profiles_created INTEGER,
  errors_count INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rundown_logs_execution ON rundown_generation_logs(execution_id);
```

### TypeScript Interfaces

```typescript
// Rundown Profile Types
interface RundownProfile {
  id: string;
  project_id: string;
  month: string; // YYYYMM
  planned_value: number;
  actual_value: number;
  predicted_value?: number;
  profile_type: 'contingency' | 'total_budget';
  scenario_name: string;
  created_at: string;
  updated_at: string;
}

interface RundownProfileSummary {
  project_id: string;
  profiles: RundownProfile[];
  total_planned: number;
  total_actual: number;
  variance: number;
  trend_direction: 'up' | 'down' | 'stable';
  prediction_warning: boolean;
}

interface GenerationResult {
  execution_id: string;
  projects_processed: number;
  profiles_created: number;
  errors: GenerationError[];
  execution_time_ms: number;
}

interface GenerationError {
  project_id: string;
  project_name: string;
  error_message: string;
}

interface RundownScenario {
  name: string;
  description: string;
  adjustment_type: 'percentage' | 'absolute';
  adjustment_value: number;
  created_by: string;
  created_at: string;
}
```

### Backend Components (FastAPI)

#### Rundown Router

```python
# backend/routers/rundown.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/rundown", tags=["rundown"])

class GenerateRequest(BaseModel):
    project_id: Optional[str] = None
    profile_type: str = "contingency"
    force_regenerate: bool = False

class GenerateResponse(BaseModel):
    execution_id: str
    projects_processed: int
    profiles_created: int
    errors: List[dict]
    execution_time_ms: int

@router.post("/generate", response_model=GenerateResponse)
async def generate_rundown_profiles(
    request: GenerateRequest,
    background_tasks: BackgroundTasks
):
    """
    Generate rundown profiles for all projects or a specific project.
    Overwrites existing profiles (idempotent operation).
    """
    execution_id = str(uuid.uuid4())
    start_time = datetime.now()
    
    # Implementation details in RundownGenerator service
    result = await rundown_generator.generate(
        project_id=request.project_id,
        profile_type=request.profile_type,
        execution_id=execution_id
    )
    
    execution_time = (datetime.now() - start_time).total_seconds() * 1000
    
    return GenerateResponse(
        execution_id=execution_id,
        projects_processed=result.projects_processed,
        profiles_created=result.profiles_created,
        errors=result.errors,
        execution_time_ms=int(execution_time)
    )

@router.get("/profiles/{project_id}")
async def get_rundown_profiles(
    project_id: str,
    profile_type: str = "contingency",
    scenario_name: str = "baseline"
):
    """Get rundown profiles for a specific project."""
    profiles = await rundown_service.get_profiles(
        project_id=project_id,
        profile_type=profile_type,
        scenario_name=scenario_name
    )
    return profiles
```

#### Rundown Generator Service

```python
# backend/services/rundown_generator.py
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Optional
import numpy as np
from supabase import Client

class RundownGenerator:
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def generate(
        self,
        project_id: Optional[str] = None,
        profile_type: str = "contingency",
        execution_id: str = None
    ) -> GenerationResult:
        """Generate rundown profiles for projects."""
        
        # Log start
        await self._log_execution(execution_id, "started")
        
        # Fetch projects
        query = self.supabase.table("projects").select("*")
        if project_id:
            query = query.eq("id", project_id)
        
        projects = query.execute().data
        
        results = GenerationResult(
            execution_id=execution_id,
            projects_processed=0,
            profiles_created=0,
            errors=[]
        )
        
        for project in projects:
            try:
                profiles = await self._generate_project_profiles(
                    project, profile_type
                )
                results.projects_processed += 1
                results.profiles_created += len(profiles)
            except Exception as e:
                results.errors.append({
                    "project_id": project["id"],
                    "project_name": project["name"],
                    "error_message": str(e)
                })
        
        # Log completion
        await self._log_execution(
            execution_id, "completed",
            projects_processed=results.projects_processed,
            profiles_created=results.profiles_created,
            errors_count=len(results.errors)
        )
        
        return results
    
    async def _generate_project_profiles(
        self,
        project: dict,
        profile_type: str
    ) -> List[dict]:
        """Generate planned and actual profiles for a single project."""
        
        start_date = project.get("start_date")
        end_date = project.get("end_date")
        
        if not start_date or not end_date:
            raise ValueError("Project missing start_date or end_date")
        
        # Parse dates
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        # Calculate months
        months = self._get_months_between(start, end)
        
        # Get budget (contingency or total)
        budget = project.get("contingency_budget", project.get("budget", 0))
        
        # Generate planned profile (linear distribution)
        planned_profiles = self._calculate_planned_profile(
            project["id"], months, budget, profile_type
        )
        
        # Get actual changes from commitments/actuals
        changes = await self._get_budget_changes(project["id"])
        
        # Generate actual profile
        actual_profiles = self._calculate_actual_profile(
            planned_profiles, changes
        )
        
        # Calculate AI predictions for future months
        current_month = datetime.now().strftime("%Y%m")
        predictions = self._calculate_predictions(actual_profiles, current_month)
        
        # Merge and upsert profiles
        final_profiles = self._merge_profiles(
            planned_profiles, actual_profiles, predictions
        )
        
        # Delete existing and insert new (idempotent)
        await self._upsert_profiles(project["id"], final_profiles, profile_type)
        
        return final_profiles
    
    def _calculate_planned_profile(
        self,
        project_id: str,
        months: List[str],
        total_budget: float,
        profile_type: str
    ) -> List[dict]:
        """Calculate linear distribution of budget over months."""
        
        if not months:
            return []
        
        monthly_value = total_budget / len(months)
        cumulative = 0
        profiles = []
        
        for month in months:
            cumulative += monthly_value
            profiles.append({
                "project_id": project_id,
                "month": month,
                "planned_value": round(cumulative, 2),
                "profile_type": profile_type,
                "scenario_name": "baseline"
            })
        
        return profiles
    
    def _calculate_predictions(
        self,
        actual_profiles: List[dict],
        current_month: str
    ) -> dict:
        """Calculate AI predictions using linear regression."""
        
        # Get historical data (last 6 months)
        historical = [
            p for p in actual_profiles
            if p["month"] <= current_month
        ][-6:]
        
        if len(historical) < 3:
            return {}
        
        # Linear regression
        x = np.arange(len(historical))
        y = np.array([p["actual_value"] for p in historical])
        
        slope, intercept = np.polyfit(x, y, 1)
        
        # Predict future months
        predictions = {}
        future_profiles = [
            p for p in actual_profiles
            if p["month"] > current_month
        ]
        
        for i, profile in enumerate(future_profiles):
            predicted = intercept + slope * (len(historical) + i)
            predictions[profile["month"]] = round(max(0, predicted), 2)
        
        return predictions
```

#### Cron Job Configuration

```python
# backend/main.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    # Schedule daily rundown profile generation at 02:00 UTC
    scheduler.add_job(
        rundown_generator.generate,
        CronTrigger(hour=2, minute=0),
        id="daily_rundown_generation",
        name="Daily Rundown Profile Generation",
        replace_existing=True
    )
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
```

### Frontend Components

#### RundownSparkline Component

```typescript
// components/costbook/RundownSparkline.tsx
import { LineChart, Line, ReferenceLine, Tooltip } from 'recharts';

interface RundownSparklineProps {
  profiles: RundownProfile[];
  currentMonth: string;
  showPredictions?: boolean;
  height?: number;
  width?: number;
}

export function RundownSparkline({
  profiles,
  currentMonth,
  showPredictions = true,
  height = 40,
  width = 120
}: RundownSparklineProps) {
  const data = profiles.map(p => ({
    month: p.month,
    planned: p.planned_value,
    actual: p.actual_value,
    predicted: p.predicted_value,
    isFuture: p.month > currentMonth,
    isOverBudget: p.actual_value > p.planned_value
  }));

  const hasWarning = data.some(d => 
    d.predicted && d.predicted > (d.planned * 1.1)
  );

  return (
    <div className={`relative ${hasWarning ? 'ring-2 ring-amber-400 rounded' : ''}`}>
      <LineChart width={width} height={height} data={data}>
        {/* Planned line (dashed) */}
        <Line
          type="monotone"
          dataKey="planned"
          stroke="#94a3b8"
          strokeDasharray="3 3"
          dot={false}
          strokeWidth={1}
        />
        
        {/* Actual line (solid) */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          dot={false}
          strokeWidth={2}
        />
        
        {/* Predicted line (dotted) */}
        {showPredictions && (
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#f59e0b"
            strokeDasharray="2 2"
            dot={false}
            strokeWidth={1}
          />
        )}
        
        {/* Current month indicator */}
        <ReferenceLine
          x={currentMonth}
          stroke="#10b981"
          strokeWidth={2}
        />
        
        <Tooltip
          content={<RundownTooltip />}
          cursor={false}
        />
      </LineChart>
      
      {hasWarning && (
        <div className="absolute -top-1 -right-1">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        </div>
      )}
    </div>
  );
}

function RundownTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-white shadow-lg rounded p-2 text-xs border">
      <div className="font-medium">{formatMonth(data.month)}</div>
      <div className="text-slate-500">
        Planned: {formatCurrency(data.planned)}
      </div>
      <div className={data.isOverBudget ? 'text-red-600' : 'text-blue-600'}>
        Actual: {formatCurrency(data.actual)}
      </div>
      {data.predicted && (
        <div className="text-amber-600">
          Predicted: {formatCurrency(data.predicted)}
        </div>
      )}
    </div>
  );
}
```

#### Updated ProjectCard with Sparkline

```typescript
// Update to components/costbook/ProjectCard.tsx
interface ProjectCardProps {
  project: ProjectWithFinancials;
  currency: Currency;
  rundownProfiles?: RundownProfile[];
  onHover?: (project: ProjectWithFinancials) => void;
}

export function ProjectCard({
  project,
  currency,
  rundownProfiles,
  onHover
}: ProjectCardProps) {
  const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Existing card content */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium text-gray-900">{project.name}</h3>
        <StatusDot status={project.status} />
      </div>
      
      {/* Financial metrics */}
      <div className="space-y-1 text-sm">
        {/* ... existing metrics ... */}
      </div>
      
      {/* Rundown Sparkline */}
      {rundownProfiles && rundownProfiles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Contingency Rundown</span>
            <RundownSparkline
              profiles={rundownProfiles}
              currentMonth={currentMonth}
              height={32}
              width={100}
            />
          </div>
        </div>
      )}
      
      {/* Progress bar */}
      <div className="mt-3">
        <ProgressBar percentage={project.spend_percentage} />
      </div>
    </div>
  );
}
```

### React Query Hooks

```typescript
// lib/rundown-queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useRundownProfiles(projectId: string) {
  return useQuery({
    queryKey: ['rundown-profiles', projectId],
    queryFn: () => fetchRundownProfiles(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAllRundownProfiles(projectIds: string[]) {
  return useQuery({
    queryKey: ['rundown-profiles-all', projectIds],
    queryFn: () => Promise.all(
      projectIds.map(id => fetchRundownProfiles(id))
    ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateRundownProfiles() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (projectId?: string) => 
      fetch('/api/rundown/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rundown-profiles'] });
    }
  });
}

async function fetchRundownProfiles(projectId: string): Promise<RundownProfile[]> {
  const response = await fetch(`/api/rundown/profiles/${projectId}`);
  if (!response.ok) throw new Error('Failed to fetch rundown profiles');
  return response.json();
}
```

### Correctness Properties for Rundown Profiles

#### Property 22: Planned Profile Linear Distribution

*For any* project with a valid start_date, end_date, and budget, the generated planned profile values should sum to the original budget (within rounding tolerance of 0.01).

**Validates: Requirements 25.1, 25.4, 25.5**

**Test Implementation Notes**:
- Generate random projects with valid date ranges and budgets
- Verify: `sum(planned_values) ≈ original_budget` (within 0.01)
- Test with various project durations (1 month to 60 months)

#### Property 23: Planned Profile Month Coverage

*For any* project with valid dates, the generated planned profile should have exactly one entry for each month from start_date to end_date inclusive.

**Validates: Requirements 25.2**

**Test Implementation Notes**:
- Generate random date ranges
- Verify: number of profile entries equals expected month count
- Verify: all months are in YYYYMM format
- Verify: no gaps or duplicates in month sequence

#### Property 24: Actual Profile Adjustment Correctness

*For any* project with changes, the actual profile values should reflect the planned values adjusted by the cumulative changes from the change month onwards.

**Validates: Requirements 26.1, 26.2, 26.4**

**Test Implementation Notes**:
- Generate projects with random changes at various months
- Verify: actual values before change month equal planned values
- Verify: actual values from change month reflect adjustments

#### Property 25: Profile Generation Idempotency

*For any* project, generating profiles multiple times with the same input data should produce identical results.

**Validates: Requirements 27.3**

**Test Implementation Notes**:
- Generate profiles for a project
- Generate again without data changes
- Verify: both generations produce identical profile values

#### Property 26: Prediction Trend Consistency

*For any* project with at least 3 months of historical data, the predicted values should follow a consistent trend direction based on the historical pattern.

**Validates: Requirements 30.1, 30.2**

**Test Implementation Notes**:
- Generate projects with increasing/decreasing/stable historical trends
- Verify: predictions continue the established trend direction
- Verify: predictions are non-negative

#### Property 27: Sparkline Data Completeness

*For any* project with rundown profiles, the sparkline visualization should include data points for all profile months with planned, actual, and (where applicable) predicted values.

**Validates: Requirements 29.1, 29.3, 29.4**

**Test Implementation Notes**:
- Generate random profiles
- Verify: sparkline data includes all months
- Verify: each data point has planned and actual values
- Verify: future months have predicted values when available

#### Property 28: Real-Time Update Trigger

*For any* change to commitment or actual data, the affected project's rundown profile should be regenerated within the specified time limit.

**Validates: Requirements 31.1, 31.3**

**Test Implementation Notes**:
- Simulate data changes
- Verify: profile regeneration is triggered
- Verify: regeneration completes within 5 seconds

#### Property 29: Multi-Scenario Isolation

*For any* project with multiple scenarios, changes to one scenario should not affect other scenarios.

**Validates: Requirements 32.1, 32.4**

**Test Implementation Notes**:
- Create multiple scenarios for a project
- Modify one scenario
- Verify: other scenarios remain unchanged

### Example-Based Tests for Rundown Profiles

**Example 30: Empty Project Dates Handling**
- Given: A project with null start_date or end_date
- When: Profile generation is attempted
- Then: Generation is skipped with a warning logged
- **Validates: Requirements 25.3**

**Example 31: Single Month Project**
- Given: A project with start_date and end_date in the same month
- When: Planned profile is generated
- Then: Single profile entry with full budget value
- **Validates: Requirements 25.1, 25.2**

**Example 32: API Error Response**
- Given: Profile generation encounters an error
- When: API returns response
- Then: Error details include project context and continue processing
- **Validates: Requirements 27.5**

**Example 33: Cron Job Logging**
- Given: Daily cron job executes
- When: Job completes
- Then: Execution log contains start time, completion time, and statistics
- **Validates: Requirements 28.4**

**Example 34: Sparkline Warning Indicator**
- Given: Predicted values exceed planned by more than 10%
- When: Sparkline is rendered
- Then: Warning indicator is displayed on project card
- **Validates: Requirements 30.4**

        Planned: {formatCurrency(data.planned)}
      </div>
      {data.actual && (
        <div className={data.isOverBudget ? 'text-red-600' : 'text-green-600'}>
          Actual: {formatCurrency(data.actual)}
        </div>
      )}
      {data.predicted && (
        <div className="text-amber-600">
          Predicted: {formatCurrency(data.predicted)}
        </div>
      )}
    </div>
  );
}
```

## Additional Design Sections for New Requirements

### Natural Language Search Component

**Component**: NLSearchInput

**Purpose**: Provides natural language search capability in the header for filtering projects.

**Props**:
```typescript
interface NLSearchInputProps {
  onSearch: (query: string, filters: ParsedFilters) => void;
  placeholder?: string;
}

interface ParsedFilters {
  type: 'over_budget' | 'under_budget' | 'high_variance' | 'vendor' | 'status';
  threshold?: number;
  value?: string;
}
```

**Implementation**:
- Use NLP library (compromise.js) for query parsing
- Support queries: "show projects over budget", "find high variance projects", "vendor X"
- Display autocomplete suggestions
- Highlight matched terms in results

**Layout**: Integrated into CostbookHeader, positioned between title and KPI badges

### AI-Powered Import Builder

**Component**: AIImportBuilder

**Purpose**: Intelligent CSV import with auto-mapping and template management.

**Props**:
```typescript
interface AIImportBuilderProps {
  onImport: (data: ImportResult) => void;
  onClose: () => void;
}

interface ImportResult {
  commitments: Commitment[];
  actuals: Actual[];
  errors: ImportError[];
  template?: ImportTemplate;
}

interface ImportTemplate {
  id: string;
  name: string;
  mapping: ColumnMapping;
  shared: boolean;
  created_by: string;
}
```

**Features**:
- Auto-detect column types using ML
- Smart suggestions for ambiguous mappings
- Preview mapped data before import
- Save/load mapping templates
- Template sharing (Phase 3)

**Layout**: Modal dialog with multi-step wizard (Upload → Map → Preview → Import)

### Smart Recommendations Card

**Component**: RecommendationsCard

**Purpose**: Display AI-powered budget optimization recommendations.

**Props**:
```typescript
interface RecommendationsCardProps {
  recommendations: Recommendation[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDefer: (id: string) => void;
}

interface Recommendation {
  id: string;
  type: 'budget_reallocation' | 'vendor_change' | 'cost_reduction';
  title: string;
  description: string;
  impact: number;
  confidence: number;
  supporting_data: any;
}
```

**Layout**: Small card positioned in header or as collapsible panel, non-intrusive design

### Voice Control Integration

**Component**: VoiceControlManager

**Purpose**: Enable hands-free navigation using Web Speech API.

**Props**:
```typescript
interface VoiceControlManagerProps {
  enabled: boolean;
  onCommand: (command: VoiceCommand) => void;
  language?: string;
}

interface VoiceCommand {
  action: 'show' | 'filter' | 'refresh' | 'navigate';
  target?: string;
  parameters?: Record<string, any>;
}
```

**Supported Commands**:
- "Show project [name]"
- "Filter by vendor [name]"
- "Refresh data"
- "Show over budget projects"
- "Navigate to reports"

**Implementation**: Use Web Speech API with fallback for unsupported browsers

### Gamification System

**Component**: GamificationBadges

**Purpose**: Display earned badges and achievements.

**Props**:
```typescript
interface GamificationBadgesProps {
  badges: Badge[];
  userId: string;
  showLeaderboard?: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at?: string;
  criteria: BadgeCriteria;
}

interface BadgeCriteria {
  type: 'budget_accuracy' | 'data_quality' | 'variance_reduction';
  threshold: number;
  timeframe?: string;
}
```

**Badge Types**:
- Budget Master: Maintain variance < 5% for 3 months
- Variance Hunter: Identify and resolve 10 variances
- Data Quality Champion: 100% data completeness for 1 month
- Early Bird: First to review daily reports 10 times
- Team Player: Share 5 import templates

**Layout**: Badge display in user profile, notification on earn, leaderboard view

### EVM Gauge Visualizations

**Component**: EVMGaugeChart

**Purpose**: Display EVM metrics (CPI/SPI/TCPI) in gauge format.

**Props**:
```typescript
interface EVMGaugeChartProps {
  cpi: number;
  spi: number;
  tcpi?: number;
  size?: 'small' | 'medium' | 'large';
}
```

**Chart Configuration**:
- Use Recharts RadialBarChart for gauge display
- Color zones: green (>= 1.0), yellow (0.8-1.0), red (< 0.8)
- Display current value and trend arrow
- Tooltip with historical data

**Layout**: Integrated into ProjectCard or dedicated EVM panel

### Drag-and-Drop Cash Out Forecast

**Component**: DraggableCashOutGantt

**Purpose**: Interactive Gantt chart with drag-adjust for forecast dates.

**Props**:
```typescript
interface DraggableCashOutGanttProps {
  commitments: Commitment[];
  projects: Project[];
  currency: Currency;
  timeRange: 'weekly' | 'monthly';
  onDateChange: (commitmentId: string, newDate: Date) => void;
  scenarios: ForecastScenario[];
  activeScenario: string;
  onScenarioChange: (scenarioId: string) => void;
}

interface ForecastScenario {
  id: string;
  name: string;
  adjustments: Record<string, Date>;
}
```

**Implementation**:
- Use react-dnd for drag-and-drop
- Validate date constraints (no past dates, within project timeline)
- Update database on drop
- Support multi-scenario comparison

### Inline Comments System

**Component**: InlineCommentThread

**Purpose**: Display and manage comments directly in project cards.

**Props**:
```typescript
interface InlineCommentThreadProps {
  projectId: string;
  comments: Comment[];
  currentUser: User;
  onAdd: (content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  mentions?: string[];
}
```

**Features**:
- @mentions for user notifications (Phase 3)
- Rich text formatting
- Edit/delete own comments
- Chronological ordering
- Comment count indicator on card

### Technology Stack Extensions

**Additional Libraries**:
- **compromise.js**: Natural language processing for search queries
- **@tanstack/react-virtual**: Virtualization for large transaction lists
- **react-dnd**: Drag-and-drop for interactive forecasts
- **apscheduler**: Python cron job scheduling for backend
- **numpy**: Linear regression for AI predictions
- **Web Speech API**: Voice control (browser native)

**Performance Optimizations**:
- React.memo for expensive components
- useMemo for complex calculations
- useCallback for event handlers
- Code splitting with React.lazy
- Service Worker for offline support (Phase 3)

### Responsive Design Patterns

**Mobile Adaptations**:
- Collapsible panels → Accordion navigation
- Grid layout → Single column stack
- KPI badges → Horizontal scroll
- Charts → Expandable sections
- Touch targets → Minimum 44x44px
- Swipe gestures → Panel navigation

**Breakpoints**:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Security Considerations

**Data Protection**:
- Row-level security (RLS) in Supabase
- User authentication via Supabase Auth
- API rate limiting
- Input validation and sanitization
- XSS protection
- CSRF tokens for mutations

**Access Control**:
- Role-based permissions (viewer, editor, admin)
- Project-level access control
- Comment ownership validation
- Template sharing permissions

### Deployment Architecture

**Frontend**:
- Next.js deployed on Vercel
- CDN for static assets
- Environment-based configuration
- Error tracking (Sentry)

**Backend**:
- FastAPI deployed on Render/Railway
- Supabase for database and auth
- Cron jobs via APScheduler
- Logging to Supabase tables

**CI/CD Pipeline**:
- GitHub Actions for testing
- Automated deployment on merge
- Property tests in CI (1000+ iterations)
- Coverage reports
- Lighthouse performance audits

---

## Distribution Settings & Rules (Phase 2 & 3)

### Distribution Settings Component (Phase 2)

**Purpose**: Configure how forecasted cash outflows are distributed over time.

**Props**:
```typescript
interface DistributionSettingsProps {
  projectId: string
  currentSettings?: DistributionSettings
  onSave: (settings: DistributionSettings) => void
  onCancel: () => void
}

interface DistributionSettings {
  profile: 'linear' | 'custom' | 'ai_generated'
  duration_start: string
  duration_end: string
  granularity: 'week' | 'month'
  customDistribution?: number[] // For custom profile
}
```

**Features**:
- **Linear Profile**: Even distribution across time periods
- **Custom Profile**: Manual percentage entry with validation
- **AI-Generated Profile**: ML-powered optimal distribution based on historical patterns
- **Duration Selection**: Date range picker with project constraints
- **Granularity Toggle**: Switch between weekly/monthly buckets
- **Live Preview**: Chart showing distribution before applying

**Layout**: Modal dialog with tabs for each profile type, preview chart, and action buttons

### Distribution Rules Engine (Phase 3)

**Component**: DistributionRulesManager

**Purpose**: Automate forecast distribution adjustments using rules and AI.

**Props**:
```typescript
interface DistributionRulesManagerProps {
  projectId?: string // If null, manage global rules
  rules: DistributionRule[]
  onCreateRule: (rule: DistributionRule) => void
  onUpdateRule: (ruleId: string, updates: Partial<DistributionRule>) => void
  onDeleteRule: (ruleId: string) => void
  onApplyRule: (ruleId: string, projectIds: string[]) => void
}

interface DistributionRule {
  id: string
  name: string
  type: 'automatic' | 'reprofiling' | 'ai_generator'
  profile: 'linear' | 'custom' | 'ai_generated'
  settings: DistributionSettings
  trigger_conditions?: RuleTrigger[]
  created_at: string
  last_applied: string
  application_count: number
}

interface RuleTrigger {
  event: 'commitment_added' | 'actual_posted' | 'budget_changed' | 'schedule'
  condition?: string // Optional filter condition
  schedule?: string // Cron expression for scheduled rules
}
```

**Rule Types**:

1. **Automatic**: Simple linear distribution
   - Evenly distributes budget from start to end date
   - No manual intervention required
   - Best for stable, predictable projects

2. **Reprofiling**: Adaptive distribution
   - Analyzes actual commitments and actuals
   - Adjusts remaining distribution based on consumption patterns
   - Redistributes unspent budget to future periods
   - Maintains total budget constraint

3. **AI Generator**: Intelligent distribution
   - Uses historical project data for training
   - Predicts optimal distribution based on:
     - Project type and size
     - Vendor patterns
     - Seasonal trends
     - Risk factors
   - Provides confidence scores
   - Learns from actual vs planned deviations

**Backend Service**: DistributionRulesEngine

```python
# backend/services/distribution_rules_engine.py
class DistributionRulesEngine:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.ml_model = load_distribution_model()
    
    async def apply_rule(
        self,
        rule: DistributionRule,
        project_id: str
    ) -> DistributionResult:
        """Apply a distribution rule to a project."""
        project = await self.fetch_project(project_id)
        
        if rule.type == 'automatic':
            return self.apply_linear_distribution(project, rule.settings)
        elif rule.type == 'reprofiling':
            return self.apply_reprofiling(project, rule.settings)
        elif rule.type == 'ai_generator':
            return self.apply_ai_distribution(project, rule.settings)
    
    def apply_linear_distribution(
        self,
        project: Project,
        settings: DistributionSettings
    ) -> DistributionResult:
        """Distribute budget evenly over duration."""
        periods = calculate_periods(
            settings.duration_start,
            settings.duration_end,
            settings.granularity
        )
        amount_per_period = project.budget / len(periods)
        return create_distribution(periods, amount_per_period)
    
    def apply_reprofiling(
        self,
        project: Project,
        settings: DistributionSettings
    ) -> DistributionResult:
        """Adjust distribution based on actual consumption."""
        current_spend = calculate_total_spend(project)
        remaining_budget = project.budget - current_spend
        
        # Get remaining periods
        today = datetime.now()
        remaining_periods = [
            p for p in calculate_periods(
                settings.duration_start,
                settings.duration_end,
                settings.granularity
            )
            if p.start_date >= today
        ]
        
        # Redistribute remaining budget
        if len(remaining_periods) > 0:
            amount_per_period = remaining_budget / len(remaining_periods)
            return create_distribution(remaining_periods, amount_per_period)
        
        return DistributionResult(periods=[], error="No remaining periods")
    
    def apply_ai_distribution(
        self,
        project: Project,
        settings: DistributionSettings
    ) -> DistributionResult:
        """Use ML model to predict optimal distribution."""
        features = extract_project_features(project)
        predictions = self.ml_model.predict(features)
        
        periods = calculate_periods(
            settings.duration_start,
            settings.duration_end,
            settings.granularity
        )
        
        # Normalize predictions to sum to project budget
        total_predicted = sum(predictions)
        scaled_predictions = [
            (p / total_predicted) * project.budget
            for p in predictions
        ]
        
        return create_distribution(
            periods,
            scaled_predictions,
            confidence=calculate_confidence(predictions, features)
        )
```

**UI Components**:

- **RulesList**: Table showing all rules with status, last applied, and actions
- **RuleEditor**: Form for creating/editing rules with profile selection and trigger configuration
- **RulePreview**: Visualization of rule impact on selected projects
- **RuleApplicationLog**: Audit trail of rule executions

**Integration with Cash Out Forecast**:

```typescript
// When user opens Distribution Settings from Cash Out Forecast
function handleConfigureDistribution(projectId: string) {
  // Open modal with current settings
  setDistributionModalOpen(true)
  setSelectedProject(projectId)
}

// When user applies a distribution rule
async function handleApplyRule(ruleId: string, projectId: string) {
  const result = await applyDistributionRule({ ruleId, projectId })
  
  // Refresh Cash Out Forecast with new distribution
  invalidateQuery(['cash-out-forecast', projectId])
  
  // Show success notification
  toast.success(`Distribution rule applied to ${result.periods.length} periods`)
}
```

---

## Summary

The Costbook design provides a comprehensive, three-phase approach to building a sophisticated financial management dashboard. The architecture emphasizes:

1. **Performance**: Efficient Supabase queries, react-query caching, virtualization
2. **User Experience**: No-scroll layout, collapsible panels, natural language search
3. **Intelligence**: AI-powered anomaly detection, predictions, recommendations, distribution optimization
4. **Collaboration**: Inline comments, template sharing, gamification
5. **Extensibility**: Clear phase boundaries, modular components, plugin architecture, rule-based automation

The design supports iterative delivery with each phase providing complete, testable functionality while building toward the full vision of an intelligent, interactive financial management system with advanced forecast planning capabilities.
