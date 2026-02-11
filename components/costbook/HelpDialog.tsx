'use client'

import React, { useState } from 'react'
import {
  X,
  HelpCircle,
  BookOpen,
  Calculator,
  BarChart3,
  Keyboard,
  Search,
  Upload,
  Download,
  Filter,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'

export interface HelpDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Handler to close the dialog */
  onClose: () => void
  /** Initial section to show */
  initialSection?: HelpSection
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

type HelpSection = 'overview' | 'kpi' | 'charts' | 'keyboard' | 'import' | 'search'

interface SectionContent {
  icon: React.ElementType
  title: string
  content: React.ReactNode
}

/**
 * HelpDialog component with documentation for Costbook features
 * Includes KPI meanings, chart interpretations, and keyboard shortcuts
 */
export function HelpDialog({
  isOpen,
  onClose,
  initialSection = 'overview',
  className = '',
  'data-testid': testId = 'help-dialog'
}: HelpDialogProps) {
  const [activeSection, setActiveSection] = useState<HelpSection>(initialSection)

  // Section content
  const sections: Record<HelpSection, SectionContent> = {
    overview: {
      icon: BookOpen,
      title: 'Overview',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            The Costbook provides a comprehensive view of your project&apos;s financial health,
            including commitments, actuals, variances, and forecasts.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
              <Info className="w-4 h-4" />
              Quick Start
            </h4>
            <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-400 space-y-2">
              <li>Review the KPI badges at the top for a summary of your portfolio health</li>
              <li>Click on project cards to see detailed financial breakdowns</li>
              <li>Use the currency selector to view amounts in different currencies</li>
              <li>Hover over charts for detailed tooltips</li>
              <li>Use filters to focus on specific projects or time periods</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-500 dark:text-green-400" />
                Commitments
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Purchase orders and contracts that represent planned spending.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Actuals
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Invoices and payments that represent actual spending.
              </p>
            </div>
          </div>
        </div>
      )
    },
    kpi: {
      icon: Calculator,
      title: 'KPI Definitions',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Key Performance Indicators (KPIs) provide a quick snapshot of your portfolio&apos;s financial status.
          </p>
          
          <div className="space-y-3">
            {[
              {
                name: 'Total Budget',
                description: 'Sum of approved budgets for all projects',
                formula: 'Σ Project Budgets'
              },
              {
                name: 'Commitments',
                description: 'Total value of all purchase orders and contracts',
                formula: 'Σ PO Amounts'
              },
              {
                name: 'Actuals',
                description: 'Total value of all invoices and payments',
                formula: 'Σ Invoice Amounts'
              },
              {
                name: 'Total Spend',
                description: 'Combined value of commitments and actuals',
                formula: 'Commitments + Actuals'
              },
              {
                name: 'Net Variance',
                description: 'Difference between budget and total spend',
                formula: 'Budget - Total Spend',
                note: 'Positive = Under budget (good), Negative = Over budget (bad)'
              },
              {
                name: 'Over Budget Count',
                description: 'Number of projects exceeding their budget',
                icon: AlertTriangle,
                iconColor: 'text-red-500 dark:text-red-400'
              },
              {
                name: 'Under Budget Count',
                description: 'Number of projects under their budget',
                icon: CheckCircle,
                iconColor: 'text-green-500 dark:text-green-400'
              }
            ].map((kpi, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {kpi.icon && <kpi.icon className={`w-4 h-4 ${kpi.iconColor || ''}`} />}
                      {kpi.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {kpi.description}
                    </p>
                    {kpi.note && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                        {kpi.note}
                      </p>
                    )}
                  </div>
                  {kpi.formula && (
                    <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                      {kpi.formula}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    charts: {
      icon: BarChart3,
      title: 'Chart Guide',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            The visualization panel provides multiple views of your financial data.
          </p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Variance Waterfall
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Shows how budget flows through commitments and actuals to the final variance.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                <li><span className="text-blue-500 dark:text-blue-400">Blue</span> - Starting budget</li>
                <li><span className="text-orange-500">Orange</span> - Commitments (decreases available budget)</li>
                <li><span className="text-red-500 dark:text-red-400">Red</span> - Actuals (decreases available budget)</li>
                <li><span className="text-green-500 dark:text-green-400">Green</span>/<span className="text-red-500 dark:text-red-400">Red</span> - Final variance (under/over budget)</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                Health Bubble Chart
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Plots projects by variance and health score.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                <li><strong>X-axis:</strong> Variance (positive = under budget)</li>
                <li><strong>Y-axis:</strong> Health score (0-100)</li>
                <li><strong>Bubble size:</strong> Total spend</li>
                <li><strong>Color:</strong> Project status</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-green-500 dark:text-green-400" />
                Trend Sparkline
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Shows cumulative spending over time. Use this to identify spending patterns
                and predict future budget utilization.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                CES Tree
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cost Element Structure view groups spending by project → cost category → vendor (so vendors are grouped per project and category, not in one flat list).
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4 text-purple-500" />
                WBS Tree
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Work Breakdown Structure view groups spending by project phase and work package.
              </p>
            </div>
          </div>
        </div>
      )
    },
    keyboard: {
      icon: Keyboard,
      title: 'Keyboard Shortcuts',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Use these keyboard shortcuts to navigate the Costbook more efficiently.
          </p>
          
          <div className="space-y-2">
            {[
              { keys: ['/', 'Cmd+K'], description: 'Focus search input' },
              { keys: ['R'], description: 'Refresh data' },
              { keys: ['C'], description: 'Toggle currency selector' },
              { keys: ['F'], description: 'Toggle filters panel' },
              { keys: ['1'], description: 'Show overview tab' },
              { keys: ['2'], description: 'Show transactions tab' },
              { keys: ['3'], description: 'Show hierarchy tab' },
              { keys: ['Esc'], description: 'Close dialogs/panels' },
              { keys: ['↑', '↓'], description: 'Navigate project list' },
              { keys: ['Enter'], description: 'Select/expand item' },
              { keys: ['?'], description: 'Show this help dialog' }
            ].map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span className="text-gray-400 dark:text-slate-500 text-xs">or</span>}
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    import: {
      icon: Upload,
      title: 'Import/Export',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Import commitments and actuals from CSV files, or export your data.
          </p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Importing Data
              </h4>
              <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-2">
                <li>Click the &quot;CSV Import&quot; button in the footer</li>
                <li>Select import type (Commitments or Actuals)</li>
                <li>Drag and drop your CSV file or click to browse</li>
                <li>Review the preview and any validation errors</li>
                <li>Click &quot;Import&quot; to add records</li>
              </ol>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-green-500 dark:text-green-400" />
                Required CSV Columns
              </h4>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Commitments</h5>
                  <code className="text-xs block bg-gray-200 dark:bg-gray-700 p-2 rounded font-mono">
                    po_number, project_id, vendor_id,<br/>
                    vendor_name, description, amount,<br/>
                    currency, status, issue_date
                  </code>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Actuals</h5>
                  <code className="text-xs block bg-gray-200 dark:bg-gray-700 p-2 rounded font-mono">
                    project_id, vendor_id, vendor_name,<br/>
                    description, amount, currency,<br/>
                    status, invoice_date
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Download a template CSV from the import dialog to ensure correct formatting.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    search: {
      icon: Search,
      title: 'Search & Filter',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Use natural language search and filters to find specific data quickly.
          </p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Natural Language Search
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Type queries in plain English to find what you need:
              </p>
              <div className="space-y-2">
                {[
                  'projects over budget',
                  'high variance projects',
                  'vendor ABC transactions',
                  'commitments above 50000',
                  'actuals last month'
                ].map((example, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <code className="text-sm text-gray-700 dark:text-gray-300">&quot;{example}&quot;</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-purple-500" />
                Filter Options
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                <li><strong>Project:</strong> Filter by specific project</li>
                <li><strong>Vendor:</strong> Filter by vendor name</li>
                <li><strong>Type:</strong> Show only commitments or actuals</li>
                <li><strong>Status:</strong> Filter by transaction status</li>
                <li><strong>Date Range:</strong> Filter by date period</li>
                <li><strong>Amount:</strong> Filter by amount range</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  }

  if (!isOpen) return null

  const CurrentIcon = sections[activeSection].icon

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid={testId}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex ${className}`}>
        {/* Sidebar */}
        <div className="w-48 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">Help</span>
            </div>
          </div>
          <nav className="p-2">
            {(Object.keys(sections) as HelpSection[]).map(key => {
              const Icon = sections[key].icon
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeSection === key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {sections[key].title}
                </button>
              )
            })}
          </nav>
          
          {/* External links */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <a 
              href="#" 
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ExternalLink className="w-4 h-4" />
              Full Documentation
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <CurrentIcon className="w-6 h-6 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {sections[activeSection].title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {sections[activeSection].content}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpDialog
