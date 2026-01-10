/**
 * Help Chat Context API Endpoint
 * Provides contextual help based on current page/state
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { context } = body
    
    // Mock contextual help based on current context
    const contextualHelp = {
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
      }
    }
    
    const helpData = contextualHelp[context as keyof typeof contextualHelp] || {
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
      context,
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