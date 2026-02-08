/**
 * Help Chat Context API Endpoint (Copilot-Chat-Integration, Phase 3)
 * Provides contextual help based on current page, pathname, and optional entity.
 * Body: { context?: string, pathname?: string, entityType?: string, entityId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { context, pathname, entityType, entityId } = body
    const path = pathname || context || '/'
    
    // Contextual help keyed by path (pathname or legacy context)
    const contextualHelp: Record<string, { title: string; description: string; quickActions: Array<{ label: string; action: string }>; tips: string[] }> = {
      '/dashboards': {
        title: 'Dashboard Help',
        description: 'Your project portfolio dashboard provides real-time insights.',
        quickActions: [
          { label: 'Switch to AI View', action: 'toggle_ai_dashboard' },
          { label: 'Refresh Data', action: 'refresh_dashboard' },
          { label: 'Export Report', action: 'export_dashboard' }
        ],
        tips: [
          'Use the AI-enhanced view for predictive insights',
          'Check variance alerts for budget optimization',
          'Your preferences sync across all devices'
        ]
      },
      '/projects': {
        title: 'Projects Help',
        description: 'Manage and monitor your project portfolio.',
        quickActions: [
          { label: 'Create Project', action: 'create_project' },
          { label: 'View Reports', action: 'view_reports' },
          { label: 'Manage Resources', action: 'manage_resources' }
        ],
        tips: [
          'Use health indicators to prioritize attention',
          'Set up automated alerts for critical issues',
          'Leverage AI insights for resource optimization'
        ]
      },
      '/audit': {
        title: 'Audit & Compliance Help',
        description: 'Audit logs, anomaly detection, and semantic search.',
        quickActions: [
          { label: 'View Anomalies', action: 'open_anomalies_tab' },
          { label: 'Semantic Search', action: 'open_search_tab' },
          { label: 'Export Report', action: 'export_audit' }
        ],
        tips: [
          'Use the Anomalies tab to review AI-flagged events',
          'Semantic search finds events by meaning, not just keywords',
          'Proactive toasts suggest reviewing anomalies when detected'
        ]
      },
      '/financials': {
        title: 'Financials Help',
        description: 'Commitments, actuals, and variance tracking.',
        quickActions: [
          { label: 'Saved Views', action: 'saved_views' },
          { label: 'CSV Import', action: 'csv_import' },
          { label: 'Variance Alerts', action: 'variance_alerts' }
        ],
        tips: [
          'Save filter/sort as a view for quick access',
          'Use mapping suggestions when importing CSV',
          'Check variance alerts for budget deviations'
        ]
      }
    }
    
    const helpData = contextualHelp[path as keyof typeof contextualHelp] || {
      title: 'General Help',
      description: 'Welcome to the PPM platform. How can I assist you?',
      quickActions: [
        { label: 'View Dashboard', action: 'navigate_dashboard' },
        { label: 'Browse Projects', action: 'navigate_projects' },
        { label: 'Get Started Guide', action: 'open_guide' }
      ],
      tips: [
        'Use the search function to find specific features',
        'Check the help icon for contextual assistance',
        'Your data is automatically saved and synced'
      ]
    }
    
    return NextResponse.json({
      context: path,
      pathname: path,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      help: helpData,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat context error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get contextual help',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}