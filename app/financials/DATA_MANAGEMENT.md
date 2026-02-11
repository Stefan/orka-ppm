# Financials Data Management

## Overview

The Financials area uses a **single data layer** so that:

- **One fetch** for commitments/actuals (limit 2000) feeds Overview, Analysis, Detailed, and Trends.
- **Portfolio-scoped data** (projects, metrics, variances) is loaded and refetched on portfolio change via `useFinancialData`.
- **Derived data** (summary, analytics, cost analysis, trends) is computed once from the same raw commitments/actuals in `commitmentsActualsDerivations.ts`.

## Architecture

### 1. `FinancialsDataProvider` (context)

- **Location:** `app/financials/context/FinancialsDataContext.tsx`
- **Responsibilities:**
  - Calls `useFinancialData(accessToken, selectedCurrency, portfolioId)` for core data (projects, alerts, metrics, variances, report, budget performance).
  - Runs a **single** commitments/actuals request (after 150ms defer), then uses `computeCommitmentsActualsDerivations()` to get summary, analytics, cost analysis, and trends.
  - Triggers core refetch when `portfolioId` changes (background, no full-page loading).
  - Exposes `useFinancialsData()` with: core data, `analyticsData`, `commitmentsSummary`, `commitmentsAnalytics`, `costAnalysis`, `trendsMonthlyData`, `trendsSummary`, `commitmentsLoading`, `refetchCommitmentsActuals`.

### 2. `useFinancialData` (core)

- **Location:** `app/financials/hooks/useFinancialData.ts`
- Fetches: projects (with optional `portfolio_id`), financial alerts, comprehensive report.
- Derives: budget variances, metrics, budget performance from projects.
- **Does not** fetch commitments/actuals or cost analysis; that lives in the context.

### 3. `commitmentsActualsDerivations.ts`

- **Location:** `app/financials/utils/commitmentsActualsDerivations.ts`
- **Function:** `computeCommitmentsActualsDerivations(commitments, actuals, selectedCurrency)`
- Returns: `summary`, `analytics`, `costAnalysis`, `monthlyTrends`, `trendsSummary` from one raw dataset.

### 4. Page and views

- **Page** wraps content in `FinancialsDataProvider` and renders `FinancialsContentInner`, which calls `useFinancialsData()` and passes data into views as props.
- **OverviewView, AnalysisView, DetailedView** receive `commitmentsSummary` and `commitmentsAnalytics` (no local fetch).
- **TrendsView** receives `monthlyData`, `trendsSummary`, `trendsLoading` (no local fetch).
- **CommitmentsActualsView** receives shared commitments data and `onRefreshCommitmentsActuals` for the refresh button.

## Performance

- **Before:** Multiple components each called `useCommitmentsActualsData` or `useCommitmentsActualsTrends`, causing repeated commitments/actuals fetches (same 2000 limit) when switching tabs.
- **After:** One commitments/actuals fetch per Financials visit; all tabs consume the same in-memory derivations. Portfolio change only refetches projects (and derived metrics), not commitments/actuals.

## Optional: re-fetching commitments/actuals

- After CSV import or when the user clicks “Refresh” in the Commitments/Actuals tab, call `refetchCommitmentsActuals()` from the context so summary, analytics, cost analysis, and trends are updated from a new fetch.
