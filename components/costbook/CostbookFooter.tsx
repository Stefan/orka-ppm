'use client'

import React from 'react'
import { 
  Layers, 
  Users, 
  FileText, 
  FileSpreadsheet, 
  TrendingUp, 
  Award,
  Settings,
  Calendar,
  Download
} from 'lucide-react'

export interface CostbookFooterProps {
  /** Handler for Scenarios button */
  onScenarios?: () => void
  /** Handler for Resources button */
  onResources?: () => void
  /** Handler for Reports button */
  onReports?: () => void
  /** Handler for PO Breakdown button */
  onPOBreakdown?: () => void
  /** Handler for Forecast button */
  onForecast?: () => void
  /** Handler for Vendor Score button */
  onVendorScore?: () => void
  /** Handler for Settings button */
  onSettings?: () => void
  /** Handler for Export button */
  onExport?: () => void
  /** Current phase for feature flags */
  currentPhase?: number
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

interface FooterButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
  testId?: string
}

/**
 * Footer action button with tooltip
 */
function FooterButton({
  icon,
  label,
  onClick,
  disabled = false,
  disabledReason,
  testId
}: FooterButtonProps) {
  const tooltipText = disabled ? disabledReason || `${label} (Coming Soon)` : label

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltipText}
      aria-label={label}
      data-testid={testId}
      className={`
        flex flex-row items-center gap-1
        px-2 py-1
        rounded-md
        transition-all
        ${disabled 
          ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed' 
          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
        }
      `}
    >
      <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
    </button>
  )
}

/**
 * Divider between button groups
 */
function FooterDivider() {
  return <div className="h-4 w-px bg-gray-200 dark:bg-slate-600 mx-0.5" />
}

/**
 * CostbookFooter component for Costbook
 * Contains 8 action buttons with tooltips
 * Phase 2/3 features are disabled
 */
export function CostbookFooter({
  onScenarios,
  onResources,
  onReports,
  onPOBreakdown,
  onForecast,
  onVendorScore,
  onSettings,
  onExport,
  currentPhase = 1,
  className = '',
  'data-testid': testId = 'costbook-footer'
}: CostbookFooterProps) {
  // Phase 2 features
  const phase2Features = ['scenarios', 'forecast']
  // Phase 3 features
  const phase3Features = ['vendorScore']

  const isDisabled = (feature: string) => {
    if (phase2Features.includes(feature) && currentPhase < 2) return true
    if (phase3Features.includes(feature) && currentPhase < 3) return true
    return false
  }

  return (
    <footer 
      className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-1 ${className}`}
      data-testid={testId}
    >
      <div className="flex items-center justify-center gap-0.5 flex-wrap">
        {/* Primary Actions Group */}
        <FooterButton
          icon={<FileText className="w-5 h-5" />}
          label="Reports"
          onClick={onReports}
          testId={`${testId}-reports`}
        />
        
        <FooterButton
          icon={<FileSpreadsheet className="w-5 h-5" />}
          label="PO Breakdown"
          onClick={onPOBreakdown}
          testId={`${testId}-po-breakdown`}
        />

        <FooterButton
          icon={<Download className="w-5 h-5" />}
          label="Export"
          onClick={onExport}
          testId={`${testId}-export`}
        />

        <FooterDivider />

        {/* Planning Group */}
        <FooterButton
          icon={<Layers className="w-5 h-5" />}
          label="Scenarios"
          onClick={onScenarios}
          disabled={isDisabled('scenarios')}
          disabledReason="Scenarios (Phase 2)"
          testId={`${testId}-scenarios`}
        />
        
        <FooterButton
          icon={<TrendingUp className="w-5 h-5" />}
          label="Forecast"
          onClick={onForecast}
          disabled={isDisabled('forecast')}
          disabledReason="Forecast (Phase 2)"
          testId={`${testId}-forecast`}
        />

        <FooterButton
          icon={<Users className="w-5 h-5" />}
          label="Resources"
          onClick={onResources}
          testId={`${testId}-resources`}
        />

        <FooterDivider />

        {/* Analysis Group */}
        <FooterButton
          icon={<Award className="w-5 h-5" />}
          label="Vendor Score"
          onClick={onVendorScore}
          disabled={isDisabled('vendorScore')}
          disabledReason="Vendor Score (Phase 3)"
          testId={`${testId}-vendor-score`}
        />
        
        <FooterButton
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          onClick={onSettings}
          testId={`${testId}-settings`}
        />
      </div>
    </footer>
  )
}

/**
 * Compact footer for mobile with fewer buttons
 */
export function CompactCostbookFooter({
  onReports,
  onExport,
  onSettings,
  className = ''
}: {
  onReports?: () => void
  onExport?: () => void
  onSettings?: () => void
  className?: string
}) {
  return (
    <footer className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-2 ${className}`}>
      <div className="flex items-center justify-around">
        <FooterButton
          icon={<FileText className="w-5 h-5" />}
          label="Reports"
          onClick={onReports}
        />

        <FooterButton
          icon={<Download className="w-5 h-5" />}
          label="Export"
          onClick={onExport}
        />
        
        <FooterButton
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          onClick={onSettings}
        />
      </div>
    </footer>
  )
}

export default CostbookFooter