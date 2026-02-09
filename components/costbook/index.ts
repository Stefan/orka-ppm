// Costbook Component Library
// Export all components for easy importing

// Main component
export { Costbook, default } from './Costbook'
// Costbook Roadmap: unified wireframe (3 phases, Financial Tracking columns, Distribution Settings)
export { CostbookRoadmap } from './CostbookRoadmap'

// Core components
export { CurrencySelector, CurrencyBadge } from './CurrencySelector'
export { KPIBadges, SingleKPI } from './KPIBadges'
export { ProjectCard, ProjectRow } from './ProjectCard'
export { ProjectsGrid, ViewModeToggle } from './ProjectsGrid'

// Visualization components
export { VarianceWaterfall } from './VarianceWaterfall'
export { HealthBubbleChart } from './HealthBubbleChart'
export { TrendSparkline, MiniSparkline } from './TrendSparkline'
export { VisualizationPanel, CompactVisualizationPanel } from './VisualizationPanel'

// Layout components
export { CostbookHeader, CompactCostbookHeader } from './CostbookHeader'
export { CostbookFooter, CompactCostbookFooter } from './CostbookFooter'
export { CollapsiblePanel, CollapsiblePanelGroup, ExpandableCard } from './CollapsiblePanel'
export { TransactionFilters } from './TransactionFilters'

// Error handling components
export { CostbookErrorBoundary } from './CostbookErrorBoundary'
export { ErrorDisplay } from './ErrorDisplay'
export { LoadingSpinner, Skeleton, CardSkeleton, InlineLoader } from './LoadingSpinner'

// AI/Search components (Phase 2)
export { NLSearchInput, CompactNLSearchInput } from './NLSearchInput'
export { SearchSuggestions, NoResults, SearchHelp } from './SearchSuggestions'
export { AnomalyIndicator, AnomalyBadge, AnomalySummaryBadge, ProjectAnomalyStatus } from './AnomalyIndicator'
export { AnomalyDetailDialog } from './AnomalyDetailDialog'
export { RecommendationsPanel, RecommendationsBadge } from './RecommendationsPanel'
export { RecommendationDetail } from './RecommendationDetail'
export { ScenarioSelector, createBaselineScenario, duplicateScenario } from './ScenarioSelector'
export { CashOutGantt } from './CashOutGantt'
export { EVMTrendChart, EVMIndicator, EVMSummaryCard } from './EVMTrendChart'
export { CommentIndicator, CommentCountBadge, CommentActivity } from './CommentIndicator'
export { CommentsPanel } from './CommentsPanel'
export { VendorScoreList } from './VendorScoreList'
export { VendorDetailView } from './VendorDetailView'
export { CostEstimateTimeline } from './CostEstimateTimeline'
export { SyncStatusIndicator, SyncBadge } from './SyncStatusIndicator'
export { RundownSparkline, RundownSparklineWithLabel, RundownSparklineSkeleton, RundownLegend } from './RundownSparkline'
export { ScenarioManager, ScenarioDropdown } from './ScenarioManager'
export { RefreshIndicator, RefreshBadge, RefreshSuccess, ConnectionIndicator } from './RefreshIndicator'

// New Phase 1 components
export { VirtualizedTransactionTable, VirtualizedTransactionTableSkeleton } from './VirtualizedTransactionTable'
export { HierarchyTreeView, HierarchyTreeViewSkeleton } from './HierarchyTreeView'
export { MobileAccordion, AccordionItem, MobileAccordionSkeleton } from './MobileAccordion'
export { CSVImportDialog } from './CSVImportDialog'
export { PerformanceDialog } from './PerformanceDialog'
export { HelpDialog } from './HelpDialog'

// Distribution Settings & Rules (Phase 2 & 3)
export { DistributionPreview } from './DistributionPreview'
// DistributionSettingsDialog and DistributionRulesPanel are used internally via stubs in Costbook;
// not re-exported here to avoid build failure when files are missing (e.g. in CI). Import from their paths if needed.

// Re-export types for convenience
export type { CurrencySelectorProps } from './CurrencySelector'
export type { KPIBadgesProps } from './KPIBadges'
export type { ProjectCardProps } from './ProjectCard'
export type { ProjectsGridProps } from './ProjectsGrid'
export type { VarianceWaterfallProps } from './VarianceWaterfall'
export type { HealthBubbleChartProps } from './HealthBubbleChart'
export type { TrendSparklineProps } from './TrendSparkline'
export type { VisualizationPanelProps } from './VisualizationPanel'
export type { CostbookHeaderProps } from './CostbookHeader'
export type { CostbookFooterProps } from './CostbookFooter'
export type { CollapsiblePanelProps } from './CollapsiblePanel'
export type { TransactionFiltersProps } from './TransactionFilters'
export type { CostbookErrorBoundaryProps } from './CostbookErrorBoundary'
export type { ErrorDisplayProps } from './ErrorDisplay'
export type { LoadingSpinnerProps } from './LoadingSpinner'
export type { CostbookProps } from './Costbook'
export type { NLSearchInputProps } from './NLSearchInput'
export type { SearchSuggestionsProps, NoResultsProps, SearchHelpProps } from './SearchSuggestions'
export type { AnomalyIndicatorProps } from './AnomalyIndicator'
export type { AnomalyDetailDialogProps } from './AnomalyDetailDialog'
export type { RecommendationsPanelProps, RecommendationsBadgeProps } from './RecommendationsPanel'
export type { RecommendationDetailProps } from './RecommendationDetail'
export type { ScenarioSelectorProps, ForecastScenario } from './ScenarioSelector'
export type { CashOutGanttProps, ForecastItem } from './CashOutGantt'
export type { EVMTrendChartProps, EVMIndicatorProps, EVMSummaryCardProps } from './EVMTrendChart'
export type { CommentIndicatorProps, CommentCountBadgeProps, CommentActivityProps } from './CommentIndicator'
export type { CommentsPanelProps } from './CommentsPanel'
export type { VendorScoreListProps } from './VendorScoreList'
export type { VendorDetailViewProps } from './VendorDetailView'
export type { CostEstimateTimelineProps } from './CostEstimateTimeline'
export type { SyncStatusIndicatorProps, SyncBadgeProps } from './SyncStatusIndicator'
export type { RundownSparklineProps, RundownSparklineWithLabelProps } from './RundownSparkline'
export type { ScenarioManagerProps, ScenarioDropdownProps } from './ScenarioManager'
export type { RefreshIndicatorProps, RefreshBadgeProps, RefreshSuccessProps, ConnectionIndicatorProps } from './RefreshIndicator'

// New Phase 1 component types
export type { VirtualizedTransactionTableProps, TransactionColumn } from './VirtualizedTransactionTable'
export type { HierarchyTreeViewProps, ViewType } from './HierarchyTreeView'
export type { MobileAccordionProps, AccordionSection, AccordionItemProps } from './MobileAccordion'
export type { CSVImportDialogProps, ImportType } from './CSVImportDialog'
export type { PerformanceDialogProps, PerformanceMetrics } from './PerformanceDialog'
export type { HelpDialogProps } from './HelpDialog'

// Distribution Settings & Rules types (Phase 2 & 3)
export type { DistributionPreviewProps } from './DistributionPreview'